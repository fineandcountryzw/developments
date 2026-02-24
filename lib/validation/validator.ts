/**
 * Validation Helper Functions for Fine & Country Zimbabwe ERP
 * 
 * Provides utilities for validating API requests using Zod schemas.
 * Returns consistent error responses for validation failures.
 */

import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: NextResponse };

/**
 * Validate request data against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate (usually from request.json())
 * @returns Validation result with either data or error response
 * 
 * @example
 * ```typescript
 * const validation = validateRequest(developmentSchema, rawData);
 * if (!validation.success) {
 *   return validation.error;
 * }
 * const data = validation.data;
 * ```
 */
export function validateRequest<T>(
  schema: any,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    logger.debug('Request validated successfully', { schema: schema.constructor.name });
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      logger.warn('Request validation failed', {
        errors,
        data: typeof data === 'object' && data !== null ? Object.keys(data) : typeof data,
      });

      return {
        success: false,
        error: apiError(
          `Validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          400,
          'VALIDATION_ERROR',
          errors
        ),
      };
    }

    logger.error('Unexpected validation error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return {
      success: false,
      error: apiError('Invalid request data', 400, 'INVALID_DATA'),
    };
  }
}

/**
 * Validate query parameters
 * 
 * @param schema - Zod schema to validate against
 * @param searchParams - URLSearchParams from request
 * @returns Validation result with either data or error response
 */
export function validateQuery<T>(
  schema: any,
  searchParams: URLSearchParams
): ValidationResult<T> {
  const params: Record<string, string> = {};
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return validateRequest<T>(schema, params);
}

/**
 * Validate path parameters
 * 
 * @param schema - Zod schema to validate against
 * @param params - Object containing path parameters
 * @returns Validation result with either data or error response
 */
export function validateParams<T>(
  schema: any,
  params: Record<string, string | string[]>
): ValidationResult<T> {
  return validateRequest<T>(schema, params);
}

/**
 * Sanitize string input
 * Removes potentially dangerous characters
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Sanitize HTML input
 * Uses DOMPurify if available, otherwise basic sanitization
 * 
 * @param input - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
  try {
    // Try to use DOMPurify if available
    const DOMPurify = require('isomorphic-dompurify');
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  } catch {
    // Fallback to basic sanitization
    return sanitizeString(input);
  }
}

/**
 * Validate email format
 * 
 * @param email - Email address to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * 
 * @param phone - Phone number to validate
 * @returns True if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate national ID format
 * 
 * @param nationalId - National ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidNationalId(nationalId: string): boolean {
  // Basic validation - adjust based on country requirements
  return nationalId.length >= 5 && nationalId.length <= 50;
}

/**
 * Validate monetary amount
 * 
 * @param amount - Amount to validate
 * @param max - Maximum allowed amount (default: 999999999.99)
 * @returns True if valid, false otherwise
 */
export function isValidAmount(amount: number, max: number = 999999999.99): boolean {
  return !isNaN(amount) && amount > 0 && amount <= max;
}

/**
 * Validate date string
 * 
 * @param dateStr - Date string to validate
 * @returns True if valid ISO date string, false otherwise
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString() === dateStr;
}

/**
 * Validate pagination parameters
 * 
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validation result with pagination data or error
 */
export function validatePagination(page?: string, limit?: string): ValidationResult<{
  page: number;
  limit: number;
}> {
  const pageNum = page ? parseInt(page, 10) : 1;
  const limitNum = limit ? parseInt(limit, 10) : 20;

  if (isNaN(pageNum) || pageNum < 1) {
    return {
      success: false,
      error: apiError('Invalid page number', 400, 'INVALID_PAGINATION'),
    };
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return {
      success: false,
      error: apiError('Invalid limit (must be 1-100)', 400, 'INVALID_PAGINATION'),
    };
  }

  return {
    success: true,
    data: { page: pageNum, limit: limitNum },
  };
}

/**
 * Validate sort parameters
 * 
 * @param sort - Sort field
 * @param order - Sort order (asc/desc)
 * @returns Validation result with sort data or error
 */
export function validateSort(sort?: string, order?: string): ValidationResult<{
  sort: string | undefined;
  order: 'asc' | 'desc';
}> {
  const validOrders = ['asc', 'desc'] as const;
  
  if (order && !validOrders.includes(order as any)) {
    return {
      success: false,
      error: apiError('Invalid order (must be asc or desc)', 400, 'INVALID_SORT'),
    };
  }

  return {
    success: true,
    data: {
      sort: sort,
      order: (order as 'asc' | 'desc') || 'desc',
    },
  };
}

/**
 * Validate file upload
 * 
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes (default: 10MB)
 * @param allowedTypes - Allowed MIME types
 * @returns Validation result with file data or error
 */
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
): ValidationResult<{ file: File }> {
  if (!file) {
    return {
      success: false,
      error: apiError('No file provided', 400, 'NO_FILE'),
    };
  }

  if (file.size > maxSize) {
    return {
      success: false,
      error: apiError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 400, 'FILE_TOO_LARGE'),
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: apiError(`Invalid file type (allowed: ${allowedTypes.join(', ')})`, 400, 'INVALID_FILE_TYPE'),
    };
  }

  return {
    success: true,
    data: { file },
  };
}

/**
 * Validate ID parameter
 * 
 * @param id - ID string to validate
 * @param paramName - Parameter name for error messages
 * @returns Validation result with ID or error
 */
export function validateId(id: string, paramName: string = 'ID'): ValidationResult<{ id: string }> {
  if (!id || typeof id !== 'string') {
    return {
      success: false,
      error: apiError(`${paramName} is required`, 400, 'MISSING_ID'),
    };
  }

  // Basic CUID validation (25 characters, alphanumeric)
  const cuidRegex = /^[a-z0-9]{25}$/;
  if (!cuidRegex.test(id)) {
    return {
      success: false,
      error: apiError(`Invalid ${paramName} format`, 400, 'INVALID_ID'),
    };
  }

  return {
    success: true,
    data: { id },
  };
}

/**
 * Validate branch parameter
 * 
 * @param branch - Branch name to validate
 * @returns Validation result with branch or error
 */
export function validateBranch(branch?: string): ValidationResult<{ branch: string }> {
  const validBranches = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo'];
  
  if (!branch) {
    return {
      success: true,
      data: { branch: 'Harare' }, // Default branch
    };
  }

  if (!validBranches.includes(branch)) {
    return {
      success: false,
      error: apiError(`Invalid branch (allowed: ${validBranches.join(', ')})`, 400, 'INVALID_BRANCH'),
    };
  }

  return {
    success: true,
    data: { branch },
  };
}

/**
 * Validate status parameter
 * 
 * @param status - Status to validate
 * @param validStatuses - Array of valid status values
 * @param paramName - Parameter name for error messages
 * @returns Validation result with status or error
 */
export function validateStatus(
  status: string,
  validStatuses: string[],
  paramName: string = 'status'
): ValidationResult<{ status: string }> {
  if (!status || !validStatuses.includes(status)) {
    return {
      success: false,
      error: apiError(`Invalid ${paramName} (allowed: ${validStatuses.join(', ')})`, 400, 'INVALID_STATUS'),
    };
  }

  return {
    success: true,
    data: { status },
  };
}

export default {
  validateRequest,
  validateQuery,
  validateParams,
  sanitizeString,
  sanitizeHtml,
  isValidEmail,
  isValidPhone,
  isValidNationalId,
  isValidAmount,
  isValidDate,
  validatePagination,
  validateSort,
  validateFile,
  validateId,
  validateBranch,
  validateStatus,
};
