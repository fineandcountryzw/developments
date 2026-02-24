import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { calculateDealMetrics } from '@/lib/deal-intelligence';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/deals/[id]/intelligence
 * Get deal intelligence metrics
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

    // Manually fetch stage
    const stage = await prisma.stage.findUnique({
      where: { id: deal.stageId }
    });

    // Manually fetch board and its stages
    let stages: { id: string }[] = [];
    if (stage) {
      const board = await prisma.kanbanBoard.findUnique({
        where: { id: stage.boardId }
      });
      if (board) {
        stages = await prisma.stage.findMany({
          where: { boardId: board.id },
          select: { id: true },
          orderBy: { orderIndex: 'asc' }
        });
      }
    }

    // Manually fetch collaborators count from join table
    const collaborators = await prisma.dealCollaborators.findMany({
      where: { A: id }
    });
    const collaboratorCount = collaborators.length;

    // Manually fetch latest activity
    const latestActivity = await prisma.dealActivity.findFirst({
      where: { dealId: id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Find stage index
    const stageIndex = stages.findIndex(s => s.id === deal.stageId);
    const totalStages = stages.length;

    // Get last activity date
    const lastActivityDate = latestActivity?.createdAt || null;

    // Calculate metrics
    const metrics = calculateDealMetrics(
      deal,
      stageIndex,
      totalStages,
      collaboratorCount,
      lastActivityDate
    );

    // Get comments for engagement
    const commentCount = await prisma.comment.count({
      where: { dealId: id }
    });

    // Get activity count
    const activityCount = await prisma.dealActivity.count({
      where: { dealId: id }
    });

    return NextResponse.json({
      success: true,
      data: {
        dealId: id,
        dealTitle: deal.title,
        dealValue: deal.value,
        probability: deal.probability,
        metrics,
        engagement: {
          commentCount,
          collaboratorCount,
          activityCount
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Error calculating deal intelligence', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_DEAL_INTELLIGENCE' });
    return apiError('Failed to calculate metrics', 500, ErrorCodes.FETCH_ERROR);
  }
}
