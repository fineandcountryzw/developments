import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/targets/:id
 * Fetch a single sales target
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const target = await prisma.salesTarget.findUnique({
      where: { id }
    });

    if (!target) {
      return apiError('Target not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (target.branch !== user.branch && user.role !== 'ADMIN') {
      return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
    }

    return apiSuccess(target);
  } catch (error: any) {
    logger.error('Failed to fetch target', error, { module: 'Manager-API', endpoint: '/api/manager/targets/[id]' });
    return apiError(error.message || 'Failed to fetch target', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * DELETE /api/manager/targets/:id
 * Delete a sales target
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return apiError('Invalid target ID', 400, ErrorCodes.INVALID_ID);
    }

    const target = await prisma.salesTarget.findUnique({
      where: { id }
    });

    if (!target) {
      return apiError('Target not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (target.branch !== user.branch && user.role !== 'ADMIN') {
      return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
    }

    await prisma.salesTarget.delete({
      where: { id }
    });

    return apiSuccess({ id, message: 'Target deleted' });
  } catch (error: any) {
    logger.error('Failed to delete target', error, { module: 'Manager-API', endpoint: '/api/manager/targets/[id]' });
    return apiError(error.message || 'Failed to delete target', 500, ErrorCodes.DELETE_ERROR);
  }
}
