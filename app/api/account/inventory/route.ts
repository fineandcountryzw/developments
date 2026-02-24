import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/inventory
 * Get stand inventory grouped by development
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';

    // Get all developments with stand counts
    const developments = await prisma.development.findMany({
      where: { branch },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        stands: {
          select: {
            id: true,
            status: true,
            price: true,
          },
        },
      },
    });

    // Process developments with stand statistics
    const processedDevelopments = developments.map((dev) => {
      const totalStands = dev.stands.length;
      const availableStands = dev.stands.filter((s) => s.status === 'AVAILABLE').length;
      const reservedStands = dev.stands.filter((s) => s.status === 'RESERVED').length;
      const soldStands = dev.stands.filter((s) => s.status === 'SOLD').length;
      
      // Calculate total revenue from sold stands
      const totalRevenue = dev.stands
        .filter((s) => s.status === 'SOLD')
        .reduce((sum, s) => sum + Number(s.price || 0), 0);

      return {
        id: dev.id,
        name: dev.name,
        location: dev.location,
        status: dev.status,
        totalStands,
        availableStands,
        reservedStands,
        soldStands,
        totalRevenue,
      };
    });

    return apiSuccess({
      developments: processedDevelopments,
    });
  } catch (error: any) {
    logger.error('ACCOUNT_INVENTORY Error', error, { module: 'API', action: 'GET_ACCOUNT_INVENTORY' });
    return apiError('Failed to fetch inventory', 500, ErrorCodes.FETCH_ERROR);
  }
}
