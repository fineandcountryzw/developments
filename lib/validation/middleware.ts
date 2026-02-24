/**
 * Validation Middleware for API Routes
 * 
 * Provides reusable validation middleware that integrates with apiError
 * for consistent error responses.
 * 
 * @module lib/validation/middleware
 */

import { z, ZodError } from 'zod';
import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ReturnType<typeof apiError> };

/**
 * Validate request body against Zod schema
 * 
 * @template T - Type of the schema
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @param options - Optional configuration
 * @returns Validation result with parsed data or error response
 * 
 * @example
 * ```typescript
 * const result = await validateRequest(request, reservationSchema);
 * if (!result.success) return result.error;
 * const data = result.data; // Type-safe validated data
 * ```
 */
export async function validateRequest<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  options?: {
    module?: string;
    action?: string;
  }
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      logger.warn('Validation failed', {
        module: options?.module || 'API',
        action: options?.action || 'VALIDATE',
        errors: errors.map(e => e.path)
      });

      return {
        success: false,
        error: apiError(
          'Validation failed',
          400,
          ErrorCodes.VALIDATION_ERROR,
          { validationErrors: errors }
        )
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error: any) {
    // JSON parse error
    if (error instanceof SyntaxError || error.message?.includes('JSON')) {
      logger.warn('Invalid JSON in request body', {
        module: options?.module || 'API',
        action: options?.action || 'VALIDATE'
      });
      return {
        success: false,
        error: apiError(
          'Invalid JSON in request body',
          400,
          ErrorCodes.PARSE_ERROR
        )
      };
    }

    logger.error('Validation error', error, {
      module: options?.module || 'API',
      action: options?.action || 'VALIDATE'
    });

    return {
      success: false,
      error: apiError(
        'Failed to validate request',
        400,
        ErrorCodes.VALIDATION_ERROR
      )
    };
  }
}

/**
 * Format Zod errors into a readable structure
 */
function formatZodErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message
  }));
}

/**
 * Validate partial data (for PUT/PATCH requests)
 * 
 * @template T - Type of the schema
 * @param data - Data to validate
 * @param schema - Zod schema (will be made partial)
 * @returns Validation result
 */
export function validatePartial<T extends z.ZodObject<z.ZodRawShape>>(
  data: unknown,
  schema: T
): ValidationResult<Partial<z.infer<T>>> {
  const partialSchema = schema.partial();
  const result = partialSchema.safeParse(data);

  if (!result.success) {
    const errors = formatZodErrors(result.error);
    return {
      success: false,
      error: apiError(
        'Validation failed',
        400,
        ErrorCodes.VALIDATION_ERROR,
        { validationErrors: errors }
      )
    };
  }

  return {
    success: true,
    data: result.data
  };
}
