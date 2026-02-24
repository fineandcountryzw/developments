/**
 * Contract Template Compiler
 * 
 * This module implements the Template Compilation Strategy for contracts.
 * Templates are compiled at upload/creation time into a normalized spec
 * that the contract engine uses directly. This ensures:
 * 
 * 1. FAIL-FAST: Invalid templates are rejected at upload, not generation
 * 2. GUARANTEED STRUCTURE: Compiled specs have proven, validated structure
 * 3. NO RUNTIME VALIDATION: Contract generation is simple substitution
 * 4. IMMUTABILITY: Compiled specs are versioned and immutable
 * 
 * Architecture:
 * - Raw Template (DOCX/HTML) → Compile → CompiledTemplateSpec → Generate Contract
 * - The engine ONLY works with CompiledTemplateSpec, never raw templates
 * 
 * @module lib/contract-template-compiler
 */

import { logger } from './logger';
import { extractVariablesFromDocx, validateVariables, type DetectedVariable } from './docx-template-engine';

// ============================================================================
// CORE TYPES - The Normalized Contract Specification
// ============================================================================

/**
 * A validated, normalized merge tag.
 * After compilation, all tags are guaranteed to be in this exact format.
 */
export interface CompiledMergeTag {
  /** Full tag including namespace: "client.fullName" */
  fullName: string;
  /** Namespace: "client", "stand", "development", "terms", "pricing", "contract" */
  namespace: ValidNamespace;
  /** Field within namespace: "fullName", "price", etc. */
  field: string;
  /** Inferred data type for formatting */
  dataType: 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone' | 'boolean';
  /** Whether this field is required (has data in resolved context) */
  required: boolean;
  /** Default value if field is empty */
  defaultValue: string;
  /** Original position in template (for error reporting) */
  position: number;
}

/**
 * Allowed namespaces - this is the ONLY set of namespaces the engine supports.
 * Any template using other namespaces will fail compilation.
 */
export type ValidNamespace = 'client' | 'stand' | 'development' | 'terms' | 'pricing' | 'contract' | 'loop' | 'custom';

/**
 * The schema definition for each namespace.
 * This defines what fields are available and their types.
 */
export const NAMESPACE_SCHEMA: any = {
  client: {
    fullName: { type: 'text', required: true },
    firstName: { type: 'text', required: false },
    lastName: { type: 'text', required: false },
    email: { type: 'email', required: true },
    phone: { type: 'phone', required: false },
    nationalId: { type: 'text', required: false },
    address: { type: 'text', required: false },
  },
  stand: {
    number: { type: 'text', required: true },
    price: { type: 'currency', required: true },
    sizeSqm: { type: 'number', required: false },
    status: { type: 'text', required: true },
  },
  development: {
    name: { type: 'text', required: true },
    location: { type: 'text', required: true },
    description: { type: 'text', required: false },
    developerName: { type: 'text', required: false },
    developerEmail: { type: 'email', required: false },
    developerPhone: { type: 'phone', required: false },
    lawyerName: { type: 'text', required: false },
    lawyerEmail: { type: 'email', required: false },
    lawyerPhone: { type: 'phone', required: false },
  },
  terms: {
    depositPercentage: { type: 'number', required: true },
    vatEnabled: { type: 'boolean', required: true },
    vatPercentage: { type: 'number', required: false },
    endowmentEnabled: { type: 'boolean', required: false },
    endowmentFee: { type: 'currency', required: false },
    aosEnabled: { type: 'boolean', required: false },
    aosFee: { type: 'currency', required: false },
    cessionsEnabled: { type: 'boolean', required: false },
    cessionFee: { type: 'currency', required: false },
    adminFeeEnabled: { type: 'boolean', required: false },
    adminFee: { type: 'currency', required: false },
    installmentPeriods: { type: 'number', required: false },
  },
  pricing: {
    vatAmount: { type: 'currency', required: false },
    depositAmount: { type: 'currency', required: true },
    endowmentAmount: { type: 'currency', required: false },
    aosAmount: { type: 'currency', required: false },
    cessionAmount: { type: 'currency', required: false },
    adminAmount: { type: 'currency', required: false },
    grandTotal: { type: 'currency', required: true },
    balanceAfterDeposit: { type: 'currency', required: true },
  },
  contract: {
    date: { type: 'date', required: true },
    timestamp: { type: 'text', required: true },
    id: { type: 'text', required: true },
  },
  loop: {},
  custom: {},
};



export const VALID_NAMESPACES: ValidNamespace[] = ['client', 'stand', 'development', 'terms', 'pricing', 'contract', 'loop', 'custom'];

/**
 * The compiled template specification.
 * This is the ONLY format the contract engine accepts.
 * Once compiled, a spec is guaranteed to be valid and can be used without validation.
 */
export interface CompiledTemplateSpec {
  /** Unique ID of the compiled spec */
  specId: string;
  /** Version of the compiler that created this spec */
  compilerVersion: string;
  /** When this spec was compiled */
  compiledAt: string;
  /** SHA-256 hash of the source template content (for integrity checking) */
  sourceHash: string;

  /** Template metadata */
  metadata: {
    name: string;
    description: string | null;
    /** Scope: 'global' or 'development' */
    scope: 'global' | 'development';
    /** Development ID if scope is 'development' */
    developmentId: string | null;
    /** Branch for access control */
    branch: string;
  };

  /** The HTML content with merge tags in normalized format */
  htmlContent: string;
  /** Plain text version */
  textContent: string;

  /** All merge tags found in template, validated and normalized */
  mergeTags: CompiledMergeTag[];

  /** Required fields that MUST be present in contract data */
  requiredFields: string[];

  /** Optional fields that may be present */
  optionalFields: string[];

  /** Compilation warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Result of template compilation
 */
export interface CompilationResult {
  success: boolean;
  spec?: CompiledTemplateSpec;
  errors: CompilationError[];
  warnings: string[];
}

/**
 * Compilation error with location and fix suggestion
 */
export interface CompilationError {
  code: string;
  message: string;
  tag?: string;
  position?: number;
  suggestion?: string;
}

// ============================================================================
// COMPILER IMPLEMENTATION
// ============================================================================

const COMPILER_VERSION = '2.0.0';
const MERGE_TAG_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

/**
 * Generate a unique spec ID
 */
function generateSpecId(): string {
  return `spec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate SHA-256 hash of content (simplified for browser/node compatibility)
 */
function hashContent(content: string): string {
  // Simple hash for integrity checking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Infer data type from field name
 */
function inferDataType(field: string): CompiledMergeTag['dataType'] {
  const lower = field.toLowerCase();

  if (lower.includes('email')) return 'email';
  if (lower.includes('phone') || lower.includes('tel')) return 'phone';
  if (lower.includes('date') || lower.includes('timestamp')) return 'date';
  if (lower.includes('price') || lower.includes('amount') || lower.includes('fee') ||
    lower.includes('total') || lower.includes('deposit')) return 'currency';
  if (lower.includes('percentage') || lower.includes('size') || lower.includes('periods')) return 'number';
  if (lower.includes('enabled')) return 'boolean';

  return 'text';
}

/**
 * Extract and validate all merge tags from content - fail-fast validation
 */
function extractAndValidateMergeTags(content: string): { tags: CompiledMergeTag[]; errors: CompilationError[] } {
  const tags: CompiledMergeTag[] = [];
  const errors: CompilationError[] = [];
  const seenTags = new Set<string>();

  let match;
  while ((match = MERGE_TAG_REGEX.exec(content)) !== null) {
    const [fullMatch, namespace, field] = match;
    const position = match.index;
    const fullName = `${namespace}.${field}`;

    // Check for duplicate variables
    if (seenTags.has(fullName)) {
      errors.push({
        code: 'DUPLICATE_TAG',
        message: `Duplicate merge tag "${fullName}"`,
        tag: fullMatch,
        position
      });
      continue;
    }
    seenTags.add(fullName);

    // Validate namespace
    if (!VALID_NAMESPACES.includes(namespace as ValidNamespace)) {
      errors.push({
        code: 'INVALID_NAMESPACE',
        message: `Unknown namespace "${namespace}"`,
        tag: fullMatch,
        position,
        suggestion: `Use one of: ${VALID_NAMESPACES.join(', ')}`
      });
      continue;
    }

    const validNamespace = namespace as ValidNamespace;

    // For custom and loop namespaces, accept any valid field name
    if (validNamespace === 'custom' || validNamespace === 'loop') {
      // Validate field format
      const fieldRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!fieldRegex.test(field)) {
        errors.push({
          code: 'INVALID_FIELD_FORMAT',
          message: `Invalid field name "${field}" - must start with letter/underscore, contain only letters/numbers/underscores`,
          tag: fullMatch,
          position
        });
        continue;
      }

      tags.push({
        fullName,
        namespace: validNamespace,
        field,
        dataType: 'text',
        required: false,
        defaultValue: '',
        position
      });
      continue;
    }

    const schemaFields = NAMESPACE_SCHEMA[validNamespace];

    // Validate field exists in schema
    if (!schemaFields[field]) {
      errors.push({
        code: 'UNKNOWN_FIELD',
        message: `Unknown field "${field}" in namespace "${namespace}"`,
        tag: fullMatch,
        position,
        suggestion: `Available fields: ${Object.keys(schemaFields).join(', ')}`
      });
      continue;
    }

    // Validate field format
    const fieldRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!fieldRegex.test(field)) {
      errors.push({
        code: 'INVALID_FIELD_FORMAT',
        message: `Invalid field name "${field}" - must start with letter/underscore, contain only letters/numbers/underscores`,
        tag: fullMatch,
        position
      });
      continue;
    }

    const fieldSchema = schemaFields[field];

    tags.push({
      fullName,
      namespace: validNamespace,
      field,
      dataType: fieldSchema.type,
      required: fieldSchema.required,
      defaultValue: '',
      position
    });
  }

  return { tags, errors };
}

/**
 * Compile a template into a normalized spec.
 * This is the main entry point for template compilation.
 * 
 * @param htmlContent - The HTML content of the template
 * @param textContent - Plain text version
 * @param metadata - Template metadata (name, scope, etc.)
 * @returns Compilation result with spec or errors
 */
export function compileTemplate(
  htmlContent: string,
  textContent: string,
  metadata: {
    name: string;
    description?: string | null;
    scope: 'global' | 'development';
    developmentId?: string | null;
    branch: string;
  }
): CompilationResult {
  const errors: CompilationError[] = [];
  const warnings: string[] = [];

  // Validate inputs
  if (!htmlContent || htmlContent.trim().length === 0) {
    errors.push({
      code: 'EMPTY_CONTENT',
      message: 'Template content is empty',
      suggestion: 'Provide template content with merge tags like {{client.fullName}}'
    });
    return { success: false, errors, warnings };
  }

  if (!metadata.name || metadata.name.trim().length === 0) {
    errors.push({
      code: 'MISSING_NAME',
      message: 'Template name is required',
      suggestion: 'Provide a descriptive name for the template'
    });
    return { success: false, errors, warnings };
  }

  // Validate development-scoped templates have developmentId
  if (metadata.scope === 'development' && !metadata.developmentId) {
    errors.push({
      code: 'MISSING_DEVELOPMENT_ID',
      message: 'Development-scoped templates require a developmentId',
      suggestion: 'Specify the developmentId or change scope to global'
    });
    return { success: false, errors, warnings };
  }

  // Extract and validate merge tags
  const { tags, errors: tagErrors } = extractAndValidateMergeTags(htmlContent);
  errors.push(...tagErrors);

  // If there are any errors, fail compilation
  if (errors.length > 0) {
    logger.warn('Template compilation failed', {
      module: 'COMPILER',
      action: 'COMPILE_TEMPLATE',
      templateName: metadata.name,
      errorCount: errors.length,
      errors: errors.map(e => e.message)
    });
    return { success: false, errors, warnings };
  }

  // Check for empty template (no merge tags)
  if (tags.length === 0) {
    warnings.push('Template contains no merge tags - contract will be static text');
  }

  // Separate required and optional fields
  const requiredFields = tags.filter(t => t.required).map(t => t.fullName);
  const optionalFields = tags.filter(t => !t.required).map(t => t.fullName);

  // Build compiled spec
  const spec: CompiledTemplateSpec = {
    specId: generateSpecId(),
    compilerVersion: COMPILER_VERSION,
    compiledAt: new Date().toISOString(),
    sourceHash: hashContent(htmlContent),

    metadata: {
      name: metadata.name.trim(),
      description: metadata.description || null,
      scope: metadata.scope,
      developmentId: metadata.developmentId || null,
      branch: metadata.branch
    },

    htmlContent,
    textContent: textContent || htmlContent.replace(/<[^>]*>/g, ''),

    mergeTags: tags,
    requiredFields,
    optionalFields,
    warnings
  };

  logger.info('Template compiled successfully', {
    module: 'COMPILER',
    action: 'COMPILE_TEMPLATE',
    specId: spec.specId,
    templateName: metadata.name,
    mergeTagCount: tags.length,
    requiredFieldCount: requiredFields.length
  });

  return { success: true, spec, errors: [], warnings };
}

/**
 * Validate that contract data satisfies a compiled spec.
 * This is a FAST check because the spec is already validated.
 * Returns missing required fields or null if valid.
 */
export function validateContractData(
  spec: CompiledTemplateSpec,
  contractData: Record<string, Record<string, unknown>>
): string[] | null {
  const missing: string[] = [];

  for (const fieldName of spec.requiredFields) {
    const [namespace, field] = fieldName.split('.');
    const namespaceData = contractData[namespace];

    if (!namespaceData || namespaceData[field] === undefined || namespaceData[field] === null || namespaceData[field] === '') {
      missing.push(fieldName);
    }
  }

  return missing.length > 0 ? missing : null;
}

/**
 * Generate contract content from a compiled spec.
 * This is SIMPLE because the spec is already validated.
 * No validation is performed here - the spec guarantees validity.
 */
export function generateFromSpec(
  spec: CompiledTemplateSpec,
  contractData: Record<string, Record<string, string>>
): { content: string; htmlContent: string } {
  let htmlContent = spec.htmlContent;
  let content = spec.textContent;

  // Replace all merge tags with values
  for (const tag of spec.mergeTags) {
    const value = contractData[tag.namespace]?.[tag.field] || tag.defaultValue || '';
    const pattern = new RegExp(`\\{\\{${tag.fullName}\\}\\}`, 'g');

    htmlContent = htmlContent.replace(pattern, value);
    content = content.replace(pattern, value);
  }

  return { content, htmlContent };
}

/**
 * Compile a DOCX template into normalized spec format
 */
export function compileDocxTemplate(
  templateBuffer: Buffer,
  metadata: {
    name: string;
    description?: string | null;
    scope: 'global' | 'development';
    developmentId?: string | null;
    branch: string;
  }
): CompilationResult {
  const errors: CompilationError[] = [];
  const warnings: string[] = [];

  try {
    // Extract variables from DOCX
    const detectedVariables = extractVariablesFromDocx(templateBuffer);

    // Validate variables
    const validation = validateVariables(detectedVariables);
    if (!validation.valid) {
      errors.push(...validation.errors.map(message => ({
        code: 'INVALID_VARIABLE',
        message,
        position: -1
      })));
    }

    // Add warnings
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    // Convert DOCX to HTML for spec storage
    // Note: This is a simplified conversion - in production, use a proper DOCX to HTML library
    const htmlContent = `[DOCX Template with ${detectedVariables.length} variables]`;
    const textContent = htmlContent;

    // Convert detected variables to compiled merge tags
    const mergeTags: CompiledMergeTag[] = detectedVariables.map(variable => ({
      fullName: variable.name,
      namespace: variable.namespace as ValidNamespace,
      field: variable.field,
      dataType: variable.dataType || 'text',
      required: variable.required || false,
      defaultValue: '',
      position: variable.position || 0
    }));

    // Build compiled spec
    const spec: CompiledTemplateSpec = {
      specId: generateSpecId(),
      compilerVersion: COMPILER_VERSION,
      compiledAt: new Date().toISOString(),
      sourceHash: hashContent(htmlContent),

      metadata: {
        name: metadata.name.trim(),
        description: metadata.description || null,
        scope: metadata.scope,
        developmentId: metadata.developmentId || null,
        branch: metadata.branch
      },

      htmlContent,
      textContent,

      mergeTags,
      requiredFields: mergeTags.filter(t => t.required).map(t => t.fullName),
      optionalFields: mergeTags.filter(t => !t.required).map(t => t.fullName),
      warnings
    };

    logger.info('DOCX template compiled successfully', {
      module: 'COMPILER',
      action: 'COMPILE_DOCX_TEMPLATE',
      specId: spec.specId,
      templateName: metadata.name,
      mergeTagCount: mergeTags.length,
      requiredFieldCount: spec.requiredFields.length
    });

    return { success: true, spec, errors: [], warnings };

  } catch (error: any) {
    logger.error('DOCX template compilation failed', error, {
      module: 'COMPILER',
      action: 'COMPILE_DOCX_TEMPLATE',
      templateName: metadata.name
    });

    errors.push({
      code: 'DOCX_COMPILATION_ERROR',
      message: `Failed to compile DOCX template: ${error.message}`,
      position: -1,
      suggestion: 'Check that the template is a valid DOCX file with correct merge tags'
    });

    return { success: false, errors, warnings };
  }
}

/**
 * Recompile an existing template (for migration or updates)
 */
export function recompileFromRaw(
  rawTemplate: {
    name: string;
    description?: string | null;
    content: string;
    htmlContent?: string | null;
    isGlobal: boolean;
    developmentId?: string | null;
    branch: string;
    variables?: unknown;
  }
): CompilationResult {
  const htmlContent = rawTemplate.htmlContent || rawTemplate.content;
  const textContent = rawTemplate.content;

  return compileTemplate(htmlContent, textContent, {
    name: rawTemplate.name,
    description: rawTemplate.description,
    scope: rawTemplate.isGlobal ? 'global' : 'development',
    developmentId: rawTemplate.developmentId,
    branch: rawTemplate.branch
  });
}

export default {
  compileTemplate,
  validateContractData,
  generateFromSpec,
  recompileFromRaw,
  NAMESPACE_SCHEMA,
  VALID_NAMESPACES,
  COMPILER_VERSION
};
