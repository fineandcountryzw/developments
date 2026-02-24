import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/bounces/list
 * Returns paginated list of bounces with filtering options
 * Query params: page, limit, bounceType, suppressed, branch, search
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const bounceType = searchParams.get('bounceType');
    const suppressed = searchParams.get('suppressed') === 'true';
    const branch = searchParams.get('branch') || 'Harare';
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = { branch };

    if (bounceType) {
      where.bounceType = bounceType;
    }
    if (suppressed) {
      where.shouldSuppress = true;
    }
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { clientId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [bounces, total] = await Promise.all([
      prisma.bouncePattern.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastBounceAt: 'desc' },
        select: {
          id: true,
          recipientEmail: true,
          clientId: true,
          bounceType: true,
          lastBounceAt: true,
          consecutiveBounces: true,
          totalBounceCount: true,
          bounceReason: true,
          smtpCode: true,
          shouldSuppress: true,
          suppressedAt: true
        }
      }),
      prisma.bouncePattern.count({ where })
    ]);

    return NextResponse.json({
      bounces,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching bounces', error, { module: 'API', action: 'GET_BOUNCES_LIST' });
    return apiError('Failed to fetch bounces', 500, ErrorCodes.FETCH_ERROR);
  }
}
