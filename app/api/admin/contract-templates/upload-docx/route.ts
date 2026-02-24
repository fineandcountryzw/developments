/**
 * POST /api/admin/contract-templates/upload-docx
 * 
 * Upload and process a DOCX contract template.
 * Handles file upload, variable extraction, and template creation.
 * 
 * Request body: multipart/form-data
 * - file: File (required) - The DOCX template file
 * - name: string (required) - Template name
 * - description: string (optional) - Template description
 * - branch: string (optional) - Branch for the template
 * - developmentId: string (optional) - Development-specific template
 * 
 * @module app/api/admin/contract-templates/upload-docx/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import {
  extractVariablesFromDocx,
  validateVariables,
  validateDocxTemplate,
  isValidDocxMagicBytes,
  formatVariablesForStorage,
} from '@/lib/docx-template-engine';
import { compileDocxTemplate, type CompilationError } from '@/lib/contract-template-compiler';

// Increase body size limit for file uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const branch = formData.get('branch') as string | null;
    const developmentId = formData.get('developmentId') as string | null;

    // Validate required fields
    if (!file) {
      return apiError('Missing required file', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!name) {
      return apiError('Missing required field: name', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.docx')) {
      return apiError('Invalid file type. Only .docx files are allowed.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Validate DOCX magic bytes
    if (!isValidDocxMagicBytes(fileBuffer)) {
      return apiError('Invalid file format. File is not a valid DOCX.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate DOCX structure
    const validation = validateDocxTemplate(fileBuffer);
    if (!validation.valid) {
      return apiError(`Invalid DOCX template: ${validation.error}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Extract and validate variables from template
    let variables;
    try {
      variables = extractVariablesFromDocx(fileBuffer);
    } catch (error) {
      logger.error('[DOCX] Failed to extract variables', error as Error);
      return apiError('Failed to extract variables from template', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate variables against our schema
    const variableValidation = validateVariables(variables);
    if (!variableValidation.valid) {
      return apiError(
        `Invalid template variables: ${variableValidation.errors.join('; ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Compile template into normalized spec format
    const compilationResult = compileDocxTemplate(
      fileBuffer, 
      {
        name,
        description: description || null,
        scope: developmentId ? 'development' : 'global',
        developmentId,
        branch: branch || user.branch || 'Harare'
      }
    );

    if (!compilationResult.success) {
      logger.warn('[DOCX] Template compilation failed', {
        module: 'API',
        action: 'POST_DOCX_TEMPLATE_UPLOAD',
        templateName: name,
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

    logger.info('[DOCX] Template variables extracted', {
      count: variables.length,
      variables: variables.map(v => v.name),
    });

    // Upload file to UploadThing
    let templateFileUrl = null;
    let templateFileKey = null;
    
    try {
      // Create FormData for UploadThing
      const uploadFormData = new FormData();
      uploadFormData.append('file', new Blob([fileBuffer]), file.name);
      
      // Upload to UploadThing
      const uploadResponse = await fetch('/api/uploadthing', {
        method: 'POST',
        body: uploadFormData,
      });
      
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        templateFileUrl = uploadResult.url;
        templateFileKey = uploadResult.key;
      } else {
        logger.warn('[DOCX] UploadThing upload failed, continuing without file URL');
      }
    } catch (uploadError: any) {
      logger.warn('[DOCX] UploadThing error:', uploadError.message);
    }

     // Create template record with compiled variables
     const compiledVariables = compilationResult.spec!.mergeTags.map(tag => ({
       name: tag.fullName,
       namespace: tag.namespace,
       field: tag.field,
       dataType: tag.dataType,
       required: tag.required
     }));

     // For development-specific templates, ensure only one active template exists per development
     let template;
     if (developmentId) {
       // Transaction to deactivate existing active template and create new one
       template = await prisma.$transaction(async (prismaTx) => {
         // Deactivate all existing active templates for this development
         await prismaTx.contractTemplate.updateMany({
           where: {
             developmentId: developmentId,
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
             name: name,
             description: description || null,
             type: 'DOCX_TEMPLATE',
             templateType: 'docx',
             templateFileUrl: templateFileUrl,
             templateFileKey: templateFileKey,
             templateVariables: compiledVariables as any,
             content: `[DOCX Template - Variables: ${compilationResult.spec!.mergeTags.map(v => v.fullName).join(', ')}]`,
             branch: branch || user.branch || 'Harare',
             developmentId: developmentId,
             isGlobal: false,
             status: 'ACTIVE',
             isActive: true,
           }
         });

         // Create initial version
         await prismaTx.contractTemplateVersion.create({
           data: {
             templateId: template.id,
             version: 1,
             content: template.content,
             htmlContent: null,
             variables: [],
             templateType: 'docx',
             templateFileUrl: templateFileUrl,
             templateFileKey: templateFileKey,
             templateVariables: compiledVariables as any,
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
           name: name,
           description: description || null,
           type: 'DOCX_TEMPLATE',
           templateType: 'docx',
           templateFileUrl: templateFileUrl,
           templateFileKey: templateFileKey,
           templateVariables: compiledVariables as any,
           content: `[DOCX Template - Variables: ${compilationResult.spec!.mergeTags.map(v => v.fullName).join(', ')}]`,
           branch: branch || user.branch || 'Harare',
           developmentId: null,
           isGlobal: true,
           status: 'ACTIVE',
           isActive: true,
         }
       });

       // Create initial version
       await prisma.contractTemplateVersion.create({
         data: {
           templateId: template.id,
           version: 1,
           content: template.content,
           htmlContent: null,
           variables: [],
           templateType: 'docx',
           templateFileUrl: templateFileUrl,
           templateFileKey: templateFileKey,
           templateVariables: compiledVariables as any,
           changedBy: user.email,
           changeNotes: 'Initial version'
         }
       });
     }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: branch || user.branch || 'Harare',
        userId: user.id || user.email,
        action: 'CREATE',
        module: 'CONTRACT_TEMPLATES',
        recordId: template.id,
        description: `Created DOCX contract template: ${name} with ${variables.length} variables`
      }
    });

    logger.info('[DOCX] Template created and compiled successfully', {
      templateId: template.id,
      name: name,
      variableCount: compilationResult.spec!.mergeTags.length,
      requiredFieldCount: compilationResult.spec!.requiredFields.length
    });

    return apiSuccess({
      ...template,
      _extractedVariables: compilationResult.spec!.mergeTags,
      _compilation: {
        specId: compilationResult.spec!.specId,
        compilerVersion: compilationResult.spec!.compilerVersion,
        compiledAt: compilationResult.spec!.compiledAt,
        requiredFields: compilationResult.spec!.requiredFields,
        optionalFields: compilationResult.spec!.optionalFields,
        warnings: compilationResult.spec!.warnings
      }
    }, 201);

  } catch (error: any) {
    logger.error('[DOCX] Upload failed', error as Error, {
      module: 'API',
      action: 'POST_DOCX_TEMPLATE_UPLOAD',
    });
    return apiError(error?.message || 'Failed to upload DOCX template', 500, ErrorCodes.CREATE_ERROR);
  }
}
