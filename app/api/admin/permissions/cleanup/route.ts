/**
 * Permissions Cleanup API
 * 
 * Clean up expired permissions
 * 
 * @module app/api/admin/permissions/cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { cleanupExpiredPermissions } from '@/lib/permission-manager';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/permissions/cleanup
 * Clean up expired permissions
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    logger.info('POST /api/admin/permissions/cleanup', {
      module: 'API'
    });

    const count = await cleanupExpiredPermissions();

    return apiSuccess({ cleaned: count });
  } catch (error: any) {
    logger.error('Error cleaning up permissions', error, { module: 'API' });
    return apiError('Failed to cleanup permissions', 500, 'INTERNAL_ERROR');
  }
}
