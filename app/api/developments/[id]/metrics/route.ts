import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/developments/[id]/metrics
 * Fetch development metrics: stand counts by status and total value
 * Protected by NextAuth
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const developmentId = id;

    logger.info('GET /api/developments/[id]/metrics', {
      module: 'API',
      action: 'GET_DEVELOPMENT_METRICS',
      developmentId,
      userEmail: session.user.email?.substring(0, 3) + '***'
    });

    // Get stand statistics (without groupBy to avoid Prisma type issues)
    const stands = await prisma.stand.findMany({
      where: { 
        developmentId: developmentId as any
      },
      select: {
        status: true,
        price: true
      }
    });

    // Manual grouping by status
    const statsByStatus = new Map<string, { count: number; sum: number }>();
    
    stands.forEach(s => {
      const status = s.status || 'UNKNOWN';
      const price = typeof s.price === 'number' ? s.price : (s.price ? parseFloat(String(s.price)) : 0);
      
      if (!statsByStatus.has(status)) {
        statsByStatus.set(status, { count: 0, sum: 0 });
      }
      
      const stats = statsByStatus.get(status)!;
      stats.count += 1;
      stats.sum += price;
    });

    // Convert to array format
    const standsGrouped = Array.from(statsByStatus.entries()).map(([status, data]) => ({
      status,
      _count: data.count,
      _sum: { price: data.sum }
    }));

    const metrics = {
      total: standsGrouped.reduce((sum, s) => sum + s._count, 0),
      available: standsGrouped.find(s => s.status === 'AVAILABLE')?._count || 0,
      reserved: standsGrouped.find(s => s.status === 'RESERVED')?._count || 0,
      sold: standsGrouped.find(s => s.status === 'SOLD')?._count || 0,
      totalValue: standsGrouped.reduce((sum, s) => sum + (s._sum.price || 0), 0),
    };

    logger.debug('Metrics calculated', {
      module: 'API',
      action: 'GET_DEVELOPMENT_METRICS',
      developmentId,
      metrics
    });

    return apiSuccess(metrics);

  } catch (error: any) {
    logger.error('Error fetching metrics', error, { module: 'API', action: 'GET_DEVELOPMENT_METRICS' });
    return apiError(error.message || 'Failed to fetch metrics', 500, ErrorCodes.FETCH_ERROR, {
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined,
      // Return safe defaults on error
      total: 0,
      available: 0,
      reserved: 0,
      sold: 0,
      totalValue: 0,
    });
  }
}
