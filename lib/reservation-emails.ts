/**
 * Reservation Email Service
 * 
 * Sends branded email notifications for reservation lifecycle events:
 * - Reservation Created
 * - Reservation Cancelled
 * - Reservation Converted to Sale
 * 
 * Recipients:
 * - Developer (property developer)
 * - Internal (company operations email)
 * - Client (customer confirmation)
 * - Agent (if involved in the transaction)
 */

import { sendEmail } from './email-service';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Internal operations email - receives all notifications
const INTERNAL_OPS_EMAIL = process.env.INTERNAL_OPS_EMAIL || 'zimbabwe@fineandcountry.com';

// Accounts team email - receives financial notifications
const ACCOUNTS_EMAIL = process.env.ACCOUNTS_EMAIL || 'accounts@fineandcountry.com';

// Company details for branding
const COMPANY = {
  name: 'Fine & Country Zimbabwe',
  website: 'https://fineandcountryerp.com',
  phone: '+263 242 123 456',
  address: '1 Borrowdale Road, Harare, Zimbabwe',
  logo: 'https://fineandcountryerp.com/logo.png',
};

// Brand colors
const COLORS = {
  primary: '#85754E',      // Gold
  secondary: '#1A1A1A',    // Slate
  success: '#059669',      // Green
  warning: '#F59E0B',      // Amber
  danger: '#EF4444',       // Red
  background: '#F8F7F5',   // Cream
  text: '#333333',
  lightText: '#666666',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReservationEmailData {
  // Reservation details
  reservationId: string;
  reservationDate: Date;
  expiresAt: Date;
  
  // Stand details
  standNumber: string;
  standPrice: number;
  standSize?: number;
  
  // Development details
  developmentName: string;
  developmentLocation: string;
  developerEmail?: string;
  developerName?: string;
  
  // Client details
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  
  // Agent details (if applicable)
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
  
  // Branch
  branch: string;
}

export interface SaleConversionEmailData extends ReservationEmailData {
  saleDate: Date;
  paymentMethod?: string;
  depositAmount?: number;
  installmentPlan?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Sending Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send all reservation created emails
 */
export async function sendReservationCreatedEmails(data: ReservationEmailData): Promise<void> {
  console.log('[RESERVATION_EMAIL] Sending reservation created emails', {
    reservationId: data.reservationId,
    standNumber: data.standNumber,
    clientEmail: data.clientEmail,
    developerEmail: data.developerEmail,
    agentEmail: data.agentEmail,
  });

  const emailPromises: Promise<any>[] = [];

  // 1. Send to Client
  emailPromises.push(
    sendEmail({
      to: data.clientEmail,
      subject: `Reservation Confirmed - Stand ${data.standNumber} at ${data.developmentName}`,
      html: generateClientReservationHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send client email:', err.message))
  );

  // 2. Send to Developer (if email exists)
  if (data.developerEmail) {
    emailPromises.push(
      sendEmail({
        to: data.developerEmail,
        subject: `[New Reservation] Stand ${data.standNumber} - ${data.developmentName}`,
        html: generateDeveloperReservationHTML(data),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send developer email:', err.message))
    );
  }

  // 3. Send to Internal Operations
  emailPromises.push(
    sendEmail({
      to: INTERNAL_OPS_EMAIL,
      subject: `[INTERNAL] New Reservation - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalReservationHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send internal email:', err.message))
  );

  // 4. Send to Accounts Team
  emailPromises.push(
    sendEmail({
      to: ACCOUNTS_EMAIL,
      subject: `[ACCOUNTS] New Reservation - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalReservationHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send accounts email:', err.message))
  );

  // 5. Send to Agent (if different from internal)
  if (data.agentEmail && data.agentEmail !== INTERNAL_OPS_EMAIL) {
    emailPromises.push(
      sendEmail({
        to: data.agentEmail,
        subject: `Reservation Confirmed - Stand ${data.standNumber} (Your Client: ${data.clientName})`,
        html: generateAgentReservationHTML(data),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send agent email:', err.message))
    );
  }

  await Promise.allSettled(emailPromises);
  console.log('[RESERVATION_EMAIL] All reservation created emails dispatched');
}

/**
 * Send all reservation cancelled emails
 */
export async function sendReservationCancelledEmails(data: ReservationEmailData, reason?: string): Promise<void> {
  console.log('[RESERVATION_EMAIL] Sending reservation cancelled emails', {
    reservationId: data.reservationId,
    standNumber: data.standNumber,
    reason,
  });

  const emailPromises: Promise<any>[] = [];

  // 1. Send to Client
  emailPromises.push(
    sendEmail({
      to: data.clientEmail,
      subject: `Reservation Cancelled - Stand ${data.standNumber} at ${data.developmentName}`,
      html: generateClientCancellationHTML(data, reason),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send client cancellation email:', err.message))
  );

  // 2. Send to Developer (if email exists)
  if (data.developerEmail) {
    emailPromises.push(
      sendEmail({
        to: data.developerEmail,
        subject: `[Reservation Cancelled] Stand ${data.standNumber} - ${data.developmentName}`,
        html: generateDeveloperCancellationHTML(data, reason),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send developer cancellation email:', err.message))
    );
  }

  // 3. Send to Internal Operations
  emailPromises.push(
    sendEmail({
      to: INTERNAL_OPS_EMAIL,
      subject: `[INTERNAL] Reservation Cancelled - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalCancellationHTML(data, reason),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send internal cancellation email:', err.message))
  );

  // 4. Send to Accounts Team
  emailPromises.push(
    sendEmail({
      to: ACCOUNTS_EMAIL,
      subject: `[ACCOUNTS] Reservation Cancelled - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalCancellationHTML(data, reason),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send accounts cancellation email:', err.message))
  );

  // 5. Send to Agent (if applicable)
  if (data.agentEmail) {
    emailPromises.push(
      sendEmail({
        to: data.agentEmail,
        subject: `Reservation Cancelled - Stand ${data.standNumber} (Client: ${data.clientName})`,
        html: generateAgentCancellationHTML(data, reason),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send agent cancellation email:', err.message))
    );
  }

  await Promise.allSettled(emailPromises);
  console.log('[RESERVATION_EMAIL] All cancellation emails dispatched');
}

/**
 * Send all sale conversion emails (reservation -> sale)
 */
export async function sendSaleConversionEmails(data: SaleConversionEmailData): Promise<void> {
  console.log('[RESERVATION_EMAIL] Sending sale conversion emails', {
    reservationId: data.reservationId,
    standNumber: data.standNumber,
    clientEmail: data.clientEmail,
    agentEmail: data.agentEmail,
  });

  const emailPromises: Promise<any>[] = [];

  // 1. Send to Client
  emailPromises.push(
    sendEmail({
      to: data.clientEmail,
      subject: `🎉 Congratulations! Your Purchase is Confirmed - Stand ${data.standNumber}`,
      html: generateClientSaleHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send client sale email:', err.message))
  );

  // 2. Send to Developer
  if (data.developerEmail) {
    emailPromises.push(
      sendEmail({
        to: data.developerEmail,
        subject: `[SALE CONFIRMED] Stand ${data.standNumber} - ${data.developmentName}`,
        html: generateDeveloperSaleHTML(data),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send developer sale email:', err.message))
    );
  }

  // 3. Send to Internal Operations
  emailPromises.push(
    sendEmail({
      to: INTERNAL_OPS_EMAIL,
      subject: `[INTERNAL] Sale Confirmed - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalSaleHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send internal sale email:', err.message))
  );

  // 4. Send to Accounts Team
  emailPromises.push(
    sendEmail({
      to: ACCOUNTS_EMAIL,
      subject: `[ACCOUNTS] Sale Confirmed - Stand ${data.standNumber}, ${data.developmentName}`,
      html: generateInternalSaleHTML(data),
    }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send accounts sale email:', err.message))
  );

  // 5. Send to Agent (IMPORTANT: They get commission!)
  if (data.agentEmail) {
    emailPromises.push(
      sendEmail({
        to: data.agentEmail,
        subject: `🎉 Sale Closed! Stand ${data.standNumber} - ${data.clientName}`,
        html: generateAgentSaleHTML(data),
      }).catch(err => console.error('[RESERVATION_EMAIL] Failed to send agent sale email:', err.message))
    );
  }

  await Promise.allSettled(emailPromises);
  console.log('[RESERVATION_EMAIL] All sale conversion emails dispatched');
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base email wrapper with Fine & Country branding
 */
function generateEmailWrapper(content: string, headerColor: string = COLORS.primary): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fine & Country Zimbabwe</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Fine & Country
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">
                Zimbabwe
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: ${COLORS.background}; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: ${COLORS.lightText};">
                ${COMPANY.name}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: ${COLORS.lightText};">
                ${COMPANY.address}
              </p>
              <p style="margin: 0; font-size: 12px; color: ${COLORS.lightText};">
                ${COMPANY.phone} | <a href="${COMPANY.website}" style="color: ${COLORS.primary};">${COMPANY.website}</a>
              </p>
              <p style="margin: 20px 0 0 0; font-size: 10px; color: #999;">
                This is an automated message from ${COMPANY.name}. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(date));
}

/**
 * Calculate hours remaining
 */
function calculateHoursRemaining(expiresAt: Date): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reservation Created Templates
// ─────────────────────────────────────────────────────────────────────────────

function generateClientReservationHTML(data: ReservationEmailData): string {
  const hoursRemaining = calculateHoursRemaining(data.expiresAt);
  
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.secondary}; font-size: 22px;">
      Your Reservation is Confirmed! 🎉
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.clientName}</strong>,
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Thank you for your interest in ${data.developmentName}. Your reservation has been successfully confirmed.
    </p>
    
    <!-- Property Details Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 15px 0; color: ${COLORS.primary}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
            Property Details
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 13px;">Stand Number</span>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <strong style="color: ${COLORS.secondary}; font-size: 14px;">${data.standNumber}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 13px;">Development</span>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <strong style="color: ${COLORS.secondary}; font-size: 14px;">${data.developmentName}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 13px;">Location</span>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <strong style="color: ${COLORS.secondary}; font-size: 14px;">${data.developmentLocation}</strong>
              </td>
            </tr>
            ${data.standSize ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 13px;">Stand Size</span>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <strong style="color: ${COLORS.secondary}; font-size: 14px;">${data.standSize.toLocaleString()} m²</strong>
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: ${COLORS.lightText}; font-size: 13px;">Price</span>
              </td>
              <td style="padding: 8px 0; text-align: right;">
                <strong style="color: ${COLORS.primary}; font-size: 18px;">${formatCurrency(data.standPrice)}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Timer Warning -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #92400E; font-size: 14px;">
            ⏰ Important: 72-Hour Reservation Window
          </h4>
          <p style="margin: 0; color: #92400E; font-size: 13px; line-height: 1.5;">
            Your reservation expires on <strong>${formatDate(data.expiresAt)}</strong> (${hoursRemaining} hours remaining).
            Please contact us to complete your purchase before this time, or your reservation will be automatically released.
          </p>
        </td>
      </tr>
    </table>
    
    <!-- Next Steps -->
    <h3 style="margin: 0 0 15px 0; color: ${COLORS.secondary}; font-size: 16px;">
      Next Steps
    </h3>
    <ol style="margin: 0 0 25px 0; padding-left: 20px; color: ${COLORS.text}; font-size: 14px; line-height: 1.8;">
      <li>Review the property documentation we'll send you shortly</li>
      <li>Prepare your deposit payment (typically 10-30% of purchase price)</li>
      <li>Contact your assigned agent to schedule a site visit</li>
      <li>Complete the Agreement of Sale documentation</li>
    </ol>
    
    ${data.agentName ? `
    <!-- Agent Contact -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0FDF4; border: 1px solid #22C55E; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #166534; font-size: 14px;">
            Your Agent Contact
          </h4>
          <p style="margin: 0; color: #166534; font-size: 14px;">
            <strong>${data.agentName}</strong><br>
            ${data.agentEmail ? `📧 ${data.agentEmail}<br>` : ''}
            ${data.agentPhone ? `📱 ${data.agentPhone}` : ''}
          </p>
        </td>
      </tr>
    </table>
    ` : ''}
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px; line-height: 1.6;">
      If you have any questions, please don't hesitate to contact us. We're here to help make your property purchase as smooth as possible.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.primary);
}

function generateDeveloperReservationHTML(data: ReservationEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.secondary}; font-size: 22px;">
      New Reservation Alert 📋
    </h2>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Dear ${data.developerName || 'Developer'},
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      A new reservation has been made at your development. Here are the details:
    </p>
    
    <!-- Reservation Summary -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="50%" style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Development</span><br>
                <strong style="color: ${COLORS.secondary}; font-size: 16px;">${data.developmentName}</strong>
              </td>
              <td width="50%" style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Stand</span><br>
                <strong style="color: ${COLORS.secondary}; font-size: 16px;">${data.standNumber}</strong>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Client</span><br>
                <strong style="color: ${COLORS.secondary}; font-size: 16px;">${data.clientName}</strong>
              </td>
              <td width="50%" style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Price</span><br>
                <strong style="color: ${COLORS.primary}; font-size: 16px;">${formatCurrency(data.standPrice)}</strong>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding: 10px 0;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Reserved At</span><br>
                <strong style="color: ${COLORS.secondary}; font-size: 14px;">${formatDate(data.reservationDate)}</strong>
              </td>
              <td width="50%" style="padding: 10px 0; text-align: right;">
                <span style="color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Expires At</span><br>
                <strong style="color: ${COLORS.warning}; font-size: 14px;">${formatDate(data.expiresAt)}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    ${data.agentName ? `
    <p style="margin: 0 0 15px 0; color: ${COLORS.text}; font-size: 14px;">
      <strong>Handling Agent:</strong> ${data.agentName} ${data.agentEmail ? `(${data.agentEmail})` : ''}
    </p>
    ` : ''}
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px; line-height: 1.6;">
      This reservation has a 72-hour window. You will be notified if the reservation converts to a sale or is cancelled.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.primary);
}

function generateInternalReservationHTML(data: ReservationEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.secondary}; font-size: 22px;">
      [INTERNAL] New Reservation Created
    </h2>
    
    <!-- Full Details Table -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <h4 style="margin: 0 0 15px 0; color: ${COLORS.primary}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
            Reservation Details
          </h4>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Reservation ID:</td><td style="padding: 6px 0; text-align: right;"><code style="background: #eee; padding: 2px 6px; border-radius: 4px;">${data.reservationId}</code></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Development:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.developmentName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Stand Number:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Location:</td><td style="padding: 6px 0; text-align: right;">${data.developmentLocation}</td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Price:</td><td style="padding: 6px 0; text-align: right;"><strong style="color: ${COLORS.primary};">${formatCurrency(data.standPrice)}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Branch:</td><td style="padding: 6px 0; text-align: right;">${data.branch}</td></tr>
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Client Name:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.clientName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Client Email:</td><td style="padding: 6px 0; text-align: right;">${data.clientEmail}</td></tr>
            ${data.clientPhone ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Client Phone:</td><td style="padding: 6px 0; text-align: right;">${data.clientPhone}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            ${data.agentName ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Agent:</td><td style="padding: 6px 0; text-align: right;">${data.agentName}</td></tr>` : ''}
            ${data.agentEmail ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Agent Email:</td><td style="padding: 6px 0; text-align: right;">${data.agentEmail}</td></tr>` : ''}
            ${data.developerEmail ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Developer Email:</td><td style="padding: 6px 0; text-align: right;">${data.developerEmail}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Reserved At:</td><td style="padding: 6px 0; text-align: right;">${formatDate(data.reservationDate)}</td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Expires At:</td><td style="padding: 6px 0; text-align: right;"><strong style="color: ${COLORS.warning};">${formatDate(data.expiresAt)}</strong></td></tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 12px;">
      This is an automated internal notification. Monitor the dashboard for status updates.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.secondary);
}

function generateAgentReservationHTML(data: ReservationEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.secondary}; font-size: 22px;">
      Reservation Confirmed! ✅
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Hi ${data.agentName},
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Great news! Your client <strong>${data.clientName}</strong> has successfully reserved <strong>Stand ${data.standNumber}</strong> at ${data.developmentName}.
    </p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0FDF4; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #166534; font-size: 14px;">Property Value</p>
          <p style="margin: 0; color: #166534; font-size: 28px; font-weight: 700;">${formatCurrency(data.standPrice)}</p>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF3C7; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            <strong>⏰ Reminder:</strong> The reservation expires on ${formatDate(data.expiresAt)}. 
            Follow up with your client to complete the sale documentation within the 72-hour window.
          </p>
        </td>
      </tr>
    </table>
    
    <h3 style="margin: 0 0 15px 0; color: ${COLORS.secondary}; font-size: 16px;">Action Items</h3>
    <ul style="margin: 0 0 25px 0; padding-left: 20px; color: ${COLORS.text}; font-size: 14px; line-height: 1.8;">
      <li>Contact client to confirm site visit schedule</li>
      <li>Prepare deposit invoice and payment instructions</li>
      <li>Send Agreement of Sale documentation</li>
      <li>Log all interactions in the CRM</li>
    </ul>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px;">
      Client Contact: ${data.clientEmail} ${data.clientPhone ? `| ${data.clientPhone}` : ''}
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.success);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation Templates
// ─────────────────────────────────────────────────────────────────────────────

function generateClientCancellationHTML(data: ReservationEmailData, reason?: string): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.danger}; font-size: 22px;">
      Reservation Cancelled
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.clientName}</strong>,
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      We regret to inform you that your reservation for <strong>Stand ${data.standNumber}</strong> at <strong>${data.developmentName}</strong> has been cancelled.
    </p>
    
    ${reason ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF2F2; border: 1px solid #EF4444; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0; color: #991B1B; font-size: 14px;">
            <strong>Reason:</strong> ${reason}
          </p>
        </td>
      </tr>
    </table>
    ` : ''}
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 8px 0;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Stand:</span></td>
              <td style="padding: 8px 0; text-align: right;"><strong>${data.standNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Development:</span></td>
              <td style="padding: 8px 0; text-align: right;"><strong>${data.developmentName}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Original Price:</span></td>
              <td style="padding: 8px 0; text-align: right;"><strong>${formatCurrency(data.standPrice)}</strong></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      The stand is now available for other buyers. If you're still interested in this or other properties, please contact us and we'll be happy to assist you.
    </p>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px;">
      We apologize for any inconvenience and hope to serve you in the future.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.danger);
}

function generateDeveloperCancellationHTML(data: ReservationEmailData, reason?: string): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.danger}; font-size: 22px;">
      Reservation Cancelled - Stand Now Available
    </h2>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      A reservation at ${data.developmentName} has been cancelled. The stand is now back on the market.
    </p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Stand:</td><td style="padding: 8px 0; text-align: right;"><strong>${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Client:</td><td style="padding: 8px 0; text-align: right;">${data.clientName}</td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Price:</td><td style="padding: 8px 0; text-align: right;"><strong>${formatCurrency(data.standPrice)}</strong></td></tr>
            ${reason ? `<tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Reason:</td><td style="padding: 8px 0; text-align: right; color: ${COLORS.danger};">${reason}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px;">
      Status: <strong style="color: ${COLORS.success};">AVAILABLE</strong>
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.danger);
}

function generateInternalCancellationHTML(data: ReservationEmailData, reason?: string): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.danger}; font-size: 22px;">
      [INTERNAL] Reservation Cancelled
    </h2>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF2F2; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Reservation ID:</td><td style="padding: 6px 0; text-align: right;"><code>${data.reservationId}</code></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Development:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.developmentName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Stand:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Price:</td><td style="padding: 6px 0; text-align: right;">${formatCurrency(data.standPrice)}</td></tr>
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Client:</td><td style="padding: 6px 0; text-align: right;">${data.clientName}</td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Email:</td><td style="padding: 6px 0; text-align: right;">${data.clientEmail}</td></tr>
            ${data.agentName ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Agent:</td><td style="padding: 6px 0; text-align: right;">${data.agentName}</td></tr>` : ''}
            ${reason ? `<tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr><tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Reason:</td><td style="padding: 6px 0; text-align: right; color: ${COLORS.danger};"><strong>${reason}</strong></td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.success}; font-size: 14px; font-weight: 600;">
      ✓ Stand ${data.standNumber} is now AVAILABLE for sale
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.danger);
}

function generateAgentCancellationHTML(data: ReservationEmailData, reason?: string): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.danger}; font-size: 22px;">
      Reservation Cancelled ❌
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Hi ${data.agentName},
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Unfortunately, the reservation for your client <strong>${data.clientName}</strong> on <strong>Stand ${data.standNumber}</strong> has been cancelled.
    </p>
    
    ${reason ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF2F2; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0; color: #991B1B; font-size: 14px;">
            <strong>Reason:</strong> ${reason}
          </p>
        </td>
      </tr>
    </table>
    ` : ''}
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Property:</td><td style="padding: 8px 0; text-align: right;"><strong>Stand ${data.standNumber}, ${data.developmentName}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Price:</td><td style="padding: 8px 0; text-align: right;">${formatCurrency(data.standPrice)}</td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Client:</td><td style="padding: 8px 0; text-align: right;">${data.clientName}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 15px 0; color: ${COLORS.text}; font-size: 14px;">
      <strong>Stand Status:</strong> <span style="color: ${COLORS.success};">Now Available</span>
    </p>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px;">
      Consider following up with your client to understand their needs better, or present them with alternative properties.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.danger);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale Conversion Templates
// ─────────────────────────────────────────────────────────────────────────────

function generateClientSaleHTML(data: SaleConversionEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.success}; font-size: 22px;">
      Congratulations on Your Purchase! 🎉
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Dear <strong>${data.clientName}</strong>,
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      We are thrilled to confirm that your purchase of <strong>Stand ${data.standNumber}</strong> at <strong>${data.developmentName}</strong> has been finalized. Welcome to the Fine & Country family!
    </p>
    
    <!-- Success Banner -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${COLORS.success} 0%, #047857 100%); border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 30px; text-align: center;">
          <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.85); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
            Your Property
          </p>
          <p style="margin: 0; color: white; font-size: 28px; font-weight: 700;">
            Stand ${data.standNumber}
          </p>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.85); font-size: 16px;">
            ${data.developmentName}
          </p>
        </td>
      </tr>
    </table>
    
    <!-- Purchase Details -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 15px 0; color: ${COLORS.primary}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
            Purchase Summary
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Location</span></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;"><strong>${data.developmentLocation}</strong></td>
            </tr>
            ${data.standSize ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Stand Size</span></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;"><strong>${data.standSize.toLocaleString()} m²</strong></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Purchase Price</span></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;"><strong style="color: ${COLORS.primary}; font-size: 18px;">${formatCurrency(data.standPrice)}</strong></td>
            </tr>
            ${data.depositAmount ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Deposit Paid</span></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;"><strong>${formatCurrency(data.depositAmount)}</strong></td>
            </tr>
            ` : ''}
            ${data.installmentPlan ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Payment Plan</span></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;"><strong>${data.installmentPlan}</strong></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0;"><span style="color: ${COLORS.lightText}; font-size: 13px;">Sale Date</span></td>
              <td style="padding: 8px 0; text-align: right;"><strong>${formatDate(data.saleDate)}</strong></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Next Steps -->
    <h3 style="margin: 0 0 15px 0; color: ${COLORS.secondary}; font-size: 16px;">What's Next?</h3>
    <ol style="margin: 0 0 25px 0; padding-left: 20px; color: ${COLORS.text}; font-size: 14px; line-height: 1.8;">
      <li>You will receive your official Agreement of Sale documents shortly</li>
      <li>Your payment schedule (if applicable) will be emailed separately</li>
      <li>Title documents will be processed upon full payment</li>
      <li>You can access your Client Portal to track your property status</li>
    </ol>
    
    ${data.agentName ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0FDF4; border: 1px solid #22C55E; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #166534; font-size: 14px;">Your Agent</h4>
          <p style="margin: 0; color: #166534; font-size: 14px;">
            <strong>${data.agentName}</strong><br>
            ${data.agentEmail ? `📧 ${data.agentEmail}<br>` : ''}
            ${data.agentPhone ? `📱 ${data.agentPhone}` : ''}
          </p>
        </td>
      </tr>
    </table>
    ` : ''}
    
    <p style="margin: 0; color: ${COLORS.text}; font-size: 14px; line-height: 1.6;">
      Thank you for choosing Fine & Country Zimbabwe. We're honored to be part of your property journey.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.success);
}

function generateDeveloperSaleHTML(data: SaleConversionEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.success}; font-size: 22px;">
      Sale Confirmed! 🎉
    </h2>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Great news! A sale has been finalized at ${data.developmentName}.
    </p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0FDF4; border: 2px solid ${COLORS.success}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 30px; text-align: center;">
          <p style="margin: 0 0 5px 0; color: ${COLORS.lightText}; font-size: 12px; text-transform: uppercase;">Sale Amount</p>
          <p style="margin: 0; color: ${COLORS.success}; font-size: 32px; font-weight: 700;">${formatCurrency(data.standPrice)}</p>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Stand:</td><td style="padding: 8px 0; text-align: right;"><strong>${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Buyer:</td><td style="padding: 8px 0; text-align: right;"><strong>${data.clientName}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Buyer Email:</td><td style="padding: 8px 0; text-align: right;">${data.clientEmail}</td></tr>
            ${data.depositAmount ? `<tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Deposit:</td><td style="padding: 8px 0; text-align: right;">${formatCurrency(data.depositAmount)}</td></tr>` : ''}
            ${data.installmentPlan ? `<tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Payment Plan:</td><td style="padding: 8px 0; text-align: right;">${data.installmentPlan}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Sale Date:</td><td style="padding: 8px 0; text-align: right;">${formatDate(data.saleDate)}</td></tr>
            ${data.agentName ? `<tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr><tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Selling Agent:</td><td style="padding: 8px 0; text-align: right;">${data.agentName}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.lightText}; font-size: 13px;">
      Stand ${data.standNumber} is now marked as <strong style="color: ${COLORS.danger};">SOLD</strong> in the system.
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.success);
}

function generateInternalSaleHTML(data: SaleConversionEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.success}; font-size: 22px;">
      [INTERNAL] Sale Confirmed ✅
    </h2>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0FDF4; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Reservation ID:</td><td style="padding: 6px 0; text-align: right;"><code>${data.reservationId}</code></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Development:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.developmentName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Stand:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Sale Price:</td><td style="padding: 6px 0; text-align: right;"><strong style="color: ${COLORS.success}; font-size: 16px;">${formatCurrency(data.standPrice)}</strong></td></tr>
            ${data.depositAmount ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Deposit:</td><td style="padding: 6px 0; text-align: right;">${formatCurrency(data.depositAmount)}</td></tr>` : ''}
            ${data.installmentPlan ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Payment Plan:</td><td style="padding: 6px 0; text-align: right;">${data.installmentPlan}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Buyer:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.clientName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Email:</td><td style="padding: 6px 0; text-align: right;">${data.clientEmail}</td></tr>
            ${data.clientPhone ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Phone:</td><td style="padding: 6px 0; text-align: right;">${data.clientPhone}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            ${data.agentName ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Agent:</td><td style="padding: 6px 0; text-align: right;"><strong>${data.agentName}</strong></td></tr>` : ''}
            ${data.agentEmail ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Agent Email:</td><td style="padding: 6px 0; text-align: right;">${data.agentEmail}</td></tr>` : ''}
            ${data.developerEmail ? `<tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Developer:</td><td style="padding: 6px 0; text-align: right;">${data.developerEmail}</td></tr>` : ''}
            <tr><td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd;"></td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Sale Date:</td><td style="padding: 6px 0; text-align: right;">${formatDate(data.saleDate)}</td></tr>
            <tr><td style="padding: 6px 0; color: ${COLORS.lightText};">Branch:</td><td style="padding: 6px 0; text-align: right;">${data.branch}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.danger}; font-size: 14px; font-weight: 600;">
      ✓ Stand ${data.standNumber} marked as SOLD
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.success);
}

function generateAgentSaleHTML(data: SaleConversionEmailData): string {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: ${COLORS.success}; font-size: 22px;">
      Congratulations! Sale Closed! 🎉
    </h2>
    
    <p style="margin: 0 0 20px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Hi ${data.agentName},
    </p>
    
    <p style="margin: 0 0 25px 0; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
      Excellent work! Your client <strong>${data.clientName}</strong> has completed the purchase of <strong>Stand ${data.standNumber}</strong> at ${data.developmentName}.
    </p>
    
    <!-- Success Banner -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${COLORS.success} 0%, #047857 100%); border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 30px; text-align: center;">
          <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.85); font-size: 14px;">
            Sale Completed
          </p>
          <p style="margin: 0; color: white; font-size: 36px; font-weight: 700;">
            ${formatCurrency(data.standPrice)}
          </p>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.background}; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 25px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Property:</td><td style="padding: 8px 0; text-align: right;"><strong>Stand ${data.standNumber}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Development:</td><td style="padding: 8px 0; text-align: right;">${data.developmentName}</td></tr>
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Client:</td><td style="padding: 8px 0; text-align: right;"><strong>${data.clientName}</strong></td></tr>
            ${data.depositAmount ? `<tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Deposit Received:</td><td style="padding: 8px 0; text-align: right;">${formatCurrency(data.depositAmount)}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: ${COLORS.lightText};">Sale Date:</td><td style="padding: 8px 0; text-align: right;">${formatDate(data.saleDate)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #92400E; font-size: 14px;">
            💰 Commission Note
          </h4>
          <p style="margin: 0; color: #92400E; font-size: 13px; line-height: 1.5;">
            Your commission for this sale will be calculated based on the development's commission structure and processed according to company policy. Check your Agent Dashboard for commission tracking.
          </p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: ${COLORS.text}; font-size: 14px;">
      Keep up the great work! 🌟
    </p>
  `;
  
  return generateEmailWrapper(content, COLORS.success);
}
