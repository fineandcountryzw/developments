/**
 * Request Deduplication Utility
 * 
 * Prevents duplicate API calls when multiple components request the same data simultaneously.
 * 
 * Usage:
 * import { dedupeFetch } from '@/lib/request-dedup';
 * const data = await dedupeFetch('/api/admin/developments');
 */

import { logger } from './logger';
import { retry } from './retry';

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Fetch with request deduplication
 * 
 * If the same request is made while another is in flight, returns the existing promise
 * instead of making a new request.
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Promise resolving to response data
 */
export async function dedupeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const key = `${url}:${JSON.stringify(options || {})}`;
  
  // Return existing promise if request is in flight
  if (pendingRequests.has(key)) {
    logger.debug('Deduplicating request', { url, key });
    return pendingRequests.get(key)!;
  }
  
  // Create new request with retry logic
  const promise = retry(
    async () => {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error: any = new Error(`HTTP ${res.status}: ${res.statusText}`);
        error.status = res.status;
        error.response = res;
        throw error;
      }
      return res.json();
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        // Don't retry on client errors (4xx except 429)
        if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
          return false;
        }
        // Retry on server errors (5xx) and network errors
        return true;
      }
    }
  )
    .finally(() => {
      // Clean up after request completes
      pendingRequests.delete(key);
    });
  
  pendingRequests.set(key, promise);
  return promise;
}
