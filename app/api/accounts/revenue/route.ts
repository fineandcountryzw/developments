import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounts/revenue
 * Get detailed revenue analytics for Accounts Dashboard
 * Similar to Manager Dashboard but with accounts-specific metrics
 * 
 * Query Parameters:
 * - branch: Filter by branch (defaults to user's branch)
 * - period: Time period (week/month/quarter, defaults to month)
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/accounts/revenue called', { module: 'Accounts-API' });

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError('Unauthorized', 401);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403);
    }

    const user = session.user as { branch?: string };
    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const period = searchParams.get('period') || 'month';

    logger.debug('Revenue query parameters', { branch, period });

    // Calculate date ranges
    const now = new Date();
    
    // Current week (Monday to Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Previous week
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    
    const endOfPrevWeek = new Date(startOfPrevWeek);
    endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);
    endOfPrevWeek.setHours(23, 59, 59, 999);

    // Current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Previous month
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Current quarter
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
    const endOfQuarter = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);

    // Previous quarter
    const prevQuarterStartMonth = quarterStartMonth - 3;
    const startOfPrevQuarter = new Date(now.getFullYear(), prevQuarterStartMonth >= 0 ? prevQuarterStartMonth : prevQuarterStartMonth + 12, 1);
    const endOfPrevQuarter = new Date(now.getFullYear(), prevQuarterStartMonth >= 0 ? prevQuarterStartMonth + 3 : prevQuarterStartMonth + 15, 0, 23, 59, 59, 999);
    if (prevQuarterStartMonth < 0) {
      startOfPrevQuarter.setFullYear(now.getFullYear() - 1);
      endOfPrevQuarter.setFullYear(now.getFullYear() - 1);
    }

    const branchFilter = branch === 'all' ? {} : { office_location: branch };

    // Weekly revenue
    const [thisWeekRevenue, prevWeekRevenue] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfWeek, lte: endOfWeek },
          ...branchFilter
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfPrevWeek, lte: endOfPrevWeek },
          ...branchFilter
        },
        _sum: { amount: true }
      })
    ]);

    // Monthly revenue
    const [thisMonthRevenue, prevMonthRevenue] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          ...branchFilter
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
          ...branchFilter
        },
        _sum: { amount: true }
      })
    ]);

    // Quarterly revenue
    const [thisQuarterRevenue, prevQuarterRevenue] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfQuarter, lte: endOfQuarter },
          ...branchFilter
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: startOfPrevQuarter, lte: endOfPrevQuarter },
          ...branchFilter
        },
        _sum: { amount: true }
      })
    ]);

    // Calculate trends
    const weeklyTrend = prevWeekRevenue._sum.amount && Number(prevWeekRevenue._sum.amount) > 0
      ? (((Number(thisWeekRevenue._sum.amount || 0) - Number(prevWeekRevenue._sum.amount)) / Number(prevWeekRevenue._sum.amount)) * 100).toFixed(1)
      : '0.0';

    const monthlyTrend = prevMonthRevenue._sum.amount && Number(prevMonthRevenue._sum.amount) > 0
      ? (((Number(thisMonthRevenue._sum.amount || 0) - Number(prevMonthRevenue._sum.amount)) / Number(prevMonthRevenue._sum.amount)) * 100).toFixed(1)
      : '0.0';

    const quarterlyTrend = prevQuarterRevenue._sum.amount && Number(prevQuarterRevenue._sum.amount) > 0
      ? (((Number(thisQuarterRevenue._sum.amount || 0) - Number(prevQuarterRevenue._sum.amount)) / Number(prevQuarterRevenue._sum.amount)) * 100).toFixed(1)
      : '0.0';

    // Revenue by payment type
    const revenueByType = await prisma.payment.groupBy({
      by: ['paymentType'],
      where: {
        status: 'CONFIRMED',
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        ...branchFilter
      },
      _sum: { amount: true },
      _count: true
    });

    // Daily revenue for selected period
    let periodStart: Date, periodEnd: Date;
    switch (period) {
      case 'week':
        periodStart = startOfWeek;
        periodEnd = endOfWeek;
        break;
      case 'quarter':
        periodStart = startOfQuarter;
        periodEnd = endOfQuarter;
        break;
      default:
        periodStart = startOfMonth;
        periodEnd = endOfMonth;
    }

    // Monthly trends (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const monthlyTrendsData = branch === 'all'
      ? await prisma.$queryRaw<{ month: Date; revenue: unknown; transactions: bigint }[]>`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            SUM(amount) as revenue,
            COUNT(*) as transactions
          FROM payments
          WHERE status = 'CONFIRMED' 
            AND created_at >= ${sixMonthsAgo}
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month ASC
        `
      : await prisma.$queryRaw<{ month: Date; revenue: unknown; transactions: bigint }[]>`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            SUM(amount) as revenue,
            COUNT(*) as transactions
          FROM payments
          WHERE status = 'CONFIRMED' 
            AND office_location = ${branch}
            AND created_at >= ${sixMonthsAgo}
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month ASC
        `;

    const dailyRevenue = branch === 'all'
      ? await prisma.$queryRaw<{ date: Date; revenue: unknown; transactions: bigint }[]>`
          SELECT 
            DATE(created_at) as date,
            SUM(amount) as revenue,
            COUNT(*) as transactions
          FROM payments
          WHERE status = 'CONFIRMED' 
            AND created_at >= ${periodStart}
            AND created_at <= ${periodEnd}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `
      : await prisma.$queryRaw<{ date: Date; revenue: unknown; transactions: bigint }[]>`
          SELECT 
            DATE(created_at) as date,
            SUM(amount) as revenue,
            COUNT(*) as transactions
          FROM payments
          WHERE status = 'CONFIRMED' 
            AND office_location = ${branch}
            AND created_at >= ${periodStart}
            AND created_at <= ${periodEnd}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;

    const response = {
      thisWeekRevenue: Number(thisWeekRevenue._sum.amount || 0),
      thisMonthRevenue: Number(thisMonthRevenue._sum.amount || 0),
      thisQuarterRevenue: Number(thisQuarterRevenue._sum.amount || 0),
      weeklyTrend: `${weeklyTrend}%`,
      monthlyTrend: `${monthlyTrend}%`,
      quarterlyTrend: `${quarterlyTrend}%`,
      revenueByType: revenueByType.map(item => ({
        type: item.paymentType,
        revenue: Number(item._sum.amount || 0),
        transactions: item._count
      })),
      dailyRevenue: dailyRevenue.map(item => ({
        date: item.date.toISOString().split('T')[0],
        revenue: Number(item.revenue || 0),
        transactions: Number(item.transactions)
      })),
      monthlyTrends: monthlyTrendsData.map(item => ({
        month: (item.month as Date).toISOString().split('T')[0],
        revenue: Number(item.revenue || 0),
        transactions: Number(item.transactions)
      }))
    };

    logger.info('Accounts revenue analytics fetched successfully', {
      branch,
      thisMonthRevenue: response.thisMonthRevenue,
      monthlyTrend: response.monthlyTrend,
      module: 'Accounts-Revenue'
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch accounts revenue', error, { 
      module: 'Accounts-API',
      endpoint: '/api/accounts/revenue'
    });
    return apiError('Failed to fetch revenue data', 500);
  }
}
