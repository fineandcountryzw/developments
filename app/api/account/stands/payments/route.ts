import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/stands/payments
 * Get payments grouped by stand with reconciliation data
 * 
 * Query Parameters:
 * - branch: Filter by branch (defaults to 'Harare')
 * - developmentId: Filter by specific development
 * - standId: Filter by specific stand
 * - clientId: Filter by specific client
 * - status: Filter by payment status (PENDING, CONFIRMED, FAILED)
 * - dateFrom: Start date filter
 * - dateTo: End date filter
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
    const developmentId = searchParams.get('developmentId');
    const standId = searchParams.get('standId');
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause for stands
    const standWhere: Record<string, unknown> = {
      branch,
    };

    if (developmentId) {
      standWhere.developmentId = developmentId;
    }

    if (standId) {
      standWhere.id = standId;
    }

    // Get stands with their payments and related data
    const stands = await prisma.stand.findMany({
      where: standWhere,
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true,
            developerName: true,
            developerEmail: true,
          },
        },
        payments: {
          where: {
            ...(status && status !== 'all' ? { status } : {}),
            ...(dateFrom ? { createdAt: { gte: new Date(dateFrom) } } : {}),
            ...(dateTo ? { createdAt: { lte: new Date(dateTo) } } : {}),
            ...(clientId ? { clientId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                status: true,
              },
            },
          },
        },
        installmentPlans: {
          where: { status: 'ACTIVE' },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reservations: {
          where: { status: 'CONFIRMED' },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { development: { name: 'asc' } },
        { standNumber: 'asc' },
      ],
    });

    // Process stands with payment reconciliation
    const standsWithPayments = stands.map((stand: any) => {
      const contractValue = Number(stand.price) || 0;
      const totalPaid = stand.payments
        .filter((p: any) => p.status === 'CONFIRMED')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const totalPending = stand.payments
        .filter((p: any) => p.status === 'PENDING')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const outstandingBalance = Math.max(0, contractValue - totalPaid);
      
      // Get last payment date
      const lastPayment = stand.payments
        .filter((p: any) => p.status === 'CONFIRMED')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      // Determine ownership
      const owner = stand.reservations[0]?.client || 
                    stand.installmentPlans[0]?.client || 
                    null;

      return {
        id: stand.id,
        standNumber: stand.standNumber,
        development: stand.development,
        status: stand.status,
        sizeSqm: Number(stand.sizeSqm) || null,
        contractValue,
        totalPaid,
        totalPending,
        outstandingBalance,
        lastPaymentDate: lastPayment?.createdAt || null,
        owner,
        payments: stand.payments.map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          paymentType: p.payment_type,
          reference: p.reference,
          createdAt: p.createdAt,
          confirmedAt: p.confirmedAt,
          client: p.client,
          receipt: p.receipt,
        })),
        paymentCount: stand.payments.length,
        confirmedPaymentCount: stand.payments.filter((p: any) => p.status === 'CONFIRMED').length,
      };
    });

    // Filter out stands with no payments if specifically filtering
    const filteredStands = clientId || status || dateFrom || dateTo
      ? standsWithPayments.filter((s) => s.payments.length > 0)
      : standsWithPayments;

    // Calculate summary statistics
    const summary = {
      totalStands: filteredStands.length,
      totalContractValue: filteredStands.reduce((sum, s) => sum + s.contractValue, 0),
      totalPaid: filteredStands.reduce((sum, s) => sum + s.totalPaid, 0),
      totalPending: filteredStands.reduce((sum, s) => sum + s.totalPending, 0),
      totalOutstanding: filteredStands.reduce((sum, s) => sum + s.outstandingBalance, 0),
      fullyPaidStands: filteredStands.filter((s) => s.outstandingBalance === 0 && s.totalPaid > 0).length,
      partiallyPaidStands: filteredStands.filter((s) => s.outstandingBalance > 0 && s.totalPaid > 0).length,
      unpaidStands: filteredStands.filter((s) => s.totalPaid === 0).length,
    };

    return apiSuccess({
      stands: filteredStands,
      summary,
      filters: {
        branch,
        developmentId,
        standId,
        clientId,
        status,
        dateFrom,
        dateTo,
      },
    });
  } catch (error: any) {
    logger.error('STANDS_PAYMENTS Error', error, { 
      module: 'API', 
      action: 'GET_STANDS_PAYMENTS' 
    });
    return apiError('Failed to fetch stands payments', 500, ErrorCodes.FETCH_ERROR);
  }
}
