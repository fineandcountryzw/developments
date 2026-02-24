import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/targets
 * Get sales targets with progress tracking for Manager Dashboard
 * 
 * Query Parameters:
 * - branch: Filter by branch (defaults to user's branch)
 * - period: Specific period filter (YYYY-MM format, defaults to current month)
 * - agentId: Filter by specific agent
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/manager/targets called', { module: 'Manager-API' });

    // Auth check - Manager level access required
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const agentId = searchParams.get('agentId');
    
    // Default to current month
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const period = searchParams.get('period') || defaultPeriod;

    logger.debug('Targets query parameters', { branch, period, agentId });

    // Build where clause
    const whereClause: any = {
      targetPeriod: period,
      status: 'ACTIVE'
    };

    if (branch !== 'all') {
      whereClause.branch = branch;
    }

    if (agentId) {
      whereClause.agentId = agentId;
    }

    // Parse period to date range (YYYY-MM format)
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Get targets (no relations - schema has no agent/development FKs)
    const targets = await prisma.salesTarget.findMany({
      where: whereClause,
      orderBy: [{ agentId: 'asc' }, { developmentId: 'asc' }]
    });

    // Actual performance: branch-specific raw queries (no nested $queryRaw)
    // Join payments to reservations via stand_id (more reliable than client_id which is nullable in reservations)
    const [revenueRows, dealsRows] = await Promise.all([
      branch === 'all'
        ? prisma.$queryRaw<{ agent_id: string; development_id: string | null; actual_revenue: unknown; payment_count: bigint }[]>`
            SELECT r.agent_id, s.development_id, SUM(p.amount) as actual_revenue, COUNT(p.id) as payment_count
            FROM payments p
            INNER JOIN stands s ON p.stand_id = s.id
            INNER JOIN reservations r ON s.id = r.stand_id AND r.agent_id IS NOT NULL
            WHERE p.status = 'CONFIRMED' 
              AND p.created_at >= ${periodStart}::timestamp
              AND p.created_at <= ${periodEnd}::timestamp
            GROUP BY r.agent_id, s.development_id
          `
        : prisma.$queryRaw<{ agent_id: string; development_id: string | null; actual_revenue: unknown; payment_count: bigint }[]>`
            SELECT r.agent_id, s.development_id, SUM(p.amount) as actual_revenue, COUNT(p.id) as payment_count
            FROM payments p
            INNER JOIN stands s ON p.stand_id = s.id
            INNER JOIN reservations r ON s.id = r.stand_id AND r.agent_id IS NOT NULL
            WHERE p.status = 'CONFIRMED' 
              AND p.created_at >= ${periodStart}::timestamp
              AND p.created_at <= ${periodEnd}::timestamp
              AND p.office_location = ${branch}
            GROUP BY r.agent_id, s.development_id
          `,
      branch === 'all'
        ? prisma.$queryRaw<{ agent_id: string; development_id: string | null; actual_deals: bigint }[]>`
            SELECT r.agent_id, s.development_id, COUNT(*) as actual_deals
            FROM reservations r
            INNER JOIN stands s ON r.stand_id = s.id
            WHERE r.status = 'CONFIRMED' 
              AND r.created_at >= ${periodStart}::timestamp
              AND r.created_at <= ${periodEnd}::timestamp
            GROUP BY r.agent_id, s.development_id
          `
        : prisma.$queryRaw<{ agent_id: string; development_id: string | null; actual_deals: bigint }[]>`
            SELECT r.agent_id, s.development_id, COUNT(*) as actual_deals
            FROM reservations r
            INNER JOIN stands s ON r.stand_id = s.id
            WHERE r.status = 'CONFIRMED' 
              AND r.created_at >= ${periodStart}::timestamp
              AND r.created_at <= ${periodEnd}::timestamp
              AND s.branch = ${branch}
            GROUP BY r.agent_id, s.development_id
          `
    ]);

    const actualPerformance = [revenueRows, dealsRows] as [typeof revenueRows, typeof dealsRows];

    // Process actual performance (keys: agent_id from reservations = Agent id; targets use User id – may differ)
    const revenuePerformance = (actualPerformance[0] as any[]).reduce((acc, row) => {
      const key = `${row.agent_id}-${row.development_id || 'all'}`;
      if (!acc[key]) acc[key] = { revenue: 0, payments: 0 };
      acc[key].revenue += Number(row.actual_revenue);
      acc[key].payments += Number(row.payment_count);
      return acc;
    }, {} as Record<string, { revenue: number; payments: number }>);

    const dealsPerformance = (actualPerformance[1] as any[]).reduce((acc, row) => {
      const key = `${row.agent_id}-${row.development_id || 'all'}`;
      acc[key] = Number(row.actual_deals);
      return acc;
    }, {} as Record<string, number>);

    // Resolve agent (User) and development for display
    const agentIds = [...new Set(targets.map(t => t.agentId))];
    const devIds = [...new Set(targets.map(t => t.developmentId).filter(Boolean))] as string[];
    const [users, devs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, email: true } }),
      devIds.length ? prisma.development.findMany({ where: { id: { in: devIds } }, select: { id: true, name: true, location: true } }) : []
    ]);
    const userMap = new Map(users.map(u => [u.id, u]));
    const devMap = new Map((devs as { id: string; name: string; location: string }[]).map(d => [d.id, d]));

    const defaultAgent = { id: '', name: 'Unknown', email: '' };
    const defaultDev = { id: '', name: '—', location: '' };

    // Combine targets with actual performance
    const targetsWithProgress = targets.map(target => {
      const performanceKey = `${target.agentId}-${target.developmentId || 'all'}`;
      const revenueData = revenuePerformance[performanceKey] || { revenue: 0, payments: 0 };
      const dealsData = dealsPerformance[performanceKey] || 0;
      const agent = userMap.get(target.agentId) ?? defaultAgent;
      const development = target.developmentId ? (devMap.get(target.developmentId) ?? defaultDev) : null;

      // Calculate progress percentages
      const revenueProgress = target.revenueTarget 
        ? (revenueData.revenue / Number(target.revenueTarget)) * 100
        : null;

      const dealsProgress = target.dealsTarget
        ? (dealsData / target.dealsTarget) * 100
        : null;

      // Forecast based on current progress (simple linear projection)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const projectionMultiplier = daysInMonth / daysPassed;

      const forecastRevenue = revenueData.revenue * projectionMultiplier;
      const forecastDeals = Math.round(dealsData * projectionMultiplier);

      return {
        id: target.id,
        agent: { id: agent.id, name: agent.name ?? 'Unknown', email: agent.email ?? '' },
        development: development ? { id: development.id, name: development.name, location: development.location } : null,
        targetPeriod: target.targetPeriod,
        targetType: target.targetType,
        
        // Targets
        revenueTarget: target.revenueTarget ? Number(target.revenueTarget) : null,
        dealsTarget: target.dealsTarget,
        
        // Actual Performance
        actualRevenue: revenueData.revenue,
        actualDeals: dealsData,
        paymentCount: revenueData.payments,
        
        // Progress Percentages
        revenueProgress: revenueProgress ? Math.round(revenueProgress * 10) / 10 : null,
        dealsProgress: dealsProgress ? Math.round(dealsProgress * 10) / 10 : null,
        
        // Forecasts
        forecastRevenue: forecastRevenue,
        forecastDeals: forecastDeals,
        
        // Status indicators
        revenueStatus: revenueProgress ? (
          revenueProgress >= 100 ? 'achieved' : 
          revenueProgress >= 80 ? 'on-track' : 
          revenueProgress >= 50 ? 'needs-attention' : 'behind'
        ) : null,
        
        dealsStatus: dealsProgress ? (
          dealsProgress >= 100 ? 'achieved' :
          dealsProgress >= 80 ? 'on-track' :
          dealsProgress >= 50 ? 'needs-attention' : 'behind'
        ) : null,
        
        // Metadata
        setBy: target.setBy,
        notes: target.notes,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt
      };
    });

    // Calculate summary statistics
    const summary = {
      totalTargets: targetsWithProgress.length,
      targetsAchieved: targetsWithProgress.filter(t => 
        (t.revenueProgress && t.revenueProgress >= 100) || 
        (t.dealsProgress && t.dealsProgress >= 100)
      ).length,
      targetsOnTrack: targetsWithProgress.filter(t => 
        (t.revenueProgress && t.revenueProgress >= 80 && t.revenueProgress < 100) ||
        (t.dealsProgress && t.dealsProgress >= 80 && t.dealsProgress < 100)
      ).length,
      targetsBehind: targetsWithProgress.filter(t => 
        (t.revenueProgress && t.revenueProgress < 50) ||
        (t.dealsProgress && t.dealsProgress < 50)
      ).length,
      totalRevenueTarget: targetsWithProgress.reduce((sum, t) => sum + (t.revenueTarget || 0), 0),
      totalActualRevenue: targetsWithProgress.reduce((sum, t) => sum + t.actualRevenue, 0),
      totalDealsTarget: targetsWithProgress.reduce((sum, t) => sum + (t.dealsTarget || 0), 0),
      totalActualDeals: targetsWithProgress.reduce((sum, t) => sum + t.actualDeals, 0),
      period,
      branch: branch === 'all' ? 'All Branches' : branch
    };

    const response = {
      targets: targetsWithProgress,
      summary
    };

    logger.info('Manager targets fetched successfully', {
      branch,
      period,
      totalTargets: targetsWithProgress.length,
      targetsAchieved: summary.targetsAchieved
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch manager targets', error, { 
      module: 'Manager-API',
      endpoint: '/api/manager/targets'
    });
    return apiError('Failed to fetch targets', 500);
  }
}

/**
 * POST /api/manager/targets
 * Create or update sales targets (Manager-only)
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/manager/targets called', { module: 'Manager-API' });

    // Auth check - Manager level access required
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const {
      agentId,
      developmentId,
      targetPeriod,
      targetType = 'MONTHLY',
      revenueTarget,
      dealsTarget,
      notes,
      branch = user.branch || 'Harare'
    } = body;

    // Validation
    if (!agentId || !targetPeriod) {
      return apiError('Agent ID and target period are required', 400);
    }

    if (!revenueTarget && !dealsTarget) {
      return apiError('At least one target (revenue or deals) must be specified', 400);
    }

    // Check if agent exists
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, role: true, name: true }
    });

    if (!agent || agent.role !== 'AGENT') {
      return apiError('Invalid agent ID or user is not an agent', 400);
    }

    // Upsert the target (no relations - schema has no FKs)
    const target = await prisma.salesTarget.upsert({
      where: {
        agentId_developmentId_targetPeriod_targetType: {
          agentId,
          developmentId: developmentId || null,
          targetPeriod,
          targetType
        }
      },
      update: {
        revenueTarget: revenueTarget ? Number(revenueTarget) : null,
        dealsTarget: dealsTarget ? Number(dealsTarget) : null,
        notes,
        setBy: user.id,
        updatedAt: new Date()
      },
      create: {
        agentId,
        developmentId: developmentId || null,
        targetPeriod,
        targetType,
        revenueTarget: revenueTarget ? Number(revenueTarget) : null,
        dealsTarget: dealsTarget ? Number(dealsTarget) : null,
        notes,
        setBy: user.id,
        branch,
        status: 'ACTIVE'
      }
    });

    logger.info('Sales target created/updated successfully', {
      targetId: target.id,
      agentId: target.agentId,
      targetPeriod: target.targetPeriod,
      revenueTarget: target.revenueTarget,
      dealsTarget: target.dealsTarget,
      setBy: user.name || user.email
    });

    return apiSuccess(target);

  } catch (error: any) {
    logger.error('Failed to create/update sales target', error, { 
      module: 'Manager-API',
      endpoint: '/api/manager/targets'
    });
    return apiError('Failed to create/update target', 500);
  }
}