import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgent, requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/kanban/[id]
 * Get board details with stages and deals
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Use new unified auth - allow agents to view board details
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;

    // Fetch board without relations (KanbanBoard model doesn't have explicit relations)
    const board = await prisma.kanbanBoard.findUnique({
      where: { id }
    });

    if (!board) {
      return apiError('Board not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Manually fetch stages, deals, and customFields
    const [stages, deals, customFields] = await Promise.all([
      prisma.stage.findMany({
        where: { boardId: id },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.deal.findMany({
        where: { boardId: id, isArchived: false }
      }),
      prisma.customField.findMany({
        where: { boardId: id },
        orderBy: { orderIndex: 'asc' }
      })
    ]);

    // Get stage IDs and deal IDs for fetching related data
    const stageIds = stages.map(s => s.id);
    const dealIds = deals.map(d => d.id);

    // Fetch related data for deals
    const [owners, clients, collaboratorLinks, commentCounts] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: [...new Set(deals.map(d => d.ownerId))] } },
        select: { id: true, name: true, email: true }
      }),
      prisma.client.findMany({
        where: { id: { in: [...new Set(deals.map(d => d.clientId))] } },
        select: { id: true, name: true }
      }),
      prisma.dealCollaborators.findMany({
        where: { A: { in: dealIds } }
      }),
      prisma.comment.groupBy({
        by: ['dealId'],
        where: { dealId: { in: dealIds } },
        _count: { id: true }
      })
    ]);

    // Fetch collaborator user details
    const collaboratorUserIds = [...new Set(collaboratorLinks.map(c => c.B))];
    const collaborators = collaboratorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: collaboratorUserIds } },
          select: { id: true, name: true }
        })
      : [];

    // Create lookup maps
    const ownerMap = new Map(owners.map(o => [o.id, o]));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const collaboratorUserMap = new Map(collaborators.map(u => [u.id, u]));
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

    // Group deals by stageId
    const dealsByStageId = new Map<string, typeof deals>();
    deals.forEach(deal => {
      if (!dealsByStageId.has(deal.stageId)) {
        dealsByStageId.set(deal.stageId, []);
      }
      dealsByStageId.get(deal.stageId)!.push(deal);
    });

    // Enrich stages with deals
    const enrichedStages = stages.map(stage => {
      const stageDeals = dealsByStageId.get(stage.id) || [];
      return {
        ...stage,
        deals: stageDeals.map(deal => ({
          ...deal,
          owner: ownerMap.get(deal.ownerId) || null,
          client: clientMap.get(deal.clientId) || null,
          collaborators: dealCollaboratorsMap.get(deal.id) || [],
          _count: { comments: commentCountMap.get(deal.id) || 0 }
        }))
      };
    });

    return apiSuccess({
      ...board,
      stages: enrichedStages,
      customFields
    });
  } catch (error: unknown) {
    logger.error('Error fetching board', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_KANBAN_BOARD' });
    return apiError('Failed to fetch board', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/admin/kanban/[id]
 * Update board details
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Use new unified auth - require admin for updating boards
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { name, description, branchId } = body;

    const board = await prisma.kanbanBoard.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(branchId !== undefined && { branchId })
      }
    });

    // Manually fetch stages for response
    const stages = await prisma.stage.findMany({
      where: { boardId: id },
      orderBy: { orderIndex: 'asc' }
    });

    return apiSuccess({
      ...board,
      stages
    });
  } catch (error: unknown) {
    logger.error('Error updating board', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'PUT_KANBAN_BOARD' });
    return apiError('Failed to update board', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/admin/kanban/[id]
 * Archive a board
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Use new unified auth - require admin for deleting boards
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    // Archive board (soft delete)
    const board = await prisma.kanbanBoard.update({
      where: { id },
      data: { isArchived: true }
    });

    return apiSuccess({
      board,
      message: 'Board archived successfully'
    });
  } catch (error: unknown) {
    logger.error('Error deleting board', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'DELETE_KANBAN_BOARD' });
    return apiError('Failed to delete board', 500, ErrorCodes.DELETE_ERROR);
  }
}
