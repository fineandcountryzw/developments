/**
 * Contract Template Parser
 * 
 * Parses DOCX files to extract merge tags and convert to HTML.
 * Uses mammoth library for DOCX parsing.
 * 
 * Merge Tag Format: {{namespace.fieldName}}
 * Example: {{client.fullName}}, {{stand.price}}, {{development.name}}
 * 
 * @module lib/contract-template-parser
 */

import mammoth from 'mammoth';
import PizZip from 'pizzip';
import { Readable } from 'stream';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a parsed merge tag found in the template
 */
export interface MergeTag {
  /** Full tag including braces: {{client.fullName}} */
  fullTag: string;
  /** Namespace: client, stand, development, terms, pricing, contract */
  namespace: string;
  /** Field name within the namespace */
  field: string;
  /** Optional formatting hints extracted from tag */
  format?: string;
}

/**
 * Result of parsing a DOCX template
 */
export interface ParsedTemplate {
  /** HTML representation of the template content */
  htmlContent: string;
  /** Plain text representation for preview */
  textContent: string;
  /** Array of unique merge tags found */
  mergeTags: MergeTag[];
  /** Template metadata */
  metadata: {
    title?: string;
    author?: string;
    createdAt?: Date;
    wordCount?: number;
  };
}

/**
 * Configuration for parsing
 */
export interface ParserConfig {
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Allowed namespaces for validation */
  allowedNamespaces?: string[];
  /** Whether to sanitize HTML output */
  sanitizeHtml?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Regex pattern for merge tags: {{namespace.fieldName}} */
const MERGE_TAG_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)\}\}/g;

/** Valid namespaces per CONTRACT_ENGINE_DESIGN.md */
const VALID_NAMESPACES = [
  'client',
  'stand', 
  'development',
  'terms',
  'pricing',
  'contract'
] as const;

/** Default parser configuration */
const DEFAULT_CONFIG: ParserConfig = {
  maxFileSize: 20 * 1024 * 1024, // 20MB
  allowedNamespaces: [...VALID_NAMESPACES],
  sanitizeHtml: true
};

// ============================================================================
// Main Parser Functions
// ============================================================================

/**
 * Parse a DOCX buffer and extract merge tags with streaming support
 * 
 * @param buffer - DOCX file as Buffer
 * @param config - Optional parser configuration
 * @returns Parsed template with HTML content and merge tags
 * @throws Error if file is invalid or too large
 */
export async function parseDocxTemplate(
  buffer: Buffer,
  config: ParserConfig = {}
): Promise<ParsedTemplate> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Validate file size
  if (buffer.length > mergedConfig.maxFileSize!) {
    throw new Error(
      `File size ${buffer.length} bytes exceeds maximum ${mergedConfig.maxFileSize} bytes`
    );
  }

  try {
    // Optimize DOCX for parsing by removing images
    const optimizedBuffer = removeImagesFromDocx(buffer);
    
    // Convert DOCX to HTML using mammoth with streaming
    const htmlResult = await mammoth.convertToHtml({ buffer: optimizedBuffer });
    const textResult = await mammoth.extractRawText({ buffer: optimizedBuffer });
    
    const htmlContent = htmlResult.value;
    const textContent = textResult.value;
    
    // Extract merge tags from the HTML content
    const mergeTags = extractMergeTags(htmlContent, mergedConfig);
    
    // Extract metadata from the document
    const metadata = extractMetadata(htmlResult.messages, textContent);
    
    return {
      htmlContent: mergedConfig.sanitizeHtml ? sanitizeHtml(htmlContent) : htmlContent,
      textContent,
      mergeTags,
      metadata
    };
  } catch (error) {
    throw new Error(
      `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse a DOCX file from a readable stream
 * 
 * @param stream - Readable stream of DOCX file
 * @param config - Optional parser configuration
 * @returns Parsed template with HTML content and merge tags
 * @throws Error if file is invalid or too large
 */
export async function parseDocxTemplateFromStream(
  stream: Readable,
  config: ParserConfig = {}
): Promise<ParsedTemplate> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const chunks: Buffer[] = [];
  let totalSize = 0;

  // Read stream in chunks with size validation
  for await (const chunk of stream) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += chunkBuffer.length;

    if (totalSize > mergedConfig.maxFileSize!) {
      throw new Error(
        `File size ${totalSize} bytes exceeds maximum ${mergedConfig.maxFileSize} bytes`
      );
    }

    chunks.push(chunkBuffer);
  }

  // Parse the collected buffer
  return parseDocxTemplate(Buffer.concat(chunks), config);
}

/**
 * Remove images from DOCX to reduce file size for parsing
 */
function removeImagesFromDocx(buffer: Buffer): Buffer {
  try {
    const zip = new PizZip(buffer);
    
    // Remove images from document
    const imageFiles = zip.file(/word\/media\//);
    imageFiles.forEach(file => {
      zip.remove(file.name);
    });
    
    // Remove image references from document.xml
    let documentXml = zip.file('word/document.xml')?.asText() || '';
    documentXml = documentXml.replace(/<w:pict>[\s\S]*?<\/w:pict>/g, '');
    documentXml = documentXml.replace(/<v:shape>[\s\S]*?<\/v:shape>/g, '');
    zip.file('word/document.xml', documentXml);
    
    return Buffer.from(zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    }));
  } catch (error) {
    // If we fail to remove images, just return original buffer
    console.warn('Failed to remove images from DOCX:', error);
    return buffer;
  }
}

/**
 * Extract merge tags from template content
 * 
 * @param content - Template content (HTML or plain text)
 * @param config - Parser configuration for validation
 * @returns Array of unique merge tags
 */
export function extractMergeTags(
  content: string,
  config: ParserConfig = {}
): MergeTag[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const tags: Map<string, MergeTag> = new Map();
  
  let match: RegExpExecArray | null;
  
  // Reset regex lastIndex
  MERGE_TAG_REGEX.lastIndex = 0;
  
  while ((match = MERGE_TAG_REGEX.exec(content)) !== null) {
    const [fullTag, namespace, field] = match;
    
    // Validate namespace if allowed list provided
    if (mergedConfig.allowedNamespaces && 
        !mergedConfig.allowedNamespaces.includes(namespace)) {
      console.warn(`Invalid namespace in merge tag: ${fullTag}`);
      continue;
    }
    
    // Store unique tags
    if (!tags.has(fullTag)) {
      tags.set(fullTag, {
        fullTag,
        namespace,
        field
      });
    }
  }
  
  return Array.from(tags.values());
}

/**
 * Validate that all merge tags in content use allowed namespaces
 * 
 * @param content - Template content to validate
 * @param allowedNamespaces - List of valid namespaces
 * @returns Validation result with any invalid tags
 */
export function validateMergeTags(
  content: string,
  allowedNamespaces: string[] = [...VALID_NAMESPACES]
): {
  valid: boolean;
  invalidTags: string[];
  validTags: MergeTag[];
} {
  const allTags = extractMergeTags(content, { allowedNamespaces: [] });
  const invalidTags: string[] = [];
  const validTags: MergeTag[] = [];
  
  for (const tag of allTags) {
    if (allowedNamespaces.includes(tag.namespace)) {
      validTags.push(tag);
    } else {
      invalidTags.push(tag.fullTag);
    }
  }
  
  return {
    valid: invalidTags.length === 0,
    invalidTags,
    validTags
  };
}

/**
 * Replace merge tags with actual values in template content
 * 
 * @param template - HTML template content
 * @param values - Object mapping namespace.field to values
 * @returns Content with tags replaced
 */
export function replaceMergeTags(
  template: string,
  values: Record<string, string | number | Date | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      const formattedValue = formatValue(value);
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, formattedValue);
    }
  }
  
  return result;
}

/**
 * Get required fields for a given set of merge tags
 * 
 * @param tags - Array of merge tags
 * @returns Object grouping fields by namespace
 */
export function getRequiredFields(tags: MergeTag[]): Record<string, string[]> {
  const fields: Record<string, Set<string>> = {};
  
  for (const tag of tags) {
    if (!fields[tag.namespace]) {
      fields[tag.namespace] = new Set();
    }
    fields[tag.namespace].add(tag.field);
  }
  
  // Convert Sets to arrays
  const result: Record<string, string[]> = {};
  for (const [namespace, fieldSet] of Object.entries(fields)) {
    result[namespace] = Array.from(fieldSet);
  }
  
  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Mammoth message type
 */
interface MammothMessage {
  type: string;
  message: string;
}

/**
 * Extract metadata from mammoth conversion result
 */
function extractMetadata(
  messages: MammothMessage[],
  textContent: string
): ParsedTemplate['metadata'] {
  const metadata: ParsedTemplate['metadata'] = {};
  
  // Calculate word count
  metadata.wordCount = textContent.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // Look for title in messages
  const titleMessage = messages.find(m => m.message.includes('title'));
  if (titleMessage) {
    const match = titleMessage.message.match(/title["\']?\s*:\s*["\']?([^"\']+)/i);
    if (match) {
      metadata.title = match[1];
    }
  }
  
  return metadata;
}

/**
 * Basic HTML sanitization
 * Removes script tags and event handlers
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Format a value for display in the contract
 */
function formatValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-ZW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value > 100) {
      return value.toLocaleString('en-ZW', {
        style: 'currency',
        currency: 'USD'
      });
    }
    return value.toString();
  }
  
  return String(value);
}

// ============================================================================
// Export Types and Constants
// ============================================================================

export { VALID_NAMESPACES };
export type ValidNamespace = typeof VALID_NAMESPACES[number];

// ============================================================================
// Default Export
// ============================================================================

export default {
  parseDocxTemplate,
  parseDocxTemplateFromStream,
  extractMergeTags,
  validateMergeTags,
  replaceMergeTags,
  getRequiredFields,
  VALID_NAMESPACES
};
