import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { invalidateUserCache } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const adminUser = authResult.user;

    const { userId, reason } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    logger.info('Revoke access request', { module: 'API', action: 'REVOKE_USER', userId, revokedBy: adminUser.email });

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
    }

    // Prevent revoking admin by non-super-admin (in real app, add super-admin role)
    if (user.role === 'ADMIN' && adminUser.id !== 'system') {
      return apiError('Cannot revoke admin user access', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Prevent self-revocation
    if (user.id === adminUser.id) {
      return apiError('Cannot revoke your own access', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        accessRevokedAt: new Date(),
        accessRevokedBy: adminUser.id
      }
    });
    
    // Invalidate user cache
    invalidateUserCache(userId);
    
    logger.info('User access revoked', { module: 'API', action: 'REVOKE_USER', userId, email: user.email });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: 'USER_ACCESS_REVOKED',
        resourceType: 'USER',
        resourceId: userId,
        userId: adminUser.id,
        details: {
          email: user.email,
          role: user.role,
          branch: user.branch,
          reason: reason || 'No reason provided',
          revokedAt: new Date().toISOString()
        },
        branch: user.branch
      }
    });

    // TODO: In production, implement session termination
    // - Invalidate all active sessions for this user
    // - Revoke all refresh tokens
    // - Clear any active JWT tokens
    // This would typically involve:
    // 1. Storing session invalidation timestamp in Redis
    // 2. Checking token creation time against revocation time on each request
    // 3. Logging out from all devices

    return apiSuccess({
      message: 'User access has been revoked',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
        accessRevokedAt: updatedUser.accessRevokedAt
      }
    });

  } catch (error: any) {
    logger.error('Revoke access error', error, { module: 'API', action: 'REVOKE_USER' });
    return apiError(
      error?.message || 'Failed to revoke access',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// GET endpoint to check revocation status
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        accessRevokedAt: true,
        role: true,
        branch: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        ...user,
        isRevoked: !user.isActive,
        revokedAt: user.accessRevokedAt
      }
    });

  } catch (error: any) {
    logger.error('Status check error', error, { module: 'API', action: 'GET_REVOKE_STATUS' });
    return apiError('Failed to check user status', 500, ErrorCodes.INTERNAL_ERROR);
  }
}

// DELETE endpoint to completely delete user (including data)
export async function DELETE(request: NextRequest) {
  try {
    // Auth check - only super admin can delete users
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const adminUser = authResult.user;

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    logger.info('User deletion request', { module: 'API', action: 'DELETE_USER', userId, deletedBy: adminUser.email });

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
    }

    // Prevent deleting self
    if (user.id === adminUser.id) {
      return apiError('Cannot delete your own account', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create audit trail before deletion
    await prisma.auditTrail.create({
      data: {
        action: 'USER_DELETED',
        resourceType: 'USER',
        resourceId: userId,
        userId: adminUser.id,
        details: {
          email: user.email,
          role: user.role,
          branch: user.branch,
          deletedAt: new Date().toISOString()
        },
        branch: user.branch
      }
    });

    // Delete user and related records
    await prisma.user.delete({
      where: { id: userId }
    });

    logger.info('User deleted', { module: 'API', action: 'DELETE_USER', userId, email: user.email });

    return apiSuccess({
      message: 'User has been permanently deleted'
    });

  } catch (error: any) {
    logger.error('User deletion error', error, { module: 'API', action: 'DELETE_USER' });
    return apiError(
      error?.message || 'Failed to delete user',
      500,
      ErrorCodes.DELETE_ERROR
    );
  }
}
