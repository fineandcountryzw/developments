/**
 * Permissions Management API
 * 
 * Grant, revoke, and manage fine-grained permissions via AccessControl model.
 * 
 * @module app/api/admin/permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import {
  grantPermission,
  revokePermission,
  grantPermissions,
  revokeAllUserPermissions,
  getUserPermissions,
  checkUserPermission,
  cleanupExpiredPermissions
} from '@/lib/permission-manager';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/permissions
 * Get user permissions
 * 
 * Query params:
 * - userId: User ID to get permissions for
 * - branch: Optional branch filter
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const admin = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const branch = searchParams.get('branch') || undefined;

    if (!userId) {
      return apiError('userId is required', 400, 'VALIDATION_ERROR');
    }

    logger.info('GET /api/admin/permissions', {
      module: 'API',
      userId,
      branch,
      requestedBy: admin.email
    });

    const permissions = await getUserPermissions(userId, branch);

    return apiSuccess(permissions);
  } catch (error: any) {
    logger.error('Error fetching permissions', error, { module: 'API' });
    return apiError('Failed to fetch permissions', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/permissions
 * Grant permission(s)
 * 
 * Body:
 * - userId: User ID
 * - resource: Resource path (e.g., '/api/admin/reservations')
 * - action: 'READ' | 'WRITE' | 'DELETE' | 'EXECUTE'
 * - branch: Optional branch
 * - expiresAt: Optional expiration date (ISO string)
 * - multiple: Optional array of permissions for bulk grant
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const admin = authResult.user;

    const body = await request.json();
    const { multiple, userId, resource, action, branch, expiresAt } = body;

    logger.info('POST /api/admin/permissions', {
      module: 'API',
      multiple: !!multiple,
      requestedBy: admin.email
    });

    if (multiple && Array.isArray(multiple)) {
      // Bulk grant
      const permissions = multiple.map((p: any) => ({
        userId: p.userId,
        resource: p.resource,
        action: p.action,
        branch: p.branch,
        grantedBy: admin.id,
        expiresAt: p.expiresAt ? new Date(p.expiresAt) : undefined
      }));

      await grantPermissions(permissions);

      return apiSuccess({ granted: permissions.length });
    } else {
      // Single grant
      if (!userId || !resource || !action) {
        return apiError('userId, resource, and action are required', 400, 'VALIDATION_ERROR');
      }

      await grantPermission({
        userId,
        resource,
        action,
        branch,
        grantedBy: admin.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      });

      return apiSuccess({ granted: true });
    }
  } catch (error: any) {
    logger.error('Error granting permission', error, { module: 'API' });
    return apiError('Failed to grant permission', 500, 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/admin/permissions
 * Revoke permission(s)
 * 
 * Query params:
 * - userId: User ID
 * - resource: Resource path
 * - action: Action type
 * - branch: Optional branch
 * - all: If true, revoke all permissions for user
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const admin = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const all = searchParams.get('all') === 'true';

    if (!userId) {
      return apiError('userId is required', 400, 'VALIDATION_ERROR');
    }

    logger.info('DELETE /api/admin/permissions', {
      module: 'API',
      userId,
      all,
      requestedBy: admin.email
    });

    if (all) {
      // Revoke all permissions
      const branch = searchParams.get('branch') || undefined;
      const count = await revokeAllUserPermissions(userId, branch);
      return apiSuccess({ revoked: count });
    } else {
      // Revoke specific permission
      const resource = searchParams.get('resource');
      const action = searchParams.get('action');
      const branch = searchParams.get('branch') || undefined;

      if (!resource || !action) {
        return apiError('resource and action are required', 400, 'VALIDATION_ERROR');
      }

      await revokePermission({
        userId,
        resource,
        action: action as any,
        branch
      });

      return apiSuccess({ revoked: true });
    }
  } catch (error: any) {
    logger.error('Error revoking permission', error, { module: 'API' });
    return apiError('Failed to revoke permission', 500, 'INTERNAL_ERROR');
  }
}

