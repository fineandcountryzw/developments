/**
 * Input Sanitization & Validation Utilities
 * 
 * Provides comprehensive validation and sanitization for user inputs
 * to ensure data integrity and security across the application.
 * 
 * Usage:
 * const sanitized = sanitizeInput(userInput);
 * if (!isValidEmail(email)) { throw new Error('Invalid email'); }
 */

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize user input to prevent XSS attacks
 * Removes potentially dangerous characters and HTML
 */
export function sanitizeInput(input: string, options: { allowHtml?: boolean } = {}): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input.trim();

  if (!options.allowHtml) {
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Decode HTML entities to prevent double-encoding
  sanitized = decodeHTMLEntities(sanitized);

  return sanitized;
}

/**
 * Decode HTML entities safely
 */
function decodeHTMLEntities(text: string): string {
  const map: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };
  return text.replace(/&[^;]+;/g, (entity) => map[entity] || entity);
}

/**
 * Sanitize filename to prevent directory traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  return filename
    .replace(/[/\\]/g, '_') // Remove path separators
    .replace(/[<>:"|?*]/g, '_') // Remove invalid characters
    .replace(/\.{2,}/g, '.') // Remove multiple dots
    .substring(0, 255); // Max filename length
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return url;
    }
  } catch (e) {
    // Invalid URL, return empty
  }
  return '';
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(jsonString: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(jsonString);
    // Re-stringify and parse to ensure it's clean JSON
    return JSON.parse(JSON.stringify(parsed));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number (international format support)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
  const cleaned = phone.replace(/\s/g, '');
  return phoneRegex.test(phone) && cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate numeric input with bounds
 */
export function isValidNumber(
  value: string | number,
  options: { min?: number; max?: number; decimals?: number } = {}
): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return false;
  if (options.min !== undefined && num < options.min) return false;
  if (options.max !== undefined && num > options.max) return false;

  if (options.decimals !== undefined) {
    const decimalPlaces = (num.toString().split('.')[1] || '').length;
    if (decimalPlaces > options.decimals) return false;
  }

  return true;
}

/**
 * Validate integer input
 */
export function isValidInteger(value: string | number, options: { min?: number; max?: number } = {}): boolean {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (!Number.isInteger(num)) return false;
  if (options.min !== undefined && num < options.min) return false;
  if (options.max !== undefined && num > options.max) return false;

  return true;
}

/**
 * Validate string length
 */
export function isValidLength(
  value: string,
  options: { min?: number; max?: number } = {}
): boolean {
  if (!value || typeof value !== 'string') return false;

  const length = value.trim().length;
  if (options.min !== undefined && length < options.min) return false;
  if (options.max !== undefined && length > options.max) return false;

  return true;
}

/**
 * Validate date (supports YYYY-MM-DD format)
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate currency amount
 */
export function isValidCurrency(value: string | number, options: { min?: number; max?: number } = {}): boolean {
  return isValidNumber(value, {
    min: options.min ?? 0,
    max: options.max ?? 999999999.99,
    decimals: 2,
  });
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: string | number): boolean {
  return isValidNumber(value, { min: 0, max: 100, decimals: 2 });
}

/**
 * Validate postal code (basic validation for multiple countries)
 */
export function isValidPostalCode(code: string, country: string = 'US'): boolean {
  const patterns: { [key: string]: RegExp } = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    ZA: /^\d{4}$/,
  };

  const pattern = patterns[country];
  return pattern ? pattern.test(code) : /^\d{3,10}$/.test(code);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate object with multiple fields
 */
export function validateObject(
  data: Record<string, any>,
  schema: Record<string, (value: any) => boolean | string>
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [field, validator] of Object.entries(schema)) {
    const value = data[field];
    const result = validator(value);

    if (result !== true) {
      errors[field] = typeof result === 'string' ? result : `${field} is invalid`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate reservation data
 */
export function validateReservationData(data: any): ValidationResult {
  const schema = {
    standNumber: (value: any) => isValidInteger(value, { min: 1 }) || 'Invalid stand number',
    clientEmail: (value: any) => isValidEmail(value) || 'Invalid email',
    price: (value: any) => isValidCurrency(value, { min: 1000 }) || 'Invalid price',
    developmentId: (value: any) => isValidLength(value, { min: 1 }) || 'Development required',
  };

  return validateObject(data, schema);
}

/**
 * Validate payment data
 */
export function validatePaymentData(data: any): ValidationResult {
  const schema = {
    amount: (value: any) => isValidCurrency(value, { min: 1 }) || 'Invalid amount',
    currency: (value: any) => /^[A-Z]{3}$/.test(value) || 'Invalid currency code',
    reference: (value: any) => isValidLength(value, { min: 3, max: 50 }) || 'Invalid reference',
  };

  return validateObject(data, schema);
}

/**
 * Validate contract template data
 */
export function validateContractTemplate(data: any): ValidationResult {
  const schema = {
    name: (value: any) => isValidLength(value, { min: 3, max: 200 }) || 'Invalid template name',
    content: (value: any) => isValidLength(value, { min: 50 }) || 'Template content too short',
    variables: (value: any) => Array.isArray(value) || 'Variables must be an array',
  };

  return validateObject(data, schema);
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an array of items with schema
 */
export function validateBatch(
  items: any[],
  schema: Record<string, (value: any) => boolean | string>
): Array<ValidationResult & { item: any; index: number }> {
  return items.map((item, index) => ({
    ...validateObject(item, schema),
    item,
    index,
  }));
}

/**
 * Get validation errors from batch
 */
export function getBatchErrors(batchResults: Array<ValidationResult & { index: number }>): Record<number, Record<string, string>> {
  const errors: Record<number, Record<string, string>> = {};

  batchResults.forEach((result) => {
    if (!result.isValid) {
      errors[result.index] = result.errors;
    }
  });

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE COERCION & NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize phone number to standard format
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Normalize currency to number
 */
export function normalizeCurrency(value: string): number {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Normalize date to ISO string
 */
export function normalizeDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Normalize whitespace
 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
