import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/access-control';
import { emitEvent } from '@/lib/automation/event-emitter';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/deals/[id]
 * Get deal details
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    // Fetch deal without relations (Deal model doesn't have explicit relations)
    const deal = await prisma.deal.findUnique({
      where: { id }
    });

    if (!deal) {
      return apiError('Deal not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Manually fetch related data
    const [stage, board, client, owner, collaboratorLinks, comments, activities] = await Promise.all([
      prisma.stage.findUnique({ where: { id: deal.stageId } }),
      prisma.kanbanBoard.findUnique({ where: { id: deal.boardId } }),
      prisma.client.findUnique({ where: { id: deal.clientId } }),
      prisma.user.findUnique({ where: { id: deal.ownerId }, select: { id: true, name: true, email: true } }),
      prisma.dealCollaborators.findMany({ where: { A: id } }),
      prisma.comment.findMany({ where: { dealId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.dealActivity.findMany({ where: { dealId: id }, orderBy: { createdAt: 'desc' }, take: 20 })
    ]);

    // Fetch collaborator user details
    const collaboratorUserIds = collaboratorLinks.map(c => c.B);
    const collaborators = collaboratorUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: collaboratorUserIds } }, select: { id: true, name: true } })
      : [];

    // Fetch comment user details
    const commentUserIds = [...new Set(comments.map(c => c.userId))];
    const commentUsers = commentUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: commentUserIds } }, select: { id: true, name: true } })
      : [];
    const commentUserMap = new Map(commentUsers.map(u => [u.id, u]));
    const commentsWithUsers = comments.map(c => ({ ...c, user: commentUserMap.get(c.userId) || null }));

    // Fetch activity user details
    const activityUserIds = [...new Set(activities.map(a => a.userId))];
    const activityUsers = activityUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: activityUserIds } }, select: { id: true, name: true } })
      : [];
    const activityUserMap = new Map(activityUsers.map(u => [u.id, u]));
    const activitiesWithUsers = activities.map(a => ({ ...a, user: activityUserMap.get(a.userId) || null }));

    return apiSuccess({
      ...deal,
      stage,
      board,
      client,
      owner,
      collaborators,
      comments: commentsWithUsers,
      activities: activitiesWithUsers
    });
  } catch (error: unknown) {
    logger.error('Error fetching deal', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_DEAL' });
    return apiError('Failed to fetch deal', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/admin/deals/[id]
 * Update deal details
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { title, description, value, probability, expectedCloseDate, healthScore, riskLevel, customValues } = body;

    // Update deal
    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(value !== undefined && { value: parseFloat(value) }),
        ...(probability !== undefined && { probability }),
        ...(expectedCloseDate && { expectedCloseDate: new Date(expectedCloseDate) }),
        ...(healthScore !== undefined && { healthScore }),
        ...(riskLevel && { riskLevel }),
        ...(customValues && { customValues })
      }
    });

    // Manually fetch related data for response
    const [stage, client, owner, board] = await Promise.all([
      prisma.stage.findUnique({ where: { id: deal.stageId } }),
      prisma.client.findUnique({ where: { id: deal.clientId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: deal.ownerId }, select: { id: true, name: true } }),
      prisma.kanbanBoard.findUnique({ where: { id: deal.boardId }, select: { id: true, branchId: true } })
    ]);

    const dealWithRelations = { ...deal, stage, client, owner, board };

    // Emit event for automation system
    emitEvent({
      type: 'deal.updated',
      entityType: 'deal',
      entityId: id,
      payload: {
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        stageId: deal.stageId,
        healthScore: deal.healthScore,
        riskLevel: deal.riskLevel,
        clientId: deal.clientId,
        ownerId: deal.ownerId
      },
      branch: board?.branchId || user.branch || 'Harare'
    }).catch(err => {
      logger.error('Failed to emit deal.updated event', err, { module: 'API', action: 'PUT_DEAL' });
    });

    return apiSuccess(dealWithRelations);
  } catch (error: unknown) {
    logger.error('Error updating deal', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'PUT_DEAL' });
    return apiError('Failed to update deal', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/admin/deals/[id]
 * Archive a deal
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const deal = await prisma.deal.update({
      where: { id },
      data: { isArchived: true }
    });

    return apiSuccess({
      message: 'Deal archived successfully',
      deal
    });
  } catch (error: unknown) {
    logger.error('Error archiving deal', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'DELETE_DEAL' });
    return apiError('Failed to archive deal', 500, ErrorCodes.DELETE_ERROR);
  }
}
