import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/admin/bounces/suppress
 * Suppress a recipient (add to suppression list)
 * Body: { recipientEmail: string, bounceType: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const body = await request.json();
    const { recipientEmail, bounceType, reason } = body;

    if (!recipientEmail || !bounceType) {
      return apiError('recipientEmail and bounceType are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Update or create bounce pattern with suppression
    const suppressed = await prisma.bouncePattern.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail,
          clientId: 'SYSTEM' // System-level suppression
        }
      },
      update: {
        shouldSuppress: true,
        suppressedAt: new Date(),
        suppressedReason: reason || 'Manually suppressed by admin'
      },
      create: {
        recipientEmail,
        clientId: 'SYSTEM',
        bounceType,
        lastBounceAt: new Date(),
        shouldSuppress: true,
        suppressedAt: new Date(),
        suppressedReason: reason || 'Manually suppressed by admin'
      }
    });

    // Also add to unsubscribe list
    try {
      await prisma.unsubscribeList.upsert({
        where: {
          recipientEmail_clientId: {
            recipientEmail,
            clientId: 'SYSTEM'
          }
        },
        update: {
          reason: reason || bounceType
        },
        create: {
          recipientEmail,
          clientId: 'SYSTEM',
          reason: reason || bounceType,
          unsubscribedAt: new Date(),
          unsubscribedBy: 'automatic'
        }
      });
    } catch (error: any) {
      // Silently fail if unsubscribe list update fails
      logger.warn('Failed to add to unsubscribe list', {
        module: 'API',
        action: 'POST_BOUNCES_SUPPRESS',
        error
      });
    }

    return NextResponse.json({
      success: true,
      message: `${recipientEmail} has been suppressed`,
      suppressed
    });
  } catch (error: any) {
    logger.error('Error suppressing recipient', error, { module: 'API', action: 'POST_BOUNCES_SUPPRESS' });
    return apiError('Failed to suppress recipient', 500, ErrorCodes.CREATE_ERROR);
  }
}
