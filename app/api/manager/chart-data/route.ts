import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/chart-data
 * Get chart data for trends over time
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'all';
    const months = parseInt(searchParams.get('months') || '6');

    const chartData: { month: string; deals: number; revenue: number; target: number; }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('default', { month: 'short' });

      // Get deals for this month
      const deals = await prisma.reservation.count({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      });

      // Get revenue for this month
      const payments = await prisma.payment.aggregate({
        where: {
          status: 'VERIFIED',
          createdAt: { gte: monthStart, lte: monthEnd },
          officeLocation: branch === 'all' ? undefined : branch
        },
        _sum: { amount: true }
      });

      const revenue = Number(payments._sum?.amount || 0);
      
      // Calculate target (grows over time)
      const baseTarget = 200000;
      const target = baseTarget + (months - i - 1) * 25000;

      chartData.push({
        month: monthName,
        deals,
        revenue,
        target
      });
    }

    return apiSuccess(chartData);
  } catch (error: any) {
    logger.error('Error fetching chart data', error, { module: 'API', action: 'GET_CHART_DATA' });
    return apiError(
      error.message || 'Failed to fetch chart data',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
