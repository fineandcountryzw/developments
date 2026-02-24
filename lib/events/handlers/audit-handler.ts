/**
 * Audit Email Handler
 * 
 * Sends audit trail emails for significant system events.
 * These emails provide a record of important actions for compliance and security.
 * 
 * @module lib/events/handlers/audit-handler
 */

import { logger } from '@/lib/logger';
import { 
  NotificationEvent, 
  SeverityLevel,
  NotificationType
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface SendAuditEmailParams {
  event: NotificationEvent;
  recipients: string[];
  severity: SeverityLevel;
}

interface AuditEmailContent {
  subject: string;
  html: string;
  text: string;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Send audit email for significant events
 * 
 * @param params - Audit email parameters
 * @returns Whether the email was sent successfully
 */
export async function sendAuditEmail(
  params: SendAuditEmailParams
): Promise<boolean> {
  const { event, recipients, severity } = params;
  
  if (recipients.length === 0) {
    return false;
  }

  try {
    // Generate email content
    const content = generateAuditEmailContent(event, severity);
    
    // Log the audit event (in a real implementation, this would send an email)
    logger.info('Audit email prepared', {
      module: 'AuditHandler',
      action: 'SEND_AUDIT_EMAIL',
      eventType: (event as any).type,
      severity,
      recipientCount: recipients.length,
      subject: content.subject
    });

    // TODO: Implement actual email sending via Resend or similar service
    // For now, we just log the audit event
    // const result = await sendEmail({
    //   to: recipients,
    //   subject: content.subject,
    //   html: content.html,
    //   text: content.text
    // });

    return true;

  } catch (error) {
    logger.error('Failed to send audit email', error as Error, {
      module: 'AuditHandler',
      action: 'SEND_AUDIT_EMAIL',
      eventType: (event as any).type,
      recipientCount: recipients.length
    });
    return false;
  }
}

// ============================================================================
// Content Generation
// ============================================================================

/**
 * Generate audit email content based on event type
 */
function generateAuditEmailContent(
  event: NotificationEvent,
  severity: SeverityLevel
): AuditEmailContent {
  const eventType = (event as any).type as NotificationType;
  const actorId = (event as any).actorId || 'system';
  const timestamp = (event as any).timestamp || new Date();
  
  const severityEmoji = getSeverityEmoji(severity);
  const eventDescription = getEventDescription(event);
  
  const subject = `${severityEmoji} Audit: ${eventType} - ${formatDate(timestamp)}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${getSeverityColor(severity)};">${severityEmoji} Audit Event: ${eventType}</h2>
      <p><strong>Time:</strong> ${formatDate(timestamp)}</p>
      <p><strong>Actor:</strong> ${actorId}</p>
      <p><strong>Event:</strong> ${eventDescription}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">
        This is an automated audit notification from Fine & Country ERP.
      </p>
    </div>
  `;
  
  const text = `
Audit Event: ${eventType}
Severity: ${severity}
Time: ${formatDate(timestamp)}
Actor: ${actorId}
Event: ${eventDescription}

---
This is an automated audit notification from Fine & Country ERP.
  `;
  
  return { subject, html, text };
}

/**
 * Get emoji for severity level
 */
function getSeverityEmoji(severity: SeverityLevel): string {
  switch (severity) {
    case SeverityLevel.CRITICAL:
      return '🚨';
    case SeverityLevel.WARN:
      return '⚠️';
    case SeverityLevel.INFO:
    default:
      return 'ℹ️';
  }
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: SeverityLevel): string {
  switch (severity) {
    case SeverityLevel.CRITICAL:
      return '#dc2626';
    case SeverityLevel.WARN:
      return '#f59e0b';
    case SeverityLevel.INFO:
    default:
      return '#2563eb';
  }
}

/**
 * Get human-readable description for an event
 */
function getEventDescription(event: NotificationEvent): string {
  const e = event as any;
  
  switch (e.type) {
    case NotificationType.CONTRACT_CREATED:
      return `Contract created for stand ${e.standId}`;
    case NotificationType.CONTRACT_SENT:
      return `Contract sent to client ${e.clientId}`;
    case NotificationType.CONTRACT_SIGNED:
      return `Contract signed by ${e.signedBy}`;
    case NotificationType.CONTRACT_RESENT:
      return `Contract resent to client ${e.clientId}${e.reason ? ` (Reason: ${e.reason})` : ''}`;
    case NotificationType.PAYMENT_RECORDED:
      return `Payment of ${formatCurrency(e.amount)} recorded`;
    case NotificationType.PAYMENT_VERIFIED:
      return `Payment of ${formatCurrency(e.amount)} verified by ${e.verifiedBy}`;
    case NotificationType.PAYMENT_REJECTED:
      return `Payment of ${formatCurrency(e.amount)} rejected: ${e.reason}`;
    case NotificationType.RECEIPT_ISSUED:
      return `Receipt ${e.receiptNumber} issued for ${formatCurrency(e.amount)}`;
    case NotificationType.RECEIPT_VOIDED:
      return `Receipt ${e.receiptNumber} voided by ${e.voidedBy}: ${e.reason}`;
    case NotificationType.STAND_RESERVED:
      return `Stand ${e.standNumber} reserved by client ${e.clientId}`;
    case NotificationType.STAND_SOLD:
      return `Stand ${e.standNumber} sold to client ${e.clientId} for ${formatCurrency(e.salePrice)}`;
    case NotificationType.STAND_RELEASED:
      return `Stand ${e.standNumber} released${e.previousClientId ? ` from client ${e.previousClientId}` : ''}: ${e.reason}`;
    case NotificationType.INSTALLMENT_PAID:
      return `Installment ${e.installmentNo} of ${formatCurrency(e.amount)} paid`;
    case NotificationType.INSTALLMENT_OVERDUE:
      return `Installment ${e.installmentNo} overdue by ${e.daysOverdue} days`;
    case NotificationType.PAYOUT_INITIATED:
      return `Payout of ${formatCurrency(e.amount)} initiated for agent ${e.agentId}`;
    case NotificationType.PAYOUT_APPROVED:
      return `Payout of ${formatCurrency(e.amount)} approved by ${e.approvedBy}`;
    case NotificationType.PAYOUT_COMPLETED:
      return `Payout of ${formatCurrency(e.amount)} completed`;
    case NotificationType.USER_INVITED:
      return `User invited: ${e.email} (${e.role})`;
    case NotificationType.USER_ROLE_CHANGED:
      return `User ${e.userId} role changed from ${e.previousRole} to ${e.newRole}`;
    case NotificationType.ACCESS_DENIED:
      return `Access denied to ${e.resource} for ${e.attemptedRole}: ${e.reason}`;
    default:
      return 'Unknown event type';
  }
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Format a currency amount
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
