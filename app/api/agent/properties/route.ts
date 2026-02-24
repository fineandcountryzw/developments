import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/properties
 * Get available properties for agent to reserve for clients
 * Filters by branch and shows only unreserved or agent's own stands
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const developmentId = searchParams.get('developmentId');
    const status = searchParams.get('status') || 'AVAILABLE';
    const search = searchParams.get('search');

    // Build filter
    const whereClause: any = {
      status: status === 'all' ? undefined : status,
      development: {
        branch: user.branch
      }
    };

    if (developmentId) {
      whereClause.developmentId = developmentId;
    }

    if (search) {
      whereClause.standNumber = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get available properties
    const properties = await prisma.stand.findMany({
      where: whereClause,
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        reservations: {
          select: {
            id: true,
            clientId: true,
            agentId: true,
            status: true,
            client: {
              select: {
                name: true,
                email: true
              }
            }
          },
          take: 1
        }
      },
      orderBy: { standNumber: 'asc' },
      take: 100
    });

    return apiSuccess(properties, 200, { total: properties.length });

  } catch (error: any) {
    logger.error('Error fetching properties', error, { module: 'API', action: 'GET_AGENT_PROPERTIES' });
    return apiError(error.message || 'Failed to fetch properties', 500, ErrorCodes.FETCH_ERROR);
  }
}
