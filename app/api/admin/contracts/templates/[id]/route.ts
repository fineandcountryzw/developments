import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import {
  canManageTemplate,
  canViewTemplate,
  type ContractScopeUser
} from '@/lib/contract-access-control';

function parseVariableJson(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function sortTemplateVariables(variables: any[]): any[] {
  return [...variables].sort((a, b) => {
    const nameA = String(a?.name || a?.fullName || a?.field || '').toLowerCase();
    const nameB = String(b?.name || b?.fullName || b?.field || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function normalizeTemplateVariables(template: { variables: unknown; templateVariables: unknown }): any[] {
  const primary = parseVariableJson(template.variables);
  const fallback = parseVariableJson(template.templateVariables);
  const merged = primary.length > 0 ? primary : fallback;
  return sortTemplateVariables(merged);
}

/**
 * GET /api/admin/contracts/templates/[id]
 * Get a specific template with its variables and sections
 *
 * SECURITY: Enforces role-based access control for template viewing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Build scoped user for access check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // SECURITY: Check if user can view this template
    const canView = await canViewTemplate(scopedUser, id);
    if (!canView) {
      logger.warn('Template view access denied', {
        module: 'API',
        action: 'GET_CONTRACT_TEMPLATE_BY_ID',
        templateId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this template', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Fetch template with relations
    const template = await prisma.contractTemplate.findUnique({
      where: { id },
      include: {
        development: {
          select: { id: true, name: true, location: true }
        },
        _count: {
          select: { generatedContracts: true }
        }
      }
    });

    if (!template) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get sections (from separate table)
    const sections = await prisma.templateSection.findMany({
      where: { templateId: id },
      orderBy: { orderIndex: 'asc' }
    });

    const normalizedVariables = normalizeTemplateVariables(template as any);

    return apiSuccess({
      id: template.id,
      name: template.name,
      type: (template as { type?: string }).type || 'STANDARD',
      description: template.description,
      content: template.content,
      templateVariables: normalizedVariables,
      variables: normalizedVariables,
      branch: template.branch,
      status: template.status,
      isGlobal: template.isGlobal,
      developmentId: template.developmentId,
      developmentName: template.development?.name || null,
      development: template.development,
      usageCount: template._count.generatedContracts,
      templateSections: sections,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    });
  } catch (error: any) {
    logger.error('Get template error', error, { module: 'API', action: 'GET_CONTRACT_TEMPLATE_BY_ID' });
    return apiError('Failed to fetch template', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}

/**
 * PUT /api/admin/contracts/templates/[id]
 * Update a template
 *
 * SECURITY: Enforces role-based access control for template modification
 * Body:
 * - name, description, content, variables
 * - developmentId: Can only be changed by ADMIN/MANAGER
 * - isGlobal: Can only be changed by ADMIN
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await req.json();
    const {
      name,
      type,
      description,
      content,
      templateVariables,
      developmentId,
      isGlobal,
      status
    } = body;

    // Get existing template
    const existingTemplate = await prisma.contractTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        developmentId: true,
        isGlobal: true,
        name: true
      }
    });

    if (!existingTemplate) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build scoped user for permission check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // SECURITY: Check if user can manage this template
    const permissionCheck = await canManageTemplate(scopedUser, existingTemplate.developmentId || undefined);
    if (!permissionCheck.allowed) {
      logger.warn('Template update permission denied', {
        module: 'API',
        action: 'PUT_CONTRACT_TEMPLATE_BY_ID',
        templateId: id,
        userId: user.id,
        role: user.role,
        reason: permissionCheck.reason
      });
      return apiError(
        `Permission denied: ${permissionCheck.reason}`,
        403,
        ErrorCodes.AUTH_REQUIRED
      );
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (templateVariables !== undefined) {
      const normalizedVariables = sortTemplateVariables(
        Array.isArray(templateVariables) ? templateVariables : []
      );
      updateData.variables = normalizedVariables;
      updateData.templateVariables = normalizedVariables;
    }
    if (status !== undefined) updateData.status = status;

    // Only ADMIN can change developmentId and isGlobal
    const role = scopedUser.role;
    if (role === 'ADMIN') {
      if (developmentId !== undefined) updateData.developmentId = developmentId || null;
      if (isGlobal !== undefined) updateData.isGlobal = isGlobal;
    } else if (developmentId !== undefined || isGlobal !== undefined) {
      logger.warn('Non-admin attempted to change template scope', {
        module: 'API',
        action: 'PUT_CONTRACT_TEMPLATE_BY_ID',
        templateId: id,
        userId: user.id,
        role: user.role
      });
      return apiError(
        'Only ADMIN can change template scope (developmentId, isGlobal)',
        403,
        ErrorCodes.AUTH_REQUIRED
      );
    }

    // Update template
    const updatedTemplate = await prisma.contractTemplate.update({
      where: { id },
      data: updateData,
      include: {
        development: {
          select: { id: true, name: true }
        }
      }
    });

    // Log the update
    logger.info('Template updated', {
      module: 'API',
      action: 'PUT_CONTRACT_TEMPLATE_BY_ID',
      templateId: id,
      userId: user.id,
      changes: Object.keys(updateData)
    });

    const normalizedVariables = normalizeTemplateVariables(updatedTemplate as any);

    return apiSuccess({
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      content: updatedTemplate.content,
      templateVariables: normalizedVariables,
      variables: normalizedVariables,
      branch: updatedTemplate.branch,
      status: updatedTemplate.status,
      isGlobal: updatedTemplate.isGlobal,
      developmentId: updatedTemplate.developmentId,
      developmentName: updatedTemplate.development?.name || null,
      development: updatedTemplate.development,
      updatedAt: updatedTemplate.updatedAt
    });
  } catch (error: any) {
    logger.error('Update template error', error, { module: 'API', action: 'PUT_CONTRACT_TEMPLATE_BY_ID' });
    return apiError('Failed to update template', 500, ErrorCodes.UPDATE_ERROR, { details: error.message });
  }
}

/**
 * DELETE /api/admin/contracts/templates/[id]
 * Archive a template (soft delete)
 *
 * SECURITY: Enforces role-based access control
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Get existing template
    const existingTemplate = await prisma.contractTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        developmentId: true,
        name: true,
        _count: {
          select: { generatedContracts: true }
        }
      }
    });

    if (!existingTemplate) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build scoped user for permission check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // SECURITY: Check if user can manage this template
    const permissionCheck = await canManageTemplate(scopedUser, existingTemplate.developmentId || undefined);
    if (!permissionCheck.allowed) {
      logger.warn('Template delete permission denied', {
        module: 'API',
        action: 'DELETE_CONTRACT_TEMPLATE_BY_ID',
        templateId: id,
        userId: user.id,
        role: user.role,
        reason: permissionCheck.reason
      });
      return apiError(
        `Permission denied: ${permissionCheck.reason}`,
        403,
        ErrorCodes.AUTH_REQUIRED
      );
    }

    // Check if template is in use
    const isTemplateInUse = existingTemplate._count.generatedContracts > 0;

    // HARD DELETE implementation (as requested)
    // Transaction to remove all dependencies first
    await prisma.$transaction(async (tx) => {
      // 1. Delete generated contracts
      await tx.generatedContract.deleteMany({
        where: { templateId: id }
      });

      // 2. Delete template versions
      await tx.contractTemplateVersion.deleteMany({
        where: { templateId: id }
      });

      // 3. Delete document versions
      await tx.contractDocumentVersion.deleteMany({
        where: { templateId: id }
      });

      // 4. Delete template sections (orphaned if not deleted)
      await tx.templateSection.deleteMany({
        where: { templateId: id }
      });

      // 5. Delete the template itself
      await tx.contractTemplate.delete({
        where: { id }
      });
    });

    logger.info('Template hard deleted', {
      module: 'API',
      action: 'DELETE_CONTRACT_TEMPLATE_BY_ID',
      templateId: id,
      userId: user.id,
      templateName: existingTemplate.name,
      contractsRemoved: existingTemplate._count.generatedContracts
    });

    return apiSuccess({
      template: {
        id,
        status: 'DELETED',
        message: 'Template and all associated data permanently deleted'
      }
    });
  } catch (error: any) {
    logger.error('Delete template error', error, { module: 'API', action: 'DELETE_CONTRACT_TEMPLATE_BY_ID' });
    return apiError('Failed to delete template', 500, ErrorCodes.DELETE_ERROR, { details: error.message });
  }
}
