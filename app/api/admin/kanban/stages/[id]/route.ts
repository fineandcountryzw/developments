import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * PUT /api/admin/kanban/stages/[id]
 * Update a stage
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use new unified auth - require admin for updating stages
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { name, color, wipLimit, orderIndex } = body;

    const stage = await prisma.stage.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(wipLimit !== undefined && { wipLimit }),
        ...(orderIndex !== undefined && { orderIndex })
      }
    });

    return apiSuccess(stage);
  } catch (error: any) {
    logger.error('Error updating stage', error, { module: 'API', action: 'PUT_KANBAN_STAGES' });
    return apiError('Failed to update stage', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/admin/kanban/stages/[id]
 * Delete a stage
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use new unified auth - require admin for deleting stages
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Check if stage has deals
    const dealsCount = await prisma.deal.count({
      where: { stageId: id }
    });

    if (dealsCount > 0) {
      return apiError('Cannot delete stage with active deals', 400, ErrorCodes.CONSTRAINT_VIOLATION);
    }

    await prisma.stage.delete({
      where: { id }
    });

    return apiSuccess({ message: 'Stage deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting stage', error, { module: 'API', action: 'DELETE_KANBAN_STAGES' });
    return apiError('Failed to delete stage', 500, ErrorCodes.DELETE_ERROR);
  }
}
