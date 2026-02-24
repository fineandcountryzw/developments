/**
 * API Rate Limiting Utility
 * 
 * Prevents API abuse by limiting requests per identifier (IP, user ID, etc.)
 * Uses in-memory storage with TTL-based expiration.
 * 
 * @module lib/rate-limit
 * 
 * @example
 * ```typescript
 * import { checkRateLimit } from '@/lib/rate-limit';
 * 
 * if (!checkRateLimit(userId, 10)) {
 *   return apiError('Rate limit exceeded', 429, 'RATE_LIMIT');
 * }
 * ```
 */

import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is within rate limit
   * 
   * @param identifier - Unique identifier (IP address, userId, etc.)
   * @param limit - Maximum requests allowed in the time window (default: 10)
   * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns true if within limit, false if exceeded
   */
  check(identifier: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || entry.resetAt < now) {
      // Create new entry or reset expired entry
      this.store.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (entry.count >= limit) {
      logger.warn('Rate limit exceeded', {
        module: 'rate-limit',
        identifier,
        count: entry.count,
        limit,
        resetAt: new Date(entry.resetAt).toISOString(),
      });
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Get current rate limit status for identifier
   */
  getStatus(identifier: string): { count: number; limit: number; resetAt: number } | null {
    const entry = this.store.get(identifier);
    if (!entry || entry.resetAt < Date.now()) {
      return null;
    }
    return {
      count: entry.count,
      limit: 10, // Default limit
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limit cleanup', {
        module: 'rate-limit',
        cleaned,
        remaining: this.store.size,
      });
    }
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      activeEntries: this.store.size,
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({
        identifier: key,
        count: entry.count,
        resetAt: new Date(entry.resetAt).toISOString(),
      })),
    };
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Check rate limit for API route
 * 
 * @param identifier - Unique identifier (IP address, userId, etc.)
 * @param limit - Maximum requests allowed in the time window (default: 10)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns true if within limit, false if exceeded
 * 
 * @example
 * ```typescript
 * // In API route
 * const identifier = request.headers.get('x-forwarded-for') || 'unknown';
 * if (!checkRateLimit(identifier, 20, 60000)) {
 *   return apiError('Too many requests', 429, 'RATE_LIMIT');
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): boolean {
  return rateLimiter.check(identifier, limit, windowMs);
}

/**
 * Get rate limit status for identifier
 */
export function getRateLimitStatus(identifier: string) {
  return rateLimiter.getStatus(identifier);
}

/**
 * Reset rate limit for identifier
 */
export function resetRateLimit(identifier: string): void {
  rateLimiter.reset(identifier);
}
