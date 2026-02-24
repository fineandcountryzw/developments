/**
 * Optimized Automation Engine
 * 
 * Improvements:
 * - Automation rule caching (5 min TTL)
 * - Batch event processing
 * - Reduced database queries
 * - Parallel automation processing
 * 
 * @module lib/automation/engine-optimized
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AutomationEvent } from './event-emitter';
import { evaluateCondition } from './rule-engine';
import { executeAction, AutomationAction } from './action-executor';
import { automationQueue } from './queue';

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATION RULE CACHE
// ─────────────────────────────────────────────────────────────────────────────

interface CachedAutomation {
  id: string;
  name: string;
  condition: any;
  actions: AutomationAction[];
  retryPolicy: any;
  branch: string;
  expiresAt: number;
}

class AutomationCache {
  private cache = new Map<string, CachedAutomation[]>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  getKey(eventType: string, entityType: string, branch?: string): string {
    return `${eventType}:${entityType}:${branch || 'all'}`;
  }

  get(eventType: string, entityType: string, branch?: string): CachedAutomation[] | null {
    const key = this.getKey(eventType, entityType, branch);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    const now = Date.now();
    const valid = cached.filter(a => a.expiresAt > now);
    
    if (valid.length === 0) {
      this.cache.delete(key);
      return null;
    }
    
    // Remove expired entries
    if (valid.length < cached.length) {
      this.cache.set(key, valid);
    }
    
    return valid;
  }

  set(eventType: string, entityType: string, automations: any[], branch?: string): void {
    const key = this.getKey(eventType, entityType, branch);
    const now = Date.now();
    
    const cached: CachedAutomation[] = automations.map(a => ({
      id: a.id,
      name: a.name,
      condition: a.condition,
      actions: a.actions,
      retryPolicy: a.retryPolicy,
      branch: a.branch,
      expiresAt: now + this.TTL
    }));
    
    this.cache.set(key, cached);
  }

  invalidate(eventType?: string, entityType?: string, branch?: string): void {
    if (eventType && entityType) {
      // Invalidate specific key
      const key = this.getKey(eventType, entityType, branch);
      this.cache.delete(key);
    } else {
      // Invalidate all
      this.cache.clear();
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const automationCache = new AutomationCache();

// ─────────────────────────────────────────────────────────────────────────────
// EVENT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process an automation event (optimized)
 * 
 * Uses caching to reduce database queries
 */
export async function processEvent(event: AutomationEvent): Promise<void> {
  const startTime = Date.now();
  
  logger.info('[AUTOMATION] Processing event', {
    module: 'AutomationEngine',
    eventId: event.id,
    eventType: event.type,
    entityType: event.entityType
  });
  
  try {
    // Check cache first
    let automations = automationCache.get(event.type, event.entityType, event.branch);
    
    if (!automations) {
      // Cache miss - fetch from database
      const dbAutomations = await prisma.automation.findMany({
        where: {
          enabled: true,
          triggerType: 'event',
          eventType: event.type,
          entityType: event.entityType,
          ...(event.branch && { branch: event.branch })
        },
        select: {
          id: true,
          name: true,
          condition: true,
          actions: true,
          retryPolicy: true,
          branch: true
        }
      });
      
      // Cache for future requests
      automationCache.set(event.type, event.entityType, dbAutomations, event.branch);
      automations = automationCache.get(event.type, event.entityType, event.branch) || [];
      
      logger.debug('[AUTOMATION] Cache miss - fetched automations', {
        module: 'AutomationEngine',
        eventType: event.type,
        count: automations.length
      });
    } else {
      logger.debug('[AUTOMATION] Cache hit', {
        module: 'AutomationEngine',
        eventType: event.type,
        count: automations.length
      });
    }
    
    if (automations.length === 0) {
      logger.debug('[AUTOMATION] No matching automations', {
        module: 'AutomationEngine',
        eventType: event.type
      });
      return;
    }
    
    // Batch update event log (if event ID exists)
    if (event.id) {
      // Update event log with triggered automations (non-blocking)
      prisma.automationEventLog.updateMany({
        where: {
          eventType: event.type,
          entityId: event.entityId,
          timestamp: event.timestamp
        },
        data: {
          triggeredAutomations: automations.map(a => a.id)
        }
      }).catch(() => {
        // Ignore if event log doesn't exist
      });
    }
    
    // Process automations in parallel (with concurrency limit)
    const concurrencyLimit = 5;
    const chunks = [];
    
    for (let i = 0; i < automations.length; i += concurrencyLimit) {
      chunks.push(automations.slice(i, i + concurrencyLimit));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(automation => 
        processAutomation(automation, event).catch(error => {
          logger.error('[AUTOMATION] Failed to process automation', {
            module: 'AutomationEngine',
            automationId: automation.id,
            error: error.message
          });
        })
      ));
    }
    
    const duration = Date.now() - startTime;
    logger.info('[AUTOMATION] Event processing complete', {
      module: 'AutomationEngine',
      eventId: event.id,
      durationMs: duration,
      automationCount: automations.length
    });
    
  } catch (error: any) {
    logger.error('[AUTOMATION] Event processing error', {
      module: 'AutomationEngine',
      eventId: event.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Process a single automation for an event (optimized)
 */
async function processAutomation(
  automation: CachedAutomation,
  event: AutomationEvent
): Promise<void> {
  // Evaluate condition
  const conditionMet = evaluateCondition(automation.condition, event);
  
  if (!conditionMet) {
    logger.debug('[AUTOMATION] Condition not met', {
      module: 'AutomationEngine',
      automationId: automation.id
    });
    return;
  }
  
  logger.info('[AUTOMATION] Condition met, executing actions', {
    module: 'AutomationEngine',
    automationId: automation.id,
    actionCount: Array.isArray(automation.actions) ? automation.actions.length : 0
  });
  
  // Execute actions
  const actions = automation.actions;
  if (!Array.isArray(actions) || actions.length === 0) {
    logger.warn('[AUTOMATION] No actions defined', {
      module: 'AutomationEngine',
      automationId: automation.id
    });
    return;
  }
  
  // Queue all actions (batch operation)
  const jobs = actions.map((action, index) => ({
    id: `job-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
    automationId: automation.id,
    event,
    action,
    idempotencyKey: `${automation.id}-${event.entityId}-${action.type}-${action.target}`,
    retryCount: 0,
    maxRetries: automation.retryPolicy?.maxRetries || 3,
    status: 'pending' as const,
    scheduledAt: action.delay 
      ? new Date(Date.now() + action.delay * 1000)
      : undefined,
    createdAt: new Date()
  }));
  
  // Add all jobs to queue (batch)
  await Promise.all(jobs.map(job => automationQueue.add(job).catch(error => {
    logger.error('[AUTOMATION] Failed to queue action', {
      module: 'AutomationEngine',
      automationId: automation.id,
      actionType: job.action.type,
      error: error.message
    });
  })));
  
  // Update automation stats (non-blocking)
  prisma.automation.update({
    where: { id: automation.id },
    data: {
      lastRunAt: new Date(),
      runCount: { increment: 1 }
    }
  }).catch(error => {
    logger.error('[AUTOMATION] Failed to update automation stats', {
      module: 'AutomationEngine',
      automationId: automation.id,
      error: error.message
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate automation cache
 * 
 * Call this when automations are created/updated/deleted
 */
export function invalidateAutomationCache(
  eventType?: string,
  entityType?: string,
  branch?: string
): void {
  automationCache.invalidate(eventType, entityType, branch);
  logger.debug('[AUTOMATION] Cache invalidated', {
    module: 'AutomationEngine',
    eventType,
    entityType,
    branch
  });
}

/**
 * Clear all automation caches
 */
export function clearAutomationCache(): void {
  automationCache.clear();
  logger.debug('[AUTOMATION] All caches cleared', {
    module: 'AutomationEngine'
  });
}
