/**
 * Agent Contracts API
 * 
 * GET /api/agent/contracts
 * 
 * Returns contracts for clients assigned to this agent.
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
    
    // Check role - must be AGENT or higher
    const role = user.role?.toUpperCase();
    if (!['AGENT', 'MANAGER', 'ADMIN'].includes(role)) {
      return apiError('Agent access required', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const signedOnly = searchParams.get('signedOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Build scoped user - force AGENT role for scoping
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: 'AGENT', // Force agent scoping
      branch: user.branch
    };

    // Build WHERE clause with agent scoping
    const whereClause = await buildContractScopeWhere(scopedUser, {
      status: status || undefined,
      clientId: clientId || undefined,
      signedOnly,
      includeArchived
    });

    logger.debug('Agent contracts query', {
      module: 'API',
      action: 'GET_AGENT_CONTRACTS',
      agentId: user.id,
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

    logger.info('Agent contracts fetched', {
      module: 'API',
      action: 'GET_AGENT_CONTRACTS',
      agentId: user.id,
      count: contracts.length,
      total: totalCount
    });

    return apiSuccess({
      contracts,
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
        signed: contracts.filter(c => c.status === 'SIGNED').length
      }
    });

  } catch (error: any) {
    logger.error('Agent contracts GET error', error, { 
      module: 'API', 
      action: 'GET_AGENT_CONTRACTS' 
    });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR);
  }
}
