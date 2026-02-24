import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/branches
 * Get branch performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
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

    // Get all branches
    const branches = ['Harare', 'Bulawayo', 'Mutare'];

    const branchMetrics = await Promise.all(
      branches.map(async (branch) => {
        // Get agent count
        const agents = await prisma.user.count({
          where: { role: 'AGENT', branch }
        });

        // Get leads (clients)
        const totalLeads = await prisma.client.count({
          where: { 
            branch,
            createdAt: { gte: startDate }
          }
        });

        // Get deals (reservations)
        const totalDeals = await prisma.reservation.count({
          where: {
            createdAt: { gte: startDate },
            status: 'CONFIRMED'
          }
        });

        // Get revenue
        const payments = await prisma.payment.aggregate({
          where: {
            status: 'VERIFIED',
            officeLocation: branch,
            createdAt: { gte: startDate }
          },
          _sum: { amount: true }
        });

        const revenue = Number(payments._sum?.amount || 0);
        const conversionRate = totalLeads > 0 
          ? Math.round((totalDeals / totalLeads) * 100 * 10) / 10 
          : 0;

        return {
          branch,
          totalLeads,
          totalDeals,
          revenue,
          agents,
          conversionRate
        };
      })
    );

    // Filter out branches with no activity if needed
    const activeBranches = branchMetrics.filter(b => b.agents > 0 || b.totalLeads > 0);

    return apiSuccess(activeBranches.length > 0 ? activeBranches : branchMetrics);
  } catch (error: any) {
    logger.error('Error fetching branch metrics', error, { module: 'API', action: 'GET_BRANCHES' });
    return apiError(
      error.message || 'Failed to fetch branch metrics',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
