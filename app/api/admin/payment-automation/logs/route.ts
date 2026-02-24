import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization using standard requireAdmin
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const emailStatus = searchParams.get('emailStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    interface WhereClause {
      branch?: string;
      action?: string;
      emailStatus?: string | null;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    }

    const where: WhereClause = { branch };

    if (action) {
      where.action = action;
    }

    if (emailStatus) {
      where.emailStatus = emailStatus === 'null' ? null : emailStatus;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Get total count
    const total = await prisma.paymentAutomationLog.count({
      where: where as any,
    });

    // Get logs with pagination
    const logs = await prisma.paymentAutomationLog.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return apiSuccess({
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching payment automation logs', error, { module: 'API', action: 'GET_PAYMENT_AUTOMATION_LOGS' });
    return apiError('Failed to fetch logs', 500, ErrorCodes.FETCH_ERROR);
  }
}
