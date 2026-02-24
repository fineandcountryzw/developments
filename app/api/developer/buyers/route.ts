import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/buyers
 * Fetch all buyers/clients who purchased stands from this developer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Fetch sold stands for this developer's developments only
    const soldStands = await prisma.stand.findMany({
      where: {
        status: {
          equals: 'SOLD' as any
        },
        development: {
          developerEmail: session.user.email
        }
      },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true,
            developerEmail: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Extract unique buyers/clients
    const buyersMap = new Map();
    
    soldStands.forEach(stand => {
      if (stand.reservedBy) {
        const clientKey = stand.reservedBy;
        const price = typeof stand.price === 'number' ? stand.price : parseFloat(String(stand.price || 0));
        
        if (!buyersMap.has(clientKey)) {
          buyersMap.set(clientKey, {
            name: stand.reservedBy,
            email: 'contact@example.com', // Placeholder - would come from client DB
            purchaseCount: 0,
            totalSpent: 0,
            standNumbers: []
          });
        }
        
        const buyer = buyersMap.get(clientKey);
        buyer.purchaseCount += 1;
        buyer.totalSpent += price;
        buyer.standNumbers.push({
          number: stand.standNumber,
          development: stand.development?.name || 'Unknown',
          price: price
        });
      }
    });

    // Convert map to array and sort by total spent
    const buyers = Array.from(buyersMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);

    logger.info('Developer Buyers API Fetched buyers', {
      module: 'API',
      action: 'GET_DEVELOPER_BUYERS',
      count: buyers.length,
      totalSales: soldStands.length
    });

    return apiSuccess({
      count: buyers.length,
      totalSales: soldStands.length,
      buyers,
      summary: {
        totalBuyers: buyers.length,
        averageSpentPerBuyer: buyers.length > 0 
          ? buyers.reduce((sum, b) => sum + b.totalSpent, 0) / buyers.length 
          : 0,
        topBuyer: buyers.length > 0 ? buyers[0] : null
      }
    });

  } catch (error: any) {
    logger.error('Developer Buyers API Error', error, { module: 'API', action: 'GET_DEVELOPER_BUYERS' });
    return apiError(error.message || 'Failed to fetch buyers', 500, ErrorCodes.FETCH_ERROR);
  }
}
