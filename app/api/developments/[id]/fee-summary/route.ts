import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/developments/[id]/fee-summary
 * Get fee configuration summary for a development
 * Public endpoint for displaying on landing pages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const development = await prisma.development.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        location: true,
        vatPercentage: true,
        vatEnabled: true,
        aosEnabled: true,
        aosFee: true,
        endowmentEnabled: true,
        endowmentFee: true,
        cessionsEnabled: true,
        cessionFee: true,
        adminFeeEnabled: true,
        adminFee: true,
        depositPercentage: true,
        installmentPeriods: true,
        basePrice: true,
      },
    });

    if (!development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build fee summary
    const fees: { name: string; type: string; value: number; description: string; mandatory: boolean; }[] = [];

    if (development.vatEnabled) {
      fees.push({
        name: 'VAT',
        type: 'percentage',
        value: Number(development.vatPercentage),
        description: `${Number(development.vatPercentage)}% on subtotal`,
        mandatory: true,
      });
    }

    if (development.aosEnabled) {
      fees.push({
        name: 'Agreement of Sale Fee',
        type: 'fixed',
        value: Number(development.aosFee),
        description: 'One-time legal processing fee',
        mandatory: true,
      });
    }

    if (development.endowmentEnabled) {
      fees.push({
        name: 'Endowment Fee',
        type: 'fixed',
        value: Number(development.endowmentFee),
        description: 'Property development contribution',
        mandatory: true,
      });
    }

    if (development.cessionsEnabled) {
      fees.push({
        name: 'Cession Fee',
        type: 'fixed',
        value: Number(development.cessionFee),
        description: 'Transfer and registration fee',
        mandatory: true,
      });
    }

    if (development.adminFeeEnabled) {
      fees.push({
        name: 'Admin Fee',
        type: 'fixed',
        value: Number(development.adminFee),
        description: 'Administrative processing fee',
        mandatory: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        development: {
          id: development.id,
          name: development.name,
          location: development.location,
          basePrice: Number(development.basePrice),
        },
        fees,
        paymentTerms: {
          minimumDeposit: Number(development.depositPercentage),
          installmentOptions: development.installmentPeriods,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fee summary', error, { module: 'API', action: 'GET_DEVELOPMENT_FEE_SUMMARY' });
    return apiError(error.message || 'Failed to fetch fee summary', 500, ErrorCodes.FETCH_ERROR);
  }
}
