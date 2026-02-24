/**
 * POST /api/admin/contracts/templates/auto-build
 * 
 * Auto-Builder API for DOCX templates with blank detection and mapping.
 * 
 * Flow:
 * 1. POST with DOCX file → detect blanks
 * 2. Return detected blanks with context
 * 3. User maps blanks to ERP variables
 * 4. POST with mappings → apply and save template
 * 
 * @module app/api/admin/contracts/templates/auto-build
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { canManageTemplate, type ContractScopeUser } from '@/lib/contract-access-control';
import {
  detectBlanksInDocx,
  detectBlanksInDocxFromStream,
  generateBlankPreview,
  generateBlankPreviewFromStream,
  applyMappings,
  validateMappings,
  type VariableMapping,
  type BlankDetectionResult
} from '@/lib/docx-blank-detector';
import { parseDocxTemplate, parseDocxTemplateFromStream } from '@/lib/contract-template-parser';
import { compileTemplate } from '@/lib/contract-template-compiler';
import { Readable } from 'stream';

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Valid ERP namespaces for mapping suggestions
const VALID_MAPPINGS = {
  client: [
    { label: 'Client Full Name', value: 'client.fullName', type: 'text' },
    { label: 'Client First Name', value: 'client.firstName', type: 'text' },
    { label: 'Client Last Name', value: 'client.lastName', type: 'text' },
    { label: 'Client Email', value: 'client.email', type: 'email' },
    { label: 'Client Phone', value: 'client.phone', type: 'phone' },
    { label: 'Client National ID', value: 'client.nationalId', type: 'text' },
    { label: 'Client Address', value: 'client.address', type: 'text' },
  ],
  stand: [
    { label: 'Stand Number', value: 'stand.number', type: 'text' },
    { label: 'Stand Price', value: 'stand.price', type: 'currency' },
    { label: 'Stand Size (sqm)', value: 'stand.sizeSqm', type: 'number' },
    { label: 'Stand Status', value: 'stand.status', type: 'text' },
  ],
  development: [
    { label: 'Development Name', value: 'development.name', type: 'text' },
    { label: 'Development Location', value: 'development.location', type: 'text' },
    { label: 'Developer Name', value: 'development.developerName', type: 'text' },
    { label: 'Developer Email', value: 'development.developerEmail', type: 'email' },
    { label: 'Lawyer Name', value: 'development.lawyerName', type: 'text' },
    { label: 'Lawyer Email', value: 'development.lawyerEmail', type: 'email' },
  ],
  terms: [
    { label: 'Deposit Percentage', value: 'terms.depositPercentage', type: 'number' },
    { label: 'VAT Enabled', value: 'terms.vatEnabled', type: 'boolean' },
    { label: 'VAT Percentage', value: 'terms.vatPercentage', type: 'number' },
    { label: 'Installment Periods', value: 'terms.installmentPeriods', type: 'number' },
  ],
  pricing: [
    { label: 'Deposit Amount', value: 'pricing.depositAmount', type: 'currency' },
    { label: 'VAT Amount', value: 'pricing.vatAmount', type: 'currency' },
    { label: 'Grand Total', value: 'pricing.grandTotal', type: 'currency' },
    { label: 'Balance After Deposit', value: 'pricing.balanceAfterDeposit', type: 'currency' },
  ],
  contract: [
    { label: 'Contract Date', value: 'contract.date', type: 'date' },
    { label: 'Contract ID', value: 'contract.id', type: 'text' },
  ],
  bank: [
    { label: 'Bank Name', value: 'bank.name', type: 'text' },
    { label: 'Account Number', value: 'bank.accountNumber', type: 'text' },
    { label: 'Branch Code', value: 'bank.branchCode', type: 'text' },
  ],
  seller: [
    { label: 'Seller Name', value: 'seller.name', type: 'text' },
    { label: 'Seller Email', value: 'seller.email', type: 'email' },
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all valid mapping options for UI dropdown
 */
function getMappingOptions() {
  return Object.entries(VALID_MAPPINGS).map(([category, options]) => ({
    category,
    options
  }));
}

/**
 * Format blanks for response
 */
function formatBlanksForResponse(blanks: BlankDetectionResult['blanks']) {
  const mappingOptions = getMappingOptions();
  return blanks.map(blank => ({
    placeholder: blank.placeholder,
    contextBefore: blank.contextBefore,
    contextAfter: blank.contextAfter,
    blankType: blank.blankType,
    suggestedMappings: mappingOptions.filter(group =>
      ['client', 'stand', 'development'].includes(group.category)
    ).map(group => ({
      category: group.category,
      options: group.options.slice(0, 3)
    })),
  }));
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse request
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mappingsJson = formData.get('mappings') as string | null;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const developmentId = formData.get('developmentId') as string | null;
    const isGlobal = formData.get('isGlobal') === 'true';

    // Validate file
    if (!file) {
      return apiError('No file provided', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return apiError('Only DOCX files are supported', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Process file with streaming
    const stream = new Readable();
    const arrayBuffer = await file.arrayBuffer();
    stream.push(Buffer.from(arrayBuffer));
    stream.push(null); // End of stream

    // If mappings provided, apply them and save template
    if (mappingsJson) {
      // Convert stream to buffer for applyMappings (since it needs random access)
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      return await handleSaveWithMappings(
        buffer,
        mappingsJson,
        name,
        description,
        developmentId,
        isGlobal,
        user
      );
    }

    // Otherwise, just preview blanks with streaming
    return await handlePreviewFromStream(stream, user);

  } catch (error: any) {
    logger.error('[AutoBuild] Error', error, { module: 'API', action: 'AUTO_BUILD_TEMPLATE' });
    return apiError('Failed to process template', 500, ErrorCodes.INTERNAL_ERROR, {
      details: error.message
    });
  }
}

// ============================================================================
// Preview Handler
// ============================================================================

async function handlePreview(
  buffer: Buffer,
  user: any
): Promise<NextResponse> {
  // Detect blanks
  const previewResult = await generateBlankPreview(buffer);

  logger.info('[AutoBuild] Preview generated', {
    userId: user.id,
    blankCount: previewResult.count,
    hasBlanks: previewResult.hasBlanks
  });

  // Get available mappings
  const mappingOptions = getMappingOptions();

  return apiSuccess({
    hasBlanks: previewResult.hasBlanks,
    count: previewResult.count,
    blanks: formatBlanksForResponse(previewResult.blanks),
    mappingOptions,
    message: previewResult.hasBlanks
      ? `Found ${previewResult.count} blank field(s) to map`
      : 'No blank fields detected. Upload a DOCX with underscores, dots, or dashes for blanks.'
  });
}

async function handlePreviewFromStream(
  stream: Readable,
  user: any
): Promise<NextResponse> {
  // Detect blanks with streaming
  const previewResult = await generateBlankPreviewFromStream(stream);

  logger.info('[AutoBuild] Preview generated', {
    userId: user.id,
    blankCount: previewResult.count,
    hasBlanks: previewResult.hasBlanks
  });

  // Get available mappings
  const mappingOptions = getMappingOptions();

  return apiSuccess({
    hasBlanks: previewResult.hasBlanks,
    count: previewResult.count,
    blanks: formatBlanksForResponse(previewResult.blanks),
    mappingOptions,
    message: previewResult.hasBlanks
      ? `Found ${previewResult.count} blank field(s) to map`
      : 'No blank fields detected. Upload a DOCX with underscores, dots, or dashes for blanks.'
  });
}

// ============================================================================
// Save Handler
// ============================================================================

async function handleSaveWithMappings(
  buffer: Buffer,
  mappingsJson: string,
  name: string | null,
  description: string | null,
  developmentId: string | null,
  isGlobal: boolean,
  user: any
): Promise<NextResponse> {
  // Parse mappings
  let mappings: VariableMapping;
  try {
    mappings = JSON.parse(mappingsJson);
  } catch {
    return apiError('Invalid mappings format', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Validate mappings
  const validation = validateMappings(mappings);
  if (!validation.valid) {
    logger.warn('[AutoBuild] Mapping validation failed', {
      errors: validation.errors,
      placeholderCount: Object.keys(mappings).length
    });
    return apiError('Invalid mappings provided', 400, ErrorCodes.VALIDATION_ERROR, {
      details: validation.errors.join(', ')
    });
  }

  // Validate name
  if (!name || !name.trim()) {
    return apiError('Template name is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check permissions
  const scopedUser: ContractScopeUser = {
    id: user.id || user.email,
    email: user.email,
    role: (user.role?.toUpperCase() || 'ADMIN') as any,
    branch: user.branch
  };

  const permissionCheck = await canManageTemplate(scopedUser, developmentId || undefined);
  if (!permissionCheck.allowed) {
    return apiError(`Permission denied: ${permissionCheck.reason}`, 403, ErrorCodes.AUTH_REQUIRED);
  }

  // Apply mappings to DOCX
  const applyResult = applyMappings(buffer, mappings);
  if (!applyResult.success) {
    return apiError(`Failed to apply mappings: ${applyResult.error}`, 500, ErrorCodes.INTERNAL_ERROR);
  }

  // Parse the transformed DOCX
  const parsedTemplate = await parseDocxTemplate(applyResult.transformedBuffer!, {
    maxFileSize: MAX_FILE_SIZE,
    sanitizeHtml: true
  });

  // Compile template
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

  if (!compilationResult.success) {
    const errors = compilationResult.errors.map(e => e.message).join('\n');
    return apiError(`Template compilation failed:\n${errors}`, 400, ErrorCodes.VALIDATION_ERROR);
  }

  const compiledSpec = compilationResult.spec!;

  // Extract variable info
  const uniqueVariables = compiledSpec.mergeTags.map(tag => ({
    name: tag.fullName,
    dataType: tag.dataType,
    required: tag.required,
    defaultValue: tag.defaultValue
  }));

  // Check for duplicate name
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

  // Create template record
  const template = await prisma.contractTemplate.create({
    data: {
      name: name.trim(),
      description: description || null,
      content: parsedTemplate.textContent,
      htmlContent: parsedTemplate.htmlContent,
      templateVariables: uniqueVariables as any,
      variables: uniqueVariables as any,
      templateType: 'docx',
      branch: user.branch || 'Harare',
      status: 'ACTIVE',
      isActive: true,
      developmentId: developmentId || null,
      isGlobal: !developmentId && isGlobal
    }
  });

  logger.info('[AutoBuild] Template created', {
    templateId: template.id,
    userId: user.id,
    blankCount: Object.keys(mappings).length
  });

  return apiSuccess({
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      templateVariables: uniqueVariables,
      branch: template.branch,
      status: template.status,
      isGlobal: template.isGlobal,
      developmentId: template.developmentId,
      createdAt: template.createdAt
    },
    mappingsApplied: Object.keys(mappings).length
  }, 201);
}

// ============================================================================
// GET Handler - Return mapping options
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    // Return available mapping options
    return apiSuccess({
      namespaces: Object.keys(VALID_MAPPINGS),
      mappings: VALID_MAPPINGS
    });
  } catch (error: any) {
    return apiError('Failed to get mapping options', 500, ErrorCodes.FETCH_ERROR);
  }
}

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
    responseLimit: '20mb', // Increase response limit for large files
  },
};
