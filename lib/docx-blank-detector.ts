/**
 * DOCX Blank Detector
 * 
 * Detects blank fields (dashes, underscores, dots) in DOCX files
 * and replaces them with {{field_N}} placeholders for mapping.
 * 
 * @module lib/docx-blank-detector
 */

import PizZip from 'pizzip';
import { logger } from './logger';
import { Readable } from 'stream';

// ============================================================================
// Types
// ============================================================================

/**
 * A detected blank field in the document
 */
export interface DetectedBlank {
  placeholder: string;
  contextBefore: string;
  contextAfter: string;
  position: number;
  length: number;
  blankType: 'dots' | 'underscores' | 'hyphens' | 'mixed';
}

/**
 * Result of blank detection
 */
export interface BlankDetectionResult {
  blanks: DetectedBlank[];
  count: number;
  hasBlanks: boolean;
}

/**
 * Mapping from placeholder to ERP variable
 */
export interface VariableMapping {
  [placeholder: string]: string;
}

/**
 * Result of applying mappings to DOCX
 */
export interface MappingApplyResult {
  success: boolean;
  transformedBuffer?: Buffer;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_BLANK_LENGTH = 5;
const HYPHEN_THRESHOLD = 8;
const CONTEXT_LENGTH = 40;
const BLANK_REGEX = /([._-])\1{4,}/g;
const PLACEHOLDER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// ============================================================================
// Helper Functions
// ============================================================================

function getContext(text: string, position: number, length: number): string {
  const start = Math.max(0, position - CONTEXT_LENGTH);
  const end = Math.min(text.length, position + length + CONTEXT_LENGTH);
  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet.trim();
}

function getBlankType(char: string): DetectedBlank['blankType'] {
  if (char === '.' || char === '·') return 'dots';
  if (char === '_') return 'underscores';
  return 'hyphens';
}

function getPrimaryBlankChar(text: string): string {
  const dots = (text.match(/\./g) || []).length;
  const underscores = (text.match(/_/g) || []).length;
  const hyphens = (text.match(/[-–—]/g) || []).length;

  const max = Math.max(dots, underscores, hyphens);
  if (max === dots) return '.';
  if (max === underscores) return '_';
  return '-';
}

// ============================================================================
// Blank Detection
// ============================================================================

export function detectBlanks(
  text: string,
  positionOffset: number = 0
): BlankDetectionResult {
  const blanks: DetectedBlank[] = [];

  const normalizedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  let match;
  let blankIndex = 0;

  while ((match = BLANK_REGEX.exec(normalizedText)) !== null) {
    const [fullMatch] = match;
    const position = match.index + positionOffset;
    const length = fullMatch.length;

    if (length < MIN_BLANK_LENGTH) continue;
    if (fullMatch.includes('-') && length < HYPHEN_THRESHOLD) continue;

    const primaryChar = getPrimaryBlankChar(fullMatch);
    const blankType = getBlankType(primaryChar);

    const contextBefore = getContext(normalizedText, position, 0).substring(0, CONTEXT_LENGTH);
    const contextAfter = getContext(normalizedText, position, length).substring(CONTEXT_LENGTH);

    const placeholder = `field_${++blankIndex}`;

    blanks.push({
      placeholder,
      contextBefore,
      contextAfter,
      position,
      length,
      blankType
    });
  }

  return {
    blanks,
    count: blanks.length,
    hasBlanks: blanks.length > 0
  };
}

export function detectBlanksInDocx(docxBuffer: Buffer): BlankDetectionResult {
  try {
    const zip = new PizZip(docxBuffer);
    const documentXml = zip.file('word/document.xml')?.asText() || '';

    const rawText = documentXml.replace(/<[^>]+>/g, ' ');
    const normalizedText = rawText.replace(/\s+/g, ' ').trim();

    const result = detectBlanks(normalizedText);

    logger.info('[DOCX Blank] Detection complete', {
      hasBlanks: result.hasBlanks,
      count: result.count
    });

    return result;

  } catch (error) {
    logger.error('[DOCX Blank] Detection failed', error as Error);
    throw new Error(`Failed to detect blanks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function detectBlanksInDocxFromStream(stream: Readable): Promise<BlankDetectionResult> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return detectBlanksInDocx(Buffer.concat(chunks));
}

// ============================================================================
// Mapping Application
// ============================================================================

export function applyMappings(
  docxBuffer: Buffer,
  mappings: VariableMapping
): MappingApplyResult {
  try {
    const zip = new PizZip(docxBuffer);
    let documentXml = zip.file('word/document.xml')?.asText() || '';

    // First, find all physical blanks in the document again
    // We need to do this because the placeholders (field_1, etc.) 
    // don't actually exist in the document, they were just for UI.
    const rawText = documentXml.replace(/<[^>]+>/g, ' ');
    const normalizedText = rawText.replace(/\s+/g, ' ').trim();

    // Use the same regex that identified the blanks in the first place
    const BLANK_REGEX = /([._-])\1{4,}/g;
    const detectedPatterns: string[] = [];
    let match;
    while ((match = BLANK_REGEX.exec(normalizedText)) !== null) {
      detectedPatterns.push(match[0]);
    }

    logger.info('[DOCX Mapping] Applying mappings to physical patterns', {
      mappingsCount: Object.keys(mappings).length,
      patternsFound: detectedPatterns.length
    });

    // Replace each detected pattern with its mapped variable
    // Patterns are field_1, field_2, etc. in the mappings object
    detectedPatterns.forEach((pattern, index) => {
      const placeholder = `field_${index + 1}`;
      const erpVariable = mappings[placeholder];

      if (erpVariable && erpVariable.trim()) {
        const erpTag = `{{${erpVariable}}}`;

        // We need to be careful with replacement. In document.xml, 
        // a sequence like "........" might be split across multiple <w:t> tags.
        // However, usually blanks are in a single tag.
        // Simple string replacement on normalizedText won't work for the binary-like XML.
        // For now, we try a direct replacement on the XML for the detected pattern.
        // This works if the pattern isn't split by XML tags.
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        documentXml = documentXml.replace(new RegExp(escapedPattern, ''), erpTag);
      }
      // If no mapping, we leave the original blank pattern as is.
    });

    zip.file('word/document.xml', documentXml);

    const transformedBuffer = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    return { success: true, transformedBuffer };

  } catch (error) {
    logger.error('[DOCX Blank] Mapping failed', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Validation
// ============================================================================

export function isValidPlaceholder(placeholder: string): boolean {
  return PLACEHOLDER_REGEX.test(placeholder);
}

export function validateMappings(mappings: VariableMapping): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validNamespaces = ['client', 'stand', 'development', 'terms', 'pricing', 'contract', 'bank', 'seller'];

  for (const [placeholder, erpVariable] of Object.entries(mappings)) {
    // Basic placeholder check
    if (!isValidPlaceholder(placeholder)) {
      errors.push(`Invalid placeholder name: ${placeholder}`);
      continue;
    }

    // Skip empty values (unmapped)
    if (!erpVariable || !erpVariable.trim()) continue;

    const parts = erpVariable.split('.');
    if (parts.length < 2) {
      errors.push(`Invalid format for ${placeholder}: "${erpVariable}" (expected namespace.field)`);
    } else {
      const namespace = parts[0];
      if (!validNamespaces.includes(namespace)) {
        errors.push(`Unknown namespace "${namespace}" for variable "${erpVariable}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Preview Generation
// ============================================================================

export async function generateBlankPreview(
  docxBuffer: Buffer
): Promise<BlankDetectionResult & { textContent: string }> {
  const result = detectBlanksInDocx(docxBuffer);

  const zip = new PizZip(docxBuffer);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  const textContent = documentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return { ...result, textContent };
}

export async function generateBlankPreviewFromStream(
  stream: Readable
): Promise<BlankDetectionResult & { textContent: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return generateBlankPreview(Buffer.concat(chunks));
}
