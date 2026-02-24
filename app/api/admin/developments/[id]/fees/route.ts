import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/developments/[id]/fees
 * Get fee configuration for a development
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const { id } = await params;

    const development = await prisma.development.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        vatPercentage: true,
        vatEnabled: true,
        aosEnabled: true,
        aosFee: true,
        endowmentEnabled: true,
        endowmentFee: true,
        cessionsEnabled: true,
        cessionFee: true,
        depositPercentage: true,
        installmentPeriods: true,
        commissionModel: true,
      },
    });

    if (!development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    return NextResponse.json({
      success: true,
      data: development,
    });
  } catch (error: any) {
    logger.error('Error fetching development fees', error, { module: 'API', action: 'GET_ADMIN_DEVELOPMENT_FEES' });
    return apiError(error.message || 'Failed to fetch fees', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/admin/developments/[id]/fees
 * Update fee configuration for a development
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();

    const {
      vatPercentage,
      vatEnabled,
      aosEnabled,
      aosFee,
      endowmentEnabled,
      endowmentFee,
      cessionsEnabled,
      cessionFee,
      depositPercentage,
      installmentPeriods,
      commissionModel,
    } = body;

    // Validate inputs
    if (vatPercentage !== undefined && (vatPercentage < 0 || vatPercentage > 100)) {
      return apiError('VAT percentage must be between 0 and 100', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (depositPercentage !== undefined && (depositPercentage < 10 || depositPercentage > 100)) {
      return apiError('Deposit percentage must be between 10 and 100', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Update development
    const updated = await prisma.development.update({
      where: { id },
      data: {
        ...(vatPercentage !== undefined && { vatPercentage }),
        ...(vatEnabled !== undefined && { vatEnabled }),
        ...(aosEnabled !== undefined && { aosEnabled }),
        ...(aosFee !== undefined && { aosFee }),
        ...(endowmentEnabled !== undefined && { endowmentEnabled }),
        ...(endowmentFee !== undefined && { endowmentFee }),
        ...(cessionsEnabled !== undefined && { cessionsEnabled }),
        ...(cessionFee !== undefined && { cessionFee }),
        ...(depositPercentage !== undefined && { depositPercentage }),
        ...(installmentPeriods !== undefined && { installmentPeriods }),
        ...(commissionModel !== undefined && { commissionModel }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'STAND_UPDATE',
        description: `Updated fee configuration for ${updated.name}`,
        metadata: {
          developmentId: id,
          developmentName: updated.name,
          updatedFields: Object.keys(body),
          action: 'fee_config_updated',
        },
        userId: authResult.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Fee configuration updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating development fees', error, { module: 'API', action: 'PUT_ADMIN_DEVELOPMENT_FEES' });
    return apiError(error.message || 'Failed to update fees', 500, ErrorCodes.UPDATE_ERROR);
  }
}
