import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAgent, getAuthenticatedUser } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const branch = request.nextUrl.searchParams.get('branch') || user.branch;
    const templates = await prisma.contractTemplate.findMany({
      where: { 
        branch: branch || 'HARARE',
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return apiSuccess(templates);
  } catch (error: any) {
    logger.error('contract-templates GET Error', error, { module: 'API', action: 'GET_CONTRACT_TEMPLATES' });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const data = await request.json();

    // Validate required fields
    if (!data.name) {
      return apiError('Missing required field: name', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!data.content) {
      return apiError('Missing required field: content', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // For development-specific templates, ensure only one active template exists per development
    let template;
    if (data.developmentId) {
      // Transaction to deactivate existing active template and create new one
      template = await prisma.$transaction(async (prismaTx) => {
        // Deactivate all existing active templates for this development
        await prismaTx.contractTemplate.updateMany({
          where: {
            developmentId: data.developmentId,
            status: 'ACTIVE',
            isActive: true
          },
          data: {
            status: 'ARCHIVED',
            isActive: false
          }
        });

        // Create new active template
        template = await prismaTx.contractTemplate.create({
          data: {
            branch: data.branch || user.branch || 'Harare',
            name: data.name,
            description: data.description || null,
            content: data.content,
            variables: data.variables || [],
            status: 'ACTIVE',
            isActive: true,
            developmentId: data.developmentId,
            isGlobal: false
          }
        });

        // Create initial version
        await prismaTx.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            version: 1,
            content: data.content,
            htmlContent: null,
            variables: data.variables || [],
            templateType: 'html',
            templateFileUrl: null,
            templateFileKey: null,
            templateVariables: [],
            changedBy: user.email,
            changeNotes: 'Initial version'
          }
        });

        return template;
      });
    } else {
      // Create global template
      template = await prisma.contractTemplate.create({
        data: {
          branch: data.branch || user.branch || 'Harare',
          name: data.name,
          description: data.description || null,
          content: data.content,
          variables: data.variables || [],
          status: 'ACTIVE',
          isActive: true,
          developmentId: null,
          isGlobal: true
        }
      });

      // Create initial version
      await prisma.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          content: data.content,
          htmlContent: null,
          variables: data.variables || [],
          templateType: 'html',
          templateFileUrl: null,
          templateFileKey: null,
          templateVariables: [],
          changedBy: user.email,
          changeNotes: 'Initial version'
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: data.branch || user.branch || 'Harare',
        userId: user.id || user.email,
        action: 'CREATE',
        module: 'CONTRACT_TEMPLATES',
        recordId: template.id,
        description: `Created contract template: ${data.name}`
      }
    });

    return apiSuccess(template, 201);
  } catch (error: any) {
    logger.error('contract-templates POST Error', error, { module: 'API', action: 'POST_CONTRACT_TEMPLATES' });
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

    const existing = await prisma.contractTemplate.findUnique({
      where: { id: data.id }
    });

    if (!existing) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // If activating a template and it's development-specific, ensure only one active template exists per development
    let updated;
    if (data.status === 'ACTIVE' && existing.developmentId) {
      updated = await prisma.$transaction(async (prismaTx) => {
        // Deactivate all other active templates for this development
        await prismaTx.contractTemplate.updateMany({
          where: {
            developmentId: existing.developmentId,
            status: 'ACTIVE',
            isActive: true,
            id: { not: data.id }
          },
          data: {
            status: 'ARCHIVED',
            isActive: false
          }
        });

        // Update the current template to active
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.variables !== undefined) updateData.variables = data.variables;
        if (data.templateType !== undefined) updateData.templateType = data.templateType;
        if (data.templateFileUrl !== undefined) updateData.templateFileUrl = data.templateFileUrl;
        if (data.templateFileKey !== undefined) updateData.templateFileKey = data.templateFileKey;
        if (data.templateVariables !== undefined) updateData.templateVariables = data.templateVariables;
        updateData.status = 'ACTIVE';
        updateData.isActive = true;

        updated = await prismaTx.contractTemplate.update({
          where: { id: data.id },
          data: updateData
        });

        // Create new version if any content-related fields changed
        if (data.content !== undefined || 
            data.variables !== undefined || 
            data.templateType !== undefined || 
            data.templateFileUrl !== undefined || 
            data.templateFileKey !== undefined || 
            data.templateVariables !== undefined) {
          const latestVersion = await prismaTx.contractTemplateVersion.findFirst({
            where: { templateId: data.id },
            orderBy: { version: 'desc' }
          });

          await prismaTx.contractTemplateVersion.create({
            data: {
              templateId: data.id,
              version: latestVersion ? latestVersion.version + 1 : 1,
              content: updated.content,
              htmlContent: updated.htmlContent,
              variables: updated.variables as any || [],
              templateType: updated.templateType,
              templateFileUrl: updated.templateFileUrl,
              templateFileKey: updated.templateFileKey,
              templateVariables: updated.templateVariables as any,
              changedBy: user.email,
              changeNotes: data.changeNotes || 'Updated template'
            }
          });
        }

        return updated;
      });
    } else {
      // Regular update without activation logic
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.variables !== undefined) updateData.variables = data.variables;
      if (data.templateType !== undefined) updateData.templateType = data.templateType;
      if (data.templateFileUrl !== undefined) updateData.templateFileUrl = data.templateFileUrl;
      if (data.templateFileKey !== undefined) updateData.templateFileKey = data.templateFileKey;
      if (data.templateVariables !== undefined) updateData.templateVariables = data.templateVariables;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.status !== undefined) updateData.isActive = data.status === 'ACTIVE';

      updated = await prisma.contractTemplate.update({
        where: { id: data.id },
        data: updateData
      });

      // Create new version if any content-related fields changed
      if (data.content !== undefined || 
          data.variables !== undefined || 
          data.templateType !== undefined || 
          data.templateFileUrl !== undefined || 
          data.templateFileKey !== undefined || 
          data.templateVariables !== undefined) {
        const latestVersion = await prisma.contractTemplateVersion.findFirst({
          where: { templateId: data.id },
          orderBy: { version: 'desc' }
        });

        await prisma.contractTemplateVersion.create({
          data: {
            templateId: data.id,
            version: latestVersion ? latestVersion.version + 1 : 1,
            content: updated.content,
            htmlContent: updated.htmlContent,
              variables: updated.variables as any || [],
            templateType: updated.templateType,
            templateFileUrl: updated.templateFileUrl,
            templateFileKey: updated.templateFileKey,
            templateVariables: updated.templateVariables as any,
            changedBy: user.email,
            changeNotes: data.changeNotes || 'Updated template'
          }
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.id || user.email,
        action: 'UPDATE',
        module: 'CONTRACT_TEMPLATES',
        recordId: data.id,
        description: `Updated contract template: ${existing.name}`,
        changes: JSON.stringify({ before: existing, after: updated })
      }
    });

    return apiSuccess(updated);
  } catch (error: any) {
    logger.error('contract-templates PUT Error', error, { module: 'API', action: 'PUT_CONTRACT_TEMPLATES' });
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

    const existing = await prisma.contractTemplate.findUnique({
      where: { id }
    });

    if (!existing) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Archive instead of hard delete (soft delete pattern)
    const archived = await prisma.contractTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.id || user.email,
        action: 'DELETE',
        module: 'CONTRACT_TEMPLATES',
        recordId: id,
        description: `Archived contract template: ${existing.name}`
      }
    });

    return apiSuccess({ id });
  } catch (error: any) {
    logger.error('contract-templates DELETE Error', error, { module: 'API', action: 'DELETE_CONTRACT_TEMPLATES' });
    return apiError(error?.message || 'Server error', 500, ErrorCodes.DELETE_ERROR);
  }
}
