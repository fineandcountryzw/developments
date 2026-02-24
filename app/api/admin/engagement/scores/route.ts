import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/engagement/scores
 * Returns list of engagement scores for recipients with filtering
 * Query params: page, limit, tier, branch, minScore, search
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const tier = searchParams.get('tier'); // 'hot' | 'warm' | 'cold'
    const branch = searchParams.get('branch') || 'Harare';
    const minScore = parseFloat(searchParams.get('minScore') || '0');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = {
      branch,
      engagementScore: { gte: minScore }
    };

    if (tier) {
      where.engagementTier = tier;
    }
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [scores, total, tierDistribution] = await Promise.all([
      prisma.emailEngagementScore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { engagementScore: 'desc' },
        select: {
          id: true,
          recipientEmail: true,
          clientName: true,
          engagementScore: true,
          engagementTier: true,
          openCount: true,
          clickCount: true,
          lastEngagementAt: true,
          predictedPaymentProbability: true
        }
      }),
      prisma.emailEngagementScore.count({ where }),
      prisma.emailEngagementScore.groupBy({
        by: ['engagementTier'],
        where: { branch },
        _count: { id: true },
        _avg: { engagementScore: true }
      })
    ]);

    return NextResponse.json({
      scores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      tierDistribution: tierDistribution.map(item => ({
        tier: item.engagementTier,
        count: item._count.id,
        avgScore: item._avg.engagementScore?.toFixed(2) || 0
      }))
    });
  } catch (error: any) {
    logger.error('Error fetching engagement scores', error, { module: 'API', action: 'GET_ENGAGEMENT_SCORES' });
    return apiError('Failed to fetch engagement scores', 500, ErrorCodes.FETCH_ERROR);
  }
}
