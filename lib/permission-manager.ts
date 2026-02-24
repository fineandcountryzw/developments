/**
 * Permission Management Service
 * 
 * Provides utilities for managing fine-grained permissions via AccessControl model.
 * Supports granting, revoking, and checking permissions per user/resource/action.
 * 
 * @module lib/permission-manager
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PermissionAction } from './access-control';
import { invalidateUserCache } from './access-control';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GrantPermissionParams {
  userId: string;
  resource: string;
  action: PermissionAction;
  branch?: string;
  grantedBy: string;
  expiresAt?: Date;
}

export interface RevokePermissionParams {
  userId: string;
  resource: string;
  action: PermissionAction;
  branch?: string;
}

export interface PermissionSummary {
  userId: string;
  resource: string;
  action: PermissionAction;
  branch?: string;
  granted: boolean;
  grantedBy?: string;
  grantedAt?: Date;
  expiresAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grant permission to user
 * 
 * Creates or updates an AccessControl record for the specified user/resource/action.
 * Automatically invalidates user cache to ensure immediate effect.
 */
export async function grantPermission(params: GrantPermissionParams): Promise<void> {
  const { userId, resource, action, branch, grantedBy, expiresAt } = params;

  logger.info('[PERMISSION] Granting permission', {
    module: 'PermissionManager',
    userId,
    resource,
    action,
    branch,
    grantedBy,
    expiresAt: expiresAt?.toISOString()
  });

  try {
    await prisma.accessControl.upsert({
      where: {
        userId_resource_action_branch: {
          userId,
          resource,
          action,
          branch: branch || 'Harare'
        }
      },
      create: {
        userId,
        resource,
        action,
        branch: branch || 'Harare',
        grantedBy,
        expiresAt
      },
      update: {
        grantedBy,
        expiresAt,
        grantedAt: new Date() // Update timestamp
      }
    });

    // Invalidate user cache to ensure permission takes effect immediately
    invalidateUserCache(userId);

    logger.info('[PERMISSION] Permission granted', {
      module: 'PermissionManager',
      userId,
      resource,
      action
    });
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to grant permission', {
      module: 'PermissionManager',
      userId,
      resource,
      action,
      error: error.message
    });
    throw error;
  }
}

/**
 * Revoke permission from user
 * 
 * Deletes the AccessControl record for the specified user/resource/action.
 * Automatically invalidates user cache.
 */
export async function revokePermission(params: RevokePermissionParams): Promise<void> {
  const { userId, resource, action, branch } = params;

  logger.info('[PERMISSION] Revoking permission', {
    module: 'PermissionManager',
    userId,
    resource,
    action,
    branch
  });

  try {
    await prisma.accessControl.deleteMany({
      where: {
        userId,
        resource,
        action,
        branch: branch || 'Harare'
      }
    });

    // Invalidate user cache
    invalidateUserCache(userId);

    logger.info('[PERMISSION] Permission revoked', {
      module: 'PermissionManager',
      userId,
      resource,
      action
    });
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to revoke permission', {
      module: 'PermissionManager',
      userId,
      resource,
      action,
      error: error.message
    });
    throw error;
  }
}

/**
 * Grant multiple permissions at once
 * 
 * Useful for bulk operations or role templates.
 */
export async function grantPermissions(
  permissions: GrantPermissionParams[]
): Promise<void> {
  logger.info('[PERMISSION] Granting multiple permissions', {
    module: 'PermissionManager',
    count: permissions.length
  });

  const userIds = new Set<string>();

  await Promise.all(
    permissions.map(async (params) => {
      await grantPermission(params);
      userIds.add(params.userId);
    })
  );

  // Invalidate cache for all affected users
  userIds.forEach(userId => invalidateUserCache(userId));

  logger.info('[PERMISSION] Multiple permissions granted', {
    module: 'PermissionManager',
    count: permissions.length,
    uniqueUsers: userIds.size
  });
}

/**
 * Revoke all permissions for a user
 * 
 * Useful when deactivating a user or resetting permissions.
 */
export async function revokeAllUserPermissions(
  userId: string,
  branch?: string
): Promise<number> {
  logger.info('[PERMISSION] Revoking all permissions for user', {
    module: 'PermissionManager',
    userId,
    branch
  });

  try {
    const result = await prisma.accessControl.deleteMany({
      where: {
        userId,
        ...(branch && { branch })
      }
    });

    invalidateUserCache(userId);

    logger.info('[PERMISSION] All permissions revoked', {
      module: 'PermissionManager',
      userId,
      count: result.count
    });

    return result.count;
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to revoke all permissions', {
      module: 'PermissionManager',
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get user's permissions
 * 
 * Returns all active permissions for a user (excluding expired).
 */
export async function getUserPermissions(
  userId: string,
  branch?: string
): Promise<PermissionSummary[]> {
  try {
    const permissions = await prisma.accessControl.findMany({
      where: {
        userId,
        ...(branch && { branch }),
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ]
    });

    return permissions.map(p => ({
      userId: p.userId,
      resource: p.resource,
      action: p.action as PermissionAction,
      branch: p.branch,
      granted: true,
      grantedBy: p.grantedBy || undefined,
      grantedAt: p.grantedAt,
      expiresAt: p.expiresAt || undefined
    }));
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to get user permissions', {
      module: 'PermissionManager',
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Check if user has permission
 * 
 * Convenience wrapper around hasPermission from access-control.
 */
export async function checkUserPermission(
  userId: string,
  resource: string,
  action: PermissionAction,
  branch?: string
): Promise<boolean> {
  try {
    const permission = await prisma.accessControl.findFirst({
      where: {
        userId,
        resource,
        action,
        branch: branch || 'Harare',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    return !!permission;
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to check permission', {
      module: 'PermissionManager',
      userId,
      resource,
      action,
      error: error.message
    });
    return false;
  }
}

/**
 * Clean up expired permissions
 * 
 * Removes all expired AccessControl records.
 * Should be run periodically (e.g., daily cron job).
 */
export async function cleanupExpiredPermissions(): Promise<number> {
  logger.info('[PERMISSION] Cleaning up expired permissions', {
    module: 'PermissionManager'
  });

  try {
    const result = await prisma.accessControl.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    logger.info('[PERMISSION] Expired permissions cleaned up', {
      module: 'PermissionManager',
      count: result.count
    });

    return result.count;
  } catch (error: any) {
    logger.error('[PERMISSION] Failed to cleanup expired permissions', {
      module: 'PermissionManager',
      error: error.message
    });
    throw error;
  }
}
