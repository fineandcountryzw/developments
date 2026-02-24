import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent, requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/kanban
 * List all Kanban boards.
 * ?ensureDefault=true&branch=Harare — ensure a default board exists, create if none.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;

    const ensureDefault = request.nextUrl.searchParams.get('ensureDefault') === 'true';
    const branch = request.nextUrl.searchParams.get('branch') || 'Harare';

    // Fetch boards without relations (KanbanBoard model doesn't have explicit relations)
    let boards = await prisma.kanbanBoard.findMany({
      where: { isArchived: false }
    });

    if (ensureDefault && boards.length === 0) {
      // Create default board without pipeline helpers
      const defaultBoard = await prisma.kanbanBoard.create({
        data: {
          name: `Default Board - ${branch}`,
          description: `Default board for ${branch} branch`,
          branchId: branch
        }
      });
      // Create default stages
      await prisma.stage.createMany({
        data: [
          { boardId: defaultBoard.id, name: 'Lead', color: '#ef4444', orderIndex: 0 },
          { boardId: defaultBoard.id, name: 'Negotiation', color: '#f97316', orderIndex: 1 },
          { boardId: defaultBoard.id, name: 'Closed Won', color: '#22c55e', orderIndex: 2 }
        ]
      });
      boards = await prisma.kanbanBoard.findMany({
        where: { isArchived: false }
      });
    }

    // Manually fetch stages, deals, and rules for all boards
    const boardIds = boards.map(b => b.id);
    const [stages, deals, rules] = await Promise.all([
      prisma.stage.findMany({
        where: { boardId: { in: boardIds } },
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.deal.findMany({
        where: { boardId: { in: boardIds } }
      }),
      prisma.pipelineRule.findMany({
        where: { boardId: { in: boardIds } }
      })
    ]);

    // Group stages by boardId
    const stagesByBoardId = new Map<string, typeof stages>();
    stages.forEach(stage => {
      if (!stagesByBoardId.has(stage.boardId)) {
        stagesByBoardId.set(stage.boardId, []);
      }
      stagesByBoardId.get(stage.boardId)!.push(stage);
    });

    // Count deals and rules by boardId
    const dealsCountByBoardId = new Map<string, number>();
    deals.forEach(deal => {
      dealsCountByBoardId.set(deal.boardId, (dealsCountByBoardId.get(deal.boardId) || 0) + 1);
    });

    const rulesCountByBoardId = new Map<string, number>();
    rules.forEach(rule => {
      rulesCountByBoardId.set(rule.boardId, (rulesCountByBoardId.get(rule.boardId) || 0) + 1);
    });

    // Enrich boards with stages and counts
    const enrichedBoards = boards.map(board => ({
      ...board,
      stages: stagesByBoardId.get(board.id) || [],
      _count: {
        deals: dealsCountByBoardId.get(board.id) || 0,
        rules: rulesCountByBoardId.get(board.id) || 0
      }
    }));

    return apiSuccess(enrichedBoards);
  } catch (error: unknown) {
    logger.error('GET /api/admin/kanban error', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'GET_KANBAN' });
    return apiError(error instanceof Error ? error.message : 'Failed to fetch boards', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/kanban
 * Create a new Kanban board
 */
export async function POST(request: NextRequest) {
  try {
    // Use new unified auth - require admin for creating kanban boards
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { name, description, branchId } = body;

    if (!name) {
      return apiError('Board name is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create board with default sales stages
    const board = await prisma.kanbanBoard.create({
      data: {
        name,
        description,
        branchId
      }
    });

    // Create stages separately
    await prisma.stage.createMany({
      data: [
        { boardId: board.id, name: 'Lead', color: '#ef4444', orderIndex: 0 },
        { boardId: board.id, name: 'Negotiation', color: '#f97316', orderIndex: 1 },
        { boardId: board.id, name: 'Proposal', color: '#eab308', orderIndex: 2 },
        { boardId: board.id, name: 'Closing', color: '#22c55e', orderIndex: 3 },
        { boardId: board.id, name: 'Won', color: '#06b6d4', orderIndex: 4 },
        { boardId: board.id, name: 'Lost', color: '#6b7280', orderIndex: 5 }
      ]
    });

    // Manually fetch stages for response
    const boardStages = await prisma.stage.findMany({
      where: { boardId: board.id },
      orderBy: { orderIndex: 'asc' }
    });
    const boardWithStages = { ...board, stages: boardStages };

    return apiSuccess(boardWithStages, 201);
  } catch (error: unknown) {
    logger.error('Error creating Kanban board', error instanceof Error ? error : new Error(String(error)), { module: 'API', action: 'POST_KANBAN' });
    return apiError('Failed to create board', 500, ErrorCodes.CREATE_ERROR);
  }
}
