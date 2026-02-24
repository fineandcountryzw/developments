/**
 * Standardized API Response Helpers
 * 
 * Provides consistent response formats for all API routes.
 * 
 * @module lib/api-response
 * 
 * @example
 * ```typescript
 * import { apiSuccess, apiError } from '@/lib/api-response';
 * return apiSuccess(data, 200, pagination);
 * return apiError('Not found', 404, 'NOT_FOUND');
 * ```
 */

import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  pagination?: {
    page?: number;
    limit?: number;
    total: number;
    pages?: number;
    totalPages?: number;
    hasMore?: boolean;
    hasNext?: boolean;
    hasPrev?: boolean;
    [key: string]: unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
  details?: any;
}

/**
 * Create a successful API response
 * 
 * @template T - Type of the response data
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param pagination - Optional pagination metadata
 * @returns NextResponse with standardized success format
 * 
 * @example
 * ```typescript
 * return apiSuccess({ users: [...] }, 200, { page: 1, limit: 50, total: 100, pages: 2 });
 * ```
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  pagination?: {
    page?: number;
    limit?: number;
    total: number;
    pages?: number;
    totalPages?: number;
    hasMore?: boolean;
    hasNext?: boolean;
    hasPrev?: boolean;
    [key: string]: unknown;
  }
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(pagination && { pagination }),
    },
    { status }
  );
}

/**
 * Create an error API response
 * 
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @param code - Error code for programmatic handling (default: ERROR_{status})
 * @param details - Optional additional error details
 * @returns NextResponse with standardized error format
 * 
 * @example
 * ```typescript
 * return apiError('User not found', 404, 'NOT_FOUND');
 * return apiError('Validation failed', 400, 'VALIDATION_ERROR', { field: 'email' });
 * ```
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || `ERROR_${status}`,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
    { status }
  );
}
