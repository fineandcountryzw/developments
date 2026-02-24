/**
 * API Response Caching Utility
 * 
 * Provides in-memory caching for API responses to reduce redundant requests.
 * Automatically expires entries after TTL.
 * 
 * Usage:
 * import { cachedFetch } from '@/lib/api-cache';
 * const data = await cachedFetch('/api/admin/developments', {}, 5 * 60 * 1000);
 */

import { logger } from './logger';
import { retry } from './retry';

interface CacheEntry<T> {
  data: T;
  expires: number;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      logger.debug('Cache entry expired', { key });
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      timestamp: Date.now(),
    });
    logger.debug('Cache entry stored', { key, ttl });
  }

  /**
   * Clear cache entries matching pattern, or all if no pattern
   */
  clear(pattern?: string): void {
    if (pattern) {
      let cleared = 0;
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          cleared++;
        }
      }
      logger.debug('Cache cleared by pattern', { pattern, cleared });
    } else {
      const size = this.cache.size;
      this.cache.clear();
      logger.debug('Cache cleared', { size });
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const apiCache = new APICache();

/**
 * Fetch with caching support
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 * @returns Cached or fresh data
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  ttl: number = 5 * 60 * 1000
): Promise<T> {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`;
  
  // Check cache
  const cached = apiCache.get<T>(cacheKey);
  if (cached) {
    logger.debug('Cache hit', { url, cacheKey });
    return cached;
  }
  
  // Fetch from API with retry logic
  logger.debug('Cache miss, fetching', { url });
  
  const data = await retry(
    async () => {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error: any = new Error(`API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      const json = await response.json();
      
      // Cache successful responses only
      if (response.status === 200) {
        apiCache.set(cacheKey, json, ttl);
      }
      
      return json;
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
  );
  
  return data;
}
