/**
 * Notification Handler
 * 
 * Creates in-app notifications for resolved recipients.
 * Supports batch insertion for performance.
 * 
 * @module lib/events/handlers/notification-handler
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { NotificationType as PrismaNotificationType, SeverityLevel as PrismaSeverityLevel, EntityType as PrismaEntityType, UserRole as PrismaUserRole, Prisma } from '@prisma/client';
import { 
  NotificationEvent, 
  SeverityLevel, 
  NotificationType,
  EntityType 
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface CreateNotificationsParams {
  event: NotificationEvent;
  recipientUserIds: string[];
  severity: SeverityLevel;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Create in-app notifications for multiple recipients
 * 
 * @param params - Notification creation parameters
 * @returns Number of notifications created
 */
export async function createNotifications(
  params: CreateNotificationsParams
): Promise<number> {
  const { event, recipientUserIds, severity } = params;
  
  if (recipientUserIds.length === 0) {
    return 0;
  }

  try {
    // Generate notification content
    const content = generateNotificationContent(event);
    const { entityType, entityId, developmentId } = getEntityInfo(event);
    
    // Prepare batch data with proper Prisma types
    const notificationsData: Prisma.NotificationCreateManyInput[] = recipientUserIds.map(userId => ({
      type: event.type as PrismaNotificationType,
      severity: severity as unknown as PrismaSeverityLevel,
      title: content.title,
      message: content.message,
      actorUserId: event.actorId ?? undefined,
      actorRole: event.actorRole as PrismaUserRole | undefined,
      recipientUserId: userId,
      entityType: entityType as PrismaEntityType,
      entityId,
      developmentId: developmentId ?? undefined,
      metadata: {
        ...(event as any).metadata,
        actorEmail: event.actorEmail,
        timestamp: event.timestamp
      },
      isRead: false
    }));

    // Batch insert using createMany for performance
    const result = await prisma.notification.createMany({
      data: notificationsData,
      skipDuplicates: true // Prevent duplicates if idempotency fails
    });

    logger.info('Notifications created', {
      module: 'NotificationHandler',
      action: 'CREATE_NOTIFICATIONS',
      eventType: event.type,
      count: result.count
    });

    return result.count;

  } catch (error) {
    logger.error('Failed to create notifications', error as Error, {
      module: 'NotificationHandler',
      action: 'CREATE_NOTIFICATIONS',
      eventType: event.type,
      recipientCount: recipientUserIds.length
    });
    return 0;
  }
}

// ============================================================================
// Content Generation
// ============================================================================

interface NotificationContent {
  title: string;
  message: string;
}

/**
 * Generate notification title and message based on event type
 */
function generateNotificationContent(event: NotificationEvent): NotificationContent {
  const e = event as any;
  
  switch (event.type) {
    // Contract Events
    case NotificationType.CONTRACT_CREATED:
      return {
        title: 'New Contract Generated',
        message: `A new contract has been generated for stand ${e.standId || 'N/A'}`
      };
    
    case NotificationType.CONTRACT_SENT:
      return {
        title: 'Contract Sent for Signature',
        message: `Contract has been sent to client for signature`
      };
    
    case NotificationType.CONTRACT_SIGNED:
      return {
        title: 'Contract Signed',
        message: `Contract has been signed by ${e.signedBy || 'client'}`
      };
    
    case NotificationType.CONTRACT_RESENT:
      return {
        title: 'Contract Resent',
        message: `Contract has been resent${e.reason ? `: ${e.reason}` : ''}`
      };
    
    // Payment Events
    case NotificationType.PAYMENT_RECORDED:
      return {
        title: 'Payment Recorded',
        message: `Payment of $${e.amount} recorded via ${e.method}`
      };
    
    case NotificationType.PAYMENT_VERIFIED:
      return {
        title: 'Payment Verified',
        message: `Payment of $${e.amount} has been verified`
      };
    
    case NotificationType.PAYMENT_REJECTED:
      return {
        title: 'Payment Rejected',
        message: `Payment of $${e.amount} was rejected${e.reason ? `: ${e.reason}` : ''}`
      };
    
    // Receipt Events
    case NotificationType.RECEIPT_ISSUED:
      return {
        title: 'Receipt Issued',
        message: `Receipt ${e.receiptNumber} issued for $${e.amount}`
      };
    
    case NotificationType.RECEIPT_VOIDED:
      return {
        title: 'Receipt Voided',
        message: `Receipt ${e.receiptNumber} has been voided`
      };
    
    // Stand Events
    case NotificationType.STAND_RESERVED:
      return {
        title: 'Stand Reserved',
        message: `Stand ${e.standNumber} has been reserved`
      };
    
    case NotificationType.STAND_SOLD:
      return {
        title: 'Stand Sold',
        message: `Stand ${e.standNumber} has been sold for $${e.salePrice}`
      };
    
    case NotificationType.STAND_RELEASED:
      return {
        title: 'Stand Released',
        message: `Stand ${e.standNumber} has been released${e.reason ? `: ${e.reason}` : ''}`
      };
    
    // Installment Events
    case NotificationType.INSTALLMENT_PAID:
      return {
        title: 'Installment Paid',
        message: `Installment #${e.installmentNo} of $${e.amount} has been paid`
      };
    
    case NotificationType.INSTALLMENT_OVERDUE:
      return {
        title: 'Installment Overdue',
        message: `Installment is ${e.daysOverdue} days overdue`
      };
    
    // Payout Events
    case NotificationType.PAYOUT_INITIATED:
      return {
        title: 'Payout Initiated',
        message: `Commission payout of $${e.amount} has been initiated`
      };
    
    case NotificationType.PAYOUT_APPROVED:
      return {
        title: 'Payout Approved',
        message: `Commission payout of $${e.amount} has been approved`
      };
    
    case NotificationType.PAYOUT_COMPLETED:
      return {
        title: 'Payout Completed',
        message: `Commission payout of $${e.amount} has been completed`
      };
    
    // User Events
    case NotificationType.USER_INVITED:
      return {
        title: 'New User Invited',
        message: `Invitation sent to ${e.email} with ${e.role} role`
      };
    
    case NotificationType.USER_ROLE_CHANGED:
      return {
        title: 'User Role Changed',
        message: `User role changed from ${e.previousRole} to ${e.newRole}`
      };
    
    // Access Events
    case NotificationType.ACCESS_DENIED:
      return {
        title: 'Access Denied',
        message: `Access denied to ${e.resource} for ${e.attemptedRole}`
      };
    
    default:
      return {
        title: 'Notification',
        message: 'You have a new notification'
      };
  }
}

// ============================================================================
// Entity Mapping
// ============================================================================

/**
 * Extract entity information from event
 */
function getEntityInfo(event: NotificationEvent): { 
  entityType: EntityType; 
  entityId: string;
  developmentId?: string;
} {
  const e = event as any;
  
  switch (event.type as NotificationType) {
    case NotificationType.CONTRACT_CREATED:
    case NotificationType.CONTRACT_SENT:
    case NotificationType.CONTRACT_SIGNED:
    case NotificationType.CONTRACT_RESENT:
    case NotificationType.CONTRACT_APPROVED:
    case NotificationType.CONTRACT_REJECTED:
      return {
        entityType: EntityType.CONTRACT,
        entityId: e.contractId,
        developmentId: e.developmentId
      };
    
    case NotificationType.PAYMENT_RECORDED:
    case NotificationType.PAYMENT_VERIFIED:
    case NotificationType.PAYMENT_REJECTED:
      return { 
        entityType: EntityType.PAYMENT, 
        entityId: e.paymentId,
        developmentId: e.developmentId
      };
    
    case NotificationType.RECEIPT_ISSUED:
    case NotificationType.RECEIPT_VOIDED:
      return { 
        entityType: EntityType.RECEIPT, 
        entityId: e.receiptId,
        developmentId: e.developmentId
      };
    
    case NotificationType.STAND_RESERVED:
    case NotificationType.STAND_SOLD:
    case NotificationType.STAND_RELEASED:
      return { 
        entityType: EntityType.STAND, 
        entityId: e.standId,
        developmentId: e.developmentId
      };
    
    case NotificationType.INSTALLMENT_PAID:
    case NotificationType.INSTALLMENT_OVERDUE:
      return { 
        entityType: EntityType.INSTALLMENT, 
        entityId: e.installmentId,
        developmentId: e.developmentId
      };
    
    case NotificationType.PAYOUT_INITIATED:
    case NotificationType.PAYOUT_APPROVED:
    case NotificationType.PAYOUT_COMPLETED:
      return { 
        entityType: EntityType.PAYOUT, 
        entityId: e.payoutId,
        developmentId: e.developmentId
      };
    
    case NotificationType.USER_INVITED:
    case NotificationType.USER_ROLE_CHANGED:
      return { 
        entityType: EntityType.USER, 
        entityId: e.userId || e.invitationId 
      };
    
    default:
      return { 
        entityType: EntityType.DEVELOPMENT, 
        entityId: e.developmentId || 'unknown' 
      };
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  createNotifications
};