import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/approvals/history
 * Returns recent approval decisions (payments + reservations)
 * Query params: branch, limit, type (payment|reservation)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;
    const type = searchParams.get('type');

    // Validate limit parameter
    if (limitParam && (isNaN(parseInt(limitParam)) || parseInt(limitParam) < 1 || parseInt(limitParam) > 200)) {
      return apiError('Limit must be between 1 and 200', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate type parameter
    if (type && !['payment', 'reservation'].includes(type)) {
      return apiError('Type must be either "payment" or "reservation"', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const activityTypes = type === 'payment'
      ? ['VERIFICATION']
      : type === 'reservation'
        ? ['RESERVATION']
        : ['VERIFICATION', 'RESERVATION'];

    const where: any = {
      type: { in: activityTypes as any }
    };

    if (branch !== 'all') {
      where.user = { branch };
    }

    const history = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, branch: true } }
      }
    });

    return apiSuccess(history);
  } catch (error: any) {
    logger.error('Error fetching approval history', error, { module: 'API', action: 'GET_APPROVAL_HISTORY' });
    return apiError(
      error.message || 'Failed to fetch approval history',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
