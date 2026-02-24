/**
 * Billing Allocation Management API
 * Fine & Country Zimbabwe ERP
 * 
 * Manage individual allocations - get details, reverse allocations.
 */

import { NextRequest } from 'next/server';
import { requireAdmin, getAuthenticatedUser } from '@/lib/adminAuth';
import { BillingAllocationService } from '@/lib/billing/allocation-service';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Use type assertion for new PaymentAllocation model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/billing/allocations/[id]
 * Get details of a specific allocation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const { id } = await params;

    const allocation = await db.paymentAllocation.findUnique({
      where: { id },
      include: {
        payment: {
          select: {
            id: true,
            reference: true,
            amount: true,
            clientId: true,
            clientName: true,
            standId: true,
            status: true,
            createdAt: true
          }
        },
        installment: {
          select: {
            id: true,
            installmentNo: true,
            amountDue: true,
            amountPaid: true,
            status: true,
            dueDate: true,
            paidDate: true
          }
        },
        installmentPlan: {
          select: {
            id: true,
            clientId: true,
            standId: true,
            developmentId: true,
            totalAmount: true,
            depositAmount: true,
            depositPaid: true,
            totalPaid: true,
            remainingBalance: true,
            paidInstallments: true,
            periodMonths: true,
            status: true
          }
        }
      }
    });

    if (!allocation) {
      return apiError('Allocation not found', 404, ErrorCodes.NOT_FOUND);
    }

    return apiSuccess({
      id: allocation.id,
      paymentId: allocation.paymentId,
      installmentId: allocation.installmentId,
      installmentPlanId: allocation.installmentPlanId,
      amount: Number(allocation.amount),
      type: allocation.allocationType,
      status: allocation.allocationStatus,
      allocatedAt: allocation.allocatedAt,
      allocatedBy: allocation.allocatedBy,
      reversedAt: allocation.reversedAt,
      reversedBy: allocation.reversedBy,
      reversalReason: allocation.reversalReason,
      notes: allocation.notes,
      createdAt: allocation.createdAt,
      updatedAt: allocation.updatedAt,
      payment: allocation.payment ? {
        id: allocation.payment.id,
        reference: allocation.payment.reference,
        amount: Number(allocation.payment.amount),
        clientId: allocation.payment.clientId,
        clientName: allocation.payment.clientName,
        standId: allocation.payment.standId,
        status: allocation.payment.status,
        date: allocation.payment.createdAt
      } : null,
      installment: allocation.installment ? {
        id: allocation.installment.id,
        installmentNo: allocation.installment.installmentNo,
        amountDue: Number(allocation.installment.amountDue),
        amountPaid: Number(allocation.installment.amountPaid),
        status: allocation.installment.status,
        dueDate: allocation.installment.dueDate,
        paidDate: allocation.installment.paidDate
      } : null,
      installmentPlan: allocation.installmentPlan ? {
        id: allocation.installmentPlan.id,
        totalAmount: Number(allocation.installmentPlan.totalAmount),
        depositAmount: Number(allocation.installmentPlan.depositAmount),
        depositPaid: allocation.installmentPlan.depositPaid,
        totalPaid: Number(allocation.installmentPlan.totalPaid),
        remainingBalance: Number(allocation.installmentPlan.remainingBalance),
        paidInstallments: allocation.installmentPlan.paidInstallments,
        periodMonths: allocation.installmentPlan.periodMonths,
        status: allocation.installmentPlan.status
      } : null
    });
  } catch (error) {
    logger.error('Failed to retrieve allocation', error as Error, {
      module: 'Billing',
      action: 'GET_ALLOCATION_ERROR'
    });
    return apiError('Failed to retrieve allocation', 500, ErrorCodes.FETCH_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * DELETE /api/admin/billing/allocations/[id]
 * Reverse an allocation (soft delete with audit trail)
 * 
 * Body:
 * - reason: Reason for reversal (required)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return apiError('Valid reason is required for reversal (min 3 characters)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const reversedBy = user?.email || 'system';

    const result = await BillingAllocationService.reverseAllocation(id, reversedBy, reason.trim());

    if (!result.success) {
      return apiError(result.error || 'Reversal failed', 400, ErrorCodes.UPDATE_ERROR);
    }

    logger.info('Allocation reversed', {
      module: 'Billing',
      action: 'REVERSE_ALLOCATION',
      allocationId: id,
      reversedBy,
      reason: reason.trim()
    });

    return apiSuccess({
      id,
      reversedBy,
      reversedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to reverse allocation', error as Error, {
      module: 'Billing',
      action: 'REVERSE_ALLOCATION_ERROR'
    });
    return apiError('Failed to reverse allocation', 500, ErrorCodes.UPDATE_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
