import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/commissions
 * Get commission payouts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';
    const month = searchParams.get('month');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      branch,
    };

    if (month) {
      where.month = month;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // Get commission payouts with agent details
    const commissions = await prisma.commissionPayout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get agent names
    const agentIds = [...new Set(commissions.map((c) => c.agentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, email: true },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    // Enrich commissions with agent info
    const enrichedCommissions = commissions.map((c) => ({
      ...c,
      agentName: agentMap.get(c.agentId)?.name || 'Unknown',
      agentEmail: agentMap.get(c.agentId)?.email || '',
    }));

    return apiSuccess({
      commissions: enrichedCommissions,
    });
  } catch (error: any) {
    logger.error('ACCOUNT_COMMISSIONS Error', error, { module: 'API', action: 'GET_ACCOUNT_COMMISSIONS' });
    return apiError('Failed to fetch commissions', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/account/commissions
 * Update commission status (approve/mark paid)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || !status) {
      return apiError('Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const updateData: Record<string, unknown> = {
      status,
      notes,
    };

    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }

    const updated = await prisma.commissionPayout.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess({ commission: updated });
  } catch (error: any) {
    logger.error('ACCOUNT_COMMISSIONS_UPDATE Error', error, { module: 'API', action: 'PUT_ACCOUNT_COMMISSIONS' });
    return apiError('Failed to update commission', 500, ErrorCodes.UPDATE_ERROR);
  }
}
