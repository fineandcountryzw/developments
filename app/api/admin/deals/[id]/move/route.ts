import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/access-control';
import { emitEvent } from '@/lib/automation/event-emitter';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/admin/deals/[id]/move
 * Move deal to another stage
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { stageId } = body;

    if (!stageId) {
      return apiError('Stage ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get current deal
    const currentDeal = await prisma.deal.findUnique({
      where: { id },
      select: { stageId: true }
    });

    if (!currentDeal) {
      return apiError('Deal not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Update deal
    await prisma.deal.update({
      where: { id },
      data: { stageId }
    });

    // Record activity
    if (currentDeal.stageId !== stageId) {
      await prisma.dealActivity.create({
        data: {
          dealId: id,
          userId: user.id,
          type: 'moved',
          changes: {
            field: 'stageId',
            oldValue: currentDeal.stageId,
            newValue: stageId
          }
        }
      });
    }

    // Fetch updated deal without relations (Deal model doesn't have explicit relations)
    const updatedDeal = await prisma.deal.findUnique({
      where: { id }
    });

    if (updatedDeal) {
      // Manually fetch stage
      const stage = await prisma.stage.findUnique({
        where: { id: updatedDeal.stageId }
      });

      // Manually fetch client
      const client = await prisma.client.findUnique({
        where: { id: updatedDeal.clientId },
        select: { id: true, name: true }
      });

      // Manually fetch owner (user)
      const owner = await prisma.user.findUnique({
        where: { id: updatedDeal.ownerId },
        select: { id: true, name: true }
      });

      // Manually fetch board
      const board = await prisma.kanbanBoard.findUnique({
        where: { id: updatedDeal.boardId },
        select: { id: true, branchId: true }
      });

      // Note: Pipeline helpers removed - deal stage sync handled by event system

      // Emit event for automation system (deal stage changed)
      emitEvent({
        type: 'deal.stage_changed',
        entityType: 'deal',
        entityId: id,
        payload: {
          oldStageId: currentDeal.stageId,
          newStageId: stageId,
          dealId: id,
          clientId: updatedDeal.clientId,
          ownerId: updatedDeal.ownerId,
          standId: updatedDeal.standId
        },
        branch: board?.branchId || user.branch || 'Harare'
      }).catch(err => {
        logger.error('Failed to emit deal.stage_changed event', err, { module: 'API', action: 'MOVE_DEAL', dealId: id });
      });

      return apiSuccess({
        message: 'Deal moved successfully',
        deal: {
          ...updatedDeal,
          stage,
          client,
          owner,
          board
        }
      });
    }

    return apiSuccess({
      message: 'Deal moved successfully',
      deal: updatedDeal
    });
  } catch (error: unknown) {
    logger.error('Error moving deal', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'MOVE_DEAL' });
    return apiError('Failed to move deal', 500, ErrorCodes.UPDATE_ERROR);
  }
}
