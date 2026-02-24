import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/receipts
 * Get receipts related to developer's developments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Get developments where user is the developer
    const developments = await prisma.development.findMany({
      where: {
        developerEmail: session.user.email
      },
      select: { id: true, name: true }
    });

    const developmentNames = developments.map(d => d.name);

    // Get receipts for those developments (secure - no OR clause leak)
    const receipts = await prisma.receipt.findMany({
      where: {
        AND: [
          { developmentName: { in: developmentNames } },
          { status: 'ACTIVE' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Calculate totals by development
    const byDevelopment = developmentNames.map(name => {
      const devReceipts = receipts.filter(r => r.developmentName === name);
      return {
        developmentName: name,
        receiptCount: devReceipts.length,
        totalAmount: devReceipts.reduce((sum, r) => sum + Number(r.amount), 0),
        deposits: devReceipts.filter(r => r.paymentType === 'Deposit').length,
        installments: devReceipts.filter(r => r.paymentType === 'Installment').length
      };
    });

    const totals = {
      count: receipts.length,
      totalAmount: receipts.reduce((sum, r) => sum + Number(r.amount), 0),
      thisMonth: receipts.filter(r => {
        const date = new Date(r.createdAt);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).reduce((sum, r) => sum + Number(r.amount), 0)
    };

    // Transform to DTO format expected by UI
    const transformedReceipts = receipts.map((receipt: any) => ({
      ...receipt,
      amount: Number(receipt.amount) || 0,
      issuedBy: receipt.receivedBy || '',
    }));

    return apiSuccess({
      data: transformedReceipts,
      byDevelopment,
      totals
    });

  } catch (error: any) {
    logger.error('Developer Receipts API Error', error, { module: 'API', action: 'GET_DEVELOPER_RECEIPTS' });
    return apiError(error.message || 'Failed to fetch receipts', 500, ErrorCodes.FETCH_ERROR);
  }
}
