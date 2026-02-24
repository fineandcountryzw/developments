import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/[id]
 * Get a specific task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: {
        id: id,
        userId: user.id, // Ensure user can only access their own tasks
      },
    });

    if (!task) {
      return apiError('Task not found', 404);
    }

    return apiSuccess(task);

  } catch (error: any) {
    const { id } = await params;
    logger.error('Failed to fetch task', error, { 
      module: 'Task-API',
      endpoint: `/api/tasks/${id}`
    });
    return apiError('Failed to fetch task', 500);
  }
}

/**
 * PATCH /api/tasks/[id]
 * Update a task
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info(`PATCH /api/tasks/${id} called`, { module: 'Task-API' });

    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Verify task exists and belongs to user
    const existingTask = await prisma.task.findFirst({
      where: {
        id: id,
        userId: user.id,
      },
    });

    if (!existingTask) {
      return apiError('Task not found', 404);
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      notes, 
      status, 
      priority, 
      dueDate, 
      tags,
      metadata 
    } = body;

    const updateData: Prisma.TaskUpdateInput = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (status !== undefined) updateData.status = status.toUpperCase();
    if (priority !== undefined) updateData.priority = priority.toUpperCase();
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata ?? Prisma.JsonNull;

    // If status is being set to COMPLETED, set completedAt
    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: id },
      data: updateData,
    });

    // Log activity
    await prisma.auditTrail.create({
      data: {
        action: 'TASK_UPDATED',
        resourceType: 'TASK',
        resourceId: task.id,
        userId: user.id,
        details: {
          taskTitle: task.title,
          taskStatus: task.status,
          changes: body,
        },
      },
    }).catch(err => logger.warn('Audit log failed', { error: err }));

    logger.info('Task updated successfully', {
      taskId: task.id,
      userId: user.id,
      module: 'Task-API'
    });

    return apiSuccess(task);

  } catch (error: any) {
    const { id } = await params;
    logger.error('Failed to update task', error, { 
      module: 'Task-API',
      endpoint: `/api/tasks/${id}`
    });
    return apiError(error.message || 'Failed to update task', 500);
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info(`DELETE /api/tasks/${id} called`, { module: 'Task-API' });

    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Verify task exists and belongs to user
    const existingTask = await prisma.task.findFirst({
      where: {
        id: id,
        userId: user.id,
      },
    });

    if (!existingTask) {
      return apiError('Task not found', 404);
    }

    await prisma.task.delete({
      where: { id: id },
    });

    // Log activity
    await prisma.auditTrail.create({
      data: {
        action: 'TASK_DELETED',
        resourceType: 'TASK',
        resourceId: id,
        userId: user.id,
        details: {
          taskTitle: existingTask.title,
        },
      },
    }).catch(err => logger.warn('Audit log failed', { error: err }));

    logger.info('Task deleted successfully', {
      taskId: id,
      userId: user.id,
      module: 'Task-API'
    });

    return apiSuccess({ deleted: true });

  } catch (error: any) {
    const { id } = await params;
    logger.error('Failed to delete task', error, { 
      module: 'Task-API',
      endpoint: `/api/tasks/${id}`
    });
    return apiError(error.message || 'Failed to delete task', 500);
  }
}
