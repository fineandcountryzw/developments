import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/client/documents
 * Get client's documents (contracts, receipts, statements)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    const documents: any[] = [];

    // Get receipts
    if (!type || type === 'receipts') {
      const receipts = await prisma.receipt.findMany({
        where: {
          payment: {
            clientId: client.id
          }
        },
        include: {
          payment: {
            select: {
              amount: true,
              paymentType: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      documents.push(...receipts.map(r => ({
        id: r.id,
        type: 'receipt',
        name: `Receipt ${r.receiptNumber}`,
        date: r.createdAt,
        url: `/api/client/documents/${r.id}/download?type=receipt`,
        amount: r.payment?.amount,
        paymentType: r.payment?.paymentType
      })));
    }

    // Get contracts
    if (!type || type === 'contracts') {
      const contracts = await prisma.contract.findMany({
        where: {
          clientId: client.id
        },
        orderBy: { createdAt: 'desc' }
      });

      documents.push(...contracts.map(c => ({
        id: c.id,
        type: 'contract',
        name: `Contract - ${c.title}`,
        date: c.createdAt,
        status: c.status,
        url: `/api/client/documents/${c.id}/download?type=contract`
      })));
    }

    // Account statement (generated on-demand; always available)
    if (!type || type === 'statements') {
      documents.push({
        id: 'statement',
        type: 'statement',
        name: 'Account Statement',
        date: new Date().toISOString(),
        url: '/api/client/statement/download',
        amount: undefined,
        paymentType: undefined
      });
    }

    // Sort by date descending
    documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return apiSuccess(documents);
  } catch (error: any) {
    logger.error('Error fetching documents', error, { module: 'API', action: 'GET_CLIENT_DOCUMENTS' });
    return apiError(error.message || 'Failed to fetch documents', 500, ErrorCodes.FETCH_ERROR);
  }
}
