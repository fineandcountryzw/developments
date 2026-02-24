import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAgent, getAuthenticatedUser } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateRequest } from '@/lib/validation/middleware';
import { paymentSchema } from '@/lib/validation/schemas';
import { broadcastPaymentUpdate } from '@/lib/realtime';
import { handlePaymentSuccess } from '@/lib/payment-success-handler';
import { SettlementCalculator } from '@/lib/settlement-calculator';
import { BillingAllocationService } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    logger.debug('GET /api/admin/payments called', { module: 'API' });

    // Use new unified auth - allow agents to view payments
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Query parameters
    const branch = request.nextUrl.searchParams.get('branch');
    const status = request.nextUrl.searchParams.get('status');
    const clientId = request.nextUrl.searchParams.get('clientId');
    const developmentId = request.nextUrl.searchParams.get('developmentId');

    // Build where clause
    interface PaymentWhere {
      officeLocation?: string;
      status?: string;
      clientId?: string;
      stand?: {
        developmentId?: string;
      };
    }
    const where: PaymentWhere = {};
    if (branch) {
      where.officeLocation = branch;
    }
    if (status) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        stand: {
          select: {
            id: true,
            standNumber: true,
            status: true,
            price: true,
            development: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          }
        }
      }
    });

    // Enrich payments with stand information
    const enrichedPayments = payments.map((p: any) => ({
      ...p,
      standNumber: p.stand?.standNumber || p.standId || null
    }));

    logger.info('Fetched payments from Neon', {
      module: 'API',
      count: enrichedPayments.length,
      filter: { branch: branch || 'ALL', status: status || 'ALL', developmentId: developmentId || 'ALL' }
    });

    return apiSuccess(enrichedPayments);
  } catch (error: any) {
    try { logger.error('Payment fetch error', error, { module: 'API' }); } catch { /* ignore */ }
    try {
      return apiError(error?.message || 'Unknown error', 500, ErrorCodes.FETCH_ERROR);
    } catch {
      return apiError('Failed to fetch payments', 500, ErrorCodes.FETCH_ERROR);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.debug('POST /api/admin/payments called', { module: 'API' });

    // Use new unified auth - require admin for creating payments with rate limiting
    const authResult = await requireAdmin(request, { limit: 20, windowMs: 60000 }); // 20 requests per minute
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(request, paymentSchema, {
      module: 'API',
      action: 'POST_PAYMENTS'
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
    // RESERVED is only for temporary holds without deposit payment
    if (payment.standId && data.clientId && data.clientId !== 'STAND-ONLY') {
      // Check if this is a deposit payment
      const isDepositPayment = data.paymentType?.toLowerCase() === 'deposit';

      // If deposit paid, stand must be SOLD (mutually exclusive with RESERVED)
      // If not deposit, only set to RESERVED if stand is currently AVAILABLE
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

          // Sync with InstallmentPlan: Check if deposit payment should update an existing plan
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
              const tolerance = 0.01; // Allow $0.01 difference for rounding

              // If payment amount matches plan deposit amount (within tolerance), sync the plan
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
            // Log but don't fail payment creation if sync fails
            logger.error('Error syncing deposit payment with InstallmentPlan', syncError instanceof Error ? syncError : undefined, { module: 'API' });
          }
        } else if (stand.status === 'AVAILABLE') {
          // Non-deposit payment: only set to RESERVED if currently AVAILABLE
          // Do not override SOLD status
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
          const authUser = await getAuthenticatedUser();
          const allocationResult = await BillingAllocationService.autoAllocatePayment(
            payment.id,
            authUser?.id
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
        userId: null,
        action: 'CREATE',
        module: 'PAYMENTS',
        recordId: payment.id,
        description: `Payment recorded: ${payment.clientName} - $${payment.amount} - ${data.paymentType}`,
        changes: JSON.stringify(payment)
      }
    });

    logger.info('Payment created in Neon', {
      module: 'API',
      id: payment.id,
      amount: payment.amount,
      type: data.paymentType,
      branch: payment.officeLocation,
      status: payment.status
    });

    // ───────────────────────────────────────────────────────────────────────
    // STEP: Handle payment success if status is CONFIRMED
    // ───────────────────────────────────────────────────────────────────────

    if (payment.status === 'CONFIRMED' && payment.standId && payment.clientId && payment.clientId !== 'STAND-ONLY') {
      logger.info('[PAYMENT_API] Payment created as CONFIRMED, triggering success handler', {
        module: 'API',
        paymentId: payment.id
      });

      // Handle payment success asynchronously (don't block response)
      handlePaymentSuccess(payment.id).then(result => {
        if (result.success) {
          logger.info('[PAYMENT_API] Payment success handler completed', {
            module: 'API',
            paymentId: payment.id,
            contractCreated: result.contractCreated,
            emailSent: result.emailSent
          });
        } else {
          logger.error('[PAYMENT_API] Payment success handler failed', {
            module: 'API',
            paymentId: payment.id,
            error: result.error
          });
        }
      }).catch(err => {
        logger.error('[PAYMENT_API] Payment success handler error', err, {
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
            userId: null,
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

export async function PUT(request: NextRequest) {
  try {
    logger.debug('PUT /api/admin/payments called', { module: 'API' });

    // Use new unified auth - require admin for updating payments with rate limiting
    const authResult = await requireAdmin(request, { limit: 20, windowMs: 60000 }); // 20 requests per minute
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id, ...updateData } = await request.json();

    // Get current payment to check status transition
    const currentPayment = await prisma.payment.findUnique({
      where: { id },
      select: { status: true, standId: true, clientId: true }
    });

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        client: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: payment.officeLocation,
        userId: null,
        action: 'UPDATE',
        module: 'PAYMENTS',
        recordId: payment.id,
        description: `Payment updated: ${payment.clientName} - ${payment.reference}`,
        changes: JSON.stringify(updateData)
      }
    });

    logger.info('Payment updated in Neon', {
      module: 'API',
      id: payment.id,
      oldStatus: currentPayment?.status,
      newStatus: payment.status
    });

    // ───────────────────────────────────────────────────────────────────────
    // STEP: Handle payment success if status transitioned to CONFIRMED
    // ───────────────────────────────────────────────────────────────────────

    const statusTransitioned = currentPayment?.status !== 'CONFIRMED' && payment.status === 'CONFIRMED';

    if (statusTransitioned && payment.standId && payment.clientId && payment.clientId !== 'STAND-ONLY') {
      logger.info('[PAYMENT_API] Payment status transitioned to CONFIRMED, triggering success handler', {
        module: 'API',
        paymentId: payment.id,
        oldStatus: currentPayment?.status,
        newStatus: payment.status
      });

      // Handle payment success asynchronously (don't block response)
      handlePaymentSuccess(payment.id).then(result => {
        if (result.success) {
          logger.info('[PAYMENT_API] Payment success handler completed', {
            module: 'API',
            paymentId: payment.id,
            contractCreated: result.contractCreated,
            emailSent: result.emailSent
          });
        } else {
          logger.error('[PAYMENT_API] Payment success handler failed', {
            module: 'API',
            paymentId: payment.id,
            error: result.error
          });
        }
      }).catch(err => {
        logger.error('[PAYMENT_API] Payment success handler error', err, {
          module: 'API',
          paymentId: payment.id
        });
      });
    }

    // Broadcast real-time update
    try {
      broadcastPaymentUpdate('updated', payment, {
        branch: payment.officeLocation
      });
    } catch (err) {
      logger.error('Failed to broadcast payment update', err instanceof Error ? err : new Error(String(err)), { module: 'API' });
    }

    return apiSuccess(payment);
  } catch (error: any) {
    logger.error('Payment update error', error, { module: 'API' });
    return apiError(error?.message || 'Unknown error', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/admin/payments - Void/delete a payment
 */
export async function DELETE(request: NextRequest) {
  try {
    logger.debug('DELETE /api/admin/payments called', { module: 'API' });

    // Rate limiting: 10 requests per minute for deleting payments (lower limit for safety)
    const authResult = await requireAdmin(request, { limit: 10, windowMs: 60000 });
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id, reason } = await request.json();

    if (!id) {
      return apiError('Payment ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get payment first for audit
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return apiError('Payment not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Soft delete - mark as voided instead of hard delete for audit trail
    const voidedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'VOIDED',
        description: `${payment.description || ''} [VOIDED: ${reason || 'No reason provided'}]`,
        updatedAt: new Date()
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: payment.officeLocation,
        userId: null,
        action: 'DELETE',
        module: 'PAYMENTS',
        recordId: payment.id,
        description: `Payment voided: ${payment.clientName} - ${payment.reference} - Reason: ${reason || 'Not specified'}`,
        changes: JSON.stringify({ voided: true, reason, voidedBy: user?.email })
      }
    });

    logger.info('Payment voided in Neon', { module: 'API', id: payment.id, voidedBy: user?.email });

    // Broadcast real-time update
    try {
      broadcastPaymentUpdate('deleted', voidedPayment, {
        branch: payment.officeLocation
      });
    } catch (err) {
      logger.error('Failed to broadcast payment update', err instanceof Error ? err : new Error(String(err)), { module: 'API' });
    }

    return apiSuccess({ success: true, message: 'Payment voided successfully', data: voidedPayment });
  } catch (error: any) {
    logger.error('Payment delete error', error, { module: 'API' });
    return apiError(error?.message || 'Failed to void payment', 500, ErrorCodes.DELETE_ERROR);
  }
}
