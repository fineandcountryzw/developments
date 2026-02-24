import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/bounces/summary
 * Returns bounce statistics and summary metrics
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const [totalBounces, hardBounces, softBounces, suppressedRecipients] = await Promise.all([
      prisma.bouncePattern.count(),
      prisma.bouncePattern.count({
        where: { bounceType: 'hard' }
      }),
      prisma.bouncePattern.count({
        where: { bounceType: 'soft' }
      }),
      prisma.bouncePattern.count({
        where: { shouldSuppress: true }
      })
    ]);

    const bounceByType = await prisma.bouncePattern.groupBy({
      by: ['bounceType'],
      _count: {
        id: true
      }
    });

    const recentBounces = await prisma.bouncePattern.findMany({
      take: 10,
      orderBy: { lastBounceAt: 'desc' },
      select: {
        recipientEmail: true,
        bounceType: true,
        bounceReason: true,
        consecutiveBounces: true,
        smtpCode: true,
        lastBounceAt: true
      }
    });

    return NextResponse.json({
      summary: {
        totalBounces,
        hardBounces,
        softBounces,
        suppressedRecipients,
        suppressionRate: totalBounces > 0 ? (suppressedRecipients / totalBounces * 100).toFixed(2) : 0
      },
      bounceByType: bounceByType.map(item => ({
        type: item.bounceType,
        count: item._count.id
      })),
      recentBounces
    });
  } catch (error: any) {
    logger.error('Error fetching bounce summary', error, { module: 'API', action: 'GET_BOUNCES_SUMMARY' });
    return apiError('Failed to fetch bounce summary', 500, ErrorCodes.FETCH_ERROR);
  }
}
