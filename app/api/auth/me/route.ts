/**
 * GET /api/auth/me
 *
 * Returns current user from DB (role, email, etc.) for role-based routing.
 * Use this as source of truth instead of session.role to avoid stale JWT.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true, branch: true },
    });

    if (!user) {
      return apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
    }

    const role = (user.role ?? '').toString().toUpperCase();
    return apiSuccess({
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      branch: user.branch ?? undefined,
    });
  } catch (e: any) {
    logger.error('GET /api/auth/me error', e, { module: 'API', action: 'GET_AUTH_ME' });
    return apiError(e?.message ?? 'Internal error', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
