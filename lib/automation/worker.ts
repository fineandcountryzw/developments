/**
 * Automation Worker
 * Processes pending jobs from queue
 * 
 * @module lib/automation/worker
 */

import { logger } from '@/lib/logger';
import { automationQueue } from './queue';
import { executeAction } from './action-executor';
import { retryWithBackoff, RetryPolicy } from './retry';

// ─────────────────────────────────────────────────────────────────────────────
// WORKER STATE
// ─────────────────────────────────────────────────────────────────────────────

let workerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;
let consecutiveEmptyPolls = 0;
const MAX_EMPTY_POLLS = 5; // Backoff after 5 empty polls
const MIN_INTERVAL = 5000; // 5 seconds
const MAX_INTERVAL = 60000; // 60 seconds

// ─────────────────────────────────────────────────────────────────────────────
// WORKER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the automation worker (optimized with smart polling)
 * 
 * Uses adaptive polling: faster when jobs available, slower when empty
 */
export async function startAutomationWorker(): Promise<void> {
  if (workerRunning) {
    logger.warn('[AUTOMATION] Worker already running', {
      module: 'AutomationWorker'
    });
    return;
  }
  
  workerRunning = true;
  consecutiveEmptyPolls = 0;
  logger.info('[AUTOMATION] Worker started (optimized)', {
    module: 'AutomationWorker'
  });
  
  // Process immediately on start
  await processQueue();
  
  // Start adaptive polling
  scheduleNextPoll();
}

/**
 * Schedule next poll with adaptive interval
 */
function scheduleNextPoll(): void {
  if (!workerRunning) return;
  
  // Calculate interval based on empty polls
  const interval = consecutiveEmptyPolls >= MAX_EMPTY_POLLS
    ? Math.min(MAX_INTERVAL, MIN_INTERVAL * Math.pow(2, consecutiveEmptyPolls - MAX_EMPTY_POLLS))
    : MIN_INTERVAL;
  
  workerInterval = setTimeout(async () => {
    try {
      await processQueue();
      scheduleNextPoll(); // Schedule next poll
    } catch (error: any) {
      logger.error('[AUTOMATION] Worker error', {
        module: 'AutomationWorker',
        error: error.message,
        stack: error.stack
      });
      scheduleNextPoll(); // Continue even on error
    }
  }, interval);
}

/**
 * Stop the automation worker
 */
export function stopAutomationWorker(): void {
  if (workerInterval) {
    clearTimeout(workerInterval); // Changed from clearInterval to clearTimeout
    workerInterval = null;
  }
  
  workerRunning = false;
  consecutiveEmptyPolls = 0;
  logger.info('[AUTOMATION] Worker stopped', {
    module: 'AutomationWorker'
  });
}

/**
 * Process pending jobs from queue (optimized with batching)
 */
async function processQueue(): Promise<void> {
  const jobs = await automationQueue.getPendingJobs(20); // Increased batch size
  
  if (jobs.length === 0) {
    consecutiveEmptyPolls++;
    return; // No jobs to process
  }
  
  // Reset empty poll counter when jobs found
  consecutiveEmptyPolls = 0;
  
  logger.debug('[AUTOMATION] Processing jobs', {
    module: 'AutomationWorker',
    jobCount: jobs.length
  });
  
  // Process jobs in parallel (but limit concurrency)
  const concurrentLimit = 10; // Increased concurrency
  const chunks = [];
  
  for (let i = 0; i < jobs.length; i += concurrentLimit) {
    chunks.push(jobs.slice(i, i + concurrentLimit));
  }
  
  // Process chunks in parallel for better throughput
  await Promise.all(chunks.map(chunk => 
    Promise.all(chunk.map(job => processJob(job).catch(error => {
      logger.error('[AUTOMATION] Job processing error', {
        module: 'AutomationWorker',
        jobId: job.id,
        error: error.message
      });
    })))
  ));
}

/**
 * Process a single job
 */
async function processJob(job: any): Promise<void> {
  try {
    // Mark as running
    await automationQueue.markRunning(job.id);
    
    // Get automation for retry policy
    const prisma = (await import('@/lib/prisma')).default;
    const automation = await prisma.automation.findUnique({
      where: { id: job.automationId },
      select: { retryPolicy: true }
    });
    
    const retryPolicy: RetryPolicy = (automation?.retryPolicy as unknown as RetryPolicy) || {
      maxRetries: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 60000
    };
    
    // Execute with retry
    const result = await retryWithBackoff(
      () => executeAction(job.action, job.event, job.automationId),
      job.retryCount,
      retryPolicy
    );
    
    // Mark as completed
    await automationQueue.markCompleted(job.id, result.result);
    
  } catch (error: any) {
    // Mark as failed
    await automationQueue.markFailed(job.id, error.message, error.stack);
    
    // Retry if not maxed out
    if (job.retryCount < job.maxRetries) {
      await automationQueue.retry(job.id);
    }
  }
}
