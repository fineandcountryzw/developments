/**
 * Developer Contracts API
 * 
 * GET /api/developer/contracts
 * 
 * Returns contracts linked to developments managed by this developer.
 * Shows BOTH signed and unsigned contracts by default.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { buildContractScopeWhere, type ContractScopeUser } from '@/lib/contract-access-control';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const user = session.user as any;
    
    // Check role - must be DEVELOPER or higher
    const role = user.role?.toUpperCase();
    
    logger.debug('Developer contracts access check', {
      module: 'API',
      action: 'GET_DEVELOPER_CONTRACTS',
      userId: user.id,
      email: user.email,
      role: role,
      rawRole: user.role
    });
    
    if (!role || !['DEVELOPER', 'MANAGER', 'ADMIN'].includes(role)) {
      logger.warn('Developer contracts access denied', {
        module: 'API',
        action: 'GET_DEVELOPER_CONTRACTS',
        userId: user.id,
        email: user.email,
        role: role,
        rawRole: user.role
      });
      return apiError('Developer access required', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const developmentId = searchParams.get('developmentId');
    const signedOnly = searchParams.get('signedOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Build scoped user - force DEVELOPER role for scoping
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: 'DEVELOPER', // Force developer scoping
      branch: user.branch
    };

    // Build WHERE clause with developer scoping
    const whereClause = await buildContractScopeWhere(scopedUser, {
      status: status || undefined,
      developmentId: developmentId || undefined,
      signedOnly,
      includeArchived
    });

    logger.debug('Developer contracts query', {
      module: 'API',
      action: 'GET_DEVELOPER_CONTRACTS',
      developerId: user.id,
      whereClause: JSON.stringify(whereClause)
    });

    // Fetch contracts
    const [contracts, totalCount] = await Promise.all([
      prisma.generatedContract.findMany({
        where: whereClause,
        include: {
          signers: {
            select: { role: true, status: true, name: true, email: true },
            orderBy: { role: 'asc' },
          },
          template: {
            select: { id: true, name: true }
          },
          client: {
            select: { id: true, name: true, email: true, phone: true }
          },
          stand: {
            include: {
              development: {
                select: { id: true, name: true, location: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.generatedContract.count({ where: whereClause })
    ]);

    // Get payment summaries for contracts
    const contractsWithPayments = await Promise.all(
      contracts.map(async (contract) => {
        if (!contract.standId || !contract.clientId) {
          return {
            ...contract,
            paymentSummary: null
          };
        }

        const payments = await prisma.payment.aggregate({
          where: {
            clientId: contract.clientId,
            standId: contract.standId,
            status: 'CONFIRMED'
          },
          _sum: { amount: true },
          _count: true
        });

        const standPrice = contract.stand?.price ? Number(contract.stand.price) : 0;
        const paidAmount = Number(payments._sum.amount || 0);

        return {
          ...contract,
          paymentSummary: {
            totalPrice: standPrice,
            paidAmount,
            remainingBalance: Math.max(0, standPrice - paidAmount),
            paymentCount: payments._count,
            progress: standPrice > 0 ? (paidAmount / standPrice) * 100 : 0
          }
        };
      })
    );

    logger.info('Developer contracts fetched', {
      module: 'API',
      action: 'GET_DEVELOPER_CONTRACTS',
      developerId: user.id,
      count: contracts.length,
      total: totalCount
    });

    return apiSuccess({
      contracts: contractsWithPayments,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      summary: {
        total: totalCount,
        draft: contracts.filter(c => c.status === 'DRAFT').length,
        sent: contracts.filter(c => ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(c.status)).length,
        signed: contracts.filter(c => c.status === 'SIGNED').length,
        pendingDeveloperSignature: contracts.filter(c => 
          c.docusealSignerDevStatus === 'pending'
        ).length,
        totalValue: contractsWithPayments.reduce((sum, c) => 
          sum + (c.paymentSummary?.totalPrice || 0), 0
        ),
        totalPaid: contractsWithPayments.reduce((sum, c) => 
          sum + (c.paymentSummary?.paidAmount || 0), 0
        )
      }
    });

  } catch (error: any) {
    logger.error('Developer contracts GET error', error, { 
      module: 'API', 
      action: 'GET_DEVELOPER_CONTRACTS' 
    });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR);
  }
}
