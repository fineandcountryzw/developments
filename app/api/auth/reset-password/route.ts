import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateRequest } from '@/lib/validation/middleware';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { updateUserPasswordWithHistory } from '@/lib/password-history';

/**
 * POST /api/auth/reset-password
 * 
 * Reset user password using a valid reset token.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, resetPasswordSchema, {
      module: 'API',
      action: 'POST_RESET_PASSWORD'
    });
    
    if (!validation.success) {
      return validation.error;
    }

    const { token, password } = validation.data;

    // Hash the token to compare with stored hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      logger.warn('Invalid or expired token', { module: 'API', action: 'POST_RESET_PASSWORD' });
      return apiError('Invalid or expired reset link. Please request a new one.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const passwordUpdate = await updateUserPasswordWithHistory({
      userId: user.id,
      newPassword: password,
      extraUserUpdate: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    if (!passwordUpdate.ok) {
      const code =
        passwordUpdate.code === 'PASSWORD_REUSE'
          ? ErrorCodes.PASSWORD_REUSE
          : ErrorCodes.PASSWORD_COMPLEXITY;
      return apiError(passwordUpdate.message, 400, code);
    }

    logger.info('Password reset successful', {
      module: 'API',
      action: 'POST_RESET_PASSWORD',
      email: user.email?.substring(0, 3) + '***'
    });

    return apiSuccess({
      message: 'Password reset successful. You can now sign in with your new password.'
    });

  } catch (error: any) {
    logger.error('RESET_PASSWORD Error', error, { module: 'API', action: 'POST_RESET_PASSWORD' });
    return apiError('An error occurred. Please try again.', 500, ErrorCodes.INTERNAL_ERROR);
  }
}

/**
 * GET /api/auth/reset-password?token=xxx
 * 
 * Validate reset token before showing form.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return apiError('Token is required', 400, ErrorCodes.VALIDATION_ERROR, { valid: false });
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
      },
      select: { email: true },
    });

    if (!user) {
      return apiError('Invalid or expired reset link', 400, ErrorCodes.VALIDATION_ERROR, { valid: false });
    }

    return apiSuccess({
      valid: true,
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
    });

  } catch (error: any) {
    logger.error('RESET_PASSWORD Validation error', error, { module: 'API', action: 'GET_RESET_PASSWORD' });
    return apiError('An error occurred', 500, ErrorCodes.INTERNAL_ERROR, { valid: false });
  }
}
