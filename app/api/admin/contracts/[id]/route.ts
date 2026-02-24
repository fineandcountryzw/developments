import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { canAccessContract, type ContractScopeUser } from '@/lib/contract-access-control';

/**
 * GET /api/admin/contracts/[id]
 * Get a specific contract with all details
 * 
 * SECURITY: Enforces role-based access control
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('GET /api/admin/contracts/[id]', { module: 'API', action: 'GET_ADMIN_CONTRACT_BY_ID', contractId: id });

    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch,
      clientId: (user as any).clientId
    };

    // SECURITY: Verify user can access this contract
    const hasAccess = await canAccessContract(scopedUser, id);
    if (!hasAccess) {
      logger.warn('Contract access denied', {
        module: 'API',
        action: 'GET_ADMIN_CONTRACT_BY_ID',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const contract = await prisma.generatedContract.findUnique({
      where: { id },
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
        templateSnapshot: true, // Assuming this is safe or we want to try it
        signers: {
          select: { role: true, status: true, name: true, email: true, invitedAt: true, openedAt: true, signedAt: true, declinedAt: true },
          orderBy: { role: 'asc' },
        },
        template: {
          select: { id: true, name: true, description: true }
        },
        client: {
          select: { id: true, name: true, email: true, phone: true }
        }
      }
    });

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    logger.debug('Contract retrieved', { module: 'API', action: 'GET_ADMIN_CONTRACT_BY_ID', contractId: id });

    return apiSuccess(contract);
  } catch (error: any) {
    logger.error('CONTRACTS ERROR', error, { module: 'API', action: 'GET_ADMIN_CONTRACT_BY_ID' });
    return apiError('Failed to fetch contract', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}

/**
 * PUT /api/admin/contracts/[id]
 * Update contract (variables, status, notes)
 * 
 * SECURITY: Enforces role-based access control
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let contractId: string | undefined;
  try {
    const { id } = await params;
    contractId = id;
    logger.info('PUT /api/admin/contracts/[id]', { module: 'API', action: 'PUT_ADMIN_CONTRACT_BY_ID', contractId: id });

    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch,
      clientId: (user as any).clientId
    };

    // SECURITY: Verify user can access this contract
    const hasAccess = await canAccessContract(scopedUser, id);
    if (!hasAccess) {
      logger.warn('Contract update access denied', {
        module: 'API',
        action: 'PUT_ADMIN_CONTRACT_BY_ID',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    const { variables, status } = await request.json();

    // Get existing contract
    const contract = await prisma.generatedContract.findUnique({
      where: { id },
      select: {
        id: true,
        templateId: true
      }
    });

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build update data
    const updateData: any = {};

    if (variables) {
      // Re-render template with new variables
      const template = await prisma.contractTemplate.findUnique({
        where: { id: contract.templateId }
      });

      if (template) {
        let content = template.content;
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`;
          content = content.replaceAll(placeholder, String(value || ''));
        });
        updateData.content = content;
        updateData.variables = variables;
      }
    }

    if (status) updateData.status = status;

    // Update contract
    const updated = await prisma.generatedContract.update({
      where: { id },
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
        templateSnapshot: true,
        template: {
          select: { id: true, name: true }
        },
        client: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    logger.info('Contract updated', { module: 'API', action: 'PUT_ADMIN_CONTRACT_BY_ID', contractId: id });

    return apiSuccess(updated);
  } catch (error: any) {
    logger.error('CONTRACTS ERROR', error, { module: 'API', action: 'PUT_ADMIN_CONTRACT_BY_ID', contractId });
    return apiError('Failed to update contract', 500, ErrorCodes.UPDATE_ERROR, { details: error.message });
  }
}

/**
 * DELETE /api/admin/contracts/[id]
 * Archive a contract (soft delete)
 * 
 * SECURITY: Enforces role-based access control
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let contractId: string | undefined;
  try {
    const { id } = await params;
    contractId = id;
    logger.info('DELETE /api/admin/contracts/[id]', { module: 'API', action: 'DELETE_ADMIN_CONTRACT_BY_ID', contractId: id });

    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch,
      clientId: (user as any).clientId
    };

    // SECURITY: Verify user can access this contract
    const hasAccess = await canAccessContract(scopedUser, id);
    if (!hasAccess) {
      logger.warn('Contract delete access denied', {
        module: 'API',
        action: 'DELETE_ADMIN_CONTRACT_BY_ID',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Check if contract has financial activity
    const contract = await prisma.generatedContract.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        signedAt: true,
        signedBy: true,
        client: {
          include: {
            payments: true,
            installmentPlans: {
              include: {
                installments: true
              }
            }
          }
        },
        stand: {
          include: {
            payments: true,
            installmentPlans: {
              include: {
                installments: true
              }
            }
          }
        }
      }
    });

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if contract has any payments, installments, or is not a draft
    const hasFinancialActivity =
      (contract.client?.payments?.length ?? 0) > 0 ||
      (contract.stand?.payments?.length ?? 0) > 0 ||
      (contract.client?.installmentPlans?.some(plan => (plan.installments?.length ?? 0) > 0) ?? false) ||
      (contract.stand?.installmentPlans?.some(plan => (plan.installments?.length ?? 0) > 0) ?? false) ||
      contract.status !== 'DRAFT' ||
      !!contract.signedAt ||
      !!contract.signedBy;

    if (hasFinancialActivity) {
      // Archive instead of hard delete
      const archivedContract = await prisma.generatedContract.update({
        where: { id },
        data: { status: 'ARCHIVED' },
        select: { id: true, status: true } // Only return safe fields
      });

      // Log action
      await prisma.contractActivity.create({
        data: {
          contractId: id,
          action: 'archived',
          actorEmail: user.email,
          actorRole: user.role
        }
      });

      logger.info('Contract archived (has financial activity)', {
        module: 'API',
        action: 'DELETE_ADMIN_CONTRACT_BY_ID',
        contractId: id
      });

      return apiSuccess({
        message: 'Cannot delete: Contract has financial activity. Archived instead.'
      });
    }

    // Hard delete only if it's a draft with no financial activity
    await prisma.generatedContract.delete({
      where: { id }
    });

    logger.info('Contract deleted (hard delete)', {
      module: 'API',
      action: 'DELETE_ADMIN_CONTRACT_BY_ID',
      contractId: id
    });

    return apiSuccess({ message: 'Contract deleted successfully' });
  } catch (error: any) {
    logger.error('CONTRACTS ERROR', error, { module: 'API', action: 'DELETE_ADMIN_CONTRACT_BY_ID', contractId });
    return apiError('Failed to delete contract', 500, ErrorCodes.DELETE_ERROR, { details: error.message });
  }
}
