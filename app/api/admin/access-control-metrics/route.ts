/**
 * Access Control Metrics API
 * 
 * Returns performance metrics for access control system.
 * 
 * @module app/api/admin/access-control-metrics
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { accessControlMetrics } from '@/lib/access-control-metrics';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/access-control-metrics
 * Get access control performance metrics
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    logger.debug('GET /api/admin/access-control-metrics', {
      module: 'API'
    });

    const metrics = accessControlMetrics.getMetrics();

    return apiSuccess(metrics);
  } catch (error: any) {
    logger.error('Error fetching metrics', error, { module: 'API' });
    return apiError('Failed to fetch metrics', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/access-control-metrics/reset
 * Reset all metrics
 */
export async function POST(_request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    logger.info('POST /api/admin/access-control-metrics/reset', {
      module: 'API'
    });

    accessControlMetrics.reset();

    return apiSuccess({ reset: true });
  } catch (error: any) {
    logger.error('Error resetting metrics', error, { module: 'API' });
    return apiError('Failed to reset metrics', 500, 'INTERNAL_ERROR');
  }
}
