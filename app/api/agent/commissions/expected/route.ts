import { NextRequest, NextResponse } from 'next/server';
import { requireManager, requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { FeeCalculator } from '@/lib/feeCalculator';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CommissionCalculation {
  reservationId: string;
  standNumber: string;
  developmentName: string;
  standPrice: number;
  commissionAmount: number;
  status: string;
}

/**
 * GET /api/agent/commissions/expected
 * Get expected commissions for the current agent from pending reservations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const period = searchParams.get('period') || '30d';

    // Calculate date range
    let dateFilter = {};
    if (period !== 'all') {
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter = { createdAt: { gte: startDate } };
    }

    // Get agent's reservations
    const reservations = await prisma.reservation.findMany({
      where: {
        agentId: user.id,
        status: status as any,
        ...dateFilter,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (reservations.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            commissions: [],
            summary: {
              totalExpectedCommission: 0,
              totalReservations: 0,
              averageCommission: 0,
            },
          },
        },
        { status: 200 }
      );
    }

    // Calculate commissions
    const commissions: CommissionCalculation[] = [];
    let totalExpectedCommission = 0;

    for (const reservation of reservations) {
      // Fetch stand and development for this reservation
      const stand = await prisma.stand.findUnique({
        where: { id: reservation.standId },
        include: { development: true },
      });

      if (!stand || !stand.development) continue;

      const development = stand.development;
      const commissionAmount = FeeCalculator.calculateCommission(
        Number(stand.price),
        development as any
      );

      commissions.push({
        reservationId: reservation.id,
        standNumber: stand.standNumber,
        developmentName: development.name,
        standPrice: Number(stand.price),
        commissionAmount: commissionAmount,
        status: reservation.status,
      });

      totalExpectedCommission += commissionAmount;
    }

    return NextResponse.json({
      success: true,
      data: {
        commissions,
        summary: {
          totalExpectedCommission: Math.round(totalExpectedCommission * 100) / 100,
          totalReservations: reservations.length,
          averageCommission:
            Math.round(
              (totalExpectedCommission / reservations.length) * 100
            ) / 100,
          period,
          status,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error calculating expected commissions', error, { module: 'API', action: 'GET_EXPECTED_COMMISSIONS' });
    return apiError(error.message || 'Failed to calculate commissions', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/agent/commissions/expected
 * Admin endpoint to view any agent's expected commissions
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const body = await request.json();
    const { agentId, status = 'PENDING', period = '30d' } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: agentId' },
        { status: 400 }
      );
    }

    // Calculate date range
    let dateFilter = {};
    if (period !== 'all') {
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter = { createdAt: { gte: startDate } };
    }

    // Get agent's reservations
    const reservations = await prisma.reservation.findMany({
      where: {
        agentId: agentId,
        status: status as any,
        ...dateFilter,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (reservations.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            commissions: [],
            summary: {
              totalExpectedCommission: 0,
              totalReservations: 0,
              averageCommission: 0,
            },
          },
        },
        { status: 200 }
      );
    }

    // Calculate commissions
    const commissions: CommissionCalculation[] = [];
    let totalExpectedCommission = 0;

    for (const reservation of reservations) {
      // Fetch stand and development for this reservation
      const stand = await prisma.stand.findUnique({
        where: { id: reservation.standId },
        include: { development: true },
      });

      if (!stand || !stand.development) continue;

      const development = stand.development;
      const commissionAmount = FeeCalculator.calculateCommission(
        Number(stand.price),
        development as any
      );

      commissions.push({
        reservationId: reservation.id,
        standNumber: stand.standNumber,
        developmentName: development.name,
        standPrice: Number(stand.price),
        commissionAmount: commissionAmount,
        status: reservation.status,
      });

      totalExpectedCommission += commissionAmount;
    }

    return NextResponse.json({
      success: true,
      data: {
        commissions,
        summary: {
          totalExpectedCommission: Math.round(totalExpectedCommission * 100) / 100,
          totalReservations: reservations.length,
          averageCommission:
            Math.round(
              (totalExpectedCommission / reservations.length) * 100
            ) / 100,
          period,
          status,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching agent commissions', error, { module: 'API', action: 'POST_EXPECTED_COMMISSIONS' });
    return apiError(error.message || 'Failed to fetch commissions', 500, ErrorCodes.FETCH_ERROR);
  }
}
