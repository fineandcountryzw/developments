import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

/**
 * GET /api/email/unsubscribe
 * Public unsubscribe endpoint (GDPR compliant, no auth required)
 * Query params: email, clientId, token (validation token)
 */
export async function GET(request: NextRequest) {
  try {
    if (EMAIL_DISABLED) {
      return NextResponse.json({ error: 'Email module disabled' }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const clientId = searchParams.get('clientId') || 'GENERAL';
    const token = searchParams.get('token');

    if (!email) {
      return apiError('email parameter is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Simple validation: in production, verify token matches email hash
    if (!token || token.length < 10) {
      return apiError('Invalid or missing unsubscribe token', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Add to unsubscribe list
    await prisma.unsubscribeList.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail: email,
          clientId
        }
      },
      update: {
        unsubscribedAt: new Date(),
        unsubscribedBy: 'user_request'
      },
      create: {
        recipientEmail: email,
        clientId,
        reason: 'user_request',
        description: 'User clicked unsubscribe link in email',
        unsubscribedAt: new Date(),
        unsubscribedBy: 'user_request'
      }
    });

    // Also update bounce pattern if exists
    try {
      await prisma.bouncePattern.updateMany({
        where: {
          recipientEmail: email,
          clientId
        },
        data: {
          bounceType: 'unsubscribe',
          shouldSuppress: true,
          suppressedAt: new Date(),
          suppressedReason: 'User unsubscribed'
        }
      });
    } catch (error) {
      // Silently fail if bounce pattern doesn't exist
    }

    return NextResponse.json({
      success: true,
      message: `You have been unsubscribed from our mailing list. We respect your choice.`,
      email: email?.substring(0, 3) + '***'
    });
  } catch (error: any) {
    logger.error('Error processing unsubscribe', error, { module: 'API', action: 'GET_EMAIL_UNSUBSCRIBE' });
    return apiError('Failed to process unsubscribe request', 500, ErrorCodes.CREATE_ERROR);
  }
}
