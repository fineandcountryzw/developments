import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import {
  buildTemplateScopeWhere,
  canManageTemplate,
  type ContractScopeUser
} from '@/lib/contract-access-control';
import { compileTemplate, CompiledTemplateSpec, CompilationError } from '@/lib/contract-template-compiler';

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
 * GET /api/admin/contracts/templates
 * List contract templates with role-based scoping
 *
 * Query params:
 * - status: Filter by status (ACTIVE, INACTIVE, ARCHIVED)
 * - branch: Filter by branch (ADMIN only can use 'all')
 * - developmentId: Filter by specific development
 * - includeGlobal: Include global templates (default: true)
 * - search: Search by name/description
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const branch = searchParams.get('branch') || undefined;
    const developmentId = searchParams.get('developmentId') || undefined;
    const includeGlobal = searchParams.get('includeGlobal') !== 'false'; // Default true
    const search = searchParams.get('search') || undefined;

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Build scoped WHERE clause
    const whereClause = await buildTemplateScopeWhere(scopedUser, {
      status,
      branch,
      developmentId,
      includeGlobal,
      search
    });

    logger.debug('Template query WHERE clause', {
      module: 'API',
      action: 'GET_CONTRACT_TEMPLATES',
      role: scopedUser.role,
      whereClause: JSON.stringify(whereClause)
    });

    // Fetch templates with development info
    const templates = await prisma.contractTemplate.findMany({
      where: whereClause,
      include: {
        development: {
          select: { id: true, name: true, location: true }
        },
        _count: {
          select: { generatedContracts: true }
        }
      },
      orderBy: [
        { isGlobal: 'desc' }, // Global templates first
        { name: 'asc' }
      ]
    });

    // Transform response
    const transformedTemplates = templates.map(template => {
      const normalizedVariables = normalizeTemplateVariables(template as any);

      return ({
        id: template.id,
        name: template.name,
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
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      });
    });

    return apiSuccess(
      transformedTemplates,
      200,
      {
        total: transformedTemplates.length,
        status,
        branch,
        developmentId,
        includeGlobal
      }
    );
  } catch (error: any) {
    logger.error('Get templates error', error, { module: 'API', action: 'GET_CONTRACT_TEMPLATES' });
    return apiError('Failed to fetch templates', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}

/**
 * POST /api/admin/contracts/templates
 * Create a new contract template
 *
 * Body:
 * - name: Template name (required)
 * - content: Template content with placeholders (required)
 * - description: Optional description
 * - variables: Array of variable definitions
 * - developmentId: Optional - if set, creates development-specific template
 * - isGlobal: Boolean - if true and no developmentId, creates global template
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await req.json();
    const {
      name,
      description,
      content,
      templateVariables = [],
      developmentId,
      isGlobal = false
    } = body;

    // Log incoming request
    logger.info('POST /api/admin/contracts/templates request received', {
      module: 'API',
      action: 'POST_CONTRACT_TEMPLATES',
      userId: user.id,
      userRole: user.role,
      userBranch: user.branch,
      hasName: !!name,
      nameLength: name?.length || 0,
      hasContent: !!content,
      contentLength: content?.length || 0,
      developmentId,
      isGlobal,
      variablesCount: templateVariables?.length || 0
    });

    // Validation with detailed error messages
    if (!name || !name.trim()) {
      logger.warn('Template creation failed: missing name', {
        module: 'API',
        action: 'POST_CONTRACT_TEMPLATES',
        userId: user.id,
        providedName: name
      });
      return apiError('Template name is required and cannot be empty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!content || !content.trim()) {
      logger.warn('Template creation failed: missing content', {
        module: 'API',
        action: 'POST_CONTRACT_TEMPLATES',
        userId: user.id,
        providedContentLength: content?.length || 0
      });
      return apiError('Template content is required and cannot be empty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Build scoped user for permission check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Check if user can manage this type of template
    const permissionCheck = await canManageTemplate(scopedUser, developmentId);
    if (!permissionCheck.allowed) {
      logger.warn('Template creation permission denied', {
        module: 'API',
        action: 'POST_CONTRACT_TEMPLATES',
        userId: user.id,
        role: user.role,
        developmentId,
        reason: permissionCheck.reason
      });
      return apiError(
        `Permission denied: ${permissionCheck.reason}`,
        403,
        ErrorCodes.AUTH_REQUIRED
      );
    }

    // Validate development exists if specified
    if (developmentId) {
      const development = await prisma.development.findUnique({
        where: { id: developmentId },
        select: { id: true, name: true, branch: true }
      });

      if (!development) {
        return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
      }

      // RBAC: Check branch access for non-admin users
      if (scopedUser.role !== 'ADMIN' && development.branch !== scopedUser.branch) {
        logger.warn('Branch access denied for template creation', {
          module: 'API',
          action: 'POST_CONTRACT_TEMPLATES',
          developmentId,
          developmentBranch: development.branch,
          userBranch: scopedUser.branch,
          userId: user.id,
          role: scopedUser.role
        });
        return apiError(
          'You do not have permission to create templates for developments outside your branch',
          403,
          ErrorCodes.AUTH_REQUIRED
        );
      }

      // Log development validation
      logger.info('Creating development-specific template', {
        module: 'API',
        action: 'POST_CONTRACT_TEMPLATES',
        developmentId,
        developmentName: development.name,
        developmentBranch: development.branch,
        userId: user.id
      });
    }

    // Determine isGlobal flag
    const isTemplateGlobal = developmentId ? false : isGlobal;

    // ===== TEMPLATE COMPILATION (v2.0 Architecture) =====
    // Templates are compiled at creation time to validate merge tags
    // Invalid templates are rejected immediately (fail-fast pattern)
    const compilationResult = compileTemplate(
      content,        // htmlContent (POST uses raw content)
      content,        // textContent (same for non-DOCX)
      {
        name,
        description,
        scope: developmentId ? 'development' : 'global',
        developmentId,
        branch: user.branch || 'Harare'
      }
    );

    if (!compilationResult.success) {
      // FAIL-FAST: Return compilation errors with detailed diagnostics
      logger.warn('Template compilation failed', {
        module: 'API',
        action: 'POST_CONTRACT_TEMPLATES',
        templateName: name,
        userId: user.id,
        errors: compilationResult.errors
      });

      return apiError(
        'Template compilation failed. Please fix the issues and try again.',
        400,
        ErrorCodes.VALIDATION_ERROR,
        {
          errors: compilationResult.errors,
          warnings: compilationResult.warnings,
          errorDetails: compilationResult.errors?.map((e: CompilationError) => ({
            code: e.code,
            message: e.message,
            tag: e.tag,
            suggestion: e.suggestion,
            position: e.position
          }))
        }
      );
    }

    const compiledSpec = compilationResult.spec!;

    // Extract validated variables from compiled spec
    const compiledVariables = sortTemplateVariables(compiledSpec.mergeTags.map(tag => ({
      name: tag.fullName,
      namespace: tag.namespace,
      field: tag.field,
      dataType: tag.dataType,
      required: tag.required
    })));

    // Create template with compiled spec
    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        content,
        variables: compiledVariables as any,
        templateVariables: compiledVariables as any,
        branch: user.branch || 'Harare',
        status: 'ACTIVE',
        developmentId: developmentId || null,
        isGlobal: isTemplateGlobal
      },
      include: {
        development: true
      }
    });

    logger.info('Template created and compiled successfully', {
      module: 'API',
      action: 'POST_CONTRACT_TEMPLATES',
      templateId: template.id,
      specId: compiledSpec.specId,
      userId: user.id,
      developmentId,
      isGlobal: template.isGlobal,
      mergeTagCount: compiledSpec.mergeTags.length,
      requiredFields: compiledSpec.requiredFields.length
    });

    return apiSuccess({
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      templateVariables: compiledVariables,
      variables: compiledVariables,
      mergeTags: compiledSpec.mergeTags.map(tag => ({
        tag: `{{${tag.fullName}}}`,
        namespace: tag.namespace,
        field: tag.field,
        dataType: tag.dataType,
        required: tag.required
      })),
      branch: template.branch,
      status: template.status,
      isGlobal: template.isGlobal,
      developmentId: template.developmentId,
      developmentName: template.development?.name || null,
      development: template.development,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      _compilation: {
        specId: compiledSpec.specId,
        compilerVersion: compiledSpec.compilerVersion,
        compiledAt: compiledSpec.compiledAt,
        requiredFields: compiledSpec.requiredFields,
        optionalFields: compiledSpec.optionalFields,
        warnings: compiledSpec.warnings
      }
    }, 201);
  } catch (error: any) {
    logger.error('Create template error', error, { module: 'API', action: 'POST_CONTRACT_TEMPLATES' });
    return apiError('Failed to create template', 500, ErrorCodes.CREATE_ERROR, { details: error.message });
  }
}

/**
 * DELETE /api/admin/contracts/templates
 * Batch delete templates (System Wipe)
 * 
 * Query params:
 * - all: Must be 'true' to trigger system wipe
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { searchParams } = new URL(req.url);
    const wipeAll = searchParams.get('all') === 'true';

    // Only allow ADMIN to perform system wipe
    if (user.role !== 'ADMIN') {
      return apiError('Only ADMIN can perform system wipe', 403, ErrorCodes.AUTH_REQUIRED);
    }

    if (!wipeAll) {
      return apiError('Missing confirmation param (all=true)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.warn('SYSTEM WIPE INITIATED: Deleting all contract templates', {
      module: 'API',
      action: 'DELETE_ALL_CONTRACT_TEMPLATES',
      userId: user.id
    });

    // Transaction to remove EVERYTHING
    const results = await prisma.$transaction(async (tx) => {
      // 1. Delete all generated contracts
      const contracts = await tx.generatedContract.deleteMany({});

      // 2. Delete all template versions
      const versions = await tx.contractTemplateVersion.deleteMany({});

      // 3. Delete all document versions
      const docs = await tx.contractDocumentVersion.deleteMany({});

      // 4. Delete all template sections
      const sections = await tx.templateSection.deleteMany({});

      // 5. Delete all templates
      const templates = await tx.contractTemplate.deleteMany({});

      return {
        contracts: contracts.count,
        versions: versions.count,
        docs: docs.count,
        sections: sections.count,
        templates: templates.count
      };
    });

    logger.info('System wipe completed', {
      module: 'API',
      action: 'DELETE_ALL_CONTRACT_TEMPLATES',
      userId: user.id,
      ...results
    });

    return apiSuccess({
      message: 'System wipe successful. All templates and associated data deleted.',
      deletedCounts: results
    });

  } catch (error: any) {
    logger.error('System wipe error', error, { module: 'API', action: 'DELETE_ALL_CONTRACT_TEMPLATES' });
    return apiError('Failed to wipe system', 500, ErrorCodes.DELETE_ERROR, { details: error.message });
  }
}
