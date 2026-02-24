/**
 * Billing Reconciliation API
 * Fine & Country Zimbabwe ERP
 * 
 * Run reconciliation checks on payments and installment plans
 * to detect discrepancies between allocations and actual amounts.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { BillingAllocationService } from '@/lib/billing';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/billing/reconcile
 * Run reconciliation check on payments/plans
 * 
 * Query params:
 * - paymentId: Check specific payment
 * - installmentPlanId: Check specific plan
 * - developmentId: Check all plans for a development
 * - clientId: Check all plans for a client
 * - showAll: Include balanced items (default: only show discrepancies)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const installmentPlanId = searchParams.get('installmentPlanId');
    const developmentId = searchParams.get('developmentId');
    const clientId = searchParams.get('clientId');
    const showAll = searchParams.get('showAll') === 'true';

    const reports: any[] = [];

    // Single payment check
    if (paymentId) {
      const paymentReports = await BillingAllocationService.reconcile({ paymentId });
      reports.push(...paymentReports);
    }

    // Single plan check
    if (installmentPlanId) {
      const planReports = await BillingAllocationService.reconcile({ installmentPlanId });
      reports.push(...planReports);
    }

    // Batch check by development or client
    if (developmentId || clientId) {
      const planWhere: any = {};
      if (developmentId) planWhere.developmentId = developmentId;
      if (clientId) planWhere.clientId = clientId;

      const plans = await prisma.installmentPlan.findMany({
        where: planWhere,
        select: { id: true }
      });

      for (const plan of plans) {
        const planReports = await BillingAllocationService.reconcile({ installmentPlanId: plan.id });
        reports.push(...planReports);
      }

      // Also check unallocated payments
      const paymentWhere: any = {};
      if (developmentId) paymentWhere.developmentId = developmentId;
      if (clientId) paymentWhere.clientId = clientId;

      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        select: { id: true }
      });

      for (const payment of payments) {
        const paymentReports = await BillingAllocationService.reconcile({ paymentId: payment.id });
        // Avoid duplicates
        for (const report of paymentReports) {
          if (!reports.find(r => r.paymentId === report.paymentId)) {
            reports.push(report);
          }
        }
      }
    }

    // Filter to only discrepancies unless showAll
    const filteredReports = showAll
      ? reports
      : reports.filter(r => r.status !== 'BALANCED');

    // Calculate summary
    const summary = {
      totalChecked: reports.length,
      balanced: reports.filter(r => r.status === 'BALANCED').length,
      underAllocated: reports.filter(r => r.status === 'UNDER_ALLOCATED').length,
      overAllocated: reports.filter(r => r.status === 'OVER_ALLOCATED').length,
      totalDiscrepancyAmount: reports.reduce((sum, r) => sum + Math.abs(r.discrepancy || 0), 0),
      planDiscrepancies: reports.filter(r => r.planDiscrepancy !== null && r.planDiscrepancy !== 0).length
    };

    logger.info('Reconciliation check completed', {
      module: 'Billing',
      action: 'RECONCILE',
      filters: { paymentId, installmentPlanId, developmentId, clientId },
      summary
    });

    return apiSuccess({
      reports: filteredReports,
      summary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Reconciliation check failed', error as Error, {
      module: 'Billing',
      action: 'RECONCILE_ERROR'
    });
    return apiError('Reconciliation check failed', 500, ErrorCodes.FETCH_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/billing/reconcile
 * Trigger auto-fix for specific discrepancies
 * 
 * Body:
 * - action: 'auto-allocate-unallocated' | 'flag-discrepancy'
 * - paymentIds?: Array of payment IDs to process
 * - installmentPlanId?: Plan ID for auto-allocation
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if ('error' in authResult && authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { action, paymentIds, installmentPlanId } = body;

    if (action === 'auto-allocate-unallocated') {
      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return apiError('paymentIds array is required', 400, ErrorCodes.VALIDATION_ERROR);
      }

      if (!installmentPlanId) {
        return apiError('installmentPlanId is required for auto-allocation', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const results: any[] = [];
      for (const paymentId of paymentIds) {
        const result = await BillingAllocationService.autoAllocatePayment(
          paymentId,
          'system-reconcile'
        );
        results.push({
          paymentId,
          success: result.success,
          allocations: result.allocations,
          error: result.error
        });
      }

      logger.info('Batch auto-allocation completed', {
        module: 'Billing',
        action: 'BATCH_AUTO_ALLOCATE',
        installmentPlanId,
        paymentsProcessed: paymentIds.length,
        successful: results.filter(r => r.success).length
      });

      return apiSuccess({
        message: 'Batch auto-allocation completed',
        results,
        summary: {
          processed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });
    }

    if (action === 'flag-discrepancy') {
      // Flag payments with discrepancies for manual review
      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return apiError('paymentIds array is required', 400, ErrorCodes.VALIDATION_ERROR);
      }

      await prisma.payment.updateMany({
        where: { id: { in: paymentIds } },
        data: { verificationStatus: 'FLAGGED' }
      });

      logger.info('Payments flagged for review', {
        module: 'Billing',
        action: 'FLAG_DISCREPANCIES',
        paymentsFlagged: paymentIds.length
      });

      return apiSuccess({
        message: 'Payments flagged for manual review',
        flaggedCount: paymentIds.length
      });
    }

    return apiError('Invalid action. Use: auto-allocate-unallocated | flag-discrepancy', 400, ErrorCodes.VALIDATION_ERROR);
  } catch (error) {
    logger.error('Reconciliation action failed', error as Error, {
      module: 'Billing',
      action: 'RECONCILE_ACTION_ERROR'
    });
    return apiError('Reconciliation action failed', 500, ErrorCodes.UPDATE_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
