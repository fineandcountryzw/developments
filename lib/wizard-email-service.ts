/**
 * Wizard Action Email Service
 * Sends notification emails for wizard stand actions (MARK_SOLD, APPLY_DISCOUNT)
 * to Accounts and Developer contacts.
 */

import { sendEmail } from '@/lib/email-service';
import prisma from '@/lib/prisma';

interface WizardEmailParams {
  actionType: 'MARK_SOLD' | 'APPLY_DISCOUNT';
  developmentName: string;
  developmentId: string;
  results: Array<{
    standNumber: string;
    standId?: string;
    oldStatus?: string;
    newStatus?: string;
    oldPrice?: number;
    newPrice?: number;
    discountPercent?: number;
    discountAmount?: number;
  }>;
  reason: string;
  actor: { name: string; email: string };
  developerEmail?: string | null;
  developerName?: string | null;
  branch?: string | null;
  discountPercent?: number;
}

/**
 * Send wizard action email notifications to Accounts + Developer
 */
export async function sendWizardActionEmail(params: WizardEmailParams): Promise<void> {
  const {
    actionType,
    developmentName,
    developmentId,
    results,
    reason,
    actor,
    developerEmail,
    developerName,
    branch,
    discountPercent,
  } = params;

  const timestamp = new Date().toLocaleString('en-ZW', {
    timeZone: 'Africa/Harare',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const actionLabel = actionType === 'MARK_SOLD' ? 'Mark as Sold' : 'Apply Discount';
  const standNumbers = results.map((r) => r.standNumber).join(', ');
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';

  // Build HTML email
  const html = generateWizardEmailHTML({
    actionType,
    actionLabel,
    developmentName,
    developmentId,
    results,
    reason,
    actor,
    timestamp,
    standNumbers,
    baseUrl,
    discountPercent,
  });

  const subject = `[ERP] ${actionLabel}: ${results.length} stand(s) in ${developmentName}`;

  // Collect recipients
  const recipients: string[] = [];

  // 1. Accounts recipients: from CompanySettings or PaymentAutomationSettings
  try {
    const companySettings = await prisma.companySettings.findFirst({
      where: { branch: branch || 'Harare' },
      select: { email: true, principalAgentEmail: true },
    });

    if (companySettings?.email) recipients.push(companySettings.email);
    if (companySettings?.principalAgentEmail) recipients.push(companySettings.principalAgentEmail);

    // Also check PaymentAutomationSettings for notification emails
    const paymentSettings = await prisma.paymentAutomationSettings.findFirst({
      where: { branch: branch || 'Harare' },
      select: { notificationEmails: true },
    });

    if (paymentSettings?.notificationEmails) {
      recipients.push(...paymentSettings.notificationEmails);
    }
  } catch (err) {
    console.error('[WIZARD EMAIL] Error fetching accounts recipients:', err);
  }

  // 2. Accounts role users as fallback
  if (recipients.length === 0) {
    try {
      const accountUsers = await prisma.user.findMany({
        where: { role: 'ACCOUNT', isActive: true },
        select: { email: true },
      });
      recipients.push(...accountUsers.map((u) => u.email));
    } catch (err) {
      console.error('[WIZARD EMAIL] Error fetching ACCOUNT users:', err);
    }
  }

  // 3. Developer email
  if (developerEmail) {
    recipients.push(developerEmail);
  }

  // Deduplicate
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

  if (uniqueRecipients.length === 0) {
    console.warn('[WIZARD EMAIL] No recipients found, skipping email');
    return;
  }

  // Send to each recipient
  for (const to of uniqueRecipients) {
    try {
      await sendEmail({
        to,
        subject,
        html,
      });
      console.log(`[WIZARD EMAIL] Sent ${actionType} notification to ${to}`);
    } catch (err) {
      console.error(`[WIZARD EMAIL] Failed to send to ${to}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template
// ─────────────────────────────────────────────────────────────────────────────

function generateWizardEmailHTML(params: {
  actionType: string;
  actionLabel: string;
  developmentName: string;
  developmentId: string;
  results: WizardEmailParams['results'];
  reason: string;
  actor: { name: string; email: string };
  timestamp: string;
  standNumbers: string;
  baseUrl: string;
  discountPercent?: number;
}): string {
  const {
    actionType,
    actionLabel,
    developmentName,
    results,
    reason,
    actor,
    timestamp,
    baseUrl,
    discountPercent,
  } = params;

  const accentColor = actionType === 'MARK_SOLD' ? '#16a34a' : '#2563eb';
  const accentBg = actionType === 'MARK_SOLD' ? '#f0fdf4' : '#eff6ff';

  const standRows = results
    .map((r) => {
      if (actionType === 'MARK_SOLD') {
        return `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${r.standNumber}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.oldStatus || '—'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: ${accentColor}; font-weight: 600;">SOLD</td>
          </tr>`;
      } else {
        return `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${r.standNumber}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">$${r.oldPrice?.toLocaleString() || '—'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: ${accentColor}; font-weight: 600;">$${r.newPrice?.toLocaleString() || '—'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.discountPercent || discountPercent}%</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">$${r.discountAmount?.toLocaleString() || '—'}</td>
          </tr>`;
      }
    })
    .join('');

  const tableHeaders =
    actionType === 'MARK_SOLD'
      ? `<tr style="background: #f9fafb;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Stand</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Previous Status</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">New Status</th>
        </tr>`
      : `<tr style="background: #f9fafb;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Stand</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Old Price</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">New Price</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Discount %</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Savings</th>
        </tr>`;

  const viewLink = baseUrl ? `${baseUrl}/admin?tab=stands` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
      <h1 style="color: #c9a73f; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Fine & Country Zimbabwe</h1>
      <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px;">ERP Wizard Action Notification</p>
    </div>

    <!-- Body -->
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
      <!-- Action Badge -->
      <div style="background: ${accentBg}; border: 1px solid ${accentColor}30; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 16px; color: ${accentColor};">${actionLabel}</h2>
        <p style="margin: 4px 0 0; font-size: 14px; color: #374151;">${results.length} stand(s) affected in <strong>${developmentName}</strong></p>
      </div>

      <!-- Details -->
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 120px;">Performed by:</td>
            <td style="padding: 6px 0; font-weight: 500;">${actor.name} (${actor.email})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Timestamp:</td>
            <td style="padding: 6px 0;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Reason:</td>
            <td style="padding: 6px 0;">${reason}</td>
          </tr>
          ${discountPercent ? `<tr><td style="padding: 6px 0; color: #6b7280;">Discount:</td><td style="padding: 6px 0; font-weight: 600; color: ${accentColor};">${discountPercent}%</td></tr>` : ''}
        </table>
      </div>

      <!-- Stands Table -->
      <div style="margin-bottom: 20px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${tableHeaders}
          ${standRows}
        </table>
      </div>

      ${viewLink ? `
      <!-- CTA -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${viewLink}" style="display: inline-block; background: ${accentColor}; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View in ERP
        </a>
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px; font-size: 12px; color: #9ca3af;">
      <p>This is an automated notification from the Fine & Country ERP system.</p>
      <p>Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}
