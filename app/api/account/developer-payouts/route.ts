import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { SettlementCalculator } from '@/lib/settlement-calculator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/developer-payouts
 * Get developer payouts with filtering by development and status
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
    const developmentId = searchParams.get('developmentId');
    const status = searchParams.get('status');

    // Build where clause for payments
    const where: Record<string, unknown> = {
      officeLocation: branch,
      status: 'CONFIRMED',
      standId: { not: null },
      development_id: { not: null },
    };

    if (developmentId && developmentId !== 'all') {
      where.development_id = developmentId;
    }

    if (status && status !== 'all') {
      where.settlementStatus = status;
    }

    // Get all confirmed payments with stand/development info
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stand: {
          include: {
            development: true,
          },
        },
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Get all developments for the branch
    const developments = await prisma.development.findMany({
      where: { branch },
      select: {
        id: true,
        name: true,
        developerName: true,
        developerEmail: true,
      },
    });

    // Group payments by development and calculate payouts
    const payoutData = developments.map((dev) => {
      const devPayments = payments.filter((p) => p.developmentId === dev.id);
      
      // Calculate totals using SettlementCalculator
      let totalStandPrice = 0;
      let totalFees = 0;
      let totalCommission = 0;
      let totalDeveloperNet = 0;
      let pendingPayout = 0;
      let paidOut = 0;

      const paymentDetails = devPayments.map((payment) => {
        const settlement = SettlementCalculator.calculateSettlement(payment);
        
        const payoutStatus = payment.settlementStatus || 'PENDING';
        if (payoutStatus === 'PENDING') {
          pendingPayout += settlement.developerNet;
        } else if (payoutStatus === 'PAID') {
          paidOut += settlement.developerNet;
        }

        totalStandPrice += settlement.standPricePortion;
        totalFees += settlement.totalFees;
        totalCommission += settlement.commission;
        totalDeveloperNet += settlement.developerNet;

        return {
          id: payment.id,
          reference: payment.reference,
          clientName: payment.clientName,
          clientEmail: payment.client?.email,
          standNumber: payment.stand?.standNumber,
          amount: Number(payment.amount),
          standPricePortion: settlement.standPricePortion,
          vatAmount: settlement.vatAmount,
          cessionAmount: settlement.cessionAmount,
          endowmentAmount: settlement.endowmentAmount,
          aosAmount: settlement.aosAmount,
          commission: settlement.commission,
          developerNet: settlement.developerNet,
          status: payoutStatus,
          createdAt: payment.createdAt,
        };
      });

      return {
        developmentId: dev.id,
        developmentName: dev.name,
        developerName: dev.developerName || 'Unknown Developer',
        developerEmail: dev.developerEmail,
        paymentCount: devPayments.length,
        totalStandPrice,
        totalFees,
        totalCommission,
        totalDeveloperNet,
        pendingPayout,
        paidOut,
        payments: paymentDetails,
      };
    }).filter((d) => d.paymentCount > 0); // Only include developments with payments

    // Calculate summary totals
    const summary = {
      totalDevelopments: payoutData.length,
      totalPayments: payments.length,
      totalPendingPayout: payoutData.reduce((sum, d) => sum + d.pendingPayout, 0),
      totalPaidOut: payoutData.reduce((sum, d) => sum + d.paidOut, 0),
      totalDeveloperNet: payoutData.reduce((sum, d) => sum + d.totalDeveloperNet, 0),
    };

    return apiSuccess({
      payouts: payoutData,
      developments: developments.map((d) => ({
        id: d.id,
        name: d.name,
        developerName: d.developerName,
      })),
      summary,
    });
  } catch (error: any) {
    logger.error('DEVELOPER_PAYOUTS Error', error, { module: 'API', action: 'GET_DEVELOPER_PAYOUTS' });
    return apiError('Failed to fetch developer payouts', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/account/developer-payouts
 * Mark developer payouts as paid
 */
export async function POST(request: NextRequest) {
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
    const { developmentId, paymentIds, notes } = body;

    if (!developmentId || !paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return apiError('Missing required fields: developmentId and paymentIds array', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = session.user as { id: string; name?: string; email?: string };

    // Update all specified payments to PAID status
    const updateResult = await prisma.payment.updateMany({
      where: {
        id: { in: paymentIds },
        developmentId: developmentId,
        settlementStatus: 'PENDING',
      },
      data: {
        settlementStatus: 'PAID',
      },
    });

    // Log the payout action
    await prisma.activityLog.create({
      data: {
        branch: (body.branch as string) || 'Harare',
        userId: user.id,
        action: 'CREATE',
        module: 'DEVELOPER_PAYOUT',
        recordId: developmentId,
        description: `Developer payout processed for ${paymentIds.length} payments. Notes: ${notes || 'None'}`,
        changes: JSON.stringify({
          paymentIds,
          developmentId,
          notes,
          processedBy: user.name || user.email,
          count: updateResult.count,
        }),
      },
    });

    logger.info('Developer payout processed', {
      module: 'API',
      developmentId,
      paymentCount: paymentIds.length,
      processedBy: user.id,
      updatedCount: updateResult.count,
    });

    return apiSuccess({
      success: true,
      updatedCount: updateResult.count,
      message: `Successfully processed payout for ${updateResult.count} payments`,
    });
  } catch (error: any) {
    logger.error('DEVELOPER_PAYOUTS_POST Error', error, { module: 'API', action: 'POST_DEVELOPER_PAYOUTS' });
    return apiError('Failed to process developer payout', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * PUT /api/account/developer-payouts
 * Update individual payment settlement status
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
    const { paymentId, status, notes } = body;

    if (!paymentId || !status) {
      return apiError('Missing required fields: paymentId and status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!['PENDING', 'PAID', 'HOLD'].includes(status)) {
      return apiError('Invalid status. Must be PENDING, PAID, or HOLD', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = session.user as { id: string; name?: string; email?: string };

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        settlementStatus: status,
      },
    });

    // Log the status change
    await prisma.activityLog.create({
      data: {
        branch: updated.officeLocation,
        userId: user.id,
        action: 'UPDATE',
        module: 'DEVELOPER_PAYOUT',
        recordId: paymentId,
        description: `Payment settlement status changed to ${status}. Notes: ${notes || 'None'}`,
        changes: JSON.stringify({
          paymentId,
          oldStatus: updated.settlementStatus,
          newStatus: status,
          notes,
          updatedBy: user.name || user.email,
        }),
      },
    });

    return apiSuccess({
      success: true,
      payment: updated,
    });
  } catch (error: any) {
    logger.error('DEVELOPER_PAYOUTS_PUT Error', error, { module: 'API', action: 'PUT_DEVELOPER_PAYOUTS' });
    return apiError('Failed to update payout status', 500, ErrorCodes.UPDATE_ERROR);
  }
}
