/**
 * GET /api/admin/contract-templates/:id/inspect
 * 
 * Inspect a contract template to extract and analyze variables.
 * Used for debugging and template validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { extractVariablesFromDocx, validateVariables } from '@/lib/docx-template-engine';
import { parseDocxTemplate } from '@/lib/contract-template-parser';
import { validateContractData, compileTemplate } from '@/lib/contract-template-compiler';

export async function GET(
  request: NextRequest,
  { params }: any
) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const templateId = params.id;

    // Get template from database
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    // For DOCX templates, we need to download the file first
    if (template.templateType === 'docx' && template.templateFileUrl) {
      logger.info('[Template Inspector] Fetching DOCX template', {
        templateId,
        templateName: template.name,
        fileUrl: template.templateFileUrl,
      });

      try {
        const response = await fetch(template.templateFileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download template: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Extract variables from DOCX
        const variables = extractVariablesFromDocx(fileBuffer);

        // Also parse using mammoth for comparison
        const parsed = await parseDocxTemplate(fileBuffer);

        logger.info('[Template Inspector] Variables extracted', {
          templateId,
          variablesCount: variables.length,
          variables: variables.map(v => v.name),
          mammothTagsCount: parsed.mergeTags.length,
          mammothTags: parsed.mergeTags.map(t => t.fullTag),
        });

        // Validate variables
        const validation = validateVariables(variables);
        
        return apiSuccess({
          templateId: template.id,
          templateName: template.name,
          templateType: template.templateType,
          variablesFound: variables.map(v => ({
            name: v.name,
            namespace: v.namespace,
            field: v.field,
            dataType: v.dataType,
            required: v.required,
          })),
          variablesFromMammoth: parsed.mergeTags.map(t => ({
            fullTag: t.fullTag,
            namespace: t.namespace,
            field: t.field,
          })),
          duplicates: findDuplicates([
            ...variables.map(v => v.name),
            ...parsed.mergeTags.map(t => t.fullTag),
          ]),
          validation: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          unsupportedPatterns: [], // To be implemented
        });
      } catch (downloadError: any) {
        logger.error('[Template Inspector] Failed to fetch DOCX template', {
          templateId,
          error: downloadError.message,
        });
        return apiError('Failed to fetch template file', 500, ErrorCodes.FETCH_ERROR);
      }
    } else if (template.templateType === 'html' || template.content) {
      // For HTML templates, extract variables from content
      logger.info('[Template Inspector] Inspecting HTML template', {
        templateId,
        templateName: template.name,
      });

      const content = template.content || '';
      const variablePattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
      const variables: string[] = [];
      let match;

      while ((match = variablePattern.exec(content)) !== null) {
        const variableName = match[1];
        if (!variables.includes(variableName)) {
          variables.push(variableName);
        }
      }

      // Validate variables
      const detectedVariables = variables.map(name => {
        const [namespace, field] = name.split('.');
        return {
          name,
          namespace,
          field,
          position: -1,
          dataType: 'text' as const,
          required: true,
        };
      });
      
      const validation = validateVariables(detectedVariables);
      
      return apiSuccess({
        templateId: template.id,
        templateName: template.name,
        templateType: template.templateType,
        variablesFound: detectedVariables.map(v => ({
          name: v.name,
          namespace: v.namespace,
          field: v.field,
          dataType: v.dataType,
          required: v.required,
        })),
        variablesFromMammoth: [],
        duplicates: findDuplicates(variables),
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        unsupportedPatterns: [],
      });
    } else {
      return apiError('Template has no content or file URL', 400, ErrorCodes.VALIDATION_ERROR);
    }
  } catch (error: any) {
    logger.error('[Template Inspector] Error', error, {
      module: 'API',
      action: 'INSPECT_TEMPLATE',
    });

    return apiError(
      error.message || 'Failed to inspect template',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

/**
 * Find duplicate variable names in an array
 */
function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }

  return Array.from(duplicates);
}
