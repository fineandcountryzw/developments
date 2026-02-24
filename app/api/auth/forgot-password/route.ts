import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email-service';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateRequest } from '@/lib/validation/middleware';
import { forgotPasswordSchema } from '@/lib/validation/schemas';

/**
 * POST /api/auth/forgot-password
 * 
 * Request a password reset email.
 * Creates a reset token and sends instructions via Resend.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, forgotPasswordSchema, {
      module: 'API',
      action: 'POST_FORGOT_PASSWORD'
    });
    
    if (!validation.success) {
      return validation.error;
    }

    const { email: normalizedEmail } = validation.data;
    logger.info('Reset requested', {
      module: 'API',
      action: 'POST_FORGOT_PASSWORD',
      email: normalizedEmail?.substring(0, 3) + '***'
    });

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      logger.info('User not found', {
        module: 'API',
        action: 'POST_FORGOT_PASSWORD',
        email: normalizedEmail?.substring(0, 3) + '***'
      });
      return apiSuccess({
        message: 'If an account exists with this email, you will receive reset instructions.'
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expires in 1 hour
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token in database using raw SQL (schema may not be in sync)
    await prisma.$executeRaw`
      UPDATE users 
      SET reset_token = ${resetTokenHash}, 
          reset_token_expiry = ${resetTokenExpiry}
      WHERE id = ${user.id}
    `;

    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXTAUTH_URL || 
                    'https://fineandcountryerp.com';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Generate email HTML
    const htmlContent = generatePasswordResetHTML({
      fullName: user.name || user.email,
      resetLink,
      expiryMinutes: 60,
    });

    // Send password reset email via Resend
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password - Fine & Country Zimbabwe',
        html: htmlContent,
      });

      logger.info('Reset email sent', {
        module: 'API',
        action: 'POST_FORGOT_PASSWORD',
        email: user.email?.substring(0, 3) + '***'
      });
    } catch (emailError: any) {
      logger.error('Failed to send email', emailError, { module: 'API', action: 'POST_FORGOT_PASSWORD' });
      // Still return success to prevent enumeration
    }

    return apiSuccess({
      message: 'If an account exists with this email, you will receive reset instructions.'
    });

  } catch (error: any) {
    logger.error('FORGOT_PASSWORD Error', error, { module: 'API', action: 'POST_FORGOT_PASSWORD' });
    return apiError('An error occurred. Please try again.', 500, ErrorCodes.INTERNAL_ERROR);
  }
}

/**
 * Generate password reset email HTML
 */
function generatePasswordResetHTML(params: {
  fullName: string;
  resetLink: string;
  expiryMinutes: number;
}): string {
  const { fullName, resetLink, expiryMinutes } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F7F5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #EFECE7;">
              <img src="https://fineandcountryerp.com/fc-logo.png" alt="Fine & Country" height="50" style="height: 50px; width: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #0F172A;">
                Reset Your Password
              </h1>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #475569;">
                Hello ${fullName},
              </p>
              
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #475569;">
                We received a request to reset the password for your Fine & Country Zimbabwe account. 
                Click the button below to set a new password:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #85754E 0%, #A69566 100%); color: #FFFFFF; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(133, 117, 78, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning -->
              <div style="padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 14px; color: #92400E;">
                  <strong>⏰ This link expires in ${expiryMinutes} minutes.</strong><br>
                  If you didn't request this reset, please ignore this email or contact support.
                </p>
              </div>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 10px; font-size: 14px; color: #64748B;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="margin: 0; font-size: 12px; color: #94A3B8; word-break: break-all; background: #F1F5F9; padding: 12px; border-radius: 6px;">
                ${resetLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #F8F7F5; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #64748B;">
                Need help? Contact us at 
                <a href="mailto:support@fineandcountry.co.zw" style="color: #85754E; text-decoration: none;">support@fineandcountry.co.zw</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                Fine & Country Zimbabwe • Premium Real Estate
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
