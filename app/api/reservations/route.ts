/**
 * POST /api/reservations
 * 
 * Single canonical endpoint for creating reservations.
 * 
 * Features:
 * - Atomic transaction for concurrency safety
 * - Idempotency via email + standId + time window check
 * - Prospect linking for non-logged-in users
 * - Fire-and-forget email notifications
 * 
 * Payload (camelCase):
 * - standId (required)
 * - developmentId (required)
 * - clientId (optional - if logged in)
 * - prospectDetails (optional - if not logged in):
 *   - name
 *   - email
 *   - phone
 * - agentId (optional)
 * - source = "client|agent|developer"
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendEmail } from '@/lib/email-service';

// Validation schema types
interface ReservationRequest {
  standId: string;
  developmentId: string;
  clientId?: string;
  prospectDetails?: {
    name: string;
    email: string;
    phone?: string;
  };
  agentId?: string;
  source?: 'client' | 'agent' | 'developer';
}

// Email HTML generator for reservation confirmation
function generateReservationConfirmationHTML(params: {
  name: string;
  standNumber: string;
  developmentName: string;
  expiresAt: Date;
  reservationId: string;
  dashboardUrl: string;
}): string {
  const { name, standNumber, developmentName, expiresAt, reservationId, dashboardUrl } = params;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #D4AF37 0%, #F59E0B 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✓ Reservation Confirmed</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 18px; margin-bottom: 20px;">Hi ${name},</p>
        
        <p style="color: #475569; margin-bottom: 24px;">
          Your stand reservation has been confirmed! Here are your reservation details:
        </p>
        
        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Stand Number</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #D4AF37;">${standNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Development</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${developmentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Reservation ID</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${reservationId.substring(0, 8)}...</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Expires</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ef4444;">${expiresAt.toLocaleDateString()} ${expiresAt.toLocaleTimeString()}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>⚠️ Important:</strong> You have 72 hours to complete your deposit payment. 
            Failure to pay within this time will result in automatic cancellation.
          </p>
        </div>
        
        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F59E0B 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; margin-bottom: 24px;">
          View Dashboard
        </a>
        
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          If you have any questions, please contact our team.
        </p>
      </div>
    </body>
    </html>
  `;
}

// Admin notification email
function generateAdminNotificationHTML(params: {
  standNumber: string;
  developmentName: string;
  clientName: string;
  clientEmail: string;
  agentName?: string;
  reservationId: string;
}): string {
  const { standNumber, developmentName, clientName, clientEmail, agentName, reservationId } = params;
  
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #D4AF37;">📍 New Reservation</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Stand</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${standNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Development</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${developmentName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Client</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${clientName} (${clientEmail})</td>
        </tr>
        ${agentName ? `<tr><td style="padding: 8px;"><strong>Agent</strong></td><td style="padding: 8px;">${agentName}</td></tr>` : ''}
        <tr>
          <td style="padding: 8px;"><strong>Reservation ID</strong></td>
          <td style="padding: 8px;">${reservationId}</td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ReservationRequest = await request.json();
    const { standId, developmentId, clientId, prospectDetails, agentId, source = 'client' } = body;

    // Validate required fields
    if (!standId || !developmentId) {
      return apiError('standId and developmentId are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Handle client/prospect
    let client = null;
    let prospectEmail = prospectDetails?.email;
    let prospectName = prospectDetails?.name;
    
    if (clientId) {
      // Logged-in user
      client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      
      if (client) {
        prospectEmail = client.email;
        prospectName = client.name;
      }
    } else if (prospectDetails) {
      // Find or create prospect/client record
      const normalizedEmail = prospectDetails.email.toLowerCase().trim();
      prospectEmail = normalizedEmail;
      prospectName = prospectDetails.name;

      client = await prisma.client.findFirst({
        where: {
          email: normalizedEmail,
          branch: 'Harare',
        },
      });

      if (!client) {
        // Create new client/prospect record
        client = await prisma.client.create({
          data: {
            name: prospectDetails.name.trim(),
            email: normalizedEmail,
            phone: prospectDetails.phone?.trim() || null,
            branch: 'Harare',
            isPortalUser: false,
          },
        });

        logger.info('Created prospect record during reservation', {
          module: 'API',
          action: 'CREATE_RESERVATION',
          clientId: client.id,
          email: normalizedEmail,
        });
      }
    }

    if (!client) {
      return apiError('Client information required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check for idempotency - find recent reservation for same client + stand
    const idempotencyWindow = 5 * 60 * 1000; // 5 minutes
    const recentReservation = await prisma.reservation.findFirst({
      where: {
        standId,
        clientId: client.id,
        createdAt: {
          gte: new Date(Date.now() - idempotencyWindow),
        },
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
      include: {
        stand: { include: { development: true } },
        client: true,
      },
    });

    if (recentReservation) {
      logger.info('Returning existing reservation (idempotent request)', {
        module: 'API',
        action: 'CREATE_RESERVATION_IDEMPOTENT',
        reservationId: recentReservation.id,
        clientId: client.id,
        standId,
      });

      return apiSuccess({
        reservationId: recentReservation.id,
        standNumber: recentReservation.stand.standNumber,
        expiresAt: recentReservation.expiresAt.toISOString(),
        success: true,
        idempotent: true,
        message: 'Reservation already exists',
      }, 200);
    }

    // Fetch stand with development details
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      include: {
        development: true,
      },
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (stand.status !== 'AVAILABLE') {
      return apiError('Stand is not available for reservation', 400, ErrorCodes.CONFLICT, {
        currentStatus: stand.status,
      });
    }

    // Get or create user if needed
    let user = null;
    if (client.isPortalUser) {
      user = await prisma.user.findFirst({
        where: { email: client.email.toLowerCase() },
      });
    }

    // Calculate expiration (72 hours from now)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Create reservation and update stand atomically
    const reservation = await prisma.$transaction(async (tx) => {
      // Double-check stand availability within transaction
      const currentStand = await tx.stand.findUnique({
        where: { id: standId },
      });

      if (!currentStand || currentStand.status !== 'AVAILABLE') {
        throw new Error('Stand no longer available');
      }

      // Create reservation
      const newReservation = await tx.reservation.create({
        data: {
          standId,
          clientId: client!.id,
          userId: user?.id || null,
          agentId: agentId || null,
          status: 'PENDING',
          expiresAt,
          termsAcceptedAt: new Date(),
          timerActive: true,
        },
        include: {
          stand: { include: { development: true } },
          client: true,
          agent: true,
        },
      });

      // Update stand status atomically
      await tx.stand.update({
        where: { id: standId },
        data: { status: 'RESERVED' },
      });

      return newReservation;
    });

    logger.info('Reservation created successfully', {
      module: 'API',
      action: 'CREATE_RESERVATION',
      reservationId: reservation.id,
      standId,
      clientId: client.id,
      expiresAt: reservation.expiresAt,
    });

    // Fire-and-forget email sending (don't block response)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.fineandcountryerp.com';
    const dashboardUrl = `${baseUrl}/dashboards/client`;
    const setupPasswordUrl = `${baseUrl}/set-password?email=${encodeURIComponent(prospectEmail || client.email)}`;

    // Send confirmation email
    sendEmail({
      to: prospectEmail || client.email,
      subject: `✓ Reservation Confirmed - Stand ${reservation.stand.standNumber}`,
      html: generateReservationConfirmationHTML({
        name: prospectName || client.name,
        standNumber: reservation.stand.standNumber,
        developmentName: reservation.stand.development?.name || 'Development',
        expiresAt: reservation.expiresAt,
        reservationId: reservation.id,
        dashboardUrl,
      }),
    }).catch((emailError) => {
      logger.error('Failed to send reservation confirmation email', emailError as Error, {
        module: 'API',
        action: 'SEND_RESERVATION_EMAIL',
        reservationId: reservation.id,
        email: prospectEmail || client.email,
      });
    });

    // Send admin notification
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'reservations@fineandcountry.co.zw';
    sendEmail({
      to: adminEmail,
      subject: `📍 New Reservation - Stand ${reservation.stand.standNumber}`,
      html: generateAdminNotificationHTML({
        standNumber: reservation.stand.standNumber,
        developmentName: reservation.stand.development?.name || 'Development',
        clientName: client.name,
        clientEmail: client.email,
        agentName: reservation.agent?.name || undefined,
        reservationId: reservation.id,
      }),
    }).catch((emailError) => {
      logger.error('Failed to send admin notification email', emailError as Error, {
        module: 'API',
        action: 'SEND_ADMIN_NOTIFICATION_EMAIL',
        reservationId: reservation.id,
      });
    });

    // Return success immediately (emails sent in background)
    return apiSuccess({
      reservationId: reservation.id,
      standNumber: reservation.stand.standNumber,
      developmentName: reservation.stand.development?.name,
      expiresAt: reservation.expiresAt.toISOString(),
      success: true,
      needsPasswordSetup: !user,
      passwordSetupUrl: setupPasswordUrl,
      dashboardUrl,
    }, 201);

  } catch (error: any) {
    logger.error('Reservation creation failed', error as Error, {
      module: 'API',
      action: 'CREATE_RESERVATION',
      errorMessage: error.message,
    });

    // Handle specific errors
    if (error.message.includes('no longer available')) {
      return apiError('Stand is no longer available. It may have been reserved by another user.', 409, ErrorCodes.CONFLICT);
    }

    return apiError(
      error.message || 'Failed to create reservation',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// GET - Get reservation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');
    const clientEmail = searchParams.get('email');
    const standId = searchParams.get('standId');

    if (!reservationId && !(clientEmail && standId)) {
      return apiError('reservationId or (email + standId) required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const where: any = {};
    if (reservationId) where.id = reservationId;
    if (clientEmail && standId) {
      where.standId = standId;
      where.client = { email: clientEmail.toLowerCase() };
      where.status = { in: ['PENDING', 'CONFIRMED'] };
    }

    const reservation = await prisma.reservation.findFirst({
      where,
      include: {
        stand: { include: { development: true } },
        client: true,
        agent: true,
      },
    });

    if (!reservation) {
      return apiError('Reservation not found', 404, ErrorCodes.NOT_FOUND);
    }

    return apiSuccess({
      reservationId: reservation.id,
      standNumber: reservation.stand.standNumber,
      developmentName: reservation.stand.development?.name,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    }, 200);

  } catch (error: any) {
    logger.error('Failed to get reservation', error as Error, {
      module: 'API',
      action: 'GET_RESERVATION',
    });
    return apiError('Failed to get reservation', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
