/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides retry logic for API calls and other async operations
 * with configurable retry attempts, delays, and error handling.
 * 
 * @module lib/retry
 */

import { logger } from './logger';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error should be retried (default: retries on network/server errors) */
  shouldRetry?: (error: any) => boolean;
  /** Custom delay function (optional) */
  delayFn?: (attempt: number, initialDelay: number) => number;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'delayFn'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Default function to determine if error should be retried
 * Retries on network errors and server errors (5xx), but not client errors (4xx)
 */
function defaultShouldRetry(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // HTTP errors
  if (error?.status) {
    const status = error.status;
    // Retry on server errors (5xx) and rate limits (429)
    if (status >= 500 || status === 429) {
      return true;
    }
    // Don't retry on client errors (4xx except 429)
    if (status >= 400 && status < 500) {
      return false;
    }
  }
  
  // Response errors
  if (error?.response?.status) {
    const status = error.response.status;
    if (status >= 500 || status === 429) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
  }
  
  // Default: retry on unknown errors (might be transient)
  return true;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 * 
 * @template T - Return type of the function
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the result of the function
 * @throws The last error if all retries fail
 * 
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    shouldRetry = defaultShouldRetry,
    delayFn,
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Log success if retried
      if (attempt > 0) {
        logger.info('Retry succeeded', {
          module: 'retry',
          attempt: attempt + 1,
          totalAttempts: attempt + 1
        });
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        logger.debug('Error not retryable', {
          module: 'retry',
          error: error.message,
          status: error?.status || error?.response?.status
        });
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        logger.error('Max retries exceeded', error, {
          module: 'retry',
          attempts: attempt + 1,
          maxRetries: maxRetries + 1
        });
        break;
      }
      
      // Calculate delay
      const delay = delayFn
        ? delayFn(attempt, initialDelay)
        : calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
      
      logger.warn('Retrying after error', {
        module: 'retry',
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        error: error.message || error
      });
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Retry a fetch call with exponential backoff
 * 
 * @param url - The URL to fetch
 * @param init - Fetch options (method, headers, body, etc.)
 * @param options - Retry configuration options
 * @returns Promise resolving to the fetch Response
 * @throws Error if all retries fail or response is not ok
 * 
 * @example
 * ```typescript
 * const response = await retryFetch(
 *   '/api/data',
 *   { method: 'GET' },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, init);
      
      // Throw error for non-ok responses so retry logic can handle them
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      return response;
    },
    options
  );
}

/**
 * Retry a fetch call and parse JSON response
 * 
 * @template T - Type of the JSON response
 * @param url - The URL to fetch
 * @param init - Fetch options (method, headers, body, etc.)
 * @param options - Retry configuration options
 * @returns Promise resolving to the parsed JSON response
 * @throws Error if all retries fail, response is not ok, or JSON parsing fails
 * 
 * @example
 * ```typescript
 * const data = await retryFetchJson<{ users: User[] }>(
 *   '/api/users',
 *   { method: 'GET' }
 * );
 * ```
 */
export async function retryFetchJson<T = any>(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<T> {
  const response = await retryFetch(url, init, options);
  return response.json() as Promise<T>;
}
