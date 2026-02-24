import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { FeeCalculator } from '@/lib/feeCalculator';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/reservations/with-fees
 * Create a reservation with complete fee breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) {
      return authResult.error;
    }
    const agent = authResult.user;

    const body = await request.json();
    const {
      standId,
      clientId,
      depositPercent,
      installmentMonths,
    } = body;

    // Validate required fields
    if (!standId || !clientId) {
      return apiError('Missing required fields: standId, clientId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch stand and development
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      include: { development: true },
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!stand.development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Prevent reservation if stand is not available
    if (stand.status && stand.status !== 'AVAILABLE') {
      return apiError(`Stand is not available (current status: ${stand.status})`, 409, ErrorCodes.VALIDATION_ERROR);
    }

    // Use development-specific terms if not provided in request
    const developmentDepositPercent = Number(stand.development.depositPercentage) || 30;
    const developmentInstallmentPeriods = Array.isArray(stand.development.installmentPeriods) 
      ? stand.development.installmentPeriods 
      : [12, 24, 48];
    
    const finalDepositPercent = depositPercent || developmentDepositPercent;
    const finalInstallmentMonths = installmentMonths || developmentInstallmentPeriods[0] || 24;

    // Calculate complete fee breakdown
    const feeBreakdown = FeeCalculator.calculateComplete(
      Number(stand.price),
      stand.development as any,
      finalDepositPercent,
      finalInstallmentMonths,
      stand as any
    );

    // Create reservation with fee breakdown as metadata
    const reservation = await prisma.reservation.create({
      data: {
        clientId: clientId,
        standId: standId,
        agentId: agent.id,
        status: 'PENDING',
        termsAcceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
      include: {
        stand: true,
        client: true,
        agent: true,
      },
    });

    // Mark stand as RESERVED to keep map/status in sync
    const reservedBy = reservation.client?.name
      || [reservation.client?.firstName, reservation.client?.lastName].filter(Boolean).join(' ')
      || reservation.client?.email
      || undefined;

    await prisma.stand.update({
      where: { id: standId },
      data: {
        status: 'RESERVED',
        reservedBy: reservedBy,
        updatedAt: new Date()
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'RESERVATION',
        description: `Reservation created for stand ${stand.standNumber} with fee breakdown`,
        metadata: {
          reservationId: reservation.id,
          standId: standId,
          standNumber: stand.standNumber,
          developmentId: stand.developmentId,
          developmentName: stand.development.name,
          totalAmount: feeBreakdown.totalAmount,
          depositAmount: feeBreakdown.depositAmount,
          depositPercent: finalDepositPercent,
          installmentMonths: finalInstallmentMonths,
        },
        userId: agent.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        reservation,
        feeBreakdown,
      },
      message: 'Reservation created successfully with fee breakdown',
    });
  } catch (error: any) {
    logger.error('Error creating reservation with fees', error, { module: 'API', action: 'POST_RESERVATIONS_WITH_FEES' });
    return apiError(error.message || 'Failed to create reservation', 500, ErrorCodes.CREATE_ERROR);
  }
}
