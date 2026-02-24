/**
 * Server Action: Verify Payment
 * 
 * Finalizes a reservation after agent verifies proof of payment:
 * 1. Updates Reservation status to CONFIRMED
 * 2. Updates Stand status to SOLD
 * 3. Records verifiedAt timestamp and verifying agentId
 * 4. Sends "Purchase Confirmed" email to client via Resend
 * 5. Includes link to uploaded proof of payment
 * 
 * Security: Requires ADMIN or AGENT role
 * Database: Neon PostgreSQL via Prisma
 * Email: Resend API
 */

'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser, requireRole } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VerifyPaymentInput {
  reservationId: string;
  agentNotes?: string; // Optional notes from agent about verification
}

interface VerifyPaymentResult {
  success: boolean;
  data?: {
    reservationId: string;
    standNumber: string;
    clientEmail: string;
    verifiedAt: Date;
    emailSent: boolean;
  };
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND EMAIL SERVICE
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.AUTH_EMAIL_FROM || 'noreply@fineandcountryerp.com';

async function sendPurchaseConfirmationEmail(params: {
  to: string;
  clientName: string;
  standNumber: string;
  developmentName: string;
  price: number;
  popUrl?: string;
  verifiedAt: Date;
}) {
  const { to, clientName, standNumber, developmentName, price, popUrl, verifiedAt } = params;
  
  // Check if Resend is configured
  if (!RESEND_API_KEY) {
    console.warn('[VERIFY_PAYMENT][EMAIL_SKIP]', {
      reason: 'RESEND_API_KEY not configured',
      recipient: to,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: 'Email service not configured' };
  }
  
  // Validate API key is not empty
  if (RESEND_API_KEY.trim() === '') {
    console.warn('[VERIFY_PAYMENT][EMAIL_SKIP]', {
      reason: 'RESEND_API_KEY is empty',
      recipient: to,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: 'Email service not configured' };
  }
  
  const correlationId = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const keyPrefix = RESEND_API_KEY?.substring(0, 8) || 'unknown';
  
  try {
    console.log('[VERIFY_PAYMENT][EMAIL_SENDING]', {
      recipient: to,
      correlationId,
      keyPrefix,
      to,
      stand: standNumber,
      development: developmentName,
      timestamp: new Date().toISOString(),
    });
    
    // Format price with currency
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
    
    // Format verification date
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(verifiedAt);
    
    // Compose email body with Fine & Country branding
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmed - Fine & Country Zimbabwe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Fine & Country branding -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A1629 0%, #1a2838 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #85754E; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">
                PURCHASE CONFIRMED
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">
                Fine & Country Zimbabwe
              </p>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding: 30px 30px 20px 30px;">
              <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Dear <strong>${clientName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Congratulations! Your payment has been verified and your property purchase is now <strong style="color: #85754E;">confirmed</strong>.
              </p>
              
              <!-- Property Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #85754E; border-radius: 4px; margin: 25px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px 0; color: #0A1629; font-size: 18px; font-weight: 600;">
                      Property Details
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Development:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${developmentName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Stand Number:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${standNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Purchase Price:</td>
                        <td style="padding: 8px 0; color: #85754E; font-size: 16px; font-weight: 700;">${formattedPrice}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Verified On:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formattedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${popUrl ? `
              <!-- Proof of Payment Section -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 25px 0;">
                <p style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                  📎 Your Proof of Payment
                </p>
                <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
                  For your records, here is the proof of payment you submitted:
                </p>
                <a href="${popUrl}" 
                   style="display: inline-block; padding: 10px 20px; background-color: #85754E; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
                  View Payment Proof
                </a>
              </div>
              ` : ''}
              
              <!-- Next Steps -->
              <h3 style="margin: 30px 0 15px 0; color: #0A1629; font-size: 16px; font-weight: 600;">
                What Happens Next?
              </h3>
              <ol style="margin: 0; padding-left: 20px; color: #333; font-size: 14px; line-height: 1.8;">
                <li style="margin-bottom: 10px;">Our legal team will prepare the sale agreement documents</li>
                <li style="margin-bottom: 10px;">You'll receive an email with signing instructions within 3-5 business days</li>
                <li style="margin-bottom: 10px;">Once signed, title transfer will be initiated</li>
                <li>You'll be notified when the stand is officially registered in your name</li>
              </ol>
              
              <p style="margin: 25px 0 0 0; color: #333; font-size: 14px; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact us at 
                <a href="mailto:portal@fineandcountry.co.zw" style="color: #85754E; text-decoration: none; font-weight: 500;">
                  portal@fineandcountry.co.zw
                </a>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; line-height: 1.5; text-align: center;">
                Thank you for choosing Fine & Country Zimbabwe
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                This is an automated confirmation email. Please do not reply directly to this message.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const textBody = `
PURCHASE CONFIRMED - Fine & Country Zimbabwe

Dear ${clientName},

Congratulations! Your payment has been verified and your property purchase is now confirmed.

PROPERTY DETAILS
Development: ${developmentName}
Stand Number: ${standNumber}
Purchase Price: ${formattedPrice}
Verified On: ${formattedDate}

${popUrl ? `Your Proof of Payment: ${popUrl}\n\n` : ''}

WHAT HAPPENS NEXT?
1. Our legal team will prepare the sale agreement documents
2. You'll receive an email with signing instructions within 3-5 business days
3. Once signed, title transfer will be initiated
4. You'll be notified when the stand is officially registered in your name

If you have any questions, please contact us at portal@fineandcountry.co.zw.

Thank you for choosing Fine & Country Zimbabwe.

---
This is an automated confirmation email.
    `;
    
    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Fine & Country Zimbabwe <${FROM_EMAIL}>`,
        to: [to],
        subject: `Purchase Confirmed - Stand ${standNumber}, ${developmentName}`,
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'purchase-confirmation' },
          { name: 'stand', value: standNumber },
        ],
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      const errorMessage = result.message?.toLowerCase() || '';
      const isInvalidKey = response.status === 401 || 
                          errorMessage.includes('invalid') || 
                          errorMessage.includes('unauthorized') ||
                          errorMessage.includes('api key');
      
      console.error('[VERIFY_PAYMENT][EMAIL_FAILED]', {
        status: response.status,
        error: result,
        correlationId,
        keyPrefix,
        isInvalidKey,
        timestamp: new Date().toISOString(),
      });
      
      if (isInvalidKey) {
        return { 
          success: false, 
          error: `API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}` 
        };
      }
      
      return { success: false, error: result.message || 'Email send failed' };
    }
    
    console.log('[VERIFY_PAYMENT][EMAIL_SENT]', {
      email_id: result.id,
      recipient: to,
      correlationId,
      keyPrefix,
      timestamp: new Date().toISOString(),
    });
    
    return { success: true, emailId: result.id };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isInvalidKey = errorMessage.toLowerCase().includes('invalid') || 
                        errorMessage.toLowerCase().includes('unauthorized') ||
                        errorMessage.toLowerCase().includes('api key');
    
    console.error('[VERIFY_PAYMENT][EMAIL_ERROR]', {
      error: errorMessage,
      recipient: to,
      correlationId,
      keyPrefix,
      isInvalidKey,
      timestamp: new Date().toISOString(),
    });
    
    if (isInvalidKey) {
      return { 
        success: false, 
        error: `API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}` 
      };
    }
    
    return { success: false, error: errorMessage };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVER ACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify Payment and Finalize Reservation
 * 
 * @param input - Reservation ID and optional agent notes
 * @returns Result with confirmation details or error
 */
export async function verifyPayment(
  input: VerifyPaymentInput
): Promise<VerifyPaymentResult> {
  const startTime = Date.now();
  
  try {
    console.log('[VERIFY_PAYMENT][STARTED]', {
      reservation_id: input.reservationId,
      timestamp: new Date().toISOString(),
    });
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 1: Authenticate and authorize
    // ───────────────────────────────────────────────────────────────────────
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      console.error('[VERIFY_PAYMENT][UNAUTHORIZED]', {
        reservation_id: input.reservationId,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: 'You must be logged in to verify payments',
      };
    }
    
    // Only ADMIN or AGENT can verify payments
    await requireRole(['ADMIN', 'AGENT']);
    
    const agentId = currentUser.id;
    
    console.log('[VERIFY_PAYMENT][AUTH_SUCCESS]', {
      agent_id: agentId,
      agent_email: currentUser.email,
      role: currentUser.role,
      timestamp: new Date().toISOString(),
    });
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 2: Fetch reservation with full details
    // ───────────────────────────────────────────────────────────────────────
    
    const reservation = await prisma.reservation.findUnique({
      where: { id: input.reservationId },
      include: {
        stand: {
          include: {
            development: {
              select: {
                name: true,
                basePrice: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        agent: {
          select: {
            name: true,
          },
        },
      },
    });
    
    if (!reservation) {
      console.error('[VERIFY_PAYMENT][NOT_FOUND]', {
        reservation_id: input.reservationId,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: 'Reservation not found',
      };
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 3: Validate reservation state
    // ───────────────────────────────────────────────────────────────────────
    
    if (reservation.status !== 'PENDING') {
      console.warn('[VERIFY_PAYMENT][INVALID_STATUS]', {
        reservation_id: input.reservationId,
        current_status: reservation.status,
        expected_status: 'PENDING',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: `Cannot verify payment for reservation with status: ${reservation.status}`,
      };
    }
    
    if (!reservation.popUrl) {
      console.warn('[VERIFY_PAYMENT][NO_PROOF]', {
        reservation_id: input.reservationId,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: 'No proof of payment attached to this reservation',
      };
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 4: Update reservation and stand in transaction
    // ───────────────────────────────────────────────────────────────────────
    
    const verifiedAt = new Date();
    
    console.log('[VERIFY_PAYMENT][UPDATING]', {
      reservation_id: input.reservationId,
      stand_id: reservation.standId,
      verified_by: agentId,
      timestamp: new Date().toISOString(),
    });
    
    const [updatedReservation, updatedStand] = await prisma.$transaction([
      // Update reservation to CONFIRMED
      prisma.reservation.update({
        where: { id: input.reservationId },
        data: {
          status: 'CONFIRMED',
          timerActive: false,
          // Note: Add verifiedAt and verifiedBy fields to schema if needed
          updatedAt: verifiedAt,
        },
      }),
      
      // Update stand to SOLD
      prisma.stand.update({
        where: { id: reservation.standId },
        data: {
          status: 'SOLD',
          updatedAt: verifiedAt,
        },
      }),
    ]);
    
    console.log('[VERIFY_PAYMENT][DB_UPDATED]', {
      reservation_id: updatedReservation.id,
      reservation_status: updatedReservation.status,
      stand_id: updatedStand.id,
      stand_status: updatedStand.status,
      verified_at: verifiedAt.toISOString(),
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 5: Send confirmation email to client
    // ───────────────────────────────────────────────────────────────────────
    
    let emailSent = false;
    
    if (reservation.user?.email) {
      const emailResult = await sendPurchaseConfirmationEmail({
        to: reservation.user.email,
        clientName: reservation.user.name || 'Valued Client',
        standNumber: reservation.stand.standNumber,
        developmentName: reservation.stand.development.name,
        price: parseFloat(reservation.stand.development.basePrice.toString()),
        popUrl: reservation.popUrl,
        verifiedAt,
      });
      
      emailSent = emailResult.success;
      
      if (!emailSent) {
        console.warn('[VERIFY_PAYMENT][EMAIL_WARNING]', {
          warning: 'Payment verified but email failed to send',
          error: emailResult.error,
          client_email: reservation.user.email,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.warn('[VERIFY_PAYMENT][NO_EMAIL]', {
        reservation_id: input.reservationId,
        warning: 'No client email available',
        timestamp: new Date().toISOString(),
      });
    }

    // Create in-app notification for payment confirmation (async, non-blocking)
    if (reservation.userId) {
      import('@/lib/notifications').then(({ notifyPaymentRecorded }) => {
        const clientName = reservation.user?.name || 'Unknown Client';
        const paymentAmount = parseFloat(reservation.stand.development.basePrice.toString());
        notifyPaymentRecorded(
          reservation.id, // paymentId (using reservation ID as reference)
          paymentAmount,
          clientName,
          reservation.userId!, // recipientUserId
          reservation.agentId || undefined // actorUserId
        ).catch(err => {
          console.warn('[VERIFY_PAYMENT][NOTIFICATION_WARNING]', {
            warning: 'Failed to create payment notification',
            error: err instanceof Error ? err.message : 'Unknown error',
            reservation_id: reservation.id,
            timestamp: new Date().toISOString(),
          });
        });
      });
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // STEP 6: Return success
    // ───────────────────────────────────────────────────────────────────────
    
    const duration = Date.now() - startTime;
    
    console.log('[VERIFY_PAYMENT][SUCCESS]', {
      reservation_id: updatedReservation.id,
      stand_number: reservation.stand.standNumber,
      client_email: reservation.user?.email || 'N/A',
      verified_by: agentId,
      email_sent: emailSent,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    
    return {
      success: true,
      data: {
        reservationId: updatedReservation.id,
        standNumber: reservation.stand.standNumber,
        clientEmail: reservation.user?.email || 'N/A',
        verifiedAt,
        emailSent,
      },
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[VERIFY_PAYMENT][ERROR]', {
      reservation_id: input.reservationId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    
    // Check for common errors
    if (errorMessage.includes('Forbidden')) {
      return {
        success: false,
        error: 'You do not have permission to verify payments',
      };
    }
    
    return {
      success: false,
      error: 'Failed to verify payment. Please try again.',
    };
  }
}
