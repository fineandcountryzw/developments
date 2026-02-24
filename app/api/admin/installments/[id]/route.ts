import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAuthenticatedUser, requireManager } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/installments/[id]
 * Get a specific installment plan with all details
 * Access: Admin, Manager, Accountant (read-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Allow Admin, Manager, or Accountant (ACCOUNT) access
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError('Unauthorized - Authentication required', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = user.role?.toUpperCase();
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNT') {
      return apiError('Unauthorized – Admin, Manager, or Accountant access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { id } = await params;

    // Fetch plan without payments relation (Installment model doesn't have payments relation)
    const plan = await prisma.installmentPlan.findUnique({
      where: { id },
      include: {
        client: true,
        development: true,
        installments: {
          orderBy: { installmentNo: 'asc' },
          include: {
            receipt: true
          }
        }
      }
    });

    if (!plan) {
      return apiError('Installment plan not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Manually fetch payments for each installment
    const installmentIds = plan.installments.map(i => i.id);
    const payments = installmentIds.length > 0
      ? await prisma.payment.findMany({
          where: { installmentId: { in: installmentIds } }
        })
      : [];
    
    // Group payments by installmentId
    const paymentsByInstallmentId = new Map<string, typeof payments>();
    payments.forEach(payment => {
      if (payment.installmentId) {
        if (!paymentsByInstallmentId.has(payment.installmentId)) {
          paymentsByInstallmentId.set(payment.installmentId, []);
        }
        paymentsByInstallmentId.get(payment.installmentId)!.push(payment);
      }
    });

    // Enrich installments with payments
    const enrichedPlan = {
      ...plan,
      installments: plan.installments.map(installment => ({
        ...installment,
        payments: paymentsByInstallmentId.get(installment.id) || []
      }))
    };

    return apiSuccess(enrichedPlan);

  } catch (error: any) {
    logger.error('Installment API Error', error, { module: 'API', action: 'GET_ADMIN_INSTALLMENT_BY_ID' });
    return apiError(error.message || 'Failed to fetch installment plan', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PATCH /api/admin/installments/[id]
 * Update installment plan status or make a payment
 * Access: Admin, Manager only (Accountant is read-only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only Admin and Manager can modify (Accountant is read-only)
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json();
    const { action, installmentId, paymentAmount, paymentMethod, receivedBy } = body;

    const plan = await prisma.installmentPlan.findUnique({
      where: { id },
      include: { 
        client: true, 
        development: true,
        installments: { orderBy: { installmentNo: 'asc' } }
      }
    });

    if (!plan) {
      return apiError('Installment plan not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (action === 'PAY_DEPOSIT') {
      // Business Rule: Deposit payment must set stand to SOLD
      // Mark deposit as paid
      const updatedPlan = await prisma.$transaction(async (tx) => {
        // Update the plan
        const updated = await tx.installmentPlan.update({
          where: { id },
          data: {
            depositPaid: true,
            totalPaid: { increment: plan.depositAmount },
            remainingBalance: { decrement: plan.depositAmount },
            nextDueDate: plan.installments[0]?.dueDate
          }
        });

        // Generate receipt for deposit
        // Note: For deposit payments, we link the receipt to the first installment
        const firstInstallment = plan.installments[0];
        const receiptNumber = await generateReceiptNumber(plan.client.branch);
        await tx.receipt.create({
          data: {
            receiptNumber,
            installmentId: firstInstallment?.id,
            clientId: plan.clientId,
            clientName: plan.client.name,
            clientEmail: plan.client.email,
            amount: plan.depositAmount,
            paymentMethod: paymentMethod || 'Bank',
            paymentType: 'Deposit',
            description: `Deposit for ${plan.development.name} installment plan`,
            standNumber: plan.standId,
            developmentName: plan.development.name,
            branch: plan.client.branch,
            receivedBy
          }
        });

        // Business Rule: Deposit paid = Stand must be SOLD (not RESERVED)
        if (plan.standId) {
          await tx.stand.update({
            where: { id: plan.standId },
            data: {
              status: 'SOLD',
              reservedBy: plan.clientId
            }
          });
          
          logger.info('Stand marked as SOLD (deposit paid via installment)', {
            module: 'API',
            action: 'PATCH_ADMIN_INSTALLMENT_BY_ID',
            standId: plan.standId,
            clientId: plan.clientId,
            planId: id
          });
        }

        return updated;
      });

      return apiSuccess({
        plan: updatedPlan,
        message: 'Deposit payment recorded successfully'
      });
    }

    if (action === 'PAY_INSTALLMENT' && installmentId) {
      // Find the installment
      const installment = plan.installments.find(i => i.id === installmentId);
      if (!installment) {
        return apiError('Installment not found', 404, ErrorCodes.NOT_FOUND);
      }

      // SECURITY: Prevent duplicate payments - check if already fully paid
      if (installment.status === 'PAID') {
        return apiError('Installment already paid in full', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const amountToPay = paymentAmount || Number(installment.amountDue);

      const result = await prisma.$transaction(async (tx) => {
        // Update installment
        const updatedInstallment = await tx.installment.update({
          where: { id: installmentId },
          data: {
            amountPaid: { increment: amountToPay },
            paidDate: new Date(),
            status: amountToPay >= Number(installment.amountDue) ? 'PAID' : 'PARTIAL'
          }
        });

        // Update plan totals
        const paidCount = plan.installments.filter(i => 
          i.id === installmentId || i.status === 'PAID'
        ).length;

        const nextInstallment = plan.installments.find(i => 
          i.installmentNo > installment.installmentNo && i.status !== 'PAID'
        );

        await tx.installmentPlan.update({
          where: { id },
          data: {
            totalPaid: { increment: amountToPay },
            remainingBalance: { decrement: amountToPay },
            paidInstallments: paidCount,
            nextDueDate: nextInstallment?.dueDate,
            status: paidCount >= plan.periodMonths ? 'COMPLETED' : 'ACTIVE'
          }
        });

        // Generate receipt
        const receiptNumber = await generateReceiptNumber(plan.client.branch);
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber,
            installmentId,
            clientId: plan.clientId,
            clientName: plan.client.name,
            clientEmail: plan.client.email,
            amount: amountToPay,
            paymentMethod: paymentMethod || 'Bank',
            paymentType: 'Installment',
            description: `Installment ${installment.installmentNo} of ${plan.periodMonths} for ${plan.development.name}`,
            standNumber: plan.standId,
            developmentName: plan.development.name,
            branch: plan.client.branch,
            receivedBy
          }
        });

        return { installment: updatedInstallment, receipt };
      });

      return apiSuccess({
        ...result,
        message: `Installment ${installment.installmentNo} payment recorded`
      });
    }

    if (action === 'CANCEL') {
      const updatedPlan = await prisma.installmentPlan.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      return apiSuccess({
        plan: updatedPlan,
        message: 'Installment plan cancelled'
      });
    }

    return apiError('Invalid action', 400, ErrorCodes.VALIDATION_ERROR);

  } catch (error: any) {
    logger.error('Installment API Update error', error, { module: 'API', action: 'PATCH_ADMIN_INSTALLMENT_BY_ID' });
    return apiError(error.message || 'Failed to update installment plan', 500, ErrorCodes.UPDATE_ERROR);
  }
}

// Helper to generate unique receipt numbers
async function generateReceiptNumber(branch: string): Promise<string> {
  const prefix = branch === 'Harare' ? 'FC-HRE' : 'FC-BYO';
  const year = new Date().getFullYear();
  
  // Get count of receipts this year for this branch
  const count = await prisma.receipt.count({
    where: {
      branch,
      receiptNumber: { startsWith: `${prefix}-${year}` }
    }
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}-${year}-${sequence}`;
}
