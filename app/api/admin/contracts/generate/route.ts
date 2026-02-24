/**
 * POST /api/admin/contracts/generate
 * Generate a contract from template using standId
 * 
 * REDESIGNED ARCHITECTURE (v2.0):
 * - Templates are compiled at upload time into CompiledTemplateSpec
 * - Contract generation uses compiled specs, NOT raw templates
 * - NO runtime validation - specs are proven valid at compile time
 * - Fail-fast: invalid templates never reach this endpoint
 * 
 * Features:
 * - Automatically fetches Stand → Development → Client data
 * - Uses compiled template spec for generation (no validation needed)
 * - Calculates pricing (VAT, deposit, fees) from Development Wizard settings
 * - Creates GeneratedContract with snapshot for versioning
 * - Supports preview mode (dry run without saving)
 * 
 * RBAC:
 * - ADMIN: Can generate contracts for any stand/development
 * - MANAGER: Can generate for their branch's developments
 * - AGENT: Can generate for stands they have access to
 * 
 * Request Body:
 * - standId: string (required) - The stand to generate contract for
 * - templateId: string (optional) - Specific template to use (auto-selects if not provided)
 * - preview: boolean (optional) - If true, returns preview without saving
 * 
 * @module app/api/admin/contracts/generate
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import {
  type ContractScopeUser
} from '@/lib/contract-access-control';
import {
  resolveContractData,
  type ResolvedContractData
} from '@/lib/contract-data-resolver';
import {
  recompileFromRaw,
  validateContractData,
  generateFromSpec,
  type CompiledTemplateSpec
} from '@/lib/contract-template-compiler';
import {
  generateDocxFromTemplate
} from '@/lib/docx-template-engine';

// ============================================================================
// Types
// ============================================================================

interface GenerateRequest {
  standId: string;
  templateId?: string;
  preview?: boolean;
  variables?: Record<string, string>;
}

// Raw template from database (before compilation)
type RawTemplateFromDB = {
  id: string;
  name: string;
  content: string;
  htmlContent?: string | null;
  status: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  variables: unknown; // Json field
  templateType?: string;
  templateFileUrl?: string | null;
  templateFileKey?: string | null;
  templateVariables?: unknown; // Json field
  isGlobal: boolean;
  isActive?: boolean;
  developmentId?: string | null;
  development?: { id: string; name: string } | null;
  // New field for compiled spec (stored as Json)
  compiledSpec?: CompiledTemplateSpec | null;
};

interface GenerateResponse {
  contract?: {
    id: string;
    status: string;
    content: string;
    htmlContent?: string;
    createdAt: Date;
  };
  preview?: {
    content: string;
    htmlContent: string;
    data: ResolvedContractData;
    mergeTags: string[];
  };
  template: {
    id: string;
    name: string;
    isGlobal: boolean;
    developmentId?: string;
  };
  stand: {
    id: string;
    number: string;
    developmentName: string;
  };
  client: {
    id: string;
    name: string;
    email: string;
  };
}

function applyVariableOverrides(
  resolved: ResolvedContractData,
  overrides?: Record<string, string>
): ResolvedContractData {
  if (!overrides || Object.keys(overrides).length === 0) {
    return resolved;
  }

  const merged = structuredClone(resolved);

  for (const [path, rawValue] of Object.entries(overrides)) {
    if (rawValue === undefined || rawValue === null) continue;
    if (!path.includes('.')) continue;

    const [namespace, field] = path.split('.', 2);
    if (!namespace || !field) continue;

    const namespaceRecord = (merged as Record<string, any>)[namespace];
    if (namespaceRecord && typeof namespaceRecord === 'object') {
      namespaceRecord[field] = String(rawValue);
    }
  }

  return merged;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse request body
    const body: GenerateRequest = await req.json();
    const { standId, templateId, preview = false, variables = {} } = body;

    // Validate required fields
    if (!standId) {
      return apiError(
        'Missing required field: standId',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch
    };

    // Fetch stand with relations for access check
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            branch: true
          }
        },
        reservations: {
          where: {
            status: {
              in: ['CONFIRMED', 'PENDING']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check branch access for non-admin users
    if (scopedUser.role !== 'ADMIN' && stand.development.branch !== scopedUser.branch) {
      return apiError(
        'You do not have access to this development',
        403,
        ErrorCodes.ACCESS_DENIED
      );
    }

    // Get client from reservation
    const client = stand.reservations[0]?.client;
    if (!client) {
      return apiError(
        'No client found for this stand. A reservation is required.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Resolve contract data (Stand → Development → Client + Pricing)
    let contractData: ResolvedContractData;
    try {
      contractData = await resolveContractData(standId, {
        includePricing: true,
        currencyFormat: 'USD',
        dateFormat: 'long'
      });
    } catch (error) {
      logger.error('Failed to resolve contract data', error as Error, {
        module: 'API',
        action: 'GENERATE_CONTRACT',
        standId
      });
      return apiError(
        `Failed to resolve contract data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        ErrorCodes.INTERNAL_ERROR
      );
    }

    const resolvedContractData = applyVariableOverrides(contractData, variables);

    // Find or select template
    let template;
    if (templateId) {
      // Use specified template
      template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        include: {
          development: {
            select: { id: true, name: true }
          }
        }
      }) as RawTemplateFromDB | null;

      if (!template) {
        return apiError('Template not found', 404, ErrorCodes.NOT_FOUND);
      }

      // Check template access for development-specific templates
      if (template.developmentId && template.developmentId !== stand.development.id) {
        logger.warn('Template-development mismatch', {
          module: 'API',
          action: 'GENERATE_CONTRACT',
          templateId,
          templateDevelopmentId: template.developmentId,
          standDevelopmentId: stand.development.id,
          userId: user.id
        });
        return apiError(
          'This template is not available for this development. Template is specific to a different development.',
          403,
          ErrorCodes.ACCESS_DENIED
        );
      }

      // RBAC: Check branch access for non-admin users when using development-specific templates
      if (template.developmentId && scopedUser.role !== 'ADMIN') {
        const templateDevelopment = await prisma.development.findUnique({
          where: { id: template.developmentId },
          select: { branch: true }
        });
        if (templateDevelopment && templateDevelopment.branch !== scopedUser.branch) {
          logger.warn('Branch access denied for template', {
            module: 'API',
            action: 'GENERATE_CONTRACT',
            templateId,
            templateBranch: templateDevelopment.branch,
            userBranch: scopedUser.branch,
            userId: user.id
          });
          return apiError(
            'You do not have access to templates from this development',
            403,
            ErrorCodes.ACCESS_DENIED
          );
        }
      }
    } else {
      // Auto-select template: prefer development-specific, fallback to global
      // First try: development-specific template
      template = await prisma.contractTemplate.findFirst({
        where: {
          status: 'ACTIVE',
          developmentId: stand.development.id
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        include: {
          development: {
            select: { id: true, name: true }
          }
        }
      }) as RawTemplateFromDB | null;

      // Fallback: global template
      if (!template) {
        template = await prisma.contractTemplate.findFirst({
          where: {
            status: 'ACTIVE',
            isGlobal: true
          },
          orderBy: [
            { createdAt: 'desc' }
          ]
        }) as RawTemplateFromDB | null;
      }

      if (!template) {
        return apiError(
          'No active template found for this development. Please upload a template first.',
          404,
          ErrorCodes.NOT_FOUND
        );
      }

      logger.info('Template auto-selected', {
        module: 'API',
        action: 'GENERATE_CONTRACT',
        templateId: template.id,
        templateName: template.name,
        isDevelopmentSpecific: !!template.developmentId,
        isGlobal: template.isGlobal
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // COMPILE TEMPLATE TO SPEC (or use cached spec if available)
    // This is the key architectural change - we compile templates, not validate
    // ═══════════════════════════════════════════════════════════════════════
    
    let compiledSpec: CompiledTemplateSpec;
    
    // Check if template has a pre-compiled spec (future: stored in DB)
    if ((template as any).compiledSpec) {
      compiledSpec = (template as any).compiledSpec as CompiledTemplateSpec;
      logger.debug('Using cached compiled spec', {
        module: 'API',
        action: 'GENERATE_CONTRACT',
        specId: compiledSpec.specId,
        templateId: template.id
      });
    } else {
      // Compile template on-the-fly (backward compatibility)
      const compilationResult = recompileFromRaw({
        name: template.name,
        description: template.description,
        content: template.content,
        htmlContent: template.htmlContent,
        isGlobal: template.isGlobal ?? false,
        developmentId: template.developmentId,
        branch: template.branch,
        variables: template.variables
      });
      
      if (!compilationResult.success) {
        // Template failed compilation - this should not happen for valid templates
        // But provides fail-fast behavior for legacy/corrupted templates
        logger.error('Template compilation failed at generation time', undefined, {
          module: 'API',
          action: 'GENERATE_CONTRACT',
          templateId: template.id,
          errors: compilationResult.errors.map(e => e.message)
        });
        return apiError(
          `Template "${template.name}" is invalid and cannot be used for contract generation. ` +
          `Errors: ${compilationResult.errors.map(e => e.message).join('; ')}. ` +
          `Please re-upload the template or contact support.`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      
      compiledSpec = compilationResult.spec!;
      logger.info('Template compiled successfully', {
        module: 'API',
        action: 'GENERATE_CONTRACT',
        specId: compiledSpec.specId,
        templateId: template.id,
        mergeTagCount: compiledSpec.mergeTags.length
      });
    }
    
    // Validate contract data satisfies the compiled spec
    const missingFields = validateContractData(compiledSpec, resolvedContractData as any);
    if (missingFields) {
      logger.warn('Contract generation failed: missing required data', {
        module: 'API',
        action: 'GENERATE_CONTRACT',
        templateId: template.id,
        specId: compiledSpec.specId,
        missingFields
      });
      return apiError(
        `Contract generation failed: Missing required data fields: ${missingFields.join(', ')}. ` +
        `Please ensure all required data is available for this stand.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GENERATE CONTRACT FROM COMPILED SPEC
    // This is simple substitution - NO validation needed, spec is proven valid
    // ═══════════════════════════════════════════════════════════════════════
    
    let textContent: string;
    let htmlContent: string;
    let docxBuffer: Buffer | null = null;
    
    if (template.templateType === 'docx' && template.templateFileUrl) {
      // DOCX template processing
      logger.info('Generating DOCX contract', {
        module: 'API',
        action: 'GENERATE_DOCX_CONTRACT',
        templateId: template.id,
        templateName: template.name
      });
      
      // Download DOCX template
      const templateResponse = await fetch(template.templateFileUrl);
      if (!templateResponse.ok) {
        throw new Error(`Failed to download template: ${templateResponse.status}`);
      }
      
      const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
      
      // Generate DOCX with variables substituted
      docxBuffer = generateDocxFromTemplate(templateBuffer, resolvedContractData as any);
      
      // For storage and preview, we'll use placeholders
      textContent = `[DOCX Contract: ${template.name}]`;
      htmlContent = `<p>[DOCX Contract: ${template.name}]</p>`;
    } else {
      // HTML template processing
      const result = generateFromSpec(compiledSpec, resolvedContractData as any);
      textContent = result.content;
      htmlContent = result.htmlContent;
    }
    
    const mergeTagList = compiledSpec.mergeTags.map(tag => `{{${tag.fullName}}}`);

    // If preview mode, return without saving
    if (preview) {
      logger.info('Contract preview generated', {
        module: 'API',
        action: 'GENERATE_CONTRACT_PREVIEW',
        standId,
        templateId: template.id,
        specId: compiledSpec.specId,
        userId: user.id
      });

      const previewData: any = {
        content: textContent,
        htmlContent,
        data: resolvedContractData,
        mergeTags: mergeTagList
      };

      // If DOCX, include the base64 encoded buffer for preview/download
      if (docxBuffer) {
        previewData.docxBase64 = docxBuffer.toString('base64');
      }

      return apiSuccess({
        preview: previewData,
        _context: {
          template: {
            id: template.id,
            name: template.name,
            isGlobal: template.isGlobal ?? false,
            developmentId: template.developmentId || undefined,
            specId: compiledSpec.specId
          },
          stand: {
            id: stand.id,
            number: stand.standNumber,
            developmentName: stand.development.name
          },
          client: {
            id: client.id,
            name: client.name,
            email: client.email
          }
        }
      });
    }

    // Get current template version
    const latestVersion = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { version: 'desc' }
    });

    // Create comprehensive template snapshot for versioning
    const templateSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      htmlContent: template.htmlContent,
      compiledSpec: compiledSpec,
      version: latestVersion?.version || 1,
      templateType: template.templateType,
      templateFileUrl: template.templateFileUrl,
      templateFileKey: template.templateFileKey,
      templateVariables: template.templateVariables,
      isGlobal: template.isGlobal,
      developmentId: template.developmentId,
      branch: template.branch,
      status: template.status,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      snapshottedAt: new Date().toISOString(),
      versionNotes: latestVersion?.changeNotes
    };

    // Create contract record
    const contractDataToSave: any = {
      clientId: client.id,
      templateId: template.id,
      standId: stand.id,
      templateName: template.name,
      content: textContent,
      status: 'DRAFT',
      branch: stand.development.branch || user.branch || 'Harare',
      templateSnapshot: templateSnapshot as unknown as Record<string, unknown>,
      contractData: resolvedContractData as unknown as Record<string, unknown>
    };

    const contract = await prisma.generatedContract.create({
      data: contractDataToSave
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: stand.development.branch || user.branch || 'Harare',
        userId: user.id || user.email,
        action: 'CREATE',
        module: 'CONTRACTS',
        recordId: contract.id,
        description: `Generated contract from template: ${template.name} for client: ${client.name}`,
        changes: JSON.stringify({
          templateId: template.id,
          clientId: client.id,
          standId: stand.id,
          contractId: contract.id
        })
      }
    });

    logger.info('Contract generated successfully', {
      module: 'API',
      action: 'GENERATE_CONTRACT',
      contractId: contract.id,
      templateId: template.id,
      specId: compiledSpec.specId,
      standId,
      clientId: client.id,
      userId: user.id
    });

    // Return success response
    const responseData: any = {
      id: contract.id,
      status: contract.status,
      content: contract.content,
      htmlContent: (contract as any).htmlContent || undefined,
      createdAt: contract.createdAt,
      _context: {
        template: {
          id: template.id,
          name: template.name,
          isGlobal: template.isGlobal ?? false,
          developmentId: template.developmentId || undefined,
          specId: compiledSpec.specId
        },
        stand: {
          id: stand.id,
          number: stand.standNumber,
          developmentName: stand.development.name
        },
        client: {
          id: client.id,
          name: client.name,
          email: client.email
        }
      }
    };

    // If DOCX, include the base64 encoded content for download
    if (docxBuffer) {
      responseData.docxBase64 = docxBuffer.toString('base64');
    }

    return apiSuccess(responseData, 201);

  } catch (error: any) {
    logger.error('Contract generation error', error, {
      module: 'API',
      action: 'GENERATE_CONTRACT'
    });
    return apiError(
      'Failed to generate contract',
      500,
      ErrorCodes.CREATE_ERROR,
      { details: error.message }
    );
  }
}

// ============================================================================
// GET Handler - Preview endpoint
// ============================================================================

/**
 * GET /api/admin/contracts/generate?standId=xxx&templateId=xxx
 * Preview contract generation without saving
 */
export async function GET(req: NextRequest) {
  // Reuse POST logic with preview=true
  const { searchParams } = new URL(req.url);
  const standId = searchParams.get('standId');
  const templateId = searchParams.get('templateId') || undefined;

  if (!standId) {
    return apiError(
      'Missing required query parameter: standId',
      400,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Create a mock request with preview=true
  const mockBody: GenerateRequest = {
    standId,
    templateId,
    preview: true
  };

  // Call POST handler
  const mockReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(mockBody)
  }) as unknown as NextRequest;

  return POST(mockReq);
}
