import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/revenue
 * Get detailed revenue analytics for Manager Dashboard
 * 
 * Query Parameters:
 * - branch: Filter by branch (defaults to user's branch)
 * - timezone: Client timezone (defaults to 'UTC')
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/manager/revenue called', { module: 'Manager-API' });

    // Auth check - Manager level access required
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const timezone = searchParams.get('timezone') || 'UTC';

    logger.debug('Revenue query parameters', { branch, timezone });

    // Calculate date ranges
    const now = new Date();
    
    // Current week (Monday to Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    // Previous week
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    
    const endOfPrevWeek = new Date(startOfPrevWeek);
    endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);
    endOfPrevWeek.setHours(23, 59, 59, 999);

    // Current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Previous month
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfPrevMonth.setHours(23, 59, 59, 999);

    // Year to date
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Build where clause for branch filter
    const branchFilter = branch === 'all' ? {} : { officeLocation: branch };

    // Revenue queries - USE ONLY CONFIRMED PAYMENTS as per requirements
    const baseWhere = {
      status: 'CONFIRMED',
      ...branchFilter
    };

    const [
      thisWeekRevenue,
      prevWeekRevenue,
      thisMonthRevenue,
      prevMonthRevenue,
      yearToDateRevenue,
      dailyRevenue,
      monthlyTrends,
      revenueByType
    ] = await Promise.all([
      // This week revenue
      prisma.payment.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfWeek, lte: endOfWeek }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Previous week revenue
      prisma.payment.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfPrevWeek, lte: endOfPrevWeek }
        },
        _sum: { amount: true },
        _count: true
      }),

      // This month revenue
      prisma.payment.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Previous month revenue
      prisma.payment.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Year to date revenue
      prisma.payment.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfYear }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Daily revenue for current month (branch-specific query)
      branch === 'all'
        ? prisma.$queryRaw`SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as transactions FROM payments WHERE status = 'CONFIRMED' AND created_at >= ${startOfMonth} AND created_at <= ${endOfMonth} GROUP BY DATE(created_at) ORDER BY date ASC`
        : prisma.$queryRaw`SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as transactions FROM payments WHERE status = 'CONFIRMED' AND office_location = ${branch} AND created_at >= ${startOfMonth} AND created_at <= ${endOfMonth} GROUP BY DATE(created_at) ORDER BY date ASC`,

      // Monthly trends (last 6 months, branch-specific)
      branch === 'all'
        ? prisma.$queryRaw`SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as revenue, COUNT(*) as transactions, COUNT(DISTINCT client_id) as unique_clients FROM payments WHERE status = 'CONFIRMED' AND created_at >= ${new Date(now.getFullYear(), now.getMonth() - 6, 1)} GROUP BY DATE_TRUNC('month', created_at) ORDER BY month ASC`
        : prisma.$queryRaw`SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as revenue, COUNT(*) as transactions, COUNT(DISTINCT client_id) as unique_clients FROM payments WHERE status = 'CONFIRMED' AND office_location = ${branch} AND created_at >= ${new Date(now.getFullYear(), now.getMonth() - 6, 1)} GROUP BY DATE_TRUNC('month', created_at) ORDER BY month ASC`,

      // Revenue by payment type
      prisma.payment.groupBy({
        by: ['paymentType'],
        where: {
          ...baseWhere,
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Calculate trend indicators
    const thisWeekAmount = Number(thisWeekRevenue._sum.amount || 0);
    const prevWeekAmount = Number(prevWeekRevenue._sum.amount || 0);
    const weeklyTrend = prevWeekAmount > 0 
      ? ((thisWeekAmount - prevWeekAmount) / prevWeekAmount) * 100 
      : thisWeekAmount > 0 ? 100 : 0;

    const thisMonthAmount = Number(thisMonthRevenue._sum.amount || 0);
    const prevMonthAmount = Number(prevMonthRevenue._sum.amount || 0);
    const monthlyTrend = prevMonthAmount > 0 
      ? ((thisMonthAmount - prevMonthAmount) / prevMonthAmount) * 100 
      : thisMonthAmount > 0 ? 100 : 0;

    const yearToDateAmount = Number(yearToDateRevenue._sum.amount || 0);

    // Format daily revenue data for charts
    const formattedDailyRevenue = (dailyRevenue as any[]).map(day => ({
      date: day.date.toISOString().split('T')[0],
      revenue: Number(day.revenue),
      transactions: Number(day.transactions)
    }));

    // Format monthly trends
    const formattedMonthlyTrends = (monthlyTrends as any[]).map(month => ({
      month: month.month.toISOString().slice(0, 7), // YYYY-MM format
      monthName: month.month.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      revenue: Number(month.revenue),
      transactions: Number(month.transactions),
      uniqueClients: Number(month.unique_clients)
    }));

    // Format revenue by type
    const formattedRevenueByType = revenueByType.map(type => ({
      type: type.paymentType || 'Other',
      revenue: Number(type._sum.amount || 0),
      transactions: type._count,
      percentage: thisMonthAmount > 0 
        ? ((Number(type._sum.amount || 0) / thisMonthAmount) * 100).toFixed(1)
        : '0.0'
    }));

    // Calculate average deal size
    const avgDealSize = thisMonthRevenue._count > 0 
      ? thisMonthAmount / thisMonthRevenue._count 
      : 0;

    const response = {
      summary: {
        thisWeek: {
          revenue: thisWeekAmount,
          transactions: thisWeekRevenue._count,
          trend: weeklyTrend,
          trendDirection: weeklyTrend >= 0 ? 'up' : 'down'
        },
        thisMonth: {
          revenue: thisMonthAmount,
          transactions: thisMonthRevenue._count,
          trend: monthlyTrend,
          trendDirection: monthlyTrend >= 0 ? 'up' : 'down'
        },
        previousMonth: {
          revenue: prevMonthAmount,
          transactions: prevMonthRevenue._count
        },
        yearToDate: {
          revenue: yearToDateAmount,
          transactions: yearToDateRevenue._count
        },
        avgDealSize,
        branch: branch === 'all' ? 'All Branches' : branch
      },
      dailyRevenue: formattedDailyRevenue,
      monthlyTrends: formattedMonthlyTrends,
      revenueByType: formattedRevenueByType,
      dateRanges: {
        thisWeek: { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() },
        thisMonth: { start: startOfMonth.toISOString(), end: endOfMonth.toISOString() },
        previousMonth: { start: startOfPrevMonth.toISOString(), end: endOfPrevMonth.toISOString() }
      }
    };

    logger.info('Manager revenue analytics fetched successfully', {
      branch,
      thisWeekRevenue: thisWeekAmount,
      thisMonthRevenue: thisMonthAmount,
      weeklyTrend: weeklyTrend.toFixed(1) + '%',
      monthlyTrend: monthlyTrend.toFixed(1) + '%',
      module: 'Manager-Revenue',
      action: 'REVENUE_AGGREGATION',
      queryTypes: ['weekly', 'monthly', 'yearly', 'trends', 'by_type']
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch manager revenue analytics', error, { 
      module: 'Manager-API',
      endpoint: '/api/manager/revenue'
    });
    return apiError('Failed to fetch revenue analytics', 500);
  }
}