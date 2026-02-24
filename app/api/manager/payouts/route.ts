import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/payouts
 * Payout/commission analytics for Manager Dashboard
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/manager/payouts called', { module: 'Manager-API' });

    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const monthFilter = searchParams.get('month') || null;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const branchFilter = branch === 'all' ? {} : { branch };
    const month = monthFilter || currentMonth;

    const [
      currentMonthAgg,
      previousMonthAgg,
      pendingAgg,
      paidAgg,
      agentBreakdownRows,
      revenueAgg
    ] = await Promise.all([
      prisma.commission.aggregate({
        where: {
          ...branchFilter,
          month,
          status: { in: ['CALCULATED', 'APPROVED'] }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.commission.aggregate({
        where: {
          ...branchFilter,
          month: previousMonth,
          status: { in: ['CALCULATED', 'APPROVED', 'PAID'] }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.commission.aggregate({
        where: { ...branchFilter, status: { in: ['CALCULATED', 'APPROVED'] } },
        _sum: { amount: true },
        _count: true
      }),
      prisma.commission.aggregate({
        where: { ...branchFilter, status: 'PAID' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.commission.groupBy({
        by: ['agentId', 'status'],
        where: { ...branchFilter, month },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          ...(branch === 'all' ? {} : { office_location: branch }),
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
        },
        _sum: { amount: true }
      })
    ]);

    const agentIds = [...new Set(agentBreakdownRows.map(r => r.agentId))];
    const users = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, email: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const currentDue = Number(currentMonthAgg._sum.amount ?? 0);
    const prevTotal = Number(previousMonthAgg._sum.amount ?? 0);
    const trend = prevTotal > 0 ? ((currentDue - prevTotal) / prevTotal) * 100 : (currentDue > 0 ? 100 : 0);
    const totalPendingAmount = Number(pendingAgg._sum.amount ?? 0);
    const totalPaidAmount = Number(paidAgg._sum.amount ?? 0);
    const totalPendingCount = pendingAgg._count;
    const totalPaidCount = paidAgg._count;
    const revenue = Number(revenueAgg._sum.amount ?? 0);
    const netCash = revenue - currentDue;
    const margin = revenue > 0 ? ((netCash / revenue) * 100).toFixed(1) : '0.0';

    const byAgent = new Map<string, { calculated: number; approved: number; paid: number; count: number }>();
    for (const r of agentBreakdownRows) {
      const key = r.agentId;
      if (!byAgent.has(key)) byAgent.set(key, { calculated: 0, approved: 0, paid: 0, count: 0 });
      const v = byAgent.get(key)!;
      const amt = Number(r._sum.amount ?? 0);
      v.count += r._count;
      if (r.status === 'CALCULATED') v.calculated += amt;
      else if (r.status === 'APPROVED') v.approved += amt;
      else if (r.status === 'PAID') v.paid += amt;
    }

    const distCalc = agentBreakdownRows.filter(r => r.status === 'CALCULATED').reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
    const distAppr = agentBreakdownRows.filter(r => r.status === 'APPROVED').reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
    const distPaid = agentBreakdownRows.filter(r => r.status === 'PAID').reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);

    const agentBreakdown = Array.from(byAgent.entries()).map(([agentId, v]) => {
      const u = userMap.get(agentId);
      const total = v.calculated + v.approved + v.paid;
      return {
        agent: { name: u?.name ?? 'Unknown', email: u?.email ?? '' },
        calculated: v.calculated,
        approved: v.approved,
        paid: v.paid,
        total,
        commissionCount: v.count
      };
    });

    const monthlyTrends: { month: string; monthName: string; calculated: number; approved: number; paid: number; totalAgents: number; commissionCount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const [agg, agents] = await Promise.all([
        prisma.commission.groupBy({
          by: ['status'],
          where: { ...branchFilter, month: m },
          _sum: { amount: true },
          _count: true
        }),
        prisma.commission.groupBy({
          by: ['agentId'],
          where: { ...branchFilter, month: m }
        })
      ]);
      const calc = agg.find(x => x.status === 'CALCULATED')?._sum?.amount ?? 0;
      const appr = agg.find(x => x.status === 'APPROVED')?._sum?.amount ?? 0;
      const paid = agg.find(x => x.status === 'PAID')?._sum?.amount ?? 0;
      const cnt = agg.reduce((s, x) => s + x._count, 0);
      monthlyTrends.push({
        month: m,
        monthName: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        calculated: Number(calc),
        approved: Number(appr),
        paid: Number(paid),
        totalAgents: agents.length,
        commissionCount: cnt
      });
    }

    const data = {
      summary: {
        currentMonth: {
          due: currentDue,
          agents: agentIds.length,
          commissions: currentMonthAgg._count,
          trend,
          trendDirection: (trend >= 0 ? 'up' : 'down') as 'up' | 'down',
          month
        },
        previousMonth: {
          total: prevTotal,
          commissions: previousMonthAgg._count,
          month: previousMonth
        },
        totalPending: { amount: totalPendingAmount, commissions: totalPendingCount, agents: agentIds.length },
        totalPaid: { amount: totalPaidAmount, commissions: totalPaidCount },
        netCashPosition: {
          amount: netCash,
          revenue,
          payouts: currentDue,
          margin
        },
        branch: branch === 'all' ? 'All Branches' : branch
      },
      agentBreakdown,
      monthlyTrends,
      payoutDistribution: { calculated: distCalc, approved: distAppr, paid: distPaid }
    };

    return apiSuccess(data);
  } catch (e: any) {
    logger.error('Failed to fetch manager payouts', e, { module: 'Manager-API', endpoint: '/api/manager/payouts' });
    return apiError('Failed to fetch payouts', 500);
  }
}
