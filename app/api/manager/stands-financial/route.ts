import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import {
  getStandsWithFinancials,
  getStandsStatistics,
} from '@/lib/services/stands-financial-service';
import { getVisibleDevelopmentIds, VisibilityUser } from '@/lib/services/visibility-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/manager/stands-financial
 * Manager Financial View - Limited to branch-scoped developments
 * 
 * This endpoint uses the shared financial service to ensure consistency
 * with Account, Admin, and Developer dashboards.
 * Uses central visibility service for consistent scoping.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || user.branch || undefined;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const includeDebug = searchParams.get('debug') === 'true';

    logger.debug('Manager stands-financial request', {
      module: 'API',
      action: 'GET_MANAGER_STANDS_FINANCIAL',
      userId: user.id,
      branch,
      status
    });

    // Build visibility user for the service
    const visibilityUser: VisibilityUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      branch: user.branch
    };

    // Get visible development IDs using central visibility service
    const visibility = await getVisibleDevelopmentIds(visibilityUser, {
      branch: branch || undefined,
      includeDebug
    });

    const developmentIds = visibility.developmentIds;

    if (developmentIds.length === 0) {
      return NextResponse.json({
        success: true,
        stands: [],
        stats: {
          totalStands: 0,
          totalRevenue: 0,
          totalOutstanding: 0,
          totalArrears: 0,
          standsFullyPaid: 0,
          standsOverdue: 0,
        },
        role: 'manager',
        scope: visibility.scope,
        debug: visibility.debug
      });
    }

    // Fetch stands for manager's visible developments
    const stands = await getStandsWithFinancials({
      developmentIds,
      branch: branch || undefined,
      status: status || undefined,
      search: search || undefined,
    });

    const stats = await getStandsStatistics({
      developmentIds,
      branch: branch || undefined,
    });

    return NextResponse.json({
      success: true,
      stands,
      stats,
      role: 'manager',
      scope: visibility.scope,
      debug: visibility.debug
    });
  } catch (error) {
    logger.error('Error fetching manager stands financial', error instanceof Error ? error : undefined, {
      module: 'API',
      action: 'GET_MANAGER_STANDS_FINANCIAL'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stands' },
      { status: 500 }
    );
  }
}
