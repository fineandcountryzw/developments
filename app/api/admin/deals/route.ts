import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/deals
 * List all deals with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');
    const stageId = searchParams.get('stageId');
    const clientId = searchParams.get('clientId');
    const ownerId = searchParams.get('ownerId');
    const minValue = searchParams.get('minValue');
    const maxValue = searchParams.get('maxValue');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const standId = searchParams.get('standId');
    
    const where: Record<string, unknown> = {
      isArchived: false,
      ...(boardId && { boardId }),
      ...(stageId && { stageId }),
      ...(clientId && { clientId }),
      ...(ownerId && { ownerId }),
      ...(standId && { standId }),
      ...(minValue && { value: { gte: parseFloat(minValue) } }),
      ...(maxValue && { value: { lte: parseFloat(maxValue) } })
    };

    // Fetch deals without relations
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.deal.count({ where })
    ]);

    // Manually fetch related data
    const stageIds = [...new Set(deals.map(d => d.stageId))];
    const clientIds = [...new Set(deals.map(d => d.clientId))];
    const ownerIds = [...new Set(deals.map(d => d.ownerId))];
    const standIds = [...new Set(deals.filter(d => d.standId).map(d => d.standId as string))];
    const dealIds = deals.map(d => d.id);

    const [stages, clients, owners, stands, collaboratorLinks, commentCounts] = await Promise.all([
      prisma.stage.findMany({ where: { id: { in: stageIds } } }),
      prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } }),
      standIds.length > 0 ? prisma.stand.findMany({
        where: { id: { in: standIds } },
        select: { id: true, standNumber: true, price: true, status: true, developmentId: true }
      }) : [],
      prisma.dealCollaborators.findMany({ where: { A: { in: dealIds } } }),
      prisma.comment.groupBy({ by: ['dealId'], where: { dealId: { in: dealIds } }, _count: { id: true } })
    ]);

    // Fetch development data for stands
    const developmentIds = [...new Set(stands.map(s => s.developmentId))];
    const developments = developmentIds.length > 0
      ? await prisma.development.findMany({ where: { id: { in: developmentIds } }, select: { id: true, name: true, location: true } })
      : [];
    const devMap = new Map(developments.map(d => [d.id, d]));

    // Fetch collaborator user details
    const collaboratorUserIds = [...new Set(collaboratorLinks.map(c => c.B))];
    const collaboratorUsers = collaboratorUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: collaboratorUserIds } }, select: { id: true, name: true } })
      : [];
    const collaboratorUserMap = new Map(collaboratorUsers.map(u => [u.id, u]));

    // Create lookup maps
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const ownerMap = new Map(owners.map(o => [o.id, o]));
    const standMap = new Map(stands.map(s => [s.id, { ...s, development: devMap.get(s.developmentId) || null }]));
    const commentCountMap = new Map(commentCounts.map(c => [c.dealId, c._count.id]));

    // Group collaborators by deal
    const dealCollaboratorsMap = new Map<string, { id: string; name: string | null }[]>();
    collaboratorLinks.forEach(link => {
      if (!dealCollaboratorsMap.has(link.A)) {
        dealCollaboratorsMap.set(link.A, []);
      }
      const user = collaboratorUserMap.get(link.B);
      if (user) {
        dealCollaboratorsMap.get(link.A)!.push(user);
      }
    });

    // Enrich deals with related data
    const enrichedDeals = deals.map(deal => ({
      ...deal,
      stage: stageMap.get(deal.stageId) || null,
      client: clientMap.get(deal.clientId) || null,
      owner: ownerMap.get(deal.ownerId) || null,
      collaborators: dealCollaboratorsMap.get(deal.id) || [],
      stand: deal.standId ? standMap.get(deal.standId) || null : null,
      _count: { comments: commentCountMap.get(deal.id) || 0 }
    }));

    return apiSuccess(enrichedDeals, 200, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error: unknown) {
    logger.error('Error fetching deals', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_DEALS' });
    return apiError('Failed to fetch deals', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/deals
 * Create a new deal
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { boardId, stageId, clientId, ownerId, title, description, value, probability, expectedCloseDate } = body;

    if (!boardId || !stageId || !clientId || !ownerId || !title || !value) {
      return apiError('Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const deal = await prisma.deal.create({
      data: {
        boardId,
        stageId,
        clientId,
        ownerId,
        title,
        description,
        value: parseFloat(value),
        probability: probability || 50,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined
      }
    });

    // Manually fetch related data for response
    const [stage, client, owner] = await Promise.all([
      prisma.stage.findUnique({ where: { id: deal.stageId } }),
      prisma.client.findUnique({ where: { id: deal.clientId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: deal.ownerId }, select: { id: true, name: true } })
    ]);

    return apiSuccess({ ...deal, stage, client, owner }, 201);
  } catch (error: unknown) {
    logger.error('Error creating deal', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'POST_DEALS' });
    return apiError('Failed to create deal', 500, ErrorCodes.CREATE_ERROR);
  }
}
