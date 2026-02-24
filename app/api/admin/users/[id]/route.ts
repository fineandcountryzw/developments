import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access-control";
import { invalidateUserCache } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { updateUserPasswordWithHistory } from '@/lib/password-history';

// DELETE - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if ('error' in authResult) return authResult.error;

  let userId = '';
  try {
    const { id } = await params;
    userId = id;

    // Find the user first
    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return apiError("User not found", 404, ErrorCodes.USER_NOT_FOUND);
    }

    // Prevent self-deletion
    if (userToDelete.email === authResult.user.email) {
      return apiError("You cannot delete your own account", 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create audit trail before deletion
    await prisma.auditTrail.create({
      data: {
        action: 'USER_DELETED',
        resourceType: 'USER',
        resourceId: id,
        userId: authResult.user.id,
        details: {
          email: userToDelete.email,
          name: userToDelete.name,
          role: userToDelete.role,
          branch: userToDelete.branch,
          deletedBy: authResult.user.email,
          deletedAt: new Date().toISOString()
        },
        branch: userToDelete.branch || 'Harare'
      }
    });

    // Invalidate cache before deletion
    invalidateUserCache(userId);
    
    // Delete the user (with proper error handling for FK constraints)
    try {
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (deleteError: any) {
      // Handle foreign key constraint violations
      if (deleteError.code === 'P2003' || deleteError.code === 'P2014') {
        logger.warn('FK constraint blocking user deletion', { module: 'API', action: 'DELETE_USER', userId: userId, error: deleteError });
        return apiError(
          "Cannot delete user: User has associated records (reservations, developments, etc.). Please reassign or remove dependent records first.",
          409,
          ErrorCodes.FK_CONSTRAINT
        );
      }
      throw deleteError; // Re-throw if not FK constraint error
    }

    logger.info('User deleted', {
      module: 'API',
      action: 'DELETE_USER',
      userId: userId,
      userEmail: userToDelete.email,
      deletedBy: authResult.user.email
    });

    return apiSuccess({ message: "User deleted successfully" });
  } catch (error: any) {
    logger.error('Error deleting user', error, { module: 'API', action: 'DELETE_USER', userId: userId });
    return apiError(
      error.message || "Failed to delete user",
      500,
      ErrorCodes.DELETE_ERROR
    );
  }
}

// GET - Get single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if ('error' in authResult) return authResult.error;

  let userId = '';
  try {
    const { id } = await params;
    userId = id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return apiError("User not found", 404, ErrorCodes.USER_NOT_FOUND);
    }

    return apiSuccess({ user });
  } catch (error: any) {
    logger.error('Error fetching user', error, { module: 'API', action: 'GET_USER', userId: userId });
    return apiError(
      error.message || "Failed to fetch user",
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}

// PUT - Update user details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if ('error' in authResult) return authResult.error;

  let userId = '';
  try {
    const { id } = await params;
    userId = id;
    const body = await request.json();
    const { name, email, role, branch, password } = body;

    // Find the user first
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return apiError("User not found", 404, ErrorCodes.USER_NOT_FOUND);
    }

    // If email is changing, check for duplicates
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return apiError("Email already in use", 400, ErrorCodes.CONFLICT);
      }
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date()
    };
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (branch !== undefined) updateData.branch = branch;

    let updatedUser:
      | {
          id: string;
          name: string | null;
          email: string;
          role: any;
          branch: string | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | null = null;

    if (password) {
      const passwordUpdate = await updateUserPasswordWithHistory({
        userId,
        newPassword: password,
        extraUserUpdate: updateData,
      });

      if (!passwordUpdate.ok) {
        const code =
          passwordUpdate.code === 'PASSWORD_REUSE'
            ? ErrorCodes.PASSWORD_REUSE
            : ErrorCodes.PASSWORD_COMPLEXITY;
        return apiError(passwordUpdate.message, 400, code);
      }

      updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Update the user (non-password fields only)
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (!updatedUser) {
      return apiError("User not found", 404, ErrorCodes.USER_NOT_FOUND);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: updatedUser.branch || 'HEAD_OFFICE',
        userId: null,
        action: 'UPDATE',
        module: 'USERS',
        recordId: userId,
        description: `User updated: ${updatedUser.name} (${updatedUser.email})`,
        changes: JSON.stringify({
          updatedBy: authResult.user.email,
          fieldsChanged: Object.keys(updateData).filter(k => k !== 'updatedAt' && k !== 'password')
        })
      }
    });

    logger.info('User updated', {
      module: 'API',
      action: 'PUT_USER',
      userId: userId,
      userEmail: updatedUser.email,
      updatedBy: authResult.user.email
    });

    return apiSuccess({
      user: updatedUser,
      message: "User updated successfully"
    });
  } catch (error: any) {
    logger.error('Error updating user', error, { module: 'API', action: 'PUT_USER', userId: userId });
    return apiError(
      error.message || "Failed to update user",
      500,
      ErrorCodes.UPDATE_ERROR
    );
  }
}
