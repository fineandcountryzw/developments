import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { requireAdminOrAccountant } from '@/lib/access-control';
import { validateRequest } from '@/lib/validation/middleware';
import { paymentSchema } from '@/lib/validation/schemas';
import { SettlementCalculator } from '@/lib/settlement-calculator';
import { handlePaymentSuccess } from '@/lib/payment-success-handler';
import { broadcastPaymentUpdate } from '@/lib/realtime';
import { sendEmail } from '@/lib/email-service';
import { BillingAllocationService } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/payments
 * Get payments list with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Only filter by branch if explicitly provided
    if (branch) {
      where.officeLocation = branch;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return apiSuccess({
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    logger.error('ACCOUNT_PAYMENTS Error', error, { module: 'API', action: 'GET_ACCOUNT_PAYMENTS' });
    return apiError('Failed to fetch payments', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/account/payments
 * Record a new payment (mirrors Admin logic)
 * Requires ADMIN or ACCOUNTANT role with rate limiting
 */
export async function POST(request: NextRequest) {
  try {
    logger.debug('POST /api/account/payments called', { module: 'API' });

    // Use requireAdminOrAccountant with rate limiting (20 req/min)
    const authResult = await requireAdminOrAccountant(request, { limit: 20, windowMs: 60000 });
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(request, paymentSchema, {
      module: 'API',
      action: 'POST_ACCOUNT_PAYMENTS'
    });
    if (!validation.success) {
      return validation.error;
    }
    const data = validation.data;

    // Validation: If standId provided, verify it exists in database
    let developmentId: string | null = null;
    if (data.standId) {
      const stand = await prisma.stand.findUnique({
        where: { id: data.standId },
        include: { development: true }
      });

      if (!stand) {
        return apiError(`Stand with ID ${data.standId} not found in database`, 404, ErrorCodes.STAND_NOT_FOUND);
      }

      developmentId = stand.developmentId;

      logger.debug('Stand validation passed', {
        module: 'API',
        standId: data.standId,
        standNumber: stand.standNumber,
        currentStatus: stand.status,
        developmentId
      });
    }

    // Calculate fee breakdown for accurate settlement
    const paymentAmount = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount));
    const feeData = await SettlementCalculator.calculatePaymentFees(
      paymentAmount,
      data.standId || null,
      developmentId,
      data.paymentType || 'Deposit'
    );

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        clientId: data.clientId || 'STAND-ONLY',
        clientName: data.clientName || 'Unknown',
        amount: paymentAmount,
        surchargeAmount: data.surchargeAmount ? (typeof data.surchargeAmount === 'number' ? data.surchargeAmount : parseFloat(String(data.surchargeAmount))) : 0,
        standId: data.standId || null,
        description: data.description || `${data.paymentType} payment`,
        status: data.status || 'PENDING',
        method: data.paymentMethod || 'Cash',
        paymentType: data.paymentType,
        officeLocation: data.officeLocation,
        reference: data.reference,
        receivedByName: data.receivedByName,
        manualReceiptNo: data.manualReceiptNo,
        verificationStatus: data.verificationStatus || 'Pending',
        confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : null,
        // Store fee breakdown
        standPricePortion: feeData.standPricePortion,
        vatAmount: feeData.vatAmount,
        cessionAmount: feeData.cessionAmount,
        endowmentAmount: feeData.endowmentAmount,
        aosAmount: feeData.aosAmount,
        feeCalculation: feeData.feeCalculation,
        developmentId: feeData.developmentId,
        settlementStatus: 'PENDING'
      },
      include: {
        client: true,
        stand: {
          include: {
            development: true
          }
        }
      }
    });

    // Business Rule: Deposit payments must set stand to SOLD, not RESERVED
    if (payment.standId && data.clientId && data.clientId !== 'STAND-ONLY') {
      const isDepositPayment = data.paymentType?.toLowerCase() === 'deposit';

      const stand = await prisma.stand.findUnique({
        where: { id: payment.standId }
      });

      if (stand) {
        if (isDepositPayment) {
          // Deposit paid = SOLD (business rule)
          await prisma.stand.update({
            where: { id: payment.standId },
            data: {
              status: 'SOLD',
              reservedBy: data.clientId
            }
          });

          logger.info('Stand marked as SOLD (deposit paid)', {
            module: 'API',
            standId: payment.standId,
            clientId: data.clientId,
            paymentId: payment.id,
            paymentType: data.paymentType
          });

          // Sync with InstallmentPlan
          try {
            const existingPlan = await prisma.installmentPlan.findFirst({
              where: {
                standId: payment.standId,
                clientId: data.clientId,
                depositPaid: false,
                status: { in: ['ACTIVE', 'PENDING'] }
              }
            });

            if (existingPlan) {
              const depositAmount = Number(payment.amount);
              const planDepositAmount = Number(existingPlan.depositAmount);
              const amountDifference = Math.abs(depositAmount - planDepositAmount);
              const tolerance = 0.01;

              if (amountDifference <= tolerance) {
                const firstInstallment = await prisma.installment.findFirst({
                  where: { planId: existingPlan.id },
                  orderBy: { installmentNo: 'asc' }
                });

                await prisma.installmentPlan.update({
                  where: { id: existingPlan.id },
                  data: {
                    depositPaid: true,
                    totalPaid: { increment: planDepositAmount },
                    remainingBalance: { decrement: planDepositAmount },
                    nextDueDate: firstInstallment?.dueDate || null
                  }
                });

                logger.info('Deposit payment synced with InstallmentPlan', {
                  module: 'API',
                  planId: existingPlan.id,
                  paymentId: payment.id,
                  depositAmount: planDepositAmount
                });
              } else {
                logger.warn('Deposit amount mismatch - payment not synced', {
                  module: 'API',
                  planId: existingPlan.id,
                  paymentAmount: depositAmount,
                  planDepositAmount: planDepositAmount,
                  difference: amountDifference
                });
              }
            }
          } catch (syncError) {
            logger.error('Error syncing deposit payment with InstallmentPlan', syncError instanceof Error ? syncError : undefined, { module: 'API' });
          }
        } else if (stand.status === 'AVAILABLE') {
          // Non-deposit payment: only set to RESERVED if currently AVAILABLE
          await prisma.stand.update({
            where: { id: payment.standId },
            data: {
              status: 'RESERVED',
              reservedBy: data.clientId
            }
          });

          logger.info('Stand marked as RESERVED', {
            module: 'API',
            standId: payment.standId,
            clientId: data.clientId,
            paymentId: payment.id,
            paymentType: data.paymentType
          });
        } else {
          logger.debug('Stand status not changed (not AVAILABLE)', {
            module: 'API',
            standId: payment.standId,
            currentStatus: stand.status,
            paymentType: data.paymentType
          });
        }
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP: Auto-allocate payment to installment plan (Billing module)
    // ───────────────────────────────────────────────────────────────────────
    if (data.clientId && data.clientId !== 'STAND-ONLY' && data.standId) {
      try {
        // Find active installment plan for this client/stand
        const installmentPlan = await prisma.installmentPlan.findFirst({
          where: {
            clientId: data.clientId,
            standId: data.standId,
            status: { in: ['ACTIVE', 'PENDING'] }
          }
        });

        if (installmentPlan) {
          const allocationResult = await BillingAllocationService.autoAllocatePayment(
            payment.id,
            user?.id
          );

          if (allocationResult.success) {
            logger.info('Payment auto-allocated to installment plan', {
              module: 'BILLING',
              paymentId: payment.id,
              planId: installmentPlan.id,
              allocationsCreated: allocationResult.allocations?.length || 0,
              remaining: allocationResult.remainingAmount
            });
          } else {
            logger.warn('Auto-allocation skipped or partial', {
              module: 'BILLING',
              paymentId: payment.id,
              planId: installmentPlan.id,
              reason: allocationResult.error
            });
          }
        }
      } catch (allocError) {
        // Log but don't fail payment - allocation can be done manually
        logger.error('Auto-allocation failed', allocError instanceof Error ? allocError : undefined, {
          module: 'BILLING',
          paymentId: payment.id
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: data.officeLocation,
        userId: user.id,
        action: 'CREATE',
        module: 'PAYMENTS',
        recordId: payment.id,
        description: `Payment recorded by Accountant: ${payment.clientName} - $${payment.amount} - ${data.paymentType}`,
        changes: JSON.stringify(payment)
      }
    });

    logger.info('Payment created by Accountant', {
      module: 'API',
      id: payment.id,
      amount: payment.amount,
      type: data.paymentType,
      branch: payment.officeLocation,
      status: payment.status,
      recordedBy: user.id
    });

    // Handle payment success if status is CONFIRMED
    if (payment.status === 'CONFIRMED' && payment.standId && payment.clientId && payment.clientId !== 'STAND-ONLY') {
      logger.info('[ACCOUNT_PAYMENT_API] Payment created as CONFIRMED, triggering success handler', {
        module: 'API',
        paymentId: payment.id
      });

      handlePaymentSuccess(payment.id).then(result => {
        if (result.success) {
          logger.info('[ACCOUNT_PAYMENT_API] Payment success handler completed', {
            module: 'API',
            paymentId: payment.id,
            contractCreated: result.contractCreated,
            emailSent: result.emailSent
          });
        } else {
          logger.error('[ACCOUNT_PAYMENT_API] Payment success handler failed', {
            module: 'API',
            paymentId: payment.id,
            error: result.error
          });
        }
      }).catch(err => {
        logger.error('[ACCOUNT_PAYMENT_API] Payment success handler error', err, {
          module: 'API',
          paymentId: payment.id
        });
      });
    }

    // Broadcast real-time update
    try {
      broadcastPaymentUpdate('created', payment, {
        branch: payment.officeLocation
      });
    } catch (err) {
      logger.error('Failed to broadcast payment update', err instanceof Error ? err : new Error(String(err)), { module: 'API' });
    }

    // Send payment confirmation email if client has email
    if (payment.client?.email) {
      try {
        const standInfo = payment.standId ? ` for Stand ${payment.standId}` : '';
        const emailSubject = `Payment Confirmation - $${payment.amount.toLocaleString()}`;
        const emailHTML = `
          <h2>Payment Recorded Successfully</h2>
          <p>Dear ${payment.clientName},</p>
          <p>Your payment has been recorded in our system.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <h3>Payment Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">$${payment.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Type:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${payment.paymentType}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Method:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${payment.method}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reference:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${payment.reference}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Receipt #:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${data.manualReceiptNo}</td>
            </tr>
            ${payment.standId ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Stand:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${payment.standId}</td>
            </tr>
            ` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>Your payment is now being processed. You will receive further updates as it progresses.</p>
          <p>If you have any questions, please contact our office.</p>
          <p>Best regards,<br/>Fine & Country Zimbabwe</p>
        `;

        await sendEmail({
          to: payment.client.email,
          subject: emailSubject,
          html: emailHTML
        });

        logger.info('Payment confirmation email sent', {
          module: 'API',
          to: payment.client.email,
          paymentId: payment.id,
          reference: payment.reference
        });

        // Log email in activity
        await prisma.activityLog.create({
          data: {
            branch: data.officeLocation,
            userId: user.id,
            action: 'EMAIL',
            module: 'PAYMENTS',
            recordId: payment.id,
            description: `Payment confirmation email sent to ${payment.client.email}`,
            changes: JSON.stringify({ paymentId: payment.id, recipientEmail: payment.client.email })
          }
        });
      } catch (emailError) {
        logger.error('Failed to send payment confirmation email', emailError instanceof Error ? emailError : undefined, {
          module: 'API',
          paymentId: payment.id,
          clientEmail: payment.client?.email
        });
        // Don't fail the API request if email fails
      }
    }

    return apiSuccess(payment, 201);
  } catch (error: any) {
    logger.error('Payment creation error', error, { module: 'API' });

    if (error?.code === 'P2002') {
      return apiError('Payment reference already exists', 409, ErrorCodes.DUPLICATE_KEY);
    }

    return apiError(error?.message || 'Unknown error', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * PUT /api/account/payments
 * Update payment status (PENDING → CONFIRMED)
 * Requires ADMIN or ACCOUNTANT role
 */
export async function PUT(request: NextRequest) {
  try {
    logger.debug('PUT /api/account/payments called', { module: 'API' });

    // Use requireAdminOrAccountant
    const authResult = await requireAdminOrAccountant(request, { limit: 20, windowMs: 60000 });
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { paymentId, status, notes } = body;

    if (!paymentId) {
      return apiError('Payment ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!status || !['PENDING', 'CONFIRMED', 'FAILED'].includes(status)) {
      return apiError('Valid status is required (PENDING, CONFIRMED, FAILED)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get existing payment
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      return apiError('Payment not found', 404, ErrorCodes.NOT_FOUND);
    }

    // RBAC: Check branch access for ACCOUNT role
    if (user.role === 'ACCOUNT') {
      const userBranch = user.branch || 'Harare';
      if (existingPayment.officeLocation !== userBranch && existingPayment.officeLocation !== 'all') {
        return apiError('Access denied: Payment not in your branch', 403, ErrorCodes.ACCESS_DENIED);
      }
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        verificationStatus: status === 'CONFIRMED' ? 'Verified' : existingPayment.verificationStatus,
        confirmedAt: status === 'CONFIRMED' ? new Date() : existingPayment.confirmedAt,
        updatedAt: new Date(),
      },
    });

    // If payment confirmed, trigger payment success handler
    if (status === 'CONFIRMED' && existingPayment.status !== 'CONFIRMED') {
      await handlePaymentSuccess(updatedPayment.id);

      // Broadcast realtime update
      broadcastPaymentUpdate('updated', updatedPayment);
    }

    logger.info(`Payment status updated: ${paymentId} → ${status}`, {
      module: 'API',
      paymentId,
      oldStatus: existingPayment.status,
      newStatus: status,
      updatedBy: user.id,
    });

    return apiSuccess(updatedPayment);
  } catch (error: any) {
    logger.error('Payment update error', error, { module: 'API' });
    return apiError(error?.message || 'Failed to update payment', 500, ErrorCodes.UPDATE_ERROR);
  }
}
