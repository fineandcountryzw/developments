/**
 * Audit Email Service
 * 
 * Sends email notifications for audit events and system activities.
 * Used for compliance, security alerts, and administrative notifications.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email
const DEFAULT_FROM = process.env.EMAIL_FROM || "noreply@fineandcountry.co.zw";

// Admin email for audit notifications
const AUDIT_ADMIN_EMAIL = process.env.AUDIT_ADMIN_EMAIL || "admin@fineandcountry.co.zw";

/**
 * Audit event types
 */
export type AuditEventType =
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_ROLE_CHANGED"
  | "ACCESS_DENIED"
  | "DATA_EXPORT"
  | "DATA_IMPORT"
  | "CONTRACT_CREATED"
  | "CONTRACT_SIGNED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_VERIFIED"
  | "SECURITY_ALERT"
  | "SYSTEM_ERROR"
  | "COMPLIANCE_VIOLATION";

/**
 * Severity levels for audit events
 */
export type AuditSeverity = "INFO" | "WARN" | "CRITICAL";

/**
 * Audit event data structure
 */
export interface AuditEvent {
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  description: string;
  details?: Record<string, any>;
  branch?: string;
  timestamp: Date;
}

/**
 * Send audit notification email
 */
export async function sendAuditEmail(
  event: AuditEvent,
  recipients: string[] = [AUDIT_ADMIN_EMAIL]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip sending in development if no API key
    if (!process.env.RESEND_API_KEY) {
      console.log("[AuditEmail] Skipping email - no RESEND_API_KEY configured");
      return { success: true };
    }

    const subject = formatSubject(event);
    const html = formatEmailHtml(event);

    const { data, error } = await resend.emails.send({
      from: `Fine & Country ERP <${DEFAULT_FROM}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error("[AuditEmail] Failed to send:", error);
      return { success: false, error: error.message };
    }

    console.log("[AuditEmail] Sent successfully:", data?.id);
    return { success: true };
  } catch (error) {
    console.error("[AuditEmail] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send security alert email
 */
export async function sendSecurityAlert(
  alertType: string,
  description: string,
  details: Record<string, any>,
  recipients: string[] = [AUDIT_ADMIN_EMAIL]
): Promise<{ success: boolean; error?: string }> {
  const event: AuditEvent = {
    type: "SECURITY_ALERT",
    severity: "CRITICAL",
    action: alertType,
    description,
    details,
    timestamp: new Date(),
  };

  return sendAuditEmail(event, recipients);
}

/**
 * Send compliance violation email
 */
export async function sendComplianceAlert(
  violationType: string,
  description: string,
  details: Record<string, any>,
  recipients: string[] = [AUDIT_ADMIN_EMAIL]
): Promise<{ success: boolean; error?: string }> {
  const event: AuditEvent = {
    type: "COMPLIANCE_VIOLATION",
    severity: "CRITICAL",
    action: violationType,
    description,
    details,
    timestamp: new Date(),
  };

  return sendAuditEmail(event, recipients);
}

/**
 * Send data export notification
 */
export async function sendDataExportNotification(
  userId: string,
  userEmail: string,
  exportType: string,
  recordCount: number,
  recipients: string[] = [AUDIT_ADMIN_EMAIL]
): Promise<{ success: boolean; error?: string }> {
  const event: AuditEvent = {
    type: "DATA_EXPORT",
    severity: "INFO",
    userId,
    userEmail,
    action: "DATA_EXPORT",
    description: `Data export: ${exportType} (${recordCount} records)`,
    details: { exportType, recordCount },
    timestamp: new Date(),
  };

  return sendAuditEmail(event, recipients);
}

/**
 * Format email subject based on event
 */
function formatSubject(event: AuditEvent): string {
  const severityPrefix = event.severity === "CRITICAL" ? "🚨" : event.severity === "WARN" ? "⚠️" : "ℹ️";
  return `${severityPrefix} [ERP Audit] ${event.type}: ${event.action}`;
}

/**
 * Format email HTML content
 */
function formatEmailHtml(event: AuditEvent): string {
  const severityColor =
    event.severity === "CRITICAL" ? "#dc2626" : event.severity === "WARN" ? "#f59e0b" : "#3b82f6";

  const detailsHtml = event.details
    ? Object.entries(event.details)
        .map(([key, value]) => `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`)
        .join("")
    : "<li>No additional details</li>";

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 12px; }
    .field-label { font-weight: bold; color: #6b7280; }
    .details { background-color: white; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>ERP Audit Notification</h2>
      <p>Severity: ${event.severity}</p>
    </div>
    <div class="content">
      <div class="field">
        <span class="field-label">Event Type:</span> ${event.type}
      </div>
      <div class="field">
        <span class="field-label">Action:</span> ${event.action}
      </div>
      <div class="field">
        <span class="field-label">Description:</span> ${event.description}
      </div>
      ${event.userEmail ? `
      <div class="field">
        <span class="field-label">User:</span> ${event.userEmail} (${event.userRole || "Unknown Role"})
      </div>
      ` : ""}
      ${event.ipAddress ? `
      <div class="field">
        <span class="field-label">IP Address:</span> ${event.ipAddress}
      </div>
      ` : ""}
      ${event.resourceType ? `
      <div class="field">
        <span class="field-label">Resource:</span> ${event.resourceType} (${event.resourceId || "N/A"})
      </div>
      ` : ""}
      ${event.branch ? `
      <div class="field">
        <span class="field-label">Branch:</span> ${event.branch}
      </div>
      ` : ""}
      <div class="field">
        <span class="field-label">Timestamp:</span> ${event.timestamp.toISOString()}
      </div>
      
      <div class="details">
        <h3>Additional Details</h3>
        <ul>
          ${detailsHtml}
        </ul>
      </div>
      
      <div class="footer">
        <p>This is an automated audit notification from Fine & Country Zimbabwe ERP.</p>
        <p>Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Log audit event to console and optionally send email
 */
export async function logAuditEvent(
  event: AuditEvent,
  options: { sendEmail?: boolean; recipients?: string[] } = {}
): Promise<void> {
  // Always log to console
  console.log("[AuditEvent]", {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  // Send email if requested
  if (options.sendEmail) {
    await sendAuditEmail(event, options.recipients);
  }
}

/**
 * Create and log a user activity event
 */
export async function logUserActivity(
  userId: string,
  userEmail: string,
  action: string,
  description: string,
  details?: Record<string, any>,
  options?: { sendEmail?: boolean; severity?: AuditSeverity }
): Promise<void> {
  const event: AuditEvent = {
    type: "USER_LOGIN",
    severity: options?.severity || "INFO",
    userId,
    userEmail,
    action,
    description,
    details,
    timestamp: new Date(),
  };

  await logAuditEvent(event, { sendEmail: options?.sendEmail });
}

/**
 * Create and log a data change event
 */
export async function logDataChange(
  userId: string,
  userEmail: string,
  resourceType: string,
  resourceId: string,
  action: string,
  description: string,
  changes?: { before: any; after: any },
  options?: { sendEmail?: boolean; severity?: AuditSeverity }
): Promise<void> {
  const event: AuditEvent = {
    type: "DATA_EXPORT",
    severity: options?.severity || "INFO",
    userId,
    userEmail,
    resourceType,
    resourceId,
    action,
    description,
    details: changes,
    timestamp: new Date(),
  };

  await logAuditEvent(event, { sendEmail: options?.sendEmail });
}
