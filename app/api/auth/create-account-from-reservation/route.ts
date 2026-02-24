import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendEmail } from '@/lib/email-service';
import { validateRequest } from '@/lib/validation/middleware';
import { createAccountFromReservationSchema, setPasswordSchema } from '@/lib/validation/schemas';
import { updateUserPasswordWithHistory } from '@/lib/password-history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/auth/create-account-from-reservation
 * Create a CLIENT account automatically from reservation flow
 * This endpoint is public (no auth required) as users are creating their own accounts
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, createAccountFromReservationSchema, {
      module: 'API',
      action: 'POST_CREATE_ACCOUNT_FROM_RESERVATION'
    });
    
    if (!validation.success) {
      logger.warn('POST validation failed', {
        module: 'API',
        action: 'POST_CREATE_ACCOUNT_FROM_RESERVATION',
        errorCode: validation.error.status
      });
      return validation.error;
    }

    const { email, name, phone, idNumber, idDocumentUrl, reservationData } = validation.data;
    
    // Normalize branch (default to Harare) and email
    const branch = 'Harare';
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      // User exists - log them in or return existing account info
      logger.info('Account already exists for reservation', {
        module: 'API',
        action: 'CREATE_ACCOUNT_FROM_RESERVATION',
        userId: existingUser.id,
        email: email.substring(0, 3) + '***'
      });

      // Check if they need to set a password (account created but not activated)
      if (!existingUser.password) {
        // Account exists but no password - they need to set one
        return apiError(
          'An account with this email exists but needs activation. Please check your email for activation instructions.',
          409,
          ErrorCodes.CONFLICT,
          { needsActivation: true, userId: existingUser.id }
        );
      }

      // Account exists and is active - return success (they can log in)
      return apiSuccess({
        message: 'Account already exists. Please log in to continue.',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role
        },
        existingAccount: true
      });
    }

    // Create new CLIENT account WITHOUT password
    // Password will be set in a separate step via PUT endpoint
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: 'CLIENT',
        branch: reservationData?.standId ? 'Harare' : 'Harare', // Default branch, can be updated
        password: null, // No password yet - user will set it in next step
        isActive: true,
        lastLogin: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branch: true,
        isActive: true,
        createdAt: true
      }
    });

    logger.info('Account created from reservation', {
      module: 'API',
      action: 'CREATE_ACCOUNT_FROM_RESERVATION',
      userId: newUser.id,
      email: email.substring(0, 3) + '***',
      hasReservationData: !!reservationData
    });

    // Create client record if it doesn't exist
    // Note: Client model doesn't have userId field - User and Client are linked by email
    // Client has unique constraint on [email, branch]
    let client = await prisma.client.findFirst({
      where: {
        email: normalizedEmail,
        branch: branch
      }
    });

    // Prepare KYC data if idDocumentUrl is provided
    const kycData = idDocumentUrl ? [{
      documentType: 'national_id',
      url: idDocumentUrl,
      uploadedAt: new Date().toISOString(),
      status: 'Pending'
    }] : [];

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone?.trim() || null,
          nationalId: idNumber?.trim() || null,
          branch: branch,
          isPortalUser: true, // Mark as portal user since account was created
          kyc: kycData.length > 0 ? kycData : [],
        }
      });
    } else {
      // Update existing client with new info
      const existingKyc = Array.isArray(client.kyc) ? client.kyc : [];
      const updatedKyc = idDocumentUrl && !existingKyc.some((k: any) => k.url === idDocumentUrl)
        ? [...existingKyc, ...kycData]
        : existingKyc;
      
      await prisma.client.update({
        where: { id: client.id },
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone?.trim() || client.phone,
          nationalId: idNumber?.trim() || client.nationalId,
          isPortalUser: true, // Ensure marked as portal user
          kyc: updatedKyc as any,
        }
      });
    }

    // Create reservation if reservationData is provided
    let reservation: any = null;
    let standData: any = null;
    if (reservationData?.standId) {
      try {
        // First fetch the stand to use later
        standData = await prisma.stand.findUnique({
          where: { id: reservationData.standId },
          include: { development: true }
        });

        if (!standData) {
          throw new Error('Stand not found');
        }

        if (standData.status !== 'AVAILABLE') {
          throw new Error('Stand is not available for reservation');
        }

        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
        
        // Use transaction for atomic reservation creation (prevents race conditions)
        reservation = await prisma.$transaction(async (tx) => {
          // Create reservation and update stand atomically
          const newReservation = await tx.reservation.create({
            data: {
              standId: reservationData.standId!,
              clientId: client.id,
              userId: newUser.id,
              agentId: reservationData.agentId || null,
              status: 'PENDING',
              expiresAt: expiresAt,
              termsAcceptedAt: new Date(),
              timerActive: true
            },
            include: {
              stand: { include: { development: true } },
              client: true
            }
          });

          // Update stand status atomically
          await tx.stand.update({
            where: { id: reservationData.standId },
            data: { status: 'RESERVED' }
          });

          return newReservation;
        });

        logger.info('Reservation created atomically with account', {
          module: 'API',
          action: 'CREATE_ACCOUNT_FROM_RESERVATION',
          reservationId: reservation.id,
          standId: reservationData.standId
        });
      } catch (reservationError: any) {
        // Log but don't fail account creation if reservation fails
        logger.error('Failed to create reservation during account creation', reservationError, {
          module: 'API',
          action: 'CREATE_ACCOUNT_FROM_RESERVATION',
          error: reservationError.message
        });
      }
    }

    // Claim any existing unclaimed reservations for this email/phone
    // This handles the case where user reserved before creating account
    // Must be called AFTER client is created
    try {
      const { claimReservationsForUser } = await import('@/lib/reservation-claim');
      const claimResult = await claimReservationsForUser({
        userId: newUser.id,
        clientId: client.id,
        email: normalizedEmail,
        phone: phone?.trim(),
      });

      if (claimResult.claimed > 0) {
        logger.info('Claimed existing reservations', {
          module: 'API',
          action: 'CLAIM_RESERVATIONS',
          userId: newUser.id,
          claimed: claimResult.claimed,
        });
      }
    } catch (claimError: any) {
      // Non-fatal - log but don't block account creation
      logger.warn('Failed to claim existing reservations', {
        module: 'API',
        action: 'CLAIM_RESERVATIONS',
        userId: newUser.id,
        error: claimError?.message
      });
    }

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: 'USER_ACCOUNT_CREATED_FROM_RESERVATION',
        resourceType: 'USER',
        resourceId: newUser.id,
        userId: newUser.id,
        details: {
          email: email.substring(0, 3) + '***',
          name: name,
          phone: phone ? phone.substring(0, 3) + '***' : null,
          hasReservation: !!reservation,
          reservationId: reservation?.id || null,
          method: 'reservation_flow'
        },
        branch: 'Harare'
      }
    });

    // Send single combined email
    // AWAIT email to ensure it's sent (user needs to know if it failed)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.fineandcountryerp.com';
    const setupPasswordUrl = `${baseUrl}/set-password?email=${encodeURIComponent(email)}`;
    
    try {
      if (reservation) {
        // Send combined welcome + reservation email
        await sendEmail({
          to: email,
          subject: 'Welcome! Your Reservation is Confirmed - Set Up Password',
          html: generateWelcomeWithReservationHTML({
            name: name.trim(),
            email,
            setupPasswordUrl,
            standNumber: reservation.stand.standNumber,
            developmentName: reservation.stand.development?.name || 'Development',
            expiresAt: reservation.expiresAt, // ✅ Use DB value, not recalculated
            reservationId: reservation.id,
          }),
        });
        
        logger.info('Combined welcome + reservation email sent', {
          module: 'API',
          action: 'SEND_COMBINED_EMAIL',
          email: email.substring(0, 3) + '***',
          reservationId: reservation.id
        });
      } else {
        // Send simple welcome email (no reservation)
        await sendEmail({
          to: email,
          subject: 'Welcome to Fine & Country Zimbabwe - Set Up Your Account',
          html: generateSimpleWelcomeHTML({
            name: name.trim(),
            email,
            setupPasswordUrl,
          }),
        });
        
        logger.info('Welcome email sent', {
          module: 'API',
          action: 'SEND_WELCOME_EMAIL',
          email: email.substring(0, 3) + '***'
        });
      }
    } catch (emailError: any) {
      // Log error but don't fail account creation
      logger.error('Failed to send email (non-fatal)', emailError, {
        module: 'API',
        action: 'SEND_EMAIL',
        email: email.substring(0, 3) + '***',
        error: emailError.message
      });
      
      // Return warning in response so user knows email failed
      return apiSuccess({
        message: 'Account created successfully, but email delivery failed. Please use the password reset feature to set your password.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        },
        client: {
          id: client.id,
          name: client.name
        },
        reservation: reservation ? {
          id: reservation.id,
          standNumber: reservation.stand.standNumber,
          expiresAt: reservation.expiresAt
        } : null,
        needsPasswordSetup: true,
        emailWarning: 'Email delivery failed. You can still set your password using the password reset feature.'
      }, 201);
    }

    return apiSuccess({
      message: 'Account created successfully. Please set your password to continue.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      client: {
        id: client.id,
        name: client.name
      },
      reservation: reservation ? {
        id: reservation.id,
        standNumber: reservation.stand.standNumber,
        expiresAt: reservation.expiresAt
      } : null,
      needsPasswordSetup: true
    }, 201);

  } catch (error: any) {
    logger.error('Account creation from reservation error', error, {
      module: 'API',
      action: 'CREATE_ACCOUNT_FROM_RESERVATION',
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack?.split('\n')[0]
    });
    return apiError(
      error?.message || 'Failed to create account',
      500,
      ErrorCodes.INTERNAL_ERROR,
      {
        errorType: error?.constructor?.name,
        errorCode: error?.code
      }
    );
  }
}

/**
 * PUT /api/auth/create-account-from-reservation
 * Set password for an account created from reservation flow
 */
export async function PUT(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, setPasswordSchema, {
      module: 'API',
      action: 'PUT_CREATE_ACCOUNT_FROM_RESERVATION'
    });
    
    if (!validation.success) {
      logger.warn('PUT validation failed', {
        module: 'API',
        action: 'PUT_CREATE_ACCOUNT_FROM_RESERVATION',
        errorCode: validation.error.status
      });
      return validation.error;
    }

    const { email, password } = validation.data;

    // Find user by email (email is already normalized by schema)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, branch: true }
    });

    if (!user) {
      return apiError('Account not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Public endpoint hardening: only allow initial password set for accounts with no password yet
    if (user.password) {
      return apiError(
        'Password is already set for this account. Please use the reset password flow.',
        409,
        ErrorCodes.CONFLICT
      );
    }

    const passwordUpdate = await updateUserPasswordWithHistory({
      userId: user.id,
      newPassword: password,
      extraUserUpdate: {},
    });

    if (!passwordUpdate.ok) {
      const code =
        passwordUpdate.code === 'PASSWORD_REUSE'
          ? ErrorCodes.PASSWORD_REUSE
          : ErrorCodes.PASSWORD_COMPLEXITY;
      return apiError(passwordUpdate.message, 400, code);
    }

    logger.info('Password set for account', {
      module: 'API',
      action: 'PUT_CREATE_ACCOUNT_FROM_RESERVATION',
      userId: user.id,
      email: email.substring(0, 3) + '***'
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: 'PASSWORD_SET_FROM_RESERVATION',
        resourceType: 'USER',
        resourceId: user.id,
        userId: user.id,
        details: {
          email: email.substring(0, 3) + '***',
          method: 'reservation_flow'
        },
        branch: user.branch || 'Harare'
      }
    });

    return apiSuccess({
      message: 'Password set successfully. You can now access your dashboard.'
    });

  } catch (error: any) {
    logger.error('Password setup error', error, {
      module: 'API',
      action: 'PUT_CREATE_ACCOUNT_FROM_RESERVATION'
    });
    return apiError(
      error?.message || 'Failed to set password',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML Generators
// ─────────────────────────────────────────────────────────────────────────────

function generateWelcomeWithReservationHTML(params: {
  name: string;
  email: string;
  setupPasswordUrl: string;
  standNumber: string;
  developmentName: string;
  expiresAt: Date;
  reservationId: string;
}): string {
  const { name, email, setupPasswordUrl, standNumber, developmentName, expiresAt, reservationId } = params;
  
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-ZW', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9f8f6; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .details-box { background: #ecfdf5; border: 1px solid #059669; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .details-box h3 { color: #059669; margin: 0 0 15px 0; }
          .warning-box { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .info-box { background: #e0f2fe; border: 1px solid #0284c7; color: #075985; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f9f8f6; padding: 30px; text-align: center; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .cta-button { display: inline-block; background: #059669; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 10px 0; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Welcome & Reservation Confirmed!</h1>
            <p>Stand ${standNumber} - ${developmentName}</p>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>
            <p>Great news! Your account has been created and your reservation is confirmed.</p>
            
            <div class="info-box">
              <strong>🔐 IMPORTANT: Set Your Password Now</strong><br>
              To access your client dashboard and complete your purchase, you must set up your password first.
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${setupPasswordUrl}" class="cta-button">SET UP PASSWORD NOW</a>
            </div>
            
            <div class="details-box">
              <h3>Your Reservation Details</h3>
              <p><strong>Stand Number:</strong> ${standNumber}</p>
              <p><strong>Development:</strong> ${developmentName}</p>
              <p><strong>Reservation ID:</strong> ${reservationId.substring(0, 8).toUpperCase()}</p>
              <p><strong>Your Email:</strong> ${email}</p>
              <p><strong>Status:</strong> Pending Payment</p>
            </div>
            
            <div class="warning-box">
              <strong>⏱️ Important:</strong> Your reservation expires on <strong>${expiryDate}</strong>.<br>
              Please set your password and make the deposit payment before this time to secure your stand.
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ol style="line-height: 1.8;">
              <li>Click the button above to set your password</li>
              <li>You'll be automatically logged into your dashboard</li>
              <li>View full reservation details and payment instructions</li>
              <li>Upload proof of payment to complete your purchase</li>
            </ol>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have any questions, please contact our sales team.
            </p>
          </div>
          <div class="footer">
            <p><strong>Fine & Country Zimbabwe</strong></p>
            <p>Zimbabwe's Premier Real Estate Platform</p>
            <p style="margin-top: 15px; font-size: 11px;">
              If the button doesn't work, copy and paste this link:<br>
              <a href="${setupPasswordUrl}" style="color: #059669; word-break: break-all;">${setupPasswordUrl}</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateSimpleWelcomeHTML(params: {
  name: string;
  email: string;
  setupPasswordUrl: string;
}): string {
  const { name, email, setupPasswordUrl } = params;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9f8f6; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #85754E 0%, #6B5D3E 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .cta-button { display: inline-block; background: #85754E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 20px 0; }
          .footer { background: #f9f8f6; padding: 30px; text-align: center; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .info-box { background: #f5f5f5; border-left: 4px solid #85754E; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Fine & Country</h1>
            <p>Zimbabwe's Premier Real Estate Platform</p>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your account has been created successfully! To get started, you need to set up your password.</p>
            
            <div class="info-box">
              <p><strong>Your Account Details:</strong></p>
              <p>Email: ${email}</p>
              <p>Account Type: Client</p>
            </div>
            
            <p>Click the button below to set up your password and access your dashboard:</p>
            
            <div style="text-align: center;">
              <a href="${setupPasswordUrl}" class="cta-button">Set Up Password</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you didn't create this account, please ignore this email or contact our support team.
            </p>
          </div>
          <div class="footer">
            <p>Fine & Country Zimbabwe</p>
            <p>Enterprise Real Estate Platform</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
