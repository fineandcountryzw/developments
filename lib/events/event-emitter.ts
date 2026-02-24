/**
 * Event Emitter Layer for Notifications + Audit Email System
 * 
 * Provides a centralized event emission system that:
 * - Emits events from mutation points
 * - Handles idempotency to prevent duplicates
 * - Routes events to notification and audit handlers
 * 
 * @module lib/events/event-emitter
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { 
  NotificationEvent, 
  NotificationType, 
  SeverityLevel,
  EVENT_CONFIG 
} from './types';
import { resolveRecipients } from './recipients/resolver';
import { createNotifications } from './handlers/notification-handler';
import { sendAuditEmail } from './handlers/audit-handler';

// ============================================================================
// Idempotency Cache (in-memory for serverless, consider Redis for multi-instance)
// ============================================================================

const processedEvents = new Set<string>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up old idempotency keys periodically
 */
function cleanupIdempotencyCache(): void {
  // In a multi-instance deployment, use Redis with TTL instead
  // For Vercel serverless, this is per-instance only
  if (processedEvents.size > 10000) {
    processedEvents.clear();
    logger.info('Idempotency cache cleared due to size limit', {
      module: 'EventEmitter',
      action: 'CACHE_CLEANUP'
    });
  }
}

// ============================================================================
// Core Event Emitter
// ============================================================================

/**
 * Emit an event to trigger notifications and audit emails
 * 
 * @param event - The event payload
 * @returns Result of event processing
 */
export async function emitEvent<T extends NotificationEvent>(
  event: T
): Promise<{ success: boolean; notificationsCreated: number; auditSent: boolean; error?: string }> {
  const startTime = Date.now();
  const eventType = event.type;
  const idempotencyKey = event.idempotencyKey || generateIdempotencyKey(event);
  
  try {
    // Check idempotency
    if (processedEvents.has(idempotencyKey)) {
      logger.debug('Event already processed (idempotency)', {
        module: 'EventEmitter',
        action: 'EMIT_EVENT',
        eventType,
        idempotencyKey
      });
      return { success: true, notificationsCreated: 0, auditSent: false };
    }
    
    // Mark as processed
    processedEvents.add(idempotencyKey);
    cleanupIdempotencyCache();
    
    // Get event configuration
    const config = EVENT_CONFIG[eventType];
    if (!config) {
      logger.warn('No configuration found for event type', {
        module: 'EventEmitter',
        action: 'EMIT_EVENT',
        eventType
      });
      return { success: false, notificationsCreated: 0, auditSent: false, error: 'No config' };
    }
    
    logger.info('Emitting event', {
      module: 'EventEmitter',
      action: 'EMIT_EVENT',
      eventType,
      actorId: event.actorId,
      idempotencyKey
    });
    
    // Resolve recipients based on event type and RBAC
    const recipients = await resolveRecipients(event, config);
    
    // Create in-app notifications
    let notificationsCreated = 0;
    if (config.inApp && recipients.userIds.length > 0) {
      notificationsCreated = await createNotifications({
        event,
        recipientUserIds: recipients.userIds,
        severity: config.severity
      });
    }
    
    // Send audit email
    let auditSent = false;
    if (config.auditEmail) {
      auditSent = await sendAuditEmail({
        event,
        recipients: recipients.auditRecipients,
        severity: config.severity
      });
    }
    
    const duration = Date.now() - startTime;
    logger.info('Event processed successfully', {
      module: 'EventEmitter',
      action: 'EMIT_EVENT_SUCCESS',
      eventType,
      notificationsCreated,
      auditSent,
      durationMs: duration
    });
    
    return { success: true, notificationsCreated, auditSent };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to process event', error as Error, {
      module: 'EventEmitter',
      action: 'EMIT_EVENT_ERROR',
      eventType,
      durationMs: duration
    });
    
    // Remove from processed set to allow retry
    processedEvents.delete(idempotencyKey);
    
    return { 
      success: false, 
      notificationsCreated: 0, 
      auditSent: false, 
      error: (error as Error).message 
    };
  }
}

/**
 * Generate an idempotency key for an event
 */
function generateIdempotencyKey(event: NotificationEvent): string {
  const timestamp = event.timestamp?.getTime() || Date.now();
  const actorId = event.actorId || 'system';
  const entityId = getEntityId(event);
  return `${event.type}:${entityId}:${actorId}:${timestamp}`;
}

/**
 * Extract entity ID from event payload
 */
function getEntityId(event: NotificationEvent): string {
  switch (event.type) {
    case NotificationType.CONTRACT_CREATED:
    case NotificationType.CONTRACT_SENT:
    case NotificationType.CONTRACT_SIGNED:
    case NotificationType.CONTRACT_RESENT:
      return (event as any).contractId;
    case NotificationType.PAYMENT_RECORDED:
    case NotificationType.PAYMENT_VERIFIED:
    case NotificationType.PAYMENT_REJECTED:
      return (event as any).paymentId;
    case NotificationType.RECEIPT_ISSUED:
    case NotificationType.RECEIPT_VOIDED:
      return (event as any).receiptId;
    case NotificationType.STAND_RESERVED:
    case NotificationType.STAND_SOLD:
    case NotificationType.STAND_RELEASED:
      return (event as any).standId;
    case NotificationType.INSTALLMENT_PAID:
    case NotificationType.INSTALLMENT_OVERDUE:
      return (event as any).installmentId;
    case NotificationType.PAYOUT_INITIATED:
    case NotificationType.PAYOUT_APPROVED:
    case NotificationType.PAYOUT_COMPLETED:
      return (event as any).payoutId;
    case NotificationType.USER_INVITED:
      return (event as any).invitationId;
    case NotificationType.USER_ROLE_CHANGED:
      return (event as any).userId;
    case NotificationType.ACCESS_DENIED:
      return `${(event as any).resource}:${(event as any).action}`;
    default:
      return 'unknown';
  }
}

// ============================================================================
// Convenience Methods for Common Events
// ============================================================================

/**
 * Emit a contract created event
 */
export async function emitContractCreated(params: {
  contractId: string;
  templateId: string;
  standId: string;
  clientId: string;
  developmentId: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.CONTRACT_CREATED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a contract sent event
 */
export async function emitContractSent(params: {
  contractId: string;
  submissionId?: string;
  clientId: string;
  developerId?: string;
  developmentId: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.CONTRACT_SENT,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a contract signed event
 */
export async function emitContractSigned(params: {
  contractId: string;
  submissionId?: string;
  signedBy: 'client' | 'developer' | 'both';
  clientId: string;
  developerId?: string;
  developmentId: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.CONTRACT_SIGNED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a payment recorded event
 */
export async function emitPaymentRecorded(params: {
  paymentId: string;
  clientId: string;
  standId?: string;
  developmentId: string;
  amount: number;
  method: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.PAYMENT_RECORDED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a payment verified event
 */
export async function emitPaymentVerified(params: {
  paymentId: string;
  clientId: string;
  standId?: string;
  developmentId: string;
  amount: number;
  verifiedBy: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.PAYMENT_VERIFIED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a receipt issued event
 */
export async function emitReceiptIssued(params: {
  receiptId: string;
  paymentId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  receiptNumber: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.RECEIPT_ISSUED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a receipt voided event
 */
export async function emitReceiptVoided(params: {
  receiptId: string;
  paymentId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  reason: string;
  voidedBy: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.RECEIPT_VOIDED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a stand reserved event
 */
export async function emitStandReserved(params: {
  standId: string;
  standNumber: string;
  developmentId: string;
  clientId: string;
  agentId?: string;
  reservationId: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.STAND_RESERVED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a stand sold event
 */
export async function emitStandSold(params: {
  standId: string;
  standNumber: string;
  developmentId: string;
  clientId: string;
  salePrice: number;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.STAND_SOLD,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a payout initiated event
 */
export async function emitPayoutInitiated(params: {
  payoutId: string;
  agentId: string;
  developmentId?: string;
  amount: number;
  month: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.PAYOUT_INITIATED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit a payout approved event
 */
export async function emitPayoutApproved(params: {
  payoutId: string;
  agentId: string;
  developmentId?: string;
  amount: number;
  approvedBy: string;
  actorId?: string;
  actorRole?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.PAYOUT_APPROVED,
    timestamp: new Date(),
    ...params
  } as any);
}

/**
 * Emit an access denied event
 */
export async function emitAccessDenied(params: {
  resource: string;
  action: string;
  attemptedBy: string;
  attemptedRole: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await emitEvent({
    type: NotificationType.ACCESS_DENIED,
    timestamp: new Date(),
    actorId: params.attemptedBy,
    ...params
  } as any);
}

// ============================================================================
// Export
// ============================================================================

export default {
  emitEvent,
  emitContractCreated,
  emitContractSent,
  emitContractSigned,
  emitPaymentRecorded,
  emitPaymentVerified,
  emitReceiptIssued,
  emitReceiptVoided,
  emitStandReserved,
  emitStandSold,
  emitPayoutInitiated,
  emitPayoutApproved,
  emitAccessDenied
};