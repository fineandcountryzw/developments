import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/commissions/analytics
 * Get commission analytics for the authenticated agent
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/agent/commissions/analytics called', { module: 'Agent-API' });

    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get agent's reservations (their sales)
    const allReservations = await prisma.reservation.findMany({
      where: {
        agentId: user.id,
        status: { in: ['CONFIRMED', 'PAYMENT_PENDING'] }
      },
      include: {
        stand: {
          include: {
            development: true
          }
        }
      }
    });

    // Calculate commissions (5% of stand price)
    const commissionRate = 0.05;
    const commissions = allReservations.map(res => {
      const standPrice = Number(res.stand?.price || 0);
      const commission = standPrice * commissionRate;
      const status = res.status === 'CONFIRMED' ? 'earned' : 
                     res.status === 'PAYMENT_PENDING' ? 'pending' : 'projected';
      
      return {
        id: res.id,
        reservationId: res.id,
        standId: res.standId,
        standNumber: res.stand?.standNumber || 'N/A',
        developmentName: res.stand?.development?.name || 'Unknown',
        standPrice,
        commissionRate: commissionRate * 100,
        amount: commission,
        status,
        date: res.createdAt,
        reservationStatus: res.status,
      };
    });

    // Filter by period
    const thisMonthCommissions = commissions.filter(c => 
      new Date(c.date) >= startOfMonth
    );
    const ytdCommissions = commissions.filter(c => 
      new Date(c.date) >= startOfYear
    );
    const prevMonthCommissions = commissions.filter(c => 
      new Date(c.date) >= startOfPrevMonth && new Date(c.date) <= endOfPrevMonth
    );

    // Calculate totals
    const totalEarned = commissions.filter(c => c.status === 'earned')
      .reduce((sum, c) => sum + c.amount, 0);
    const totalPending = commissions.filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);
    const totalProjected = commissions.filter(c => c.status === 'projected')
      .reduce((sum, c) => sum + c.amount, 0);

    const thisMonthTotal = thisMonthCommissions
      .reduce((sum, c) => sum + c.amount, 0);
    const ytdTotal = ytdCommissions
      .reduce((sum, c) => sum + c.amount, 0);
    const prevMonthTotal = prevMonthCommissions
      .reduce((sum, c) => sum + c.amount, 0);

    // Calculate trend
    const monthlyTrend = prevMonthTotal > 0
      ? (((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100).toFixed(1)
      : '0.0';

    // Breakdown by development
    const byDevelopment: Record<string, number> = {};
    commissions.forEach(c => {
      const devName = c.developmentName;
      if (!byDevelopment[devName]) {
        byDevelopment[devName] = 0;
      }
      byDevelopment[devName] += c.amount;
    });

    // Monthly history (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyHistory = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthCommissions = commissions.filter(c => {
        const date = new Date(c.date);
        return date >= monthStart && date <= monthEnd;
      });
      const monthTotal = monthCommissions.reduce((sum, c) => sum + c.amount, 0);
      monthlyHistory.push({
        month: monthStart.toISOString().split('T')[0].substring(0, 7),
        total: monthTotal,
        earned: monthCommissions.filter(c => c.status === 'earned').reduce((sum, c) => sum + c.amount, 0),
        pending: monthCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
      });
    }

    // Projected commissions (based on pending deals)
    const projectedCommissions = totalPending + totalProjected;

    const response = {
      totalEarned,
      totalPending,
      totalProjected,
      thisMonthTotal,
      ytdTotal,
      monthlyTrend: `${monthlyTrend}%`,
      breakdown: {
        byDevelopment: Object.entries(byDevelopment).map(([development, amount]) => ({
          development,
          amount,
        })),
        byStatus: {
          earned: totalEarned,
          pending: totalPending,
          projected: totalProjected,
        },
      },
      trends: {
        monthlyHistory,
      },
      forecast: {
        projected: projectedCommissions,
        avgMonthly: monthlyHistory.length > 0
          ? monthlyHistory.reduce((sum, m) => sum + m.total, 0) / monthlyHistory.length
          : 0,
      },
      topDevelopments: Object.entries(byDevelopment)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([development, amount]) => ({ development, amount })),
    };

    logger.info('Agent commission analytics fetched successfully', {
      agentId: user.id,
      totalEarned,
      thisMonthTotal,
      module: 'Agent-Commissions'
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch agent commission analytics', error, { 
      module: 'Agent-API',
      endpoint: '/api/agent/commissions/analytics'
    });
    return apiError('Failed to fetch commission analytics', 500);
  }
}
