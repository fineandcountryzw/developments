/**
 * GET /api/manager/developments
 * 
 * Manager-scoped developments endpoint.
 * Returns only developments within the manager's branch scope.
 * 
 * Uses the central visibility service for consistent scoping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { getVisibleDevelopmentIds, VisibilityUser } from '@/lib/services/visibility-service';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require manager role
    const authResult = await requireManager();
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return apiError('User not found', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const user = authResult.user;
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || user.branch || undefined;
    const status = searchParams.get('status') || undefined;
    const includeDebug = searchParams.get('debug') === 'true';

    logger.info('Manager developments request', {
      module: 'API',
      action: 'GET_MANAGER_DEVELOPMENTS',
      userId: user.id,
      role: user.role,
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
      branch,
      status,
      includeDebug
    });

    if (visibility.developmentIds.length === 0) {
      logger.info('No visible developments for manager', {
        module: 'API',
        userId: user.id,
        branch,
        scope: visibility.scope
      });

      return apiSuccess({
        developments: [],
        stats: {
          totalDevelopments: 0,
          totalStands: 0,
          soldStands: 0,
          reservedStands: 0,
          availableStands: 0,
          totalRevenue: 0
        },
        scope: visibility.scope,
        debug: visibility.debug
      });
    }

    // Fetch full development data with stand counts
    const developments = await prisma.development.findMany({
      where: {
        id: { in: visibility.developmentIds }
      },
      include: {
        stands: {
          select: {
            id: true,
            status: true,
            price: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform and calculate statistics
    const transformed = developments.map(dev => {
      const soldStands = dev.stands.filter(s => s.status === 'SOLD').length;
      const reservedStands = dev.stands.filter(s => s.status === 'RESERVED').length;
      const availableStands = dev.stands.filter(s => s.status === 'AVAILABLE').length;
      const soldRevenue = dev.stands
        .filter(s => s.status === 'SOLD')
        .reduce((sum, s) => sum + Number(s.price || 0), 0);

      return {
        id: dev.id,
        name: dev.name,
        location: dev.location,
        description: dev.description,
        phase: dev.phase,
        status: dev.status,
        branch: dev.branch,
        basePrice: Number(dev.basePrice || 0),
        totalStands: dev.stands.length,
        soldStands,
        reservedStands,
        availableStands,
        totalRevenue: soldRevenue,
        developerName: dev.developerName,
        developerEmail: dev.developerEmail,
        createdAt: dev.createdAt,
        updatedAt: dev.updatedAt
      };
    });

    // Calculate aggregate stats
    const stats = {
      totalDevelopments: transformed.length,
      totalStands: transformed.reduce((sum, d) => sum + d.totalStands, 0),
      soldStands: transformed.reduce((sum, d) => sum + d.soldStands, 0),
      reservedStands: transformed.reduce((sum, d) => sum + d.reservedStands, 0),
      availableStands: transformed.reduce((sum, d) => sum + d.availableStands, 0),
      totalRevenue: transformed.reduce((sum, d) => sum + d.totalRevenue, 0)
    };

    logger.info('Manager developments response', {
      module: 'API',
      action: 'GET_MANAGER_DEVELOPMENTS',
      userId: user.id,
      developmentCount: transformed.length,
      scope: visibility.scope
    });

    return apiSuccess({
      developments: transformed,
      stats,
      scope: visibility.scope,
      debug: visibility.debug
    });

  } catch (error) {
    logger.error('Error fetching manager developments', error instanceof Error ? error : undefined, {
      module: 'API',
      action: 'GET_MANAGER_DEVELOPMENTS'
    });
    
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch developments',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
