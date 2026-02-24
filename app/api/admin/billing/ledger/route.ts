/**
 * Billing Ledger API
 * Fine & Country Zimbabwe ERP
 * 
 * Provides unified ledger view of payments and their allocations.
 * Admin-only endpoint for billing oversight and reconciliation.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { BillingAllocationService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/billing/ledger
 * Get unified billing ledger with payment allocations
 * 
 * Query params:
 * - clientId: Filter by client
 * - installmentPlanId: Filter by installment plan
 * - developmentId: Filter by development
 * - search: Search by client name or reference
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Number of records (default 100)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;
    const installmentPlanId = searchParams.get('installmentPlanId') || undefined;
    const developmentId = searchParams.get('developmentId') || undefined;
    const search = searchParams.get('search') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const ledger = await BillingAllocationService.getLedger({
      clientId,
      // installmentPlanId, // Deprecated
      developmentId,
      search,
      startDate,
      endDate,
      limit,
      offset
    });

    // Calculate summary stats
    const totalPayments = ledger.length;
    const totalPaymentAmount = ledger.reduce((sum, entry) => sum + entry.paymentAmount, 0);
    const totalAllocated = ledger.reduce((sum, entry) => sum + entry.totalAllocated, 0);
    const totalUnallocated = ledger.reduce((sum, entry) => sum + entry.unallocatedAmount, 0);
    const fullyAllocatedCount = ledger.filter(entry => entry.unallocatedAmount === 0).length;
    const partiallyAllocatedCount = ledger.filter(entry => entry.unallocatedAmount > 0 && entry.totalAllocated > 0).length;
    const unallocatedCount = ledger.filter(entry => entry.totalAllocated === 0).length;

    logger.info('Billing ledger retrieved', {
      module: 'Billing',
      action: 'GET_LEDGER',
      filters: { clientId, installmentPlanId, developmentId, search },
      count: ledger.length
    });

    return apiSuccess(
      {
        ledger,
        summary: {
          totalPayments,
          totalPaymentAmount,
          totalAllocated,
          totalUnallocated,
          fullyAllocatedCount,
          partiallyAllocatedCount,
          unallocatedCount,
        },
      },
      200,
      {
        total: totalPayments,
        limit,
        offset,
        hasMore: ledger.length === limit,
      }
    );
  } catch (error) {
    logger.error('Failed to retrieve billing ledger', error as Error, {
      module: 'Billing',
      action: 'GET_LEDGER_ERROR',
      details: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : 'Unknown error'
    });
    console.error('CRITICAL LEDGER ERROR:', error); // Add explicit console log
    console.error('ERROR STACK:', error instanceof Error ? error.stack : 'No stack');
    return apiError('Failed to retrieve billing ledger', 500, ErrorCodes.FETCH_ERROR, {
      details: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : 'Unknown error'
    });
  }
}
