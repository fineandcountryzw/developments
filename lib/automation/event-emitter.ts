/**
 * Centralized Event Emitter for Automation
 * All modules emit events here instead of calling automation functions directly
 * 
 * @module lib/automation/event-emitter
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { processEvent } from './engine-optimized';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationEvent {
  id?: string;
  type: string;              // 'payment.confirmed', 'deal.updated', 'invoice.created', etc.
  entityType: string;        // 'payment', 'deal', 'invoice', 'reservation'
  entityId: string;
  payload: Record<string, any>;
  timestamp?: Date;
  branch?: string;
  correlationId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT EMITTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit an automation event
 * 
 * Events are processed asynchronously by the automation engine.
 * This function returns immediately after queuing the event.
 * 
 * @param event - Event to emit
 */
export async function emitEvent(event: AutomationEvent): Promise<void> {
  // Generate event ID if not provided
  if (!event.id) {
    event.id = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  // Set timestamp if not provided
  if (!event.timestamp) {
    event.timestamp = new Date();
  }
  
  // Log event
  logger.info('[AUTOMATION] Event emitted', {
    module: 'EventEmitter',
    eventId: event.id,
    eventType: event.type,
    entityType: event.entityType,
    entityId: event.entityId,
    correlationId: event.correlationId,
    branch: event.branch
  });
  
  // Store event in event log (for observability)
  try {
    await prisma.automationEventLog.create({
      data: {
        eventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: event.payload,
        branch: event.branch || 'Harare',
        triggeredAutomations: [] // Will be populated by engine
      }
    });
  } catch (error) {
    // Log but don't fail - event processing should continue
    logger.error('[AUTOMATION] Failed to log event', {
      module: 'EventEmitter',
      eventId: event.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // Process event asynchronously (don't block)
  processEvent(event).catch(error => {
    logger.error('[AUTOMATION] Event processing error', {
      module: 'EventEmitter',
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  });
}

/**
 * Emit multiple events in batch
 * 
 * @param events - Array of events to emit
 */
export async function emitEvents(events: AutomationEvent[]): Promise<void> {
  await Promise.all(events.map(event => emitEvent(event)));
}
