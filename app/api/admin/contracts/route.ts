import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { buildContractScopeWhere, type ContractScopeUser } from '@/lib/contract-access-control';

/**
 * GET /api/admin/contracts
 * 
 * Fetch contracts with role-based access control.
 * Shows BOTH signed and unsigned contracts by default.
 * 
 * Query params:
 * - branch: Filter by branch (admin can specify 'all')
 * - status: Filter by status (DRAFT, SENT, SIGNED, ARCHIVED, etc.)
 * - clientId: Filter by client
 * - signedOnly: If 'true', only show signed contracts
 * - includeArchived: If 'true', include archived contracts
 * - page: Page number (default 1)
 * - limit: Results per page (default 100, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch;
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const signedOnly = searchParams.get('signedOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const offset = (page - 1) * limit;

    // Build scoped user object for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Build WHERE clause with role-based scoping
    const whereClause = await buildContractScopeWhere(scopedUser, {
      branch,
      clientId: clientId || undefined,
      status: status || undefined,
      signedOnly,
      includeArchived
    });

    logger.debug('Contract query WHERE clause', {
      module: 'API',
      action: 'GET_ADMIN_CONTRACTS',
      role: scopedUser.role,
      whereClause: JSON.stringify(whereClause)
    });

    // Fetch contracts with relations
    const [contracts, totalCount] = await Promise.all([
      prisma.generatedContract.findMany({
        where: whereClause,
        select: {
          id: true,
          clientId: true,
          templateId: true,
          standId: true,
          templateName: true,
          status: true,
          branch: true,
          createdAt: true,
          updatedAt: true,
          signedAt: true,
          signedBy: true,
          // Explicitly excluding potentially missing fields (isOffline, contractDate, etc.)

          signers: {
            select: { role: true, status: true, name: true, email: true },
            orderBy: { role: 'asc' },
          },
          template: {
            select: { id: true, name: true }
          },
          client: {
            select: { id: true, name: true, email: true, agentId: true }
          },
          stand: {
            select: {
              id: true,
              standNumber: true,
              development: {
                select: { id: true, name: true }
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

    // Return with pagination info
    return apiSuccess(
      contracts.map(contract => ({
        ...contract,
        templateName: contract.template?.name || contract.templateName || 'Unknown Template',
        clientName: contract.client?.name || 'Unknown Client',
        developmentName: contract.stand?.development?.name || 'Unknown Development',
        standNumber: contract.stand?.standNumber || 'Unknown Stand'
      })),
      200,
      {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / Number(limit))
      }
    );
  } catch (error: any) {
    logger.error('contracts GET Error', error, {
      module: 'API',
      action: 'GET_ADMIN_CONTRACTS',
      query: request.nextUrl.searchParams.toString(),
      userId: (await requireAdmin()).user?.id
    });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR, {
      details: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const data = await request.json();

    // Validate required fields
    if (!data.clientId) {
      return apiError('Missing required field: clientId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!data.templateId) {
      return apiError('Missing required field: templateId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!data.standId) {
      return apiError('Missing required field: standId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch template
    const template = await prisma.contractTemplate.findUnique({
      where: { id: data.templateId }
    });

    if (!template) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Fetch client
    const client = await prisma.client.findUnique({
      where: { id: data.clientId }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Generate contract by substituting variables
    let content = template.content;

    // Variable substitution
    const substitutions: Record<string, string> = {
      '{CLIENT_NAME}': client.name,
      '{CLIENT_EMAIL}': client.email,
      '{CLIENT_PHONE}': client.phone || 'N/A',
      '{STAND_ID}': data.standId,
      '{TEMPLATE_NAME}': template.name,
      '{DATE}': new Date().toLocaleDateString(),
      '{TIMESTAMP}': new Date().toISOString()
    };

    // Add custom substitutions from request
    if (data.substitutions) {
      Object.assign(substitutions, data.substitutions);
    }

    // Replace all variables in content
    for (const [key, value] of Object.entries(substitutions)) {
      content = content.replaceAll(key, value as string);
    }

    // Create template snapshot for versioning
    const templateSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      variables: template.variables,
      version: 1, // Can be enhanced to track actual version numbers
      snapshottedAt: new Date().toISOString()
    };

    // Create contract record
    const contract = await prisma.generatedContract.create({
      data: {
        clientId: data.clientId,
        templateId: data.templateId,
        standId: data.standId,
        templateName: template.name,
        content: content,
        status: 'DRAFT',
        branch: data.branch || user.branch || 'Harare',
        templateSnapshot: templateSnapshot
      },
      select: {
        id: true,
        clientId: true,
        templateId: true,
        standId: true,
        templateName: true,
        content: true,
        status: true,
        branch: true,
        createdAt: true,
        updatedAt: true,
        signedAt: true,
        signedBy: true,
        templateSnapshot: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: data.branch || user.branch || 'Harare',
        userId: user.id || user.email,
        action: 'CREATE',
        module: 'CONTRACTS',
        recordId: contract.id,
        description: `Generated contract from template: ${template.name} for client: ${client.name}`,
        changes: JSON.stringify({
          templateId: data.templateId,
          clientId: data.clientId,
          standId: data.standId
        })
      }
    });

    return apiSuccess(contract, 201);
  } catch (error: any) {
    logger.error('contracts POST Error', error, { module: 'API', action: 'POST_ADMIN_CONTRACTS' });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.CREATE_ERROR);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const data = await request.json();
    if (!data.id) {
      return apiError('Missing id', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const existing = await prisma.generatedContract.findUnique({
      where: { id: data.id }
    });

    if (!existing) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build update data
    const updateData: any = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.signedBy !== undefined) updateData.signedBy = data.signedBy;
    if (data.status === 'SIGNED' && !existing.signedAt) {
      updateData.signedAt = new Date();
    }

    const updated = await prisma.generatedContract.update({
      where: { id: data.id },
      data: updateData,
      select: {
        id: true,
        clientId: true,
        templateId: true,
        standId: true,
        templateName: true,
        content: true,
        status: true,
        branch: true,
        createdAt: true,
        updatedAt: true,
        signedAt: true,
        signedBy: true,
        templateSnapshot: true
      }
    });

    // Log activity
    const actionDescription = data.status === 'SIGNED'
      ? `Signed contract: ${existing.templateName}`
      : `Updated contract: ${existing.templateName}`;

    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.id || user.email,
        action: data.status === 'SIGNED' ? 'UPDATE' : 'UPDATE',
        module: 'CONTRACTS',
        recordId: data.id,
        description: actionDescription,
        changes: JSON.stringify({ before: existing, after: updated })
      }
    });

    return apiSuccess(updated);
  } catch (error: any) {
    logger.error('contracts PUT Error', error, { module: 'API', action: 'PUT_ADMIN_CONTRACTS' });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.UPDATE_ERROR);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await request.json();
    if (!id) {
      return apiError('Missing id', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const existing = await prisma.generatedContract.findUnique({
      where: { id }
    });

    if (!existing) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Archive instead of hard delete
    const archived = await prisma.generatedContract.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.id || user.email,
        action: 'DELETE',
        module: 'CONTRACTS',
        recordId: id,
        description: `Archived contract: ${existing.templateName}`
      }
    });

    return apiSuccess({ id });
  } catch (error: any) {
    logger.error('contracts DELETE Error', error, { module: 'API', action: 'DELETE_ADMIN_CONTRACTS' });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.DELETE_ERROR);
  }
}
