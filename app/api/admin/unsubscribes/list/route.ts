import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

/**
 * GET /api/admin/unsubscribes/list
 * Returns paginated list of unsubscribed recipients
 * Query params: page, limit, reason, branch, search
 */
export async function GET(request: NextRequest) {
  try {
    if (EMAIL_DISABLED) {
      return NextResponse.json({ error: 'Email module disabled' }, { status: 404 });
    }
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const reason = searchParams.get('reason');
    const branch = searchParams.get('branch') || 'Harare';
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = { branch };

    if (reason) {
      where.reason = reason;
    }
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { clientId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [unsubscribed, total] = await Promise.all([
      prisma.unsubscribeList.findMany({
        where,
        skip,
        take: limit,
        orderBy: { unsubscribedAt: 'desc' },
        select: {
          id: true,
          recipientEmail: true,
          clientId: true,
          reason: true,
          description: true,
          unsubscribedAt: true,
          unsubscribedBy: true,
          resubscribeAttemptAt: true
        }
      }),
      prisma.unsubscribeList.count({ where })
    ]);

    return NextResponse.json({
      unsubscribed,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching unsubscribe list', error, { module: 'API', action: 'GET_UNSUBSCRIBES_LIST' });
    return apiError('Failed to fetch unsubscribe list', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/unsubscribes/list
 * Add a recipient to the unsubscribe list
 * Body: { recipientEmail: string, clientId: string, reason: string, description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (EMAIL_DISABLED) {
      return NextResponse.json({ error: 'Email module disabled' }, { status: 404 });
    }
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;

    const body = await request.json();
    const { recipientEmail, clientId, reason, description } = body;

    if (!recipientEmail || !reason) {
      return apiError('recipientEmail and reason are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const unsubscribed = await prisma.unsubscribeList.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail,
          clientId: clientId || 'GENERAL'
        }
      },
      update: {
        reason,
        description
      },
      create: {
        recipientEmail,
        clientId: clientId || 'GENERAL',
        reason,
        description,
        unsubscribedAt: new Date(),
        unsubscribedBy: 'manual'
      }
    });

    return NextResponse.json({
      success: true,
      message: `${recipientEmail} has been added to unsubscribe list`,
      unsubscribed
    });
  } catch (error: any) {
    logger.error('Error adding to unsubscribe list', error, { module: 'API', action: 'POST_UNSUBSCRIBES_LIST' });
    return apiError('Failed to add to unsubscribe list', 500, ErrorCodes.CREATE_ERROR);
  }
}
