import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/bounces/suppressed
 * Returns list of currently suppressed recipients
 * Query params: page, limit, reason, branch
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const reason = searchParams.get('reason');
    const branch = searchParams.get('branch') || 'Harare';

    const skip = (page - 1) * limit;

    const where: any = {
      shouldSuppress: true,
      branch
    };

    if (reason) {
      where.bounceType = reason;
    }

    const [suppressedRecipients, total] = await Promise.all([
      prisma.bouncePattern.findMany({
        where,
        skip,
        take: limit,
        orderBy: { suppressedAt: 'desc' },
        select: {
          id: true,
          recipientEmail: true,
          clientId: true,
          bounceType: true,
          suppressedAt: true,
          suppressedReason: true,
          consecutiveBounces: true,
          smtpCode: true
        }
      }),
      prisma.bouncePattern.count({ where })
    ]);

    return NextResponse.json({
      suppressedRecipients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching suppressed recipients', error, { module: 'API', action: 'GET_BOUNCES_SUPPRESSED' });
    return apiError('Failed to fetch suppressed recipients', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * DELETE /api/admin/bounces/suppressed
 * Remove a recipient from suppression list (unsuppress)
 * Body: { recipientEmail: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const body = await request.json();
    const { recipientEmail } = body;

    if (!recipientEmail) {
      return apiError('recipientEmail is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Remove suppression
    const updated = await prisma.bouncePattern.updateMany({
      where: {
        recipientEmail,
        shouldSuppress: true
      },
      data: {
        shouldSuppress: false,
        suppressedAt: null,
        suppressedReason: null,
        consecutiveBounces: 0
      }
    });

    return NextResponse.json({
      success: true,
      message: `${recipientEmail} has been unsuppressed`,
      updated: updated.count
    });
  } catch (error: any) {
    logger.error('Error unsuppressing recipient', error, { module: 'API', action: 'DELETE_BOUNCES_SUPPRESSED' });
    return apiError('Failed to unsuppress recipient', 500, ErrorCodes.UPDATE_ERROR);
  }
}
