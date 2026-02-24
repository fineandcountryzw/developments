/**
 * Billing Allocations API
 * Fine & Country Zimbabwe ERP
 * 
 * Manage payment allocations to invoices.
 */

import { NextRequest } from 'next/server';
import { requireAdmin, getAuthenticatedUser } from '@/lib/adminAuth';
import { BillingAllocationService } from '@/lib/billing';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Use type assertion for existing models
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/billing/allocations
 * List allocations
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const invoiceId = searchParams.get('invoiceId'); // Changed from installmentId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (paymentId) where.paymentTransactionId = paymentId;
    if (invoiceId) where.invoiceId = invoiceId;

    const allocations = await db.ledgerAllocation.findMany({
      where,
      include: {
        paymentTransaction: {
          select: {
            id: true,
            reference: true,
            amount: true,
            clientId: true,
            postedAt: true, // Renamed from createdAt/date
            client: { select: { name: true } }
          }
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            dueDate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalAllocated = allocations.reduce((sum: number, a: any) => sum + Number(a.amount), 0);

    logger.info('Allocations retrieved', {
      module: 'Billing',
      action: 'GET_ALLOCATIONS',
      filters: { paymentId, invoiceId },
      count: allocations.length
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedAllocations = allocations.map((a: any) => ({
      id: a.id,
      paymentId: a.paymentTransactionId,
      paymentRef: a.paymentTransaction?.reference,
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoice?.invoiceNumber,
      amount: Number(a.amount),
      allocatedAt: a.createdAt,
      payment: a.paymentTransaction ? {
        reference: a.paymentTransaction.reference,
        amount: Number(a.paymentTransaction.amount),
        clientName: a.paymentTransaction.client?.name,
        date: a.paymentTransaction.postedAt
      } : null,
      invoice: a.invoice ? {
        invoiceNumber: a.invoice.invoiceNumber,
        amount: Number(a.invoice.totalAmount),
        status: a.invoice.status,
        dueDate: a.invoice.dueDate
      } : null
    }));

    return apiSuccess(
      {
        allocations: enrichedAllocations,
        totals: {
          total: allocations.length,
          totalAllocated,
        },
      },
      200,
      { total: allocations.length }
    );
  } catch (error) {
    logger.error('Failed to retrieve allocations', error as Error, {
      module: 'Billing',
      action: 'GET_ALLOCATIONS_ERROR'
    });
    return apiError('Failed to retrieve allocations', 500, ErrorCodes.FETCH_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/billing/allocations
 * Create a new allocation
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const user = await getAuthenticatedUser();
    const body = await request.json();
    const { mode, paymentId, invoiceId, amount, notes } = body;

    if (!paymentId) {
      return apiError('paymentId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const allocatedBy = user?.email || 'system';

    if (mode === 'auto') {
      const result = await BillingAllocationService.autoAllocatePayment(
        paymentId,
        allocatedBy
      );

      if (!result.success) {
        return apiError(result.error || 'Auto-allocation failed', 400, ErrorCodes.CREATE_ERROR);
      }

      return apiSuccess(result.allocations, 201, {
        remainingAmount: result.remainingAmount,
        total: result.allocations.length
      });
    } else {
      // Manual allocation
      const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return apiError('Valid amount is required', 400, ErrorCodes.VALIDATION_ERROR);
      }

      if (!invoiceId) {
        return apiError('invoiceId is required', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const result = await BillingAllocationService.createAllocation({
        paymentId,
        invoiceId,
        amount: parsedAmount,
        allocatedBy,
        notes
      });

      if (!result.success) {
        return apiError(result.error || 'Allocation failed', 400, ErrorCodes.CREATE_ERROR);
      }

      return apiSuccess({
        id: result.allocationId,
        details: result.details
      }, 201);
    }
  } catch (error) {
    logger.error('Failed to create allocation', error as Error, {
      module: 'Billing',
      action: 'CREATE_ALLOCATION_ERROR'
    });
    return apiError('Failed to create allocation', 500, ErrorCodes.CREATE_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
