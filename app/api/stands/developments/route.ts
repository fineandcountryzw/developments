/**
 * Visible Developments API
 * GET /api/stands/developments
 * 
 * Returns list of developments the user has access to based on their role.
 * Used for the development selector dropdown in StandsInventoryView.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { getVisibleDevelopmentIds } from '@/lib/services/visibility-service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('GET /api/stands/developments', {
      module: 'API',
      action: 'GET_VISIBLE_DEVELOPMENTS',
      userId: user.id,
      role: user.role,
    });

    // Get visible development IDs
    const visibility = await getVisibleDevelopmentIds(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
      { includeDebug: true }
    );

    // Fetch development details with stand counts
    const developments = await prisma.development.findMany({
      where: {
        id: { in: visibility.developmentIds },
      },
      select: {
        id: true,
        name: true,
        branch: true,
        status: true,
        _count: {
          select: {
            stands: true,
          },
        },
        stands: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform with stand status counts
    const transformed = developments.map(dev => {
      const standCounts = dev.stands.reduce(
        (acc, stand) => {
          const status = stand.status || 'AVAILABLE';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        id: dev.id,
        name: dev.name,
        branch: dev.branch,
        status: dev.status,
        totalStands: dev._count.stands,
        availableStands: standCounts['AVAILABLE'] || 0,
        reservedStands: standCounts['RESERVED'] || 0,
        soldStands: standCounts['SOLD'] || 0,
      };
    });

    return NextResponse.json({
      success: true,
      developments: transformed,
      scope: visibility.scope,
      debug: visibility.debug,
    });
  } catch (error: any) {
    logger.error('GET /api/stands/developments failed', {
      module: 'API',
      action: 'GET_VISIBLE_DEVELOPMENTS',
      error: error.message,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch developments' },
      { status: 500 }
    );
  }
}
