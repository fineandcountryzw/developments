import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/stats
 * Get dashboard statistics for accounts role
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

    // Get current month start/end
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Parallel queries for performance
    const [
      totalRevenueResult,
      pendingPaymentsCount,
      confirmedPaymentsCount,
      overdueInstallments,
      totalClients,
      activeInstallmentPlans,
      availableStands,
      pendingCommissions,
    ] = await Promise.all([
      // Total revenue this month (confirmed payments)
      prisma.payment.aggregate({
        where: {
          officeLocation: branch,
          status: 'CONFIRMED',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),

      // Pending payments count
      prisma.payment.count({
        where: {
          officeLocation: branch,
          status: 'PENDING',
        },
      }),

      // Confirmed payments this month
      prisma.payment.count({
        where: {
          officeLocation: branch,
          status: 'CONFIRMED',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),

      // Overdue installments amount
      prisma.installment.aggregate({
        where: {
          status: 'OVERDUE',
          plan: {
            development: {
              branch: branch,
            },
          },
        },
        _sum: { amountDue: true },
      }),

      // Total clients
      prisma.client.count({
        where: { branch },
      }),

      // Active installment plans
      prisma.installmentPlan.count({
        where: {
          status: 'ACTIVE',
          development: {
            branch: branch,
          },
        },
      }),

      // Available stands
      prisma.stand.count({
        where: {
          branch,
          status: 'AVAILABLE',
        },
      }),

      // Pending commissions
      prisma.commissionPayout.aggregate({
        where: {
          branch,
          status: { in: ['CALCULATED', 'APPROVED'] },
        },
        _sum: { total: true },
      }),
    ]);

    return apiSuccess({
      totalRevenue: Number(totalRevenueResult._sum.amount || 0),
      pendingPayments: pendingPaymentsCount,
      confirmedPayments: confirmedPaymentsCount,
      overdueAmount: Number(overdueInstallments._sum.amountDue || 0),
      totalClients,
      activeInstallments: activeInstallmentPlans,
      availableStands,
      pendingCommissions: Number(pendingCommissions._sum.total || 0),
    });
  } catch (error: any) {
    logger.error('ACCOUNT_STATS Error', error, { module: 'API', action: 'GET_ACCOUNT_STATS' });
    return apiError('Failed to fetch stats', 500, ErrorCodes.FETCH_ERROR);
  }
}
