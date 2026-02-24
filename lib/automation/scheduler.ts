/**
 * Automation Scheduler
 * Processes scheduled automations (cron-based)
 * 
 * @module lib/automation/scheduler
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { emitEvent } from './event-emitter';

// Simple cron parser (avoid external dependency for now)
// Full implementation would use cron-parser library

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process scheduled automations
 * 
 * Finds all scheduled automations that should run now and emits events
 * 
 * @param cronExpression - Optional cron expression to filter (e.g., current time's cron)
 */
export async function processScheduledAutomations(cronExpression?: string): Promise<void> {
  const now = new Date();
  
  logger.info('[AUTOMATION] Processing scheduled automations', {
    module: 'Scheduler',
    timestamp: now.toISOString(),
    cronExpression
  });
  
  try {
    // Find all enabled scheduled automations
    const where: any = {
      enabled: true,
      triggerType: 'schedule'
    };
    
    // If cron expression provided, filter by it
    if (cronExpression) {
      where.schedule = cronExpression;
    }
    
    const automations = await prisma.automation.findMany({
      where
    });
    
    if (automations.length === 0) {
      logger.debug('[AUTOMATION] No scheduled automations found', {
        module: 'Scheduler',
        cronExpression
      });
      return;
    }
    
    logger.info('[AUTOMATION] Found scheduled automations', {
      module: 'Scheduler',
      count: automations.length,
      automationIds: automations.map(a => a.id)
    });
    
    // Process each automation
    for (const automation of automations) {
      try {
        // Validate cron expression
        if (!automation.schedule) {
          logger.warn('[AUTOMATION] Automation has no schedule', {
            module: 'Scheduler',
            automationId: automation.id
          });
          continue;
        }
        
        // Check if schedule matches current time
        if (cronExpression && automation.schedule !== cronExpression) {
          continue; // Not this automation's time
        }
        
        // If no cron expression provided, check if it's time to run
        if (!cronExpression) {
          const shouldRun = await shouldRunNow(automation.schedule, automation.lastRunAt);
          if (!shouldRun) {
            continue; // Not time to run yet
          }
        }
        
        // Find entities matching the automation's condition
        const entities = await findEntitiesForAutomation(automation);
        
        logger.info('[AUTOMATION] Found entities for scheduled automation', {
          module: 'Scheduler',
          automationId: automation.id,
          automationName: automation.name,
          entityCount: entities.length
        });
        
        // Emit events for each entity
        for (const entity of entities) {
          await emitEvent({
            type: `${automation.entityType}.scheduled`,
            entityType: automation.entityType,
            entityId: entity.id,
            payload: entity,
            branch: automation.branch
          });
        }
        
        // Update last run time
        await prisma.automation.update({
          where: { id: automation.id },
          data: { lastRunAt: now }
        });
        
      } catch (error: any) {
        logger.error('[AUTOMATION] Failed to process scheduled automation', {
          module: 'Scheduler',
          automationId: automation.id,
          error: error.message
        });
        // Continue with other automations
      }
    }
    
  } catch (error: any) {
    logger.error('[AUTOMATION] Scheduler error', {
      module: 'Scheduler',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Check if a cron schedule should run now
 * 
 * Simplified cron matching - checks if current time matches schedule
 * Format: "minute hour day month *" or "minute hour day,day month *"
 */
async function shouldRunNow(schedule: string, lastRunAt: Date | null): Promise<boolean> {
  try {
    const now = new Date();
    const parts = schedule.trim().split(/\s+/);
    
    if (parts.length < 5) {
      return false; // Invalid format
    }
    
    const [minute, hour, day, month] = parts;
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    
    // Check if we haven't run recently (within last minute)
    if (lastRunAt) {
      const timeSinceLastRun = now.getTime() - lastRunAt.getTime();
      if (timeSinceLastRun < 60000) {
        return false; // Just ran, don't run again
      }
    }
    
    // Match minute
    if (minute !== '*' && parseInt(minute) !== currentMinute) {
      return false;
    }
    
    // Match hour
    if (hour !== '*' && parseInt(hour) !== currentHour) {
      return false;
    }
    
    // Match day (supports comma-separated: "5,20")
    if (day !== '*') {
      const dayList = day.split(',').map(d => parseInt(d.trim()));
      if (!dayList.includes(currentDay)) {
        return false;
      }
    }
    
    // Match month
    if (month !== '*' && parseInt(month) !== currentMonth) {
      return false;
    }
    
    return true;
  } catch (error) {
    // Invalid cron expression
    logger.warn('[AUTOMATION] Invalid cron expression', {
      module: 'Scheduler',
      schedule,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Find entities matching automation condition
 */
async function findEntitiesForAutomation(automation: any): Promise<any[]> {
  const entityType = automation.entityType;
  const condition = automation.condition;
  
  // Map entity type to Prisma model
  const modelMap: Record<string, string> = {
    'invoice': 'invoice',
    'payment': 'payment',
    'deal': 'deal',
    'reservation': 'reservation',
    'stand': 'stand'
  };
  
  const modelName = modelMap[entityType];
  if (!modelName) {
    logger.warn('[AUTOMATION] Unknown entity type', {
      module: 'Scheduler',
      entityType,
      automationId: automation.id
    });
    return [];
  }
  
  // Build where clause from condition
  const where: any = {};
  
  if (condition) {
    // Simple condition mapping
    if (condition.field && condition.operator && condition.value !== undefined) {
      switch (condition.operator) {
        case 'equals':
          where[condition.field] = condition.value;
          break;
        case 'in':
          if (Array.isArray(condition.value)) {
            where[condition.field] = { in: condition.value };
          }
          break;
        case 'not_in':
          if (Array.isArray(condition.value)) {
            where[condition.field] = { notIn: condition.value };
          }
          break;
        // Add more operators as needed
      }
    }
  }
  
  // Use Prisma dynamic access
  const model = (prisma as any)[modelName];
  if (!model) {
    logger.warn('[AUTOMATION] Prisma model not found', {
      module: 'Scheduler',
      modelName,
      automationId: automation.id
    });
    return [];
  }
  
  try {
    const entities = await model.findMany({
      where,
      take: 1000 // Limit to prevent memory issues
    });
    
    return entities;
  } catch (error: any) {
    logger.error('[AUTOMATION] Failed to find entities', {
      module: 'Scheduler',
      modelName,
      error: error.message
    });
    return [];
  }
}

/**
 * Get cron expression for current time
 * 
 * Converts current time to a cron-like expression for matching
 * Format: "minute hour day month *"
 */
export function getCurrentCronExpression(date: Date = new Date()): string {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-based
  
  // For day-of-month matching, we need to check if schedule matches
  // This is a simplified version - full cron matching would be more complex
  return `${minute} ${hour} ${day} ${month} *`;
}
