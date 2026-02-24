import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/kanban/stages/[boardId]
 * Get all stages for a board
 */
export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');
    
    if (!boardId) {
      return apiError('Board ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    // Use new unified auth - allow agents to view stages
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;

    // Fetch stages without deals relation (Stage model doesn't have explicit deals relation)
    const stages = await prisma.stage.findMany({
      where: { boardId },
      orderBy: { orderIndex: 'asc' }
    });

    // Manually fetch deals for all stages
    const stageIds = stages.map(s => s.id);
    const deals = stageIds.length > 0
      ? await prisma.deal.findMany({
          where: {
            stageId: { in: stageIds },
            isArchived: false
          },
          select: {
            id: true,
            stageId: true,
            title: true,
            value: true,
            probability: true,
            healthScore: true
          }
        })
      : [];

    // Group deals by stageId
    const dealsByStageId = new Map<string, typeof deals>();
    deals.forEach(deal => {
      if (!dealsByStageId.has(deal.stageId)) {
        dealsByStageId.set(deal.stageId, []);
      }
      dealsByStageId.get(deal.stageId)!.push(deal);
    });

    // Enrich stages with deals
    const enrichedStages = stages.map(stage => ({
      ...stage,
      deals: dealsByStageId.get(stage.id) || []
    }));

    return apiSuccess(enrichedStages);
  } catch (error: unknown) {
    logger.error('Error fetching stages', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_KANBAN_STAGES' });
    return apiError('Failed to fetch stages', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/kanban/stages
 * Create a new stage
 */
export async function POST(request: NextRequest) {
  try {
    // Use new unified auth - require admin for creating stages
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { boardId, name, color, wipLimit, orderIndex } = body;

    if (!boardId || !name) {
      return apiError('Board ID and name are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const stage = await prisma.stage.create({
      data: {
        boardId,
        name,
        color: color || '#3b82f6',
        wipLimit,
        orderIndex: orderIndex ?? 0
      }
    });

    return apiSuccess(stage, 201);
  } catch (error: unknown) {
    logger.error('Error creating stage', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'POST_KANBAN_STAGES' });
    return apiError('Failed to create stage', 500, ErrorCodes.CREATE_ERROR);
  }
}

