import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/stats
 * Get manager's KPI statistics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const timeRange = searchParams.get('range') || 'month';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Build where clause for branch filter
    const branchFilter = branch === 'all' ? {} : { branch };

    // Get team count
    const totalTeamMembers = await prisma.user.count({
      where: {
        role: 'AGENT',
        ...branchFilter
      }
    });

    // Get active reservations (deals in pipeline)
    const activeDeals = await prisma.reservation.count({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        createdAt: { gte: startDate }
      }
    });

    // Get total revenue this period
    const payments = await prisma.payment.aggregate({
      where: {
        status: 'VERIFIED',
        createdAt: { gte: startDate },
        officeLocation: branch === 'all' ? undefined : branch
      },
      _sum: { amount: true },
      _count: true
    });

    const monthlyRevenue = Number(payments._sum.amount || 0);

    // Get leads (clients created this period)
    const leadsThisMonth = await prisma.client.count({
      where: {
        createdAt: { gte: startDate },
        branch: branch === 'all' ? undefined : branch
      }
    });

    // Calculate conversion rate (deals / leads * 100)
    const conversionRate = leadsThisMonth > 0 
      ? Math.round((activeDeals / leadsThisMonth) * 100 * 10) / 10 
      : 0;

    // Get confirmed deals for target calculation
    const completedDeals = await prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        createdAt: { gte: startDate }
      }
    });

    // Calculate target achievement (assuming target is 10 deals per month)
    const targetDeals = 10 * totalTeamMembers || 10;
    const targetAchievement = Math.min(Math.round((completedDeals / targetDeals) * 100), 150);

    // Team health score (based on activity)
    const activeAgents = await prisma.user.count({
      where: {
        role: 'AGENT',
        ...branchFilter,
        activities: {
          some: {
            createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
          }
        }
      }
    });
    const teamHealthScore = totalTeamMembers > 0 
      ? Math.round((activeAgents / totalTeamMembers) * 100) 
      : 0;

    // Average deal size
    const avgDealSize = payments._count > 0 
      ? Math.round(monthlyRevenue / payments._count) 
      : 0;

    return apiSuccess({
      totalTeamMembers,
      activeDeals,
      monthlyRevenue,
      conversionRate,
      leadsThisMonth,
      targetAchievement,
      teamHealthScore,
      avgDealSize,
      period: timeRange,
      branch: branch === 'all' ? 'All Branches' : branch
    });
  } catch (error: any) {
    logger.error('Error fetching manager stats', error, { module: 'API', action: 'GET_MANAGER_STATS' });
    return apiError(
      error.message || 'Failed to fetch stats',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
