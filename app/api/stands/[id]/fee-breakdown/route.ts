import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FeeCalculator } from '@/lib/feeCalculator';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/stands/[id]/fee-breakdown
 * Calculate complete fee breakdown for a stand
 * Public endpoint - no authentication required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Optional custom parameters
    const depositPercent = searchParams.get('depositPercent');
    const installmentMonths = searchParams.get('installmentMonths');

    // Fetch stand with development
    const stand = await prisma.stand.findUnique({
      where: { id },
      include: {
        development: true,
      },
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Calculate fee breakdown
    const breakdown = FeeCalculator.calculateComplete(
      Number(stand.price),
      stand.development as any,
      depositPercent ? Number(depositPercent) : undefined,
      installmentMonths ? Number(installmentMonths) : undefined,
      stand as any
    );

    return NextResponse.json({
      success: true,
      data: {
        standId: stand.id,
        standNumber: stand.standNumber,
        development: {
          id: stand.development.id,
          name: stand.development.name,
        },
        ...breakdown,
        feesEnabled: {
          // Canonical keys for UI + reporting
          vatEnabled: stand.development.vatEnabled,
          aosEnabled: stand.development.aosEnabled,
          endowmentEnabled: stand.development.endowmentEnabled,
          cessionsEnabled: stand.development.cessionsEnabled,
          adminFeeEnabled: (stand.development as any).adminFeeEnabled === true,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error calculating fee breakdown', error, { module: 'API', action: 'GET_STAND_FEE_BREAKDOWN' });
    return apiError(error.message || 'Failed to calculate fees', 500, ErrorCodes.FETCH_ERROR);
  }
}
