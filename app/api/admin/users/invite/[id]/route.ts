import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE /api/admin/users/invite/[id]
 * Delete/cancel a pending invitation
 * 
 * Role-Based Access:
 * - Admin: Can delete any invitation
 * - Non-Admin: 403 Forbidden
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('DELETE /api/admin/users/invite/[id] called', { 
      module: 'API', 
      action: 'DELETE_USER_INVITE',
      invitationId: id
    });
    
    // Use requireAdmin for consistent auth
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      logger.warn('Admin auth failed for DELETE user invite', { 
        module: 'API', 
        action: 'DELETE_USER_INVITE',
        invitationId: id
      });
      return authResult.error;
    }
    
    const { user } = authResult;
    logger.debug('Admin verified', { 
      module: 'API', 
      action: 'DELETE_USER_INVITE',
      adminEmail: user.email,
      role: user.role,
      invitationId: id
    });

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      logger.warn('Invitation not found', { 
        module: 'API', 
        action: 'DELETE_USER_INVITE',
        invitationId: id
      });
      return apiError('Invitation not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if invitation is already accepted
    if (invitation.status === 'ACCEPTED') {
      logger.warn('Cannot delete accepted invitation', { 
        module: 'API', 
        action: 'DELETE_USER_INVITE',
        invitationId: id,
        email: invitation.email
      });
      return apiError(
        'Cannot delete an accepted invitation. Revoke user access instead.',
        400,
        ErrorCodes.CONFLICT
      );
    }

    // Delete the invitation
    await prisma.invitation.delete({
      where: { id }
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        action: 'INVITATION_DELETED',
        resourceType: 'INVITATION',
        resourceId: id,
        userId: user.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          branch: invitation.branch,
          status: invitation.status,
          deletedBy: user.email
        },
        branch: invitation.branch
      }
    }).catch(err => {
      logger.warn('Failed to log invitation deletion to audit trail', { 
        module: 'API', 
        action: 'DELETE_USER_INVITE',
        error: err
      });
    });

    logger.info('Invitation deleted successfully', {
      module: 'API',
      action: 'DELETE_USER_INVITE',
      invitationId: id,
      email: invitation.email,
      deletedBy: user.email
    });

    return apiSuccess({
      message: 'Invitation deleted successfully',
      invitationId: id
    });

  } catch (error: any) {
    logger.error('Delete invitation error', error, { 
      module: 'API', 
      action: 'DELETE_USER_INVITE'
    });
    return apiError(
      error?.message || 'Failed to delete invitation',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
