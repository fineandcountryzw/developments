/**
 * Automation Job Queue
 * Manages pending, running, and failed jobs
 * 
 * @module lib/automation/queue
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AutomationEvent } from './event-emitter';
import { AutomationAction } from './action-executor';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationJob {
  id: string;
  automationId: string;
  event: AutomationEvent;
  action: AutomationAction;
  idempotencyKey: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledAt?: Date;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class AutomationQueue {
  /**
   * Add a job to the queue
   */
  async add(job: AutomationJob): Promise<void> {
    try {
      // Check idempotency
      const existing = await prisma.automationRun.findUnique({
        where: { idempotencyKey: job.idempotencyKey }
      });
      
      if (existing && existing.status === 'completed') {
        logger.debug('[AUTOMATION] Job already completed (idempotency)', {
          module: 'AutomationQueue',
          idempotencyKey: job.idempotencyKey
        });
        return;
      }
      
      // Create or update run record
      await prisma.automationRun.upsert({
        where: { idempotencyKey: job.idempotencyKey },
        create: {
          id: job.id,
          automationId: job.automationId,
          eventType: job.event.type,
          entityType: job.event.entityType,
          entityId: job.event.entityId,
          correlationId: job.event.correlationId || null,
          status: job.status,
          actionType: job.action.type,
          actionTarget: job.action.target,
          idempotencyKey: job.idempotencyKey,
          retryCount: job.retryCount,
          maxRetries: job.maxRetries,
          scheduledAt: job.scheduledAt || null,
          branch: job.event.branch || 'Harare'
        },
        update: {
          // Only update if not already completed (idempotency)
          status: job.status === 'completed' ? undefined : job.status,
          retryCount: job.retryCount,
          scheduledAt: job.scheduledAt || null
        }
      });
      
      logger.debug('[AUTOMATION] Job added to queue', {
        module: 'AutomationQueue',
        jobId: job.id,
        automationId: job.automationId,
        actionType: job.action.type
      });
      
    } catch (error: any) {
      logger.error('[AUTOMATION] Failed to add job to queue', {
        module: 'AutomationQueue',
        jobId: job.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get pending jobs (ready to execute)
   */
  async getPendingJobs(limit: number = 10): Promise<AutomationJob[]> {
    const now = new Date();
    
    const runs = await prisma.automationRun.findMany({
      where: {
        status: 'pending',
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        automation: {
          select: {
            retryPolicy: true
          }
        }
      }
    });
    
    // Convert to job format
    return runs.map(run => ({
      id: run.id,
      automationId: run.automationId,
      event: {
        type: run.eventType,
        entityType: run.entityType,
        entityId: run.entityId,
        correlationId: run.correlationId || undefined,
        branch: run.branch,
        payload: {} // Will be fetched if needed
      } as AutomationEvent,
      action: {
        type: run.actionType as any,
        target: run.actionTarget
      } as AutomationAction,
      idempotencyKey: run.idempotencyKey,
      retryCount: run.retryCount,
      maxRetries: run.maxRetries,
      status: run.status as any,
      scheduledAt: run.scheduledAt || undefined,
      createdAt: run.createdAt
    }));
  }
  
  /**
   * Mark job as running
   */
  async markRunning(jobId: string): Promise<void> {
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    });
  }
  
  /**
   * Mark job as completed
   */
  async markCompleted(jobId: string, result: any): Promise<void> {
    const run = await prisma.automationRun.findUnique({ 
      where: { id: jobId },
      select: { startedAt: true, automationId: true }
    });
    
    if (!run) return;
    
    const duration = run.startedAt 
      ? Date.now() - run.startedAt.getTime()
      : null;
    
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
        durationMs: duration
      }
    });
    
    // Update automation success count
    await prisma.automation.update({
      where: { id: run.automationId },
      data: { successCount: { increment: 1 } }
    });
  }
  
  /**
   * Mark job as failed
   */
  async markFailed(jobId: string, error: string, stack?: string): Promise<void> {
    const run = await prisma.automationRun.findUnique({ 
      where: { id: jobId },
      select: { automationId: true }
    });
    
    if (!run) return;
    
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error,
        errorStack: stack || null,
        completedAt: new Date()
      }
    });
    
    // Update automation failure count
    await prisma.automation.update({
      where: { id: run.automationId },
      data: { failureCount: { increment: 1 } }
    });
  }
  
  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<void> {
    const run = await prisma.automationRun.findUnique({ 
      where: { id: jobId }
    });
    
    if (!run) return;
    
    if (run.retryCount >= run.maxRetries) {
      logger.warn('[AUTOMATION] Max retries reached', {
        module: 'AutomationQueue',
        jobId,
        retryCount: run.retryCount,
        maxRetries: run.maxRetries
      });
      return;
    }
    
    // Reset to pending for retry
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        retryCount: { increment: 1 },
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        errorStack: null
      }
    });
    
    logger.info('[AUTOMATION] Job queued for retry', {
      module: 'AutomationQueue',
      jobId,
      retryCount: run.retryCount + 1
    });
  }
}

export const automationQueue = new AutomationQueue();
