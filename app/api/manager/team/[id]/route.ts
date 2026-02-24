import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/manager/team/:id
 * Update agent profile (name, activation status)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { name, isActive, revokeReason } = body || {};

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return apiError('Invalid agent ID', 400, ErrorCodes.INVALID_ID);
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)) {
      return apiError('Name must be between 1 and 100 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate revoke reason if provided
    if (revokeReason !== undefined && (typeof revokeReason !== 'string' || revokeReason.length > 500)) {
      return apiError('Revoke reason must not exceed 500 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== 'AGENT') {
      return apiError('Agent not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (target.branch !== user.branch && user.role !== 'ADMIN') {
      return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const updateData: any = {};
    if (typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
    }

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
      if (!isActive) {
        updateData.accessRevokedAt = new Date();
        updateData.accessRevokedBy = user.id;
        updateData.revokeReason = revokeReason || 'Revoked by manager';
      } else {
        updateData.accessRevokedAt = null;
        updateData.accessRevokedBy = null;
        updateData.revokeReason = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('No updates provided', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, branch: true, isActive: true }
    });

    return apiSuccess({ ...updated, message: 'Agent updated' });
  } catch (error: any) {
    logger.error('Failed to update agent', error, { module: 'API', action: 'UPDATE_TEAM_MEMBER' });
    return apiError(error.message || 'Failed to update agent', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/manager/team/:id
 * Deactivate agent account (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== 'AGENT') {
      return apiError('Agent not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (target.branch !== user.branch && user.role !== 'ADMIN') {
      return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        accessRevokedAt: new Date(),
        accessRevokedBy: user.id,
        revokeReason: 'Deactivated by manager'
      },
      select: { id: true, name: true, email: true, branch: true, isActive: true }
    });

    return apiSuccess({ ...updated, message: 'Agent deactivated' });
  } catch (error: any) {
    logger.error('Failed to deactivate agent', error, { module: 'API', action: 'DELETE_TEAM_MEMBER' });
    return apiError(error.message || 'Failed to deactivate agent', 500, ErrorCodes.DELETE_ERROR);
  }
}
