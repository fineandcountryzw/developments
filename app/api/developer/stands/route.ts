import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/stands
 * Fetch stands for a development (developer view)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = session.user.email;

    const developmentId = request.nextUrl.searchParams.get('developmentId');
    const status = request.nextUrl.searchParams.get('status');

    const where: any = {
      development: {
        developerEmail: userEmail
      }
    };
    
    if (developmentId) {
      where.developmentId = developmentId;
    }
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const stands = await prisma.stand.findMany({
      where,
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      },
      orderBy: { standNumber: 'asc' }
    });

    logger.info('Developer Stands API Fetched stands', {
      module: 'API',
      action: 'GET_DEVELOPER_STANDS',
      count: stands.length,
      developmentId,
      status
    });

    return apiSuccess(stands, 200, { total: stands.length });

  } catch (error: any) {
    logger.error('Developer Stands API Error', error, { module: 'API', action: 'GET_DEVELOPER_STANDS' });
    return apiError(error.message || 'Failed to fetch stands', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/developer/stands
 * Update stand status (mark as SOLD, remove from inventory)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = session.user.email;

    const { standId, status, reason, clientName, salePrice } = await request.json();

    if (!standId) {
      return apiError('Stand ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!status) {
      return apiError('Status is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Valid statuses
    const validStatuses = ['AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return apiError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch existing stand
    const existingStand = await prisma.stand.findUnique({
      where: { id: standId },
      include: { development: true }
    });

    if (!existingStand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (existingStand.development?.developerEmail !== userEmail) {
      return apiError('Forbidden', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Business Rule: Deposit-paid stands must be SOLD, not RESERVED
    let finalStatus = status.toUpperCase();
    
    // Check if stand has deposit payment
    if (finalStatus === 'RESERVED') {
      const depositPayment = await prisma.payment.findFirst({
        where: {
          standId: standId,
          paymentType: 'Deposit',
          status: { not: 'VOIDED' }
        }
      });

      if (depositPayment) {
        // Has deposit = must be SOLD, override RESERVED
        finalStatus = 'SOLD';
        logger.info('Stand has deposit payment, overriding RESERVED to SOLD', {
          module: 'API',
          action: 'PUT_DEVELOPER_STANDS',
          standId: standId,
          requestedStatus: status.toUpperCase(),
          finalStatus: 'SOLD'
        });
      }
    }

    // Update the stand
    const updatedStand = await prisma.stand.update({
      where: { id: standId },
      data: {
        status: finalStatus,
        // Update price if provided
        price: salePrice ? parseFloat(salePrice) : undefined,
        // Store client info in reservedBy field when sold
        reservedBy: finalStatus === 'SOLD' && clientName ? clientName : undefined,
        // Update timestamp
        updatedAt: new Date()
      },
      include: {
        development: true
      }
    });

    // Log the activity
    try {
      await prisma.activityLog.create({
        data: {
          branch: existingStand.branch || 'Harare',
          userId: session.user.email,
          action: status.toUpperCase() === 'SOLD' ? 'SALE' : 'UPDATE',
          module: 'STANDS',
          recordId: standId,
          description: `Stand ${existingStand.standNumber} marked as ${status.toUpperCase()}${reason ? ` - Reason: ${reason}` : ''}${clientName ? ` - Client: ${clientName}` : ''}`,
          changes: JSON.stringify({
            before: { status: existingStand.status, price: existingStand.price },
            after: { status: updatedStand.status, price: updatedStand.price },
            reason,
            clientName,
            salePrice,
            updatedBy: session.user.email,
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (logError: any) {
      logger.warn('Failed to log activity', { error: logError, module: 'API', action: 'PUT_DEVELOPER_STANDS' });
    }

    logger.info('Developer Stands API Stand updated', {
      module: 'API',
      action: 'PUT_DEVELOPER_STANDS',
      standId,
      standNumber: updatedStand.standNumber,
      previousStatus: existingStand.status,
      newStatus: updatedStand.status,
      development: updatedStand.development?.name,
      updatedBy: session.user.email
    });

    return apiSuccess({
      stand: updatedStand,
      message: `Stand ${updatedStand.standNumber} has been marked as ${updatedStand.status}`
    });

  } catch (error: any) {
    logger.error('Developer Stands API Error', error, { module: 'API', action: 'PUT_DEVELOPER_STANDS' });
    return apiError(error.message || 'Failed to update stand', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/developer/stands
 * Remove stand from inventory (mark as WITHDRAWN)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = session.user.email;

    const { standId, reason } = await request.json();

    if (!standId) {
      return apiError('Stand ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch existing stand
    const existingStand = await prisma.stand.findUnique({
      where: { id: standId },
      include: { development: true }
    });

    if (!existingStand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (existingStand.development?.developerEmail !== userEmail) {
      return apiError('Forbidden', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Mark as WITHDRAWN (soft delete)
    const updatedStand = await prisma.stand.update({
      where: { id: standId },
      data: {
        status: 'WITHDRAWN',
        updatedAt: new Date()
      },
      include: {
        development: true
      }
    });

    // Log the activity
    try {
      await prisma.activityLog.create({
        data: {
          branch: existingStand.branch || 'Harare',
          userId: session.user.email,
          action: 'WITHDRAW',
          module: 'STANDS',
          recordId: standId,
          description: `Stand ${existingStand.standNumber} withdrawn from inventory${reason ? ` - Reason: ${reason}` : ''}`,
          changes: JSON.stringify({
            before: { status: existingStand.status },
            after: { status: 'WITHDRAWN' },
            reason,
            withdrawnBy: session.user.email,
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (logError: any) {
      logger.warn('Failed to log activity', { error: logError, module: 'API', action: 'DELETE_DEVELOPER_STANDS' });
    }

    logger.info('Developer Stands API Stand withdrawn', {
      module: 'API',
      action: 'DELETE_DEVELOPER_STANDS',
      standId,
      standNumber: updatedStand.standNumber,
      development: updatedStand.development?.name,
      withdrawnBy: session.user.email
    });

    return apiSuccess({
      stand: updatedStand,
      message: `Stand ${updatedStand.standNumber} has been withdrawn from inventory`
    });

  } catch (error: any) {
    logger.error('Developer Stands API Error', error, { module: 'API', action: 'DELETE_DEVELOPER_STANDS' });
    return apiError(error.message || 'Failed to withdraw stand', 500, ErrorCodes.DELETE_ERROR);
  }
}
