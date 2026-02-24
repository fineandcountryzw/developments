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
 * GET /api/stands/by-development?developmentId=<id>
 * Fetch all stands for a specific development
 * Protected by NextAuth
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return apiError('developmentId parameter required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.info('GET /api/stands/by-development', {
      module: 'API',
      action: 'GET_STANDS_BY_DEVELOPMENT',
      developmentId,
      userEmail: session.user.email?.substring(0, 3) + '***'
    });

    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { disableMapView: true }
    });

    const stands = await prisma.stand.findMany({
      where: { developmentId: developmentId },
      orderBy: { standNumber: 'asc' },
      select: {
        id: true,
        standNumber: true,
        sizeSqm: true,
        price: true,
        status: true,
        developmentId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return apiSuccess({
      stands,
      disableMapView: !!development?.disableMapView
    });

  } catch (error: any) {
    logger.error('Error fetching stands', error, { module: 'API', action: 'GET_STANDS_BY_DEVELOPMENT' });
    return apiError(error.message || 'Failed to fetch stands', 500, ErrorCodes.FETCH_ERROR, {
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
