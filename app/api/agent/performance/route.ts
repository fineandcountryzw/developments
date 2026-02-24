import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/performance
 * Get performance metrics for the authenticated agent
 */
export async function GET(_request: NextRequest) {
  try {
    logger.info('GET /api/agent/performance called', { module: 'Agent-API' });

    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Get agent's deals without relations
    const dealsRaw = await prisma.deal.findMany({
      where: {
        ownerId: user.id,
        isArchived: false,
      },
    });

    // Manually fetch stages for deals
    const stageIds = [...new Set(dealsRaw.map(d => d.stageId))];
    const stages = await prisma.stage.findMany({ where: { id: { in: stageIds } } });
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const deals = dealsRaw.map(d => ({ ...d, stage: stageMap.get(d.stageId) || null }));

    // Get agent's reservations (sales) without relations
    const reservationsRaw = await prisma.reservation.findMany({
      where: {
        agentId: user.id,
      },
    });

    // Manually fetch stands for reservations
    const standIds = [...new Set(reservationsRaw.filter(r => r.standId).map(r => r.standId as string))];
    const stands = standIds.length > 0 ? await prisma.stand.findMany({ where: { id: { in: standIds } } }) : [];
    const standMap = new Map(stands.map(s => [s.id, s]));
    const reservations = reservationsRaw.map(r => ({ ...r, stand: r.standId ? standMap.get(r.standId) || null : null }));

    // Calculate current month metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const thisMonthDeals = deals.filter(d => 
      new Date(d.createdAt) >= startOfMonth
    );
    const thisMonthSales = reservations.filter(r => 
      new Date(r.createdAt) >= startOfMonth && r.status === 'CONFIRMED'
    );

    // Sales metrics
    const thisMonthRevenue = thisMonthSales.reduce((sum, r) => 
      sum + Number(r.stand?.price || 0), 0
    );
    
    // Try to fetch agent's target from SalesTarget table
    const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    let monthlyTarget = 0;
    try {
      const agentTarget = await prisma.salesTarget.findFirst({
        where: {
          agentId: user.id,
          targetPeriod: currentPeriod,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (agentTarget) {
        monthlyTarget = Number(agentTarget.revenueTarget || 0);
      }
    } catch (error) {
      logger.warn('Failed to fetch agent target from SalesTarget', { error, agentId: user.id });
      // Continue with default 0 - will show "No target set"
    }
    
    const targetAchievement = monthlyTarget > 0 
      ? (thisMonthRevenue / monthlyTarget) * 100 
      : 0;

    // Activity metrics (simplified - can be enhanced with actual activity tracking)
    const totalDeals = deals.length;
    const activeDeals = deals.filter(d => 
      d.stage?.name !== 'Closed Won' && d.stage?.name !== 'Closed Lost'
    ).length;
    const closedDeals = deals.filter(d => d.stage?.name === 'Closed Won').length;

    // Conversion metrics
    const totalLeads = totalDeals;
    const conversionRate = totalLeads > 0 
      ? (closedDeals / totalLeads) * 100 
      : 0;

    // Performance trends (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const monthDeals = deals.filter(d => {
        const date = new Date(d.createdAt);
        return date >= monthStart && date <= monthEnd;
      });
      const monthSales = reservations.filter(r => {
        const date = new Date(r.createdAt);
        return date >= monthStart && date <= monthEnd && r.status === 'CONFIRMED';
      });
      
      const monthRevenue = monthSales.reduce((sum, r) => 
        sum + Number(r.stand?.price || 0), 0
      );
      
      monthlyTrends.push({
        month: monthStart.toISOString().split('T')[0].substring(0, 7),
        revenue: monthRevenue,
        deals: monthDeals.length,
        closed: monthDeals.filter(d => d.stage?.name === 'Closed Won').length,
      });
    }

    // Goals - fetch from SalesTarget if available, otherwise use defaults
    let monthlyDealsTarget = 10; // Default
    let conversionRateTarget = 25; // Default 25%
    
    try {
      const agentTarget = await prisma.salesTarget.findFirst({
        where: {
          agentId: user.id,
          targetPeriod: currentPeriod,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (agentTarget) {
        monthlyDealsTarget = agentTarget.dealsTarget || 10;
        // Conversion rate target can be calculated or set separately
      }
    } catch (error) {
      // Use defaults if fetch fails
    }
    
    const goals = {
      monthlyRevenue: monthlyTarget,
      monthlyDeals: monthlyDealsTarget,
      conversionRate: conversionRateTarget,
    };

    const progress = {
      revenue: {
        current: thisMonthRevenue,
        target: goals.monthlyRevenue,
        percentage: targetAchievement,
      },
      deals: {
        current: thisMonthDeals.length,
        target: goals.monthlyDeals,
        percentage: goals.monthlyDeals > 0 
          ? (thisMonthDeals.length / goals.monthlyDeals) * 100 
          : 0,
      },
      conversion: {
        current: conversionRate,
        target: goals.conversionRate,
        percentage: goals.conversionRate > 0 
          ? (conversionRate / goals.conversionRate) * 100 
          : 0,
      },
    };

    const response = {
      metrics: {
        thisMonthRevenue,
        thisMonthDeals: thisMonthDeals.length,
        totalDeals,
        activeDeals,
        closedDeals,
        conversionRate: `${conversionRate.toFixed(1)}%`,
        targetAchievement: `${targetAchievement.toFixed(1)}%`,
        avgDealSize: thisMonthDeals.length > 0 
          ? thisMonthRevenue / thisMonthDeals.length 
          : 0,
      },
      goals,
      progress,
      trends: {
        monthlyTrends,
      },
      insights: {
        bestMonth: monthlyTrends.reduce((best, current) => 
          current.revenue > best.revenue ? current : best, monthlyTrends[0] || { month: '', revenue: 0 }
        ),
        avgMonthlyRevenue: monthlyTrends.length > 0
          ? monthlyTrends.reduce((sum, m) => sum + m.revenue, 0) / monthlyTrends.length
          : 0,
      },
    };

    logger.info('Agent performance metrics fetched successfully', {
      agentId: user.id,
      thisMonthRevenue,
      targetAchievement: `${targetAchievement.toFixed(1)}%`,
      module: 'Agent-Performance'
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch agent performance', error, { 
      module: 'Agent-API',
      endpoint: '/api/agent/performance'
    });
    return apiError('Failed to fetch performance metrics', 500);
  }
}
