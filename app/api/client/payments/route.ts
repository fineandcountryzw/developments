import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/payments
 * Get client's payment history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Find client
    const client = await prisma.client.findFirst({
      where: { email: session.user.email! }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get all payments for this client
    const payments = await prisma.payment.findMany({
      where: {
        clientId: client.id
      },
      include: {
        receipt: {
          select: {
            id: true,
            receiptNumber: true,
            pdfUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform to simplified format
    const paymentData = payments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status === 'VERIFIED' || p.status === 'PAID' ? 'paid' : 
              p.status === 'PENDING' ? 'pending' : 'overdue',
      date: p.createdAt.toISOString(),
      month: new Date(p.createdAt).toLocaleString('default', { month: 'short' }),
      year: new Date(p.createdAt).getFullYear(),
      type: p.paymentType,
      description: p.description,
      standId: p.standId,
      receiptUrl: p.receipt?.pdfUrl || (p.receipt?.id ? `/api/client/documents/${p.receipt.id}/download?type=receipt` : null),
      receiptNumber: p.receipt?.receiptNumber
    }));

    // Calculate totals
    const summary = {
      totalPaid: paymentData.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: paymentData.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
      totalPayments: paymentData.length,
      paidCount: paymentData.filter(p => p.status === 'paid').length,
      pendingCount: paymentData.filter(p => p.status === 'pending').length
    };

    return apiSuccess({
      data: paymentData,
      summary
    });
  } catch (error: any) {
    logger.error('Error fetching payments', error, { module: 'API', action: 'GET_CLIENT_PAYMENTS' });
    return apiError(error.message || 'Failed to fetch payments', 500, ErrorCodes.FETCH_ERROR);
  }
}
