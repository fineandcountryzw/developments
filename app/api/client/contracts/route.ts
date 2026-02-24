/**
 * Client Contracts API
 * 
 * GET /api/client/contracts
 * 
 * Returns contracts for the authenticated client.
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

    // Clients can access this endpoint (or higher roles for impersonation)
    const role = user.role?.toUpperCase();
    if (!['CLIENT', 'AGENT', 'MANAGER', 'ADMIN'].includes(role)) {
      return apiError('Access denied', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const signedOnly = searchParams.get('signedOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Build scoped user - force CLIENT role for scoping
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: 'CLIENT', // Force client scoping
      branch: user.branch,
      clientId: user.clientId  // If session has clientId directly
    };

    // Build WHERE clause with client scoping
    const whereClause = await buildContractScopeWhere(scopedUser, {
      status: status || undefined,
      signedOnly,
      includeArchived
    });

    logger.debug('Client contracts query', {
      module: 'API',
      action: 'GET_CLIENT_CONTRACTS',
      userId: user.id,
      email: user.email,
      whereClause: JSON.stringify(whereClause)
    });

    // Fetch contracts
    const [contracts, totalCount] = await Promise.all([
      prisma.generatedContract.findMany({
        where: whereClause,
        include: {
          signers: {
            select: { role: true, status: true, name: true },
            orderBy: { role: 'asc' },
          },
          template: {
            select: { id: true, name: true }
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

    // Format response for client view
    const formattedContracts = contracts.map(contract => ({
      id: contract.id,
      templateName: contract.templateName,
      status: contract.status,

      stand: contract.stand ? {
        standNumber: contract.stand.standNumber,
        development: contract.stand.development?.name
      } : null,
      signedAt: contract.signedAt,

      createdAt: contract.createdAt,
      // Include signing URL if client needs to sign
      canSign: false,
      signers: contract.signers?.map(s => ({ role: s.role, status: s.status, name: s.name })) || [],
    }));

    logger.info('Client contracts fetched', {
      module: 'API',
      action: 'GET_CLIENT_CONTRACTS',
      userId: user.id,
      count: contracts.length,
      total: totalCount
    });

    return apiSuccess({
      contracts: formattedContracts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      summary: {
        total: totalCount,
        pendingSignature: 0,
        signed: contracts.filter(c => c.status === 'SIGNED').length,
        draft: contracts.filter(c => c.status === 'DRAFT').length
      }
    });

  } catch (error: any) {
    logger.error('Client contracts GET error', error, {
      module: 'API',
      action: 'GET_CLIENT_CONTRACTS'
    });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR);
  }
}
