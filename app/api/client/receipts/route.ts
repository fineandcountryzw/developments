import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/receipts
 * Get receipts for the logged-in client
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Find client by email
    const client = await prisma.client.findFirst({
      where: { email: session.user.email }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    const receipts = await prisma.receipt.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Calculate totals
    const totals = {
      count: receipts.length,
      totalAmount: receipts.reduce((sum, r) => sum + Number(r.amount), 0)
    };

    // Transform to DTO format expected by UI
    const transformedReceipts = receipts.map((receipt: any) => ({
      ...receipt,
      amount: Number(receipt.amount) || 0,
      issuedBy: receipt.receivedBy || '',
    }));

    return apiSuccess({
      data: transformedReceipts,
      totals
    });

  } catch (error: any) {
    logger.error('Client Receipts API Error', error, { module: 'API', action: 'GET_CLIENT_RECEIPTS' });
    return apiError(error.message || 'Failed to fetch receipts', 500, ErrorCodes.FETCH_ERROR);
  }
}
