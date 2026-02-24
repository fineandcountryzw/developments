import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/manager/team/:id/performance
 * Get detailed performance metrics for team member
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month'; // week, month, quarter, year

    // Get team member
    const teamMember = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        branch: true,
        role: true
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Verify same branch (unless admin)
    if (user.role !== 'ADMIN' && teamMember.branch !== user.branch) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - different branch' },
        { status: 403 }
      );
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default: // month
        startDate.setMonth(now.getMonth() - 1);
    }

    // Get performance metrics
    const [
      newClients,
      activeReservations,
      completedDeals,
      totalRevenue,
      activities
    ] = await Promise.all([
      prisma.client.count({
        where: {
          reservations: {
            some: {
              agentId: id,
              createdAt: { gte: startDate }
            }
          }
        }
      }),
      prisma.reservation.count({
        where: {
          agentId: id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          createdAt: { gte: startDate }
        }
      }),
      prisma.stand.count({
        where: {
          status: 'SOLD',
          reservations: {
            some: {
              agentId: id,
              updatedAt: { gte: startDate }
            }
          }
        }
      }),
      prisma.stand.aggregate({
        where: {
          status: 'SOLD',
          reservations: {
            some: {
              agentId: id,
              updatedAt: { gte: startDate }
            }
          }
        },
        _sum: {
          price: true
        }
      }),
      prisma.activity.count({
        where: {
          userId: id,
          createdAt: { gte: startDate }
        }
      })
    ]);

    const totalRevenueAmount = totalRevenue._sum.price ? Number(totalRevenue._sum.price) : 0;

    const performance = {
      teamMember,
      period,
      startDate,
      endDate: now,
      metrics: {
        newClients,
        activeReservations,
        completedDeals,
        totalRevenue: totalRevenueAmount,
        estimatedCommission: totalRevenueAmount * 0.05, // 5% commission
        activitiesLogged: activities,
        conversionRate: newClients > 0 ? (completedDeals / newClients) * 100 : 0
      }
    };

    return apiSuccess(performance);
  } catch (error: any) {
    logger.error('Error fetching performance', error, { module: 'API', action: 'GET_TEAM_PERFORMANCE' });
    return apiError(error.message || 'Failed to fetch performance', 500, ErrorCodes.FETCH_ERROR);
  }
}
