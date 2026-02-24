import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/engagement/summary
 * Returns engagement summary metrics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const branch = new URL(request.url).searchParams.get('branch') || 'Harare';

    const [totalRecipients, avgEngagementScore, highEngagementCount, predictedPayments] = await Promise.all([
      prisma.emailEngagementScore.count({ where: { branch } }),
      prisma.emailEngagementScore.aggregate({
        where: { branch },
        _avg: { engagementScore: true }
      }),
      prisma.emailEngagementScore.count({
        where: {
          branch,
          engagementTier: { in: ['hot', 'warm'] }
        }
      }),
      prisma.emailEngagementScore.aggregate({
        where: { branch },
        _sum: { predictedPaymentProbability: true }
      })
    ]);

    const tierStats = await prisma.emailEngagementScore.groupBy({
      by: ['engagementTier'],
      where: { branch },
      _count: { id: true },
      _avg: { engagementScore: true }
    });

    return NextResponse.json({
      summary: {
        totalRecipients,
        avgEngagementScore: avgEngagementScore._avg.engagementScore?.toFixed(2) || 0,
        highEngagementPercentage: totalRecipients > 0 
          ? (highEngagementCount / totalRecipients * 100).toFixed(2)
          : 0,
        estimatedPaymentProbability: totalRecipients > 0
          ? (((predictedPayments._sum.predictedPaymentProbability || 0) / totalRecipients) * 100).toFixed(2)
          : 0
      },
      tierBreakdown: tierStats.map(item => ({
        tier: item.engagementTier,
        count: item._count.id,
        percentage: totalRecipients > 0 ? (item._count.id / totalRecipients * 100).toFixed(2) : 0,
        avgScore: item._avg.engagementScore?.toFixed(2) || 0
      }))
    });
  } catch (error: any) {
    logger.error('Error fetching engagement summary', error, { module: 'API', action: 'GET_ENGAGEMENT_SUMMARY' });
    return apiError('Failed to fetch engagement summary', 500, ErrorCodes.FETCH_ERROR);
  }
}
