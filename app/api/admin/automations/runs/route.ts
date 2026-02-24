/**
 * Automation Runs API
 * Get automation execution history
 * 
 * @module app/api/admin/automations/runs
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/automations/runs
 * Get automation runs with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    
    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get('automationId');
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');
    const correlationId = searchParams.get('correlationId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const where: any = {};
    if (automationId) where.automationId = automationId;
    if (entityId) where.entityId = entityId;
    if (status) where.status = status;
    if (correlationId) where.correlationId = correlationId;
    
    const [runs, total] = await Promise.all([
      prisma.automationRun.findMany({
        where,
        include: {
          automation: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.automationRun.count({ where })
    ]);
    
    return apiSuccess(runs, 200, {
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    logger.error('Error fetching automation runs', error, { module: 'API', action: 'GET_AUTOMATION_RUNS' });
    return apiError('Failed to fetch automation runs', 500, ErrorCodes.FETCH_ERROR);
  }
}
