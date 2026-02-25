/**
 * POST /api/admin/contracts/templates/upload
 * Upload and parse DOCX contract template
 * 
 * REDESIGNED ARCHITECTURE (v2.0):
 * - Templates are COMPILED at upload time, not just parsed
 * - Compilation validates all merge tags against the schema
 * - Invalid templates are rejected BEFORE they reach the database
 * - CompiledTemplateSpec is stored for fast generation
 * 
 * Features:
 * - Accepts DOCX file upload
 * - Parses to HTML using mammoth
 * - COMPILES template to CompiledTemplateSpec
 * - Validates ALL merge tags against schema
 * - Creates ContractTemplate record with compiled spec
 * - Supports development-specific or global templates
 * 
 * RBAC:
 * - ADMIN: Can upload global or any development-specific template
 * - MANAGER: Can upload templates for their branch's developments
 * - AGENT: Cannot upload templates
 * 
 * @module app/api/admin/contracts/templates/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
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
import {
  parseDocxTemplate,
  parseDocxTemplateFromStream,
  extractMergeTags,
  validateMergeTags,
  type MergeTag
} from '@/lib/contract-template-parser';
import {
  compileTemplate,
  type CompiledTemplateSpec,
  type CompilationError
} from '@/lib/contract-template-compiler';

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size: 20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream' // Some systems send this for .docx
];

/** Allowed file extensions */
const ALLOWED_EXTENSIONS = ['.docx'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer data type from field name
 */
function inferDataType(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  
  if (lower.includes('date') || lower.includes('timestamp')) return 'date';
  if (lower.includes('email')) return 'email';
  if (lower.includes('phone') || lower.includes('tel')) return 'tel';
  if (lower.includes('price') || lower.includes('amount') || lower.includes('fee') || 
      lower.includes('percentage') || lower.includes('total')) return 'number';
  
  return 'text';
}

function sortTemplateVariables(variables: any[]): any[] {
  return [...variables].sort((a, b) => {
    const nameA = String(a?.name || a?.fullName || '').toLowerCase();
    const nameB = String(b?.name || b?.fullName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * POST handler for DOCX template upload
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const developmentId = formData.get('developmentId') as string | null;
    const isGlobal = formData.get('isGlobal') === 'true';

    // Validate file presence
    if (!file) {
      return apiError(
        'No file provided. Please upload a DOCX file.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        `Invalid file type: ${file.type}. Only DOCX files are supported.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
      fileName.endsWith(ext)
    );
    if (!hasValidExtension) {
      return apiError(
        `Invalid file extension. Only ${ALLOWED_EXTENSIONS.join(', ')} files are supported.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      return apiError(
        'Template name is required.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Build scoped user for permission check
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Check if user can manage this type of template
    const permissionCheck = await canManageTemplate(scopedUser, developmentId || undefined);
    if (!permissionCheck.allowed) {
      logger.warn('Template upload permission denied', {
        module: 'API',
        action: 'UPLOAD_CONTRACT_TEMPLATE',
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

      // Check branch access for non-admin users
      if (scopedUser.role !== 'ADMIN' && development.branch !== scopedUser.branch) {
        return apiError(
          'You do not have access to this development',
          403,
          ErrorCodes.AUTH_REQUIRED
        );
      }
    }

    // Process file with streaming
    logger.info('Parsing DOCX template', {
      module: 'API',
      action: 'UPLOAD_CONTRACT_TEMPLATE',
      fileName: file.name,
      fileSize: file.size
    });

    let parsedTemplate;
    try {
      // Create readable stream from File
      const stream = new Readable();
      const arrayBuffer = await file.arrayBuffer();
      stream.push(Buffer.from(arrayBuffer));
      stream.push(null); // End of stream

      parsedTemplate = await parseDocxTemplateFromStream(stream, {
        maxFileSize: MAX_FILE_SIZE,
        sanitizeHtml: true
      });
    } catch (parseError) {
      logger.error('DOCX parsing failed', parseError as Error, {
        module: 'API',
        action: 'UPLOAD_CONTRACT_TEMPLATE',
        fileName: file.name
      });
      return apiError(
        `Failed to parse DOCX file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate merge tags
    const validation = validateMergeTags(parsedTemplate.htmlContent);
    if (!validation.valid) {
      logger.warn('Invalid merge tags found in template', {
        module: 'API',
        action: 'UPLOAD_CONTRACT_TEMPLATE',
        invalidTags: validation.invalidTags
      });
      return apiError(
        `Invalid merge tags found: ${validation.invalidTags.join(', ')}. Allowed namespaces: client, stand, development, terms, pricing, contract`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate merge tag format (must be namespace.field)
    const invalidFormatTags = validation.validTags.filter(tag => {
      const tagName = tag.fullTag.replace(/[{}]/g, '');
      return !tagName.includes('.') || tagName.split('.').length !== 2;
    });

    if (invalidFormatTags.length > 0) {
      logger.warn('Merge tags with invalid format found', {
        module: 'API',
        action: 'UPLOAD_CONTRACT_TEMPLATE',
        invalidFormatTags: invalidFormatTags.map(t => t.fullTag)
      });
      return apiError(
        `Invalid merge tag format: ${invalidFormatTags.map(t => t.fullTag).join(', ')}. Tags must be in format {{namespace.field}}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // COMPILE TEMPLATE - This is the key architectural change
    // Templates are compiled BEFORE storage, ensuring only valid templates exist
    // ═══════════════════════════════════════════════════════════════════════
    
    const compilationResult = compileTemplate(
      parsedTemplate.htmlContent,
      parsedTemplate.textContent,
      {
        name: name.trim(),
        description: description || null,
        scope: (!developmentId && isGlobal) ? 'global' : 'development',
        developmentId: developmentId || null,
        branch: user.branch || 'Harare'
      }
    );
    
    // FAIL-FAST: If compilation fails, reject the template immediately
    if (!compilationResult.success) {
      const errorMessages = compilationResult.errors.map(e => 
        `${e.code}: ${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`
      );
      
      logger.warn('Template compilation failed', {
        module: 'API',
        action: 'UPLOAD_CONTRACT_TEMPLATE',
        fileName: file.name,
        errorCount: compilationResult.errors.length,
        errors: errorMessages
      });
      
      return apiError(
        `Template compilation failed. The template cannot be used for contract generation.\n\n` +
        `Errors:\n${errorMessages.join('\n')}\n\n` +
        `Please fix these issues and re-upload the template.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }
    
    const compiledSpec = compilationResult.spec!;
    
    logger.info('Template compiled successfully', {
      module: 'API',
      action: 'UPLOAD_CONTRACT_TEMPLATE',
      specId: compiledSpec.specId,
      mergeTagCount: compiledSpec.mergeTags.length,
      requiredFields: compiledSpec.requiredFields.length,
      warnings: compiledSpec.warnings
    });

    // Extract variable info from compiled spec (for backward compatibility)
    const uniqueVariables = sortTemplateVariables(compiledSpec.mergeTags.map(tag => ({
      name: tag.fullName,
      dataType: tag.dataType,
      required: tag.required,
      defaultValue: tag.defaultValue
    })));

    // Check for duplicate template name in same scope
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        name: name.trim(),
        OR: [
          { isGlobal: true },
          { developmentId: developmentId || null }
        ]
      }
    });

    if (existingTemplate) {
      return apiError(
        `A template with name "${name}" already exists in this scope.`,
        409,
        ErrorCodes.CONFLICT
      );
    }

    // Create template record with compiled spec
    const template = await prisma.contractTemplate.create({
      data: {
        name: name.trim(),
        description: description || null,
        content: parsedTemplate.textContent, // Plain text version
        htmlContent: parsedTemplate.htmlContent, // HTML version
        variables: uniqueVariables as any,
        templateVariables: uniqueVariables as any,
        branch: user.branch || 'Harare',
        status: 'ACTIVE',
        isActive: true,
        developmentId: developmentId || null,
        isGlobal: !developmentId && isGlobal
      },
      include: {
        development: {
          select: { id: true, name: true, location: true }
        },
        _count: {
          select: { generatedContracts: true }
        }
      }
    });

    logger.info('Template uploaded and compiled successfully', {
      module: 'API',
      action: 'UPLOAD_CONTRACT_TEMPLATE',
      templateId: template.id,
      specId: compiledSpec.specId,
      userId: user.id,
      developmentId,
      isGlobal: template.isGlobal,
      mergeTagCount: compiledSpec.mergeTags.length,
      requiredFields: compiledSpec.requiredFields.length
    });

    // Return success response with compilation info
    return apiSuccess({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        templateVariables: uniqueVariables,
        mergeTags: compiledSpec.mergeTags.map(tag => ({
          tag: `{{${tag.fullName}}}`,
          namespace: tag.namespace,
          field: tag.field,
          dataType: tag.dataType,
          required: tag.required
        })),
        branch: template.branch,
        status: template.status,
        isActive: template.isActive,
        isGlobal: template.isGlobal,
        developmentId: template.developmentId,
        development: template.development || null,
        usageCount: template._count?.generatedContracts || 0,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      },
      // Compilation info for transparency
      compilation: {
        specId: compiledSpec.specId,
        compilerVersion: compiledSpec.compilerVersion,
        compiledAt: compiledSpec.compiledAt,
        requiredFields: compiledSpec.requiredFields,
        optionalFields: compiledSpec.optionalFields,
        warnings: compiledSpec.warnings
      },
      parsed: {
        wordCount: parsedTemplate.metadata.wordCount,
        hasMergeTags: compiledSpec.mergeTags.length > 0,
        mergeTagCount: compiledSpec.mergeTags.length
      }
    }, 201);

  } catch (error: any) {
    logger.error('Template upload error', error, {
      module: 'API',
      action: 'UPLOAD_CONTRACT_TEMPLATE'
    });
    return apiError(
      'Failed to upload template',
      500,
      ErrorCodes.CREATE_ERROR,
      { details: error.message }
    );
  }
}

// ============================================================================
// Config
// ============================================================================

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
    responseLimit: '20mb', // Increase response limit for large files
  },
};
