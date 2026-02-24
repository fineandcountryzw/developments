import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { apiSuccess } from '@/lib/api-response';

/**
 * GET /api/agent/deals
 * Get deals for the authenticated agent
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Agents can only see their own deals - fetch without relations
    const deals = await prisma.deal.findMany({
      where: {
        ownerId: user.id,
        isArchived: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Manually fetch related data
    const stageIds = [...new Set(deals.map(d => d.stageId))];
    const clientIds = [...new Set(deals.map(d => d.clientId))];
    const dealIds = deals.map(d => d.id);

    const [stages, clients, commentCounts] = await Promise.all([
      prisma.stage.findMany({ where: { id: { in: stageIds } } }),
      prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
      prisma.comment.groupBy({ by: ['dealId'], where: { dealId: { in: dealIds } }, _count: { id: true } })
    ]);

    // Create lookup maps
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const commentCountMap = new Map(commentCounts.map(c => [c.dealId, c._count.id]));

    // Enrich deals with related data
    const enrichedDeals = deals.map(deal => ({
      ...deal,
      stage: stageMap.get(deal.stageId) || null,
      client: clientMap.get(deal.clientId) || null,
      _count: { comments: commentCountMap.get(deal.id) || 0 }
    }));

    return apiSuccess(enrichedDeals);
  } catch (error: unknown) {
    logger.error('Error fetching agent deals', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_AGENT_DEALS' });
    return apiSuccess([], 200); // Return 200 with empty data to prevent dashboard errors
  }
}
