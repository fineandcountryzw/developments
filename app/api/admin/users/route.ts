import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateRequest } from '@/lib/validation/middleware';
import { userPostSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/admin/users called', { module: 'API', action: 'GET_USERS' });
    
    // Auth check - Admin only
    const authResult = await requireAdmin();
    if (authResult.error) {
      logger.warn('Unauthorized access attempt', { module: 'API', action: 'GET_USERS' });
      return authResult.error;
    }
    const user = authResult.user;

    // Get query parameters
    const branch = request.nextUrl.searchParams.get('branch');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

    logger.debug('List users request', { module: 'API', action: 'GET_USERS', branch, page, limit, includeInactive });

    // Build query filter
    const where: any = {
      role: { not: 'ADMIN' } // Don't expose other admins to prevent enumeration
    };

    if (branch) {
      where.branch = branch;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get paginated users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branch: true,
        isActive: true,
        lastLogin: true,
        accessRevokedAt: true,
        accessRevokedBy: true,
        revokeReason: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    logger.debug('Users retrieved', { module: 'API', action: 'GET_USERS', count: users.length, total });

    return apiSuccess(
      { users },
      200,
      {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    );

  } catch (error: any) {
    logger.error('List users error', error, { module: 'API', action: 'GET_USERS' });
    return apiError(
      error?.message || 'Failed to list users',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// POST endpoint to create new user directly (without invitation)
export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/admin/users called', { module: 'API', action: 'POST_USERS' });
    
    // Auth check - Admin only
    const authResult = await requireAdmin();
    if (authResult.error) {
      logger.warn('Unauthorized access attempt', { module: 'API', action: 'POST_USERS' });
      return authResult.error;
    }
    const adminUser = authResult.user;

    // Validate request body (union schema handles both bulk actions and direct creation)
    const validation = await validateRequest(request, userPostSchema, {
      module: 'API',
      action: 'POST_USERS'
    });
    if (!validation.success) {
      return validation.error;
    }
    const body = validation.data;

    // Handle bulk actions
    if ('action' in body && 'userIds' in body) {
      const { action, userIds, data } = body;
      logger.debug('Bulk action request', { module: 'API', action: 'POST_USERS', actionType: action, userCount: userIds.length });

      let updateData: any = {};

      switch (action) {
        case 'update-branch':
          if (!data?.branch) {
            return apiError(
              'Branch is required for update-branch action',
              400,
              ErrorCodes.VALIDATION_ERROR
            );
          }
          updateData = { branch: data.branch };
          break;

        case 'bulk-enable':
          updateData = { isActive: true, accessRevokedAt: null, accessRevokedBy: null, revokeReason: null };
          break;

        case 'bulk-disable':
          updateData = { 
            isActive: false, 
            accessRevokedAt: new Date(),
            accessRevokedBy: adminUser.id,
            revokeReason: data?.reason || 'Bulk disabled by administrator'
          };
          break;

        default:
          return apiError(
            `Unknown action: ${action}`,
            400,
            ErrorCodes.VALIDATION_ERROR
          );
      }

      // Perform bulk update
      const result = await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: updateData
      });

      logger.info('Bulk update completed', { module: 'API', action: 'POST_USERS', count: result.count, actionType: action });

      // Log bulk action to audit trail
      await prisma.auditTrail.create({
        data: {
          action: `USERS_BULK_${action.toUpperCase().replace('-', '_')}`,
          resourceType: 'USER',
          resourceId: `bulk_${userIds.length}_users`,
          userId: adminUser.id,
          details: {
            action: action as string,
            userIds: userIds as string[],
            userCount: userIds.length,
            updateData
          },
          branch: 'system'
        }
      });

      return apiSuccess({
        message: `Updated ${result.count} users`,
        count: result.count
      });
    }

    // Handle direct user creation (without invitation flow)
    if ('email' in body && 'role' in body && 'branch' in body) {
      const { email, role, branch, name } = body;
      logger.debug('Direct user creation', { module: 'API', action: 'POST_USERS', email, role, branch });

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return apiError('User with this email already exists', 409, ErrorCodes.CONFLICT);
      }

      // Create user directly
      const newUser = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          role: role as 'ADMIN' | 'MANAGER' | 'AGENT' | 'ACCOUNT' | 'CLIENT',
          branch,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          branch: true,
          isActive: true,
          createdAt: true
        }
      });

      logger.info('User created directly', { module: 'API', action: 'POST_USERS', userId: newUser.id, email });

      // Audit trail
      await prisma.auditTrail.create({
        data: {
          action: 'USER_CREATED_DIRECT',
          resourceType: 'USER',
          resourceId: newUser.id,
          userId: adminUser.id,
          details: {
            email,
            role,
            branch,
            createdBy: adminUser.email
          },
          branch
        }
      });

      return apiSuccess({
        user: newUser,
        message: 'User created successfully'
      }, 201);
    }

    return apiError(
      'Invalid request: provide either (action + userIds) or (email + role + branch)',
      400,
      ErrorCodes.VALIDATION_ERROR
    );

  } catch (error: any) {
    logger.error('POST error', error, { module: 'API', action: 'POST_USERS' });
    return apiError(
      error?.message || 'Failed to process request',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
