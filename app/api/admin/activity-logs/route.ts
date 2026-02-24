import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * Unified Activity Log API
 * Returns chronological activity from ALL branches
 * Used by System Diagnostics and Forensic Ledger
 */

export async function GET(request: NextRequest) {
  try {
    logger.debug('GET /api/admin/activity-logs called', { module: 'API' });

    // Use new unified auth - require admin for viewing activity logs
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    // Query parameters
    const module = request.nextUrl.searchParams.get('module');
    const branch = request.nextUrl.searchParams.get('branch');
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
    
    // Pagination parameters
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)),
      1000
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (module) {
      where.module = module;
    }

    if (branch) {
      where.branch = branch;
    } else {
      // No branch specified: return ALL branches (executive view)
      logger.debug('Returning cross-branch activity (no filter)', { module: 'API' });
    }

    // Time-based filtering
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.createdAt = {
      gte: sinceDate
    };

    // Get total count for pagination
    const total = await prisma.activityLog.count({ where });
    
    const activities = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },  // Chronological order (newest first)
      skip,
      take: limit
    });

    // Fetch user details separately since ActivityLog doesn't have a user relation
    const userIds = Array.from(new Set(activities.map(a => a.userId).filter(Boolean) as string[]));
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true
      }
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Enrich activities with user data
    const enrichedActivities = activities.map(activity => ({
      ...activity,
      user: activity.userId ? userMap.get(activity.userId) || null : null
    }));

    logger.info('Fetched activity logs from Neon', {
      module: 'API',
      count: enrichedActivities.length,
      total,
      page,
      limit,
      filter: { module: module || 'ALL', branch: branch || 'ALL_BRANCHES', days }
    });

    // Transform response to include pagination metadata
    return apiSuccess({
      data: enrichedActivities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      metadata: {
        filters: {
          module: module || 'ALL',
          branch: branch || 'ALL_BRANCHES',
          days,
          since: sinceDate.toISOString()
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Activity log fetch error', error, { module: 'API' });
    return apiError(error?.message || 'Unknown error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/admin/activity-logs called', { module: 'API', action: 'POST_ACTIVITY_LOGS' });

    const data = await request.json();

    // Minimal validation
    if (!data.branch || !data.module || !data.recordId) {
      return apiError('Missing required fields: branch, module, recordId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create activity log
    const activityLog = await prisma.activityLog.create({
      data: {
        branch: data.branch,
        userId: data.userId || null,
        action: data.action || 'UNKNOWN',
        module: data.module,
        recordId: data.recordId,
        description: data.description || '',
        changes: data.changes ?? undefined
      }
    });

    logger.info('Activity log created', {
      module: 'API',
      action: 'POST_ACTIVITY_LOGS',
      id: activityLog.id,
      branch: activityLog.branch,
      activityModule: activityLog.module,
      activityAction: activityLog.action
    });

    return apiSuccess(activityLog, 201);
  } catch (error: any) {
    logger.error('Activity log creation error', error, { module: 'API', action: 'POST_ACTIVITY_LOGS' });
    return apiError(error?.message || 'Unknown error', 500, ErrorCodes.INTERNAL_ERROR);
  }
}

/**
 * GET /api/admin/activity-logs?branch=Harare
 *   Returns only Harare activities
 *
 * GET /api/admin/activity-logs
 *   Returns ALL activities from both branches (Executive Summary)
 *
 * GET /api/admin/activity-logs?module=PAYMENTS
 *   Returns payment-related activities from both branches
 *
 * GET /api/admin/activity-logs?branch=Bulawayo&module=CLIENTS&days=30
 *   Returns Bulawayo client activities from last 30 days
 */
