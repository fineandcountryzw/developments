/**
 * DOCX Template Engine
 * 
 * Handles DOCX template processing for contract generation.
 * Uses docxtemplater with Pizzip for DOCX file manipulation.
 * 
 * @module lib/docx-template-engine
 */

import PizZip from 'pizzip';
import docxtemplater from 'docxtemplater';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface DocxTemplateData {
  /** Template file buffer */
  templateBuffer: Buffer;
  /** Detected variables from template */
  variables: DetectedVariable[];
  /** Generated file buffer */
  generatedBuffer: Buffer;
}

export interface DetectedVariable {
  /** Full variable name with namespace: "client.fullName" */
  name: string;
  /** Namespace: "client", "stand", "development", etc. */
  namespace: string;
  /** Field name without namespace */
  field: string;
  /** Line/position in document */
  position?: number;
  /** Data type inferred from field name */
  dataType?: 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone' | 'boolean';
  /** Whether this field is required */
  required?: boolean;
}

export interface TemplateVariableContext {
  client?: Record<string, unknown>;
  stand?: Record<string, unknown>;
  development?: Record<string, unknown>;
  terms?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  contract?: Record<string, unknown>;
  [key: string]: Record<string, unknown> | undefined;
}

// ============================================================================
// Variable Detection
// ============================================================================

/**
 * Infer data type from field name
 */
function inferDataType(field: string): DetectedVariable['dataType'] {
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
 * Validate namespace and field against schema
 */
function validateVariable(namespace: string, field: string): { valid: boolean; required: boolean } {
  const validNamespaces = ['client', 'stand', 'development', 'terms', 'pricing', 'contract', 'loop', 'custom'];
  const namespaceSchema = {
    client: { fullName: true, firstName: false, lastName: false, email: true, phone: false, nationalId: false, address: false },
    stand: { number: true, price: true, sizeSqm: false, status: true },
    development: { name: true, location: true, description: false, developerName: false, developerEmail: false, developerPhone: false, lawyerName: false, lawyerEmail: false, lawyerPhone: false },
    terms: { depositPercentage: true, vatEnabled: true, vatPercentage: false, endowmentEnabled: false, endowmentFee: false, aosEnabled: false, aosFee: false, cessionsEnabled: false, cessionFee: false, adminFeeEnabled: false, adminFee: false, installmentPeriods: false },
    pricing: { vatAmount: false, depositAmount: true, endowmentAmount: false, aosAmount: false, cessionAmount: false, adminAmount: false, grandTotal: true, balanceAfterDeposit: true },
    contract: { date: true, timestamp: true, id: true },
    loop: {},
    custom: {} // Allow any field in custom namespace
  };
  
  if (!validNamespaces.includes(namespace)) {
    return { valid: false, required: false };
  }
  
  if (namespace === 'loop' || namespace === 'custom') {
    return { valid: true, required: false };
  }
  
  const fields = namespaceSchema[namespace as keyof typeof namespaceSchema];
  return { 
    valid: field in fields, 
    required: fields[field as keyof typeof fields]
  };
}

/**
 * Extract variables from DOCX content
 * Supports: {{namespace.field}} and {% for item in items %}...{% endfor %}
 * Handles variables split across Word runs by parsing the raw document.xml
 */
export function extractVariablesFromDocx(docxBuffer: Buffer): DetectedVariable[] {
  const variables: DetectedVariable[] = [];
  
  try {
    const zip = new PizZip(docxBuffer);
    
    // Get the raw document.xml content - this preserves the actual structure
    const documentXml = zip.file('word/document.xml')?.asText() || '';
    
    // Remove XML tags to get the raw text with variables potentially split across runs
    // but preserve the text content of all runs combined
    let rawText = documentXml.replace(/<[^>]+>/g, '');
    
    // Normalize whitespace and special characters that Word might insert
    rawText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    rawText = rawText.replace(/\s+/g, ' ').trim();
    
    // Match multiple variable formats:
    // 1. {{variable}} or {{namespace.field}}
    // 2. [VARIABLE] or [NAMESPACE.FIELD]
    // 3. __variable__ or __namespace_field__
    // 4. ----- lines
    
    const patterns = [
      // {{namespace.field}} or {{variable}}
      /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g,
      // [VARIABLE] or [NAMESPACE.FIELD]
      /\[([a-zA-Z_][a-zA-Z0-9_.]*)\]/g,
      // __variable__ or __namespace_field__
      /_{2,}([a-zA-Z0-9_]+)_{2,}/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(rawText)) !== null) {
        const [fullMatch, variableName] = match;
        let normalizedName = variableName.trim();
        
        // Normalize separators
        normalizedName = normalizedName.replace(/_/g, '.'); // Replace underscores with dots
        normalizedName = normalizedName.toLowerCase();
        
        // Check if it's a valid variable format (namespace.field or single field)
        const parts = normalizedName.split('.');
        if (parts.length >= 1 && parts.length <= 2) {
          let namespace: string;
          let field: string;
          
          if (parts.length === 2) {
            [namespace, field] = parts;
          } else {
            // If no namespace, assume it's a general field (can be mapped later)
            namespace = 'custom';
            field = parts[0];
          }
          
          const validation = validateVariable(namespace, field);
          
          // Check if variable already exists to avoid duplicates
          if (!variables.find(v => v.name === normalizedName)) {
            variables.push({
              name: normalizedName,
              namespace,
              field,
              position: match.index,
              dataType: inferDataType(field),
              required: validation.required
            });
          }
        }
      }
    }
    
    // Match lines with multiple dashes as variable candidates
    const lines = rawText.split('\n');
    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length >= 5 && /^[-–—]+$/.test(trimmedLine)) {
        const variableName = `field_${variables.length + 1}`;
        if (!variables.find(v => v.name === variableName)) {
          variables.push({
            name: variableName,
            namespace: 'custom',
            field: variableName,
            position: lineIndex,
            dataType: 'text',
            required: false
          });
        }
      }
    });
    
    logger.info('[DOCX] Extracted variables from template', {
      count: variables.length,
      variables: variables.map(v => v.name),
    });
    
    return variables;
    
  } catch (error) {
    logger.error('[DOCX] Failed to extract variables', error as Error);
    return []; // Always return an empty array instead of throwing
  }
}

/**
 * Validate that detected variables match our schema - fail-fast validation
 */
export function validateVariables(variables: DetectedVariable[]): { valid: boolean; errors: string[]; warnings: string[] } {
  const validNamespaces = ['client', 'stand', 'development', 'terms', 'pricing', 'contract', 'loop', 'custom'];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenVariables = new Set<string>();
  
  for (const variable of variables) {
    // Check for duplicate variables
    if (seenVariables.has(variable.name)) {
      errors.push(`Duplicate variable "${variable.name}" at position ${variable.position}`);
      continue;
    }
    seenVariables.add(variable.name);
    
    // Validate namespace format
    if (!validNamespaces.includes(variable.namespace)) {
      errors.push(`Invalid namespace "${variable.namespace}" in variable "${variable.name}" at position ${variable.position}. Valid namespaces: ${validNamespaces.join(', ')}`);
      continue;
    }
    
    // Validate field format
    const fieldRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!fieldRegex.test(variable.field)) {
      errors.push(`Invalid field name "${variable.field}" in variable "${variable.name}" at position ${variable.position}. Field names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      continue;
    }
    
    if (variable.namespace !== 'loop' && variable.namespace !== 'custom') {
      const validation = validateVariable(variable.namespace, variable.field);
      if (!validation.valid) {
        const namespaceSchema = {
          client: ['fullName', 'firstName', 'lastName', 'email', 'phone', 'nationalId', 'address'],
          stand: ['number', 'price', 'sizeSqm', 'status'],
          development: ['name', 'location', 'description', 'developerName', 'developerEmail', 'developerPhone', 'lawyerName', 'lawyerEmail', 'lawyerPhone'],
          terms: ['depositPercentage', 'vatEnabled', 'vatPercentage', 'endowmentEnabled', 'endowmentFee', 'aosEnabled', 'aosFee', 'cessionsEnabled', 'cessionFee', 'adminFeeEnabled', 'adminFee', 'installmentPeriods'],
          pricing: ['vatAmount', 'depositAmount', 'endowmentAmount', 'aosAmount', 'cessionAmount', 'adminAmount', 'grandTotal', 'balanceAfterDeposit'],
          contract: ['date', 'timestamp', 'id']
        };
        
        errors.push(`Unknown field "${variable.field}" in namespace "${variable.namespace}" for variable "${variable.name}" at position ${variable.position}. Available fields: ${namespaceSchema[variable.namespace as keyof typeof namespaceSchema].join(', ')}`);
      } else {
        // Check if required field is missing from template
        if (validation.required && !variable.required) {
          warnings.push(`Variable "${variable.name}" should be marked as required`);
        }
      }
    }
  }
  
  // Check for missing required fields (only for non-custom namespaces)
  const requiredFields = new Set<string>();
  Object.entries({
    client: ['fullName', 'email'],
    stand: ['number', 'price', 'status'],
    development: ['name', 'location'],
    terms: ['depositPercentage', 'vatEnabled'],
    pricing: ['depositAmount', 'grandTotal', 'balanceAfterDeposit'],
    contract: ['date', 'timestamp', 'id']
  }).forEach(([namespace, fields]) => {
    fields.forEach(field => {
      requiredFields.add(`${namespace}.${field}`);
    });
  });
  
  const foundFields = new Set(variables.map(v => v.name));
  for (const requiredField of requiredFields) {
    if (!foundFields.has(requiredField)) {
      warnings.push(`Required field "${requiredField}" is missing from template`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// DOCX Generation
// ============================================================================

/**
 * Format variable value based on data type for proper document formatting
 */
function formatVariableValue(value: unknown, dataType?: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  const stringValue = String(value);
  
  switch (dataType) {
    case 'currency':
      // Format currency with proper thousands and decimal separators
      const numValue = parseFloat(stringValue);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat('en-ZW', {
          style: 'currency',
          currency: 'ZWL',
          minimumFractionDigits: 2
        }).format(numValue);
      }
      return stringValue;
      
    case 'date':
      try {
        const dateValue = new Date(value as string | number | Date);
        if (!isNaN(dateValue.getTime())) {
          return new Intl.DateTimeFormat('en-ZW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).format(dateValue);
        }
      } catch (error) {
        logger.warn('[DOCX] Invalid date value', { value, error });
      }
      return stringValue;
      
    case 'number':
      const numValue2 = parseFloat(stringValue);
      if (!isNaN(numValue2)) {
        return new Intl.NumberFormat('en-ZW').format(numValue2);
      }
      return stringValue;
      
    case 'boolean':
      return stringValue.toLowerCase() === 'true' ? 'Yes' : 'No';
      
    default:
      return stringValue;
  }
}

/**
 * Prepare context for DOCX template rendering with proper value formatting
 */
function prepareRenderContext(context: TemplateVariableContext): TemplateVariableContext {
  const formattedContext: TemplateVariableContext = {};
  
  for (const [namespace, fields] of Object.entries(context)) {
    if (fields) {
      const formattedFields: Record<string, unknown> = {};
      
      for (const [field, value] of Object.entries(fields)) {
        // Try to infer data type from field name for better formatting
        const dataType = inferDataType(field);
        formattedFields[field] = formatVariableValue(value, dataType);
      }
      
      formattedContext[namespace] = formattedFields;
    }
  }
  
  return formattedContext;
}

/**
 * Generate DOCX from template with variable substitution
 */
export function generateDocxFromTemplate(
  templateBuffer: Buffer,
  context: TemplateVariableContext
): Buffer {
  try {
    const zip = new PizZip(templateBuffer);
    
    const doc = new docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Prepare context with formatted values
    const formattedContext = prepareRenderContext(context);
    
    // Set the template variables
    doc.render(formattedContext);
    
    // Generate the DOCX buffer
    const generatedBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    logger.info('[DOCX] Generated DOCX from template', {
      contextKeys: Object.keys(formattedContext),
    });
    
    return generatedBuffer;
    
  } catch (error: any) {
    // Handle docxtemplater errors
    if (error.properties && error.properties.errors) {
      const errorMessages = error.properties.errors.map((e: any) => e.message).join('; ');
      logger.error('[DOCX] Template rendering errors', { errors: errorMessages });
      throw new Error(`DOCX template rendering failed: ${errorMessages}`);
    }
    
    logger.error('[DOCX] Failed to generate DOCX', error as Error);
    throw new Error(`Failed to generate DOCX from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert DOCX buffer to HTML string
 * Uses the built-in docxtemplater text extraction
 */
export function convertDocxToHtml(docxBuffer: Buffer): string {
  try {
    const zip = new PizZip(docxBuffer);
    const doc = new docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Get full text
    const fullText = doc.getFullText();
    
    // Convert newlines to HTML breaks
    const html = fullText
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    return `<p>${html}</p>`;
    
  } catch (error) {
    logger.error('[DOCX] Failed to convert to HTML', error as Error);
    throw new Error(`Failed to convert DOCX to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Template Validation
// ============================================================================

/**
 * Validate DOCX file by checking its structure
 */
export function validateDocxTemplate(fileBuffer: Buffer): { valid: boolean; error?: string } {
  try {
    const zip = new PizZip(fileBuffer);
    
    // Check if it's a valid DOCX (zip with [Content_Types].xml)
    if (!zip.file('[Content_Types].xml')) {
      return { valid: false, error: 'Invalid DOCX file: missing [Content_Types].xml' };
    }
    
    // Try to create a docxtemplater instance
    const doc = new docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Verify we can access the document
    doc.getFullText();
    
    return { valid: true };
    
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Check if file is actually a DOCX by magic bytes
 */
export function isValidDocxMagicBytes(buffer: Buffer): boolean {
  // DOCX files are ZIP files with specific magic bytes
  const DOCX_MAGIC = [
    0x50, 0x4B, 0x03, 0x04, // ZIP local file header
    0x50, 0x4B, 0x05, 0x06, // ZIP empty archive
    0x50, 0x4B, 0x07, 0x08, // ZIP spanned archive
  ];
  
  // Check first 4 bytes for ZIP signature
  const header = buffer.slice(0, 4);
  const headerHex = Array.from(header).map(b => b.toString(16)).join(',');
  const expectedHex = DOCX_MAGIC.slice(0, 4).map(b => b.toString(16)).join(',');
  
  return headerHex === expectedHex;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect variable namespace and field from full name
 */
export function parseVariableName(fullName: string): { namespace: string; field: string } | null {
  const parts = fullName.split('.');
  if (parts.length !== 2) return null;
  
  return {
    namespace: parts[0],
    field: parts[1],
  };
}

/**
 * Format detected variables for storage
 */
export function formatVariablesForStorage(variables: DetectedVariable[]): Prisma.InputJsonValue {
  return variables.map(v => ({
    name: v.name,
    namespace: v.namespace,
    field: v.field,
    position: v.position,
  })) as Prisma.InputJsonValue;
}

/**
 * Load variables from storage format
 */
export function loadVariablesFromStorage(stored: Record<string, unknown>[]): DetectedVariable[] {
  return stored.map(v => ({
    name: v.name as string,
    namespace: v.namespace as string,
    field: v.field as string,
    position: v.position as number | undefined,
  }));
}
