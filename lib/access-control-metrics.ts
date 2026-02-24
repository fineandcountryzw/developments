/**
 * Access Control Performance Metrics
 * 
 * Tracks cache hit rates, query reduction, and performance improvements.
 * 
 * @module lib/access-control-metrics
 */

import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────────────────
// METRICS TRACKING
// ─────────────────────────────────────────────────────────────────────────────

interface CacheMetrics {
  hits: number;
  misses: number;
  total: number;
}

interface QueryMetrics {
  before: number; // Queries before optimization
  after: number; // Queries after optimization
  saved: number; // Queries saved
}

interface PerformanceMetrics {
  avgTimeBefore: number; // ms
  avgTimeAfter: number; // ms
  improvement: number; // percentage
}

class AccessControlMetrics {
  private sessionCacheMetrics: CacheMetrics = { hits: 0, misses: 0, total: 0 };
  private permissionCacheMetrics: CacheMetrics = { hits: 0, misses: 0, total: 0 };
  private queryMetrics: QueryMetrics = { before: 0, after: 0, saved: 0 };
  private performanceMetrics: PerformanceMetrics = { avgTimeBefore: 0, avgTimeAfter: 0, improvement: 0 };
  private requestCount = 0;
  private totalTimeBefore = 0;
  private totalTimeAfter = 0;

  /**
   * Record session cache hit
   */
  recordSessionCacheHit(): void {
    this.sessionCacheMetrics.hits++;
    this.sessionCacheMetrics.total++;
  }

  /**
   * Record session cache miss
   */
  recordSessionCacheMiss(): void {
    this.sessionCacheMetrics.misses++;
    this.sessionCacheMetrics.total++;
  }

  /**
   * Record permission cache hit
   */
  recordPermissionCacheHit(): void {
    this.permissionCacheMetrics.hits++;
    this.permissionCacheMetrics.total++;
  }

  /**
   * Record permission cache miss
   */
  recordPermissionCacheMiss(): void {
    this.permissionCacheMetrics.misses++;
    this.permissionCacheMetrics.total++;
  }

  /**
   * Record query reduction
   */
  recordQueryReduction(before: number, after: number): void {
    this.queryMetrics.before += before;
    this.queryMetrics.after += after;
    this.queryMetrics.saved += (before - after);
  }

  /**
   * Record performance improvement
   */
  recordPerformance(timeBefore: number, timeAfter: number): void {
    this.requestCount++;
    this.totalTimeBefore += timeBefore;
    this.totalTimeAfter += timeAfter;

    this.performanceMetrics.avgTimeBefore = this.totalTimeBefore / this.requestCount;
    this.performanceMetrics.avgTimeAfter = this.totalTimeAfter / this.requestCount;
    this.performanceMetrics.improvement = 
      ((this.performanceMetrics.avgTimeBefore - this.performanceMetrics.avgTimeAfter) / 
       this.performanceMetrics.avgTimeBefore) * 100;
  }

  /**
   * Get session cache hit rate
   */
  getSessionCacheHitRate(): number {
    if (this.sessionCacheMetrics.total === 0) return 0;
    return (this.sessionCacheMetrics.hits / this.sessionCacheMetrics.total) * 100;
  }

  /**
   * Get permission cache hit rate
   */
  getPermissionCacheHitRate(): number {
    if (this.permissionCacheMetrics.total === 0) return 0;
    return (this.permissionCacheMetrics.hits / this.permissionCacheMetrics.total) * 100;
  }

  /**
   * Get query reduction percentage
   */
  getQueryReduction(): number {
    if (this.queryMetrics.before === 0) return 0;
    return (this.queryMetrics.saved / this.queryMetrics.before) * 100;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      sessionCache: {
        ...this.sessionCacheMetrics,
        hitRate: this.getSessionCacheHitRate()
      },
      permissionCache: {
        ...this.permissionCacheMetrics,
        hitRate: this.getPermissionCacheHitRate()
      },
      queries: {
        ...this.queryMetrics,
        reduction: this.getQueryReduction()
      },
      performance: {
        ...this.performanceMetrics,
        requestCount: this.requestCount
      }
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.sessionCacheMetrics = { hits: 0, misses: 0, total: 0 };
    this.permissionCacheMetrics = { hits: 0, misses: 0, total: 0 };
    this.queryMetrics = { before: 0, after: 0, saved: 0 };
    this.performanceMetrics = { avgTimeBefore: 0, avgTimeAfter: 0, improvement: 0 };
    this.requestCount = 0;
    this.totalTimeBefore = 0;
    this.totalTimeAfter = 0;
  }

  /**
   * Log metrics summary
   */
  logSummary(): void {
    const metrics = this.getMetrics();
    
    logger.info('[ACCESS_CONTROL] Performance Metrics', {
      module: 'AccessControlMetrics',
      sessionCache: {
        hitRate: `${metrics.sessionCache.hitRate.toFixed(2)}%`,
        hits: metrics.sessionCache.hits,
        misses: metrics.sessionCache.misses,
        total: metrics.sessionCache.total
      },
      permissionCache: {
        hitRate: `${metrics.permissionCache.hitRate.toFixed(2)}%`,
        hits: metrics.permissionCache.hits,
        misses: metrics.permissionCache.misses,
        total: metrics.permissionCache.total
      },
      queries: {
        reduction: `${metrics.queries.reduction.toFixed(2)}%`,
        saved: metrics.queries.saved,
        before: metrics.queries.before,
        after: metrics.queries.after
      },
      performance: {
        improvement: `${metrics.performance.improvement.toFixed(2)}%`,
        avgTimeBefore: `${metrics.performance.avgTimeBefore.toFixed(2)}ms`,
        avgTimeAfter: `${metrics.performance.avgTimeAfter.toFixed(2)}ms`,
        requests: metrics.performance.requestCount
      }
    });
  }
}

export const accessControlMetrics = new AccessControlMetrics();

// Log metrics summary every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    accessControlMetrics.logSummary();
  }, 5 * 60 * 1000);
}
