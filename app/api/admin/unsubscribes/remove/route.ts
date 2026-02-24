import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

/**
 * POST /api/admin/unsubscribes/remove
 * Remove a recipient from the unsubscribe list (resubscribe)
 * Body: { recipientEmail: string, clientId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (EMAIL_DISABLED) {
      return NextResponse.json({ error: 'Email module disabled' }, { status: 404 });
    }
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const body = await request.json();
    const { recipientEmail, clientId } = body;

    if (!recipientEmail) {
      return apiError('recipientEmail is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const where: any = { recipientEmail };
    if (clientId) {
      where.clientId = clientId;
    }

    const deleted = await prisma.unsubscribeList.deleteMany({
      where
    });

    // Update resubscribe attempt timestamp in any remaining records
    try {
      await prisma.unsubscribeList.updateMany({
        where: {
          recipientEmail,
          resubscribeAttemptAt: null
        },
        data: {
          resubscribeAttemptAt: new Date()
        }
      });
    } catch (error) {
      // Silently fail if no records to update
    }

    return NextResponse.json({
      success: true,
      message: `${recipientEmail} has been removed from unsubscribe list`,
      deleted: deleted.count
    });
  } catch (error: any) {
    logger.error('Error removing from unsubscribe list', error, { module: 'API', action: 'POST_UNSUBSCRIBES_REMOVE' });
    return apiError('Failed to remove from unsubscribe list', 500, ErrorCodes.DELETE_ERROR);
  }
}
