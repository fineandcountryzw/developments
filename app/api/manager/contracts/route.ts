import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildContractScopeWhere, type ContractScopeUser } from '@/lib/contract-access-control';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/contracts
 * Fetch contracts with comprehensive filtering for Manager Dashboard
 * 
 * VISIBILITY: Shows ALL contracts (signed + unsigned) by default
 * SCOPING: Uses centralized access control for role-based visibility
 * 
 * Query Parameters:
 * - branch: Filter by branch (defaults to user's branch, 'all' for all branches)
 * - status: Filter by contract status (DRAFT, SENT, SIGNED, ARCHIVED, ALL)
 * - developmentId: Filter by specific development
 * - agentId: Filter by agent's clients
 * - clientId: Filter by specific client
 * - dateFrom/dateTo: Date range filtering
 * - signedOnly: If 'true', only show signed contracts (default: false)
 * - includeArchived: If 'true', include archived contracts
 * - limit: Number of results (default 50, max 200)
 * - page: Page number for pagination
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/manager/contracts called', { module: 'Manager-API' });

    // Auth check - Manager level access required
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const branch = searchParams.get('branch') || user.branch || 'Harare';
    const status = searchParams.get('status');
    const developmentId = searchParams.get('developmentId');
    const agentId = searchParams.get('agentId');
    const clientId = searchParams.get('clientId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const signedOnly = searchParams.get('signedOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    logger.debug('Contract query parameters', {
      branch, status, developmentId, agentId, clientId,
      dateFrom, dateTo, limit, page, offset, signedOnly, includeArchived
    });

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'MANAGER') as any,
      branch: user.branch ?? undefined
    };

    // Build WHERE clause with role-based scoping
    // Manager sees all contracts in their branch (or all if branch='all')
    const whereClause = await buildContractScopeWhere(scopedUser, {
      branch,
      status: status || undefined,
      clientId: clientId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      signedOnly,
      includeArchived
    });

    // If agentId filter is provided, filter by agent's clients
    if (agentId && agentId !== 'ALL') {
      const agentClients = await prisma.client.findMany({
        where: { agentId },
        select: { id: true }
      });
      const agentClientIds = agentClients.map(c => c.id);
      
      if (agentClientIds.length > 0) {
        whereClause.clientId = { in: agentClientIds };
      } else {
        // Agent has no clients - return empty
        whereClause.clientId = { in: [] };
      }
    }

    // Fetch contracts with includes
    const [contracts, totalCount] = await Promise.all([
      prisma.generatedContract.findMany({
        where: whereClause,
        include: {
          signers: {
            select: { role: true, status: true, name: true, email: true },
            orderBy: { role: 'asc' },
          },
          client: {
            select: { id: true, name: true, email: true, phone: true, agentId: true }
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
      
      prisma.generatedContract.count({
        where: whereClause
      })
    ]);

    // Filter by development server-side if requested
    let filteredContracts = contracts;
    if (developmentId && developmentId !== 'ALL') {
      filteredContracts = contracts.filter(contract => 
        contract.stand?.development?.id === developmentId
      );
    }

    // Create maps for easy lookup (relations already included)
    const standMap = contracts.reduce((acc, contract) => {
      if (contract.stand) {
        acc[contract.standId] = contract.stand;
      }
      return acc;
    }, {} as Record<string, any>);

    // Get payment summaries for each contract
    const contractIds = filteredContracts.map(c => c.id);
    const paymentSummaries = contractIds.length > 0 ? await Promise.all(
      filteredContracts.map(async (contract) => {
        const stand = standMap[contract.standId];
        if (!stand) {
          return {
            contractId: contract.id,
            totalPrice: 0,
            paidToDate: 0,
            remainingBalance: 0,
            paymentCount: 0
          };
        }

        // Get payments for this client-stand combination
        const payments = await prisma.payment.findMany({
          where: {
            clientId: contract.clientId,
            standId: contract.standId,
            status: 'CONFIRMED'
          },
          select: {
            amount: true,
            createdAt: true
          }
        });

        const paidToDate = payments.reduce((sum, payment) => 
          sum + Number(payment.amount), 0
        );
        
        const totalPrice = Number(stand.price);
        const remainingBalance = Math.max(0, totalPrice - paidToDate);

        return {
          contractId: contract.id,
          totalPrice,
          paidToDate,
          remainingBalance,
          paymentCount: payments.length,
          lastPaymentDate: payments.length > 0 ? 
            Math.max(...payments.map(p => p.createdAt.getTime())) : null
        };
      })
    ) : [];

    // Create payment summary lookup
    const paymentMap = paymentSummaries.reduce((acc, summary) => {
      acc[summary.contractId] = summary;
      return acc;
    }, {} as Record<string, any>);

    // Note: Agent filtering is now handled server-side via buildContractScopeWhere
    // and the agentId param above

    // Format response data (use included relations directly)
    const formattedContracts = filteredContracts.map(contract => {
      const paymentSummary = paymentMap[contract.id] || {
        totalPrice: 0, paidToDate: 0, remainingBalance: 0, paymentCount: 0
      };

      return {
        id: contract.id,
        status: contract.status,
        docusealStatus: (contract as any).docusealStatus,
        signedAt: contract.signedAt,
        signedBy: contract.signedBy,
        signedPdfUrl: (contract as any).signedPdfUrl,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        
        // Client information (from included relation)
        client: contract.client ? {
          id: contract.client.id,
          name: contract.client.name,
          email: contract.client.email,
          phone: contract.client.phone,
          agentId: contract.client.agentId
        } : { id: contract.clientId, name: 'Unknown', email: '', phone: '' },
        
        // Template information (from included relation)
        template: contract.template ? {
          id: contract.template.id,
          name: contract.template.name
        } : { id: contract.templateId, name: contract.templateName || 'Unknown' },
        
        // Stand and development information (from included relation)
        stand: contract.stand ? {
          id: contract.stand.id,
          standNumber: contract.stand.standNumber,
          price: Number(contract.stand.price),
          sizeSqm: Number(contract.stand.sizeSqm || 0),
          development: contract.stand.development
        } : null,
        
        // Payment summary
        paymentSummary: {
          ...paymentSummary,
          paymentProgress: paymentSummary.totalPrice > 0 ? 
            (paymentSummary.paidToDate / paymentSummary.totalPrice) * 100 : 0
        }
      };
    });

    const response = {
      contracts: formattedContracts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      summary: {
        totalContracts: totalCount,
        draftContracts: formattedContracts.filter(c => c.status === 'DRAFT').length,
        sentContracts: formattedContracts.filter(c => 
          ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(c.status || c.docusealStatus)
        ).length,
        signedContracts: formattedContracts.filter(c => c.status === 'SIGNED').length,
        archivedContracts: formattedContracts.filter(c => c.status === 'ARCHIVED').length,
        totalValue: formattedContracts.reduce((sum, c) => 
          sum + (c.paymentSummary?.totalPrice || 0), 0),
        totalPaid: formattedContracts.reduce((sum, c) => 
          sum + (c.paymentSummary?.paidToDate || 0), 0)
      }
    };

    logger.info('Manager contracts fetched successfully', {
      count: formattedContracts.length,
      totalContracts: totalCount,
      branch,
      filters: { status, developmentId, agentId },
      queryExecutionTime: Date.now() - Date.now(), // This would need proper timing
      module: 'Manager-Contracts',
      action: 'CONTRACT_QUERY'
    });

    return apiSuccess(response);

  } catch (error: any) {
    logger.error('Failed to fetch manager contracts', error, { 
      module: 'Manager-API',
      endpoint: '/api/manager/contracts'
    });
    return apiError('Failed to fetch contracts', 500);
  }
}
