import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import {
  canManageTemplate,
  type ContractScopeUser
} from '@/lib/contract-access-control';

/**
 * GET /api/admin/developments/[id]/templates
 * Get all templates for a specific development
 * Includes both development-specific and global templates
 *
 * Query params:
 * - includeGlobal: Include global templates (default: true)
 * - status: Filter by status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id: developmentId } = await params;
    const { searchParams } = new URL(req.url);
    const includeGlobal = searchParams.get('includeGlobal') !== 'false';
    const status = searchParams.get('status') || undefined;

    // Verify development exists
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, name: true, branch: true }
    });

    if (!development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build scoped user for access check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    const role = scopedUser.role;

    // Check access based on role
    let hasAccess = false;
    switch (role) {
      case 'ADMIN':
        hasAccess = true;
        break;
      case 'MANAGER':
        hasAccess = development.branch === user.branch;
        break;
      case 'DEVELOPER':
        // Check if this developer owns this development
        const devDevelopments = await prisma.development.findMany({
          where: { developerEmail: user.email },
          select: { id: true }
        });
        hasAccess = devDevelopments.some(d => d.id === developmentId);
        break;
      default:
        hasAccess = false;
    }

    if (!hasAccess) {
      logger.warn('Development templates access denied', {
        module: 'API',
        action: 'GET_DEVELOPMENT_TEMPLATES',
        developmentId,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this development', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Build query conditions
    const whereConditions: any[] = [];

    // Development-specific templates
    whereConditions.push({ developmentId });

    // Global templates (if requested)
    if (includeGlobal) {
      whereConditions.push({ isGlobal: true });
    }

    // Status filter
    const statusFilter = status ? { status } : {};

    // Fetch templates
    const templates = await prisma.contractTemplate.findMany({
      where: {
        OR: whereConditions,
        ...statusFilter
      },
      include: {
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
    const transformedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      variables: template.variables,
      branch: template.branch,
      status: template.status,
      isGlobal: template.isGlobal,
      developmentId: template.developmentId,
      usageCount: template._count.generatedContracts,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));

    return apiSuccess({
      development: {
        id: development.id,
        name: development.name,
        branch: development.branch
      },
      templates: transformedTemplates,
      count: transformedTemplates.length,
      filters: { includeGlobal, status }
    });
  } catch (error: any) {
    logger.error('Get development templates error', error, {
      module: 'API',
      action: 'GET_DEVELOPMENT_TEMPLATES'
    });
    return apiError('Failed to fetch development templates', 500, ErrorCodes.FETCH_ERROR, {
      details: error.message
    });
  }
}

/**
 * POST /api/admin/developments/[id]/templates
 * Create a new template specifically for this development
 *
 * Body:
 * - name: Template name (required)
 * - content: Template content (required)
 * - description: Optional description
 * - variables: Array of variable definitions
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id: developmentId } = await params;
    const body = await req.json();
    const { name, description, content, variables = [] } = body;

    // Validation
    if (!name || !content) {
      return apiError('Name and content are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify development exists
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, name: true, branch: true }
    });

    if (!development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build scoped user for permission check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Check if user can manage templates for this development
    const permissionCheck = await canManageTemplate(scopedUser, developmentId);
    if (!permissionCheck.allowed) {
      logger.warn('Development template creation permission denied', {
        module: 'API',
        action: 'POST_DEVELOPMENT_TEMPLATE',
        developmentId,
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

    // Create development-specific template
    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        content,
        variables,
        branch: development.branch,
        status: 'ACTIVE',
        developmentId: developmentId,
        isGlobal: false // Development-specific templates are never global
      }
    });

    logger.info('Development template created', {
      module: 'API',
      action: 'POST_DEVELOPMENT_TEMPLATE',
      templateId: template.id,
      developmentId,
      userId: user.id
    });

    return apiSuccess({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        content: template.content,
        variables: template.variables,
        branch: template.branch,
        status: template.status,
        isGlobal: template.isGlobal,
        developmentId: template.developmentId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      },
      development: {
        id: development.id,
        name: development.name
      }
    }, 201);
  } catch (error: any) {
    logger.error('Create development template error', error, {
      module: 'API',
      action: 'POST_DEVELOPMENT_TEMPLATE'
    });
    return apiError('Failed to create development template', 500, ErrorCodes.CREATE_ERROR, {
      details: error.message
    });
  }
}
