import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateRequest } from '@/lib/validation/middleware';
import { reservationSchema } from '@/lib/validation/schemas';
import {
  sendReservationCreatedEmails,
  sendReservationCancelledEmails,
  sendSaleConversionEmails,
  type ReservationEmailData,
  type SaleConversionEmailData
} from '@/lib/reservation-emails';

/**
 * GET /api/admin/reservations
 * Fetch reservations with optional filters
 * 
 * Query Parameters:
 * - agentId: Filter by agent ID (for agent pipeline)
 * - clientId: Filter by client ID (for client reservations)
 * - status: Filter by reservation status
 * - branch: Filter by branch
 * 
 * Role-Based Access:
 * - Admin: Can see all reservations
 * - Agent: Can only see their own reservations (enforced)
 * - Client: Can only see their own reservations (enforced)
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/admin/reservations called', { module: 'API', action: 'GET_RESERVATIONS' });

    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Query parameters
    const searchParams = request.nextUrl.searchParams;
    let agentId = searchParams.get('agentId');
    let clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const branch = searchParams.get('branch');

    // Role-Based Access Control Enforcement
    if (user.role === 'Agent') {
      // Agents can only see their own reservations
      agentId = user.id;
      logger.debug('Agent access enforced - filtering by agentId', { module: 'API', action: 'GET_RESERVATIONS', agentId });
    } else if (user.role === 'Client') {
      // Clients can only see their own reservations
      clientId = user.id;
      logger.debug('Client access enforced - filtering by clientId', { module: 'API', action: 'GET_RESERVATIONS', clientId });
    }

    // Build where clause with proper Prisma types
    const where: {
      agentId?: string;
      clientId?: string;
      status?: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'PAYMENT_PENDING' | 'CANCELLED';
      branch?: string;
    } = {};

    if (agentId) {
      where.agentId = agentId;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (status && ['PENDING', 'CONFIRMED', 'EXPIRED', 'PAYMENT_PENDING', 'CANCELLED'].includes(status)) {
      where.status = status as 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'PAYMENT_PENDING' | 'CANCELLED';
    }

    let reservations;
    try {
      reservations = await prisma.reservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          stand: {
            include: {
              development: true
            }
          }
        }
      });
    } catch (queryError: any) {
      logger.warn('Reservation query error, attempting fallback', { module: 'API', action: 'GET_RESERVATIONS', error: queryError.message });
      // Fallback to simpler query without includes
      try {
        reservations = await prisma.reservation.findMany({
          where,
          orderBy: { createdAt: 'desc' }
        });
      } catch (fallbackError: any) {
        logger.error('Fallback query also failed', fallbackError, { module: 'API', action: 'GET_RESERVATIONS' });
        return NextResponse.json({
          data: [],
          error: `Database query failed: ${fallbackError.message}`,
          code: 'DB_QUERY_ERROR',
          status: 500
        }, { status: 500 });
      }
    }

    // Transform data for dashboard consumption
    const transformedReservations = reservations.map((res: any) => ({
      id: res.id,
      standId: res.standId,
      standNumber: res.stand?.standNumber || 'N/A',
      standName: `Stand ${res.stand?.standNumber || res.standId}`,
      developmentId: res.stand?.development?.id || res.stand?.developmentId,
      developmentName: res.stand?.development?.name || 'Development',
      price: Number(res.stand?.price || 0),
      clientId: res.clientId || res.userId,
      clientName: res.clientName || 'Client',
      agentId: res.agentId,
      status: res.status,
      expiresAt: res.expiresAt?.toISOString?.() || res.expiresAt,
      createdAt: res.createdAt?.toISOString?.() || res.createdAt,
      updatedAt: res.updatedAt?.toISOString?.() || res.updatedAt,
      // Calculated fields for client dashboard
      hoursRemaining: res.expiresAt
        ? Math.max(0, Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
        : null
    }));

    logger.debug('Fetched reservations', {
      module: 'API',
      action: 'GET_RESERVATIONS',
      count: reservations.length,
      filter: { agentId, clientId, status, branch },
      userRole: user.role
    });

    return apiSuccess({
      reservations: transformedReservations,
      count: transformedReservations.length
    });

  } catch (error: any) {
    logger.error('Reservation fetch error', error, { module: 'API', action: 'GET_RESERVATIONS' });
    return apiError(
      error?.message || 'Failed to fetch reservations',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}

/**
 * POST /api/admin/reservations
 * Create a new reservation
 * 
 * Role-Based Access:
 * - Admin/Agent: Can create reservations
 * - Client: Cannot create reservations directly
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/admin/reservations called', { module: 'API', action: 'POST_RESERVATIONS' });

    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(request, reservationSchema, {
      module: 'API',
      action: 'POST_RESERVATIONS'
    });
    if (!validation.success) {
      return validation.error;
    }
    const data = validation.data;

    // Use validated standId/clientId
    const standIdValue = data.standId;
    const clientIdValue = data.clientId;

    if (!standIdValue || !clientIdValue) {
      return apiError('standId and clientId are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if stand exists and is available
    const stand = await prisma.stand.findUnique({
      where: { id: standIdValue },
      include: { development: true }
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.STAND_NOT_FOUND);
    }

    if (stand.status !== 'AVAILABLE') {
      return apiError(
        `Stand is not available. Current status: ${stand.status}`,
        409,
        ErrorCodes.STAND_UNAVAILABLE,
        { currentStatus: stand.status }
      );
    }

    // Calculate price snapshot (with discount if applicable)
    const basePrice = typeof stand.price === 'string'
      ? parseFloat(stand.price)
      : Number(stand.price);

    const discountPercent = stand.discountPercent
      ? (typeof stand.discountPercent === 'string'
        ? parseFloat(stand.discountPercent)
        : Number(stand.discountPercent))
      : null;

    const hasDiscount = discountPercent !== null
      && discountPercent > 0
      && stand.discountActive !== false;

    const finalPrice = hasDiscount && discountPercent
      ? basePrice * (1 - discountPercent / 100)
      : basePrice;

    // Calculate expiry (72 hours from now)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Prepare metadata for insurance interest if provided
    const metadata: any = {};
    if (data.insuranceInterest === true) {
      metadata.insuranceInterest = true;
      metadata.insuranceInterestSource = data.insuranceInterestSource || 'legal_gateway';
      metadata.insuranceInterestTimestamp = new Date().toISOString();
    }

    // Create reservation and update stand status in a transaction
    const reservation = await prisma.$transaction(async (tx) => {
      const newReservation = await tx.reservation.create({
        data: {
          standId: standIdValue,
          clientId: clientIdValue,
          userId: data.userId || clientIdValue, // Support both for backwards compatibility
          agentId: data.agentId || (user.role === 'Agent' ? user.id : null),
          status: 'PENDING',
          expiresAt: expiresAt,
          termsAcceptedAt: new Date(), // Required field
          timerActive: true,
          // Price snapshot fields
          basePriceAtReservation: basePrice,
          discountPercentAtReservation: hasDiscount ? discountPercent : null,
          finalPriceAtReservation: finalPrice
        },
        include: {
          stand: { include: { development: true } },
          client: true,
          agent: true,
          user: true
        }
      });

      await tx.stand.update({
        where: { id: standIdValue },
        data: { status: 'RESERVED' }
      });

      return newReservation;
    });

    // Create insurance enquiry if interest was expressed
    if (data.insuranceInterest === true && reservation.agentId) {
      try {
        await prisma.activityLog.create({
          data: {
            branch: stand.branch || 'Harare',
            userId: user.id,
            action: 'ENQUIRY',
            module: 'INSURANCE',
            recordId: reservation.id,
            description: `Client opted in to receive more information about optional Old Mutual insurance`,
            changes: {
              category: 'Insurance - Old Mutual',
              message: `Client opted in to receive more information about optional Old Mutual insurance for Stand ${stand.standNumber} in ${stand.development.name}`,
              developmentId: stand.development.id,
              standId: standIdValue,
              standNumber: stand.standNumber,
              clientId: clientIdValue,
              agentId: reservation.agentId,
              source: data.insuranceInterestSource || 'legal_gateway',
              timestamp: new Date().toISOString(),
            },
          },
        });

        // Notify agent about insurance enquiry (async)
        import('@/lib/notifications').then(({ notifyInsuranceEnquiry }) => {
          notifyInsuranceEnquiry({
            agentId: reservation.agentId!,
            clientId: clientIdValue,
            clientName: data.clientName || 'Client',
            developmentName: stand.development.name,
            standNumber: stand.standNumber,
          }).catch((err: unknown) => {
            logger.warn('Failed to notify agent about insurance enquiry', {
              module: 'API',
              action: 'NOTIFY_INSURANCE_ENQUIRY',
              agentId: reservation.agentId,
              error: String(err)
            });
          });
        });
      } catch (error) {
        // Non-fatal: log but don't block reservation
        logger.warn('Failed to create insurance enquiry', {
          module: 'API',
          action: 'CREATE_INSURANCE_ENQUIRY',
          reservationId: reservation.id,
          error
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: stand.branch || 'Harare',
        userId: user.id,
        action: 'CREATE',
        module: 'RESERVATIONS',
        recordId: reservation.id,
        description: `Reservation created for Stand ${stand.standNumber} by ${data.clientName}`,
        changes: JSON.stringify({
          standId: standIdValue,
          clientId: clientIdValue,
          expiresAt: expiresAt.toISOString()
        })
      }
    });

    logger.info('Reservation created', {
      module: 'API',
      action: 'POST_RESERVATIONS',
      reservationId: reservation.id,
      standId: standIdValue,
      clientId: clientIdValue,
      expiresAt: expiresAt.toISOString()
    });

    // Send reservation emails (async, don't block response)
    // Use the already-fetched stand (which includes development) instead of reservation.stand
    // For client/agent/user, we use the data from the request or fetch if needed
    const standWithDev = stand; // stand already has development included

    // Fetch client if we have clientId
    const fetchedClient = await prisma.client.findUnique({
      where: { id: clientIdValue }
    });

    // Fetch agent if we have agentId
    const fetchedAgent = reservation.agentId ? await prisma.user.findUnique({
      where: { id: reservation.agentId }
    }) : null;

    // Fetch user if we have userId
    const reservationUser = reservation.userId ? await prisma.user.findUnique({
      where: { id: reservation.userId }
    }) : null;

    const emailData: ReservationEmailData = {
      reservationId: reservation.id,
      reservationDate: new Date(),
      expiresAt: expiresAt,
      standNumber: stand.standNumber,
      standPrice: Number(stand.price),
      standSize: stand.sizeSqm ? Number(stand.sizeSqm) : undefined,
      developmentName: standWithDev?.development?.name || data.developmentName || 'Development',
      developmentLocation: standWithDev?.development?.location || data.developmentLocation || '',
      developerEmail: standWithDev?.development?.developerEmail || undefined,
      developerName: standWithDev?.development?.developerName || undefined,
      clientName: fetchedClient?.name || data.clientName || 'Client',
      clientEmail: fetchedClient?.email || data.clientEmail || '',
      clientPhone: fetchedClient?.phone ?? data.clientPhone ?? undefined,
      agentName: fetchedAgent?.name || reservationUser?.name || undefined,
      agentEmail: fetchedAgent?.email || reservationUser?.email || undefined,
      branch: stand.branch || 'Harare',
    };

    // Send emails in background (don't await to avoid blocking)
    sendReservationCreatedEmails(emailData).catch((err: unknown) => {
      logger.error('Failed to send reservation emails', err instanceof Error ? err : undefined, { module: 'API', action: 'POST_RESERVATIONS' });
    });

    // Create in-app notifications (async, don't block)
    if (reservation.clientId) {
      import('@/lib/notifications').then(({ notifyReservationCreated }) => {
        notifyReservationCreated({
          clientId: reservation.clientId!,
          reservationId: reservation.id,
          standNumber: stand.standNumber,
          developmentName: emailData.developmentName,
          agentId: reservation.agentId || undefined,
        }).catch((err: unknown) => {
          logger.warn('Failed to create reservation notification', {
            module: 'API',
            action: 'CREATE_RESERVATION_NOTIFICATION',
            reservationId: reservation.id,
            error: String(err)
          });
        });
      });
    }

    // Return structured response with all required fields for client display
    const responseData = {
      id: reservation.id,
      reservationId: reservation.id,
      standId: reservation.standId,
      standNumber: stand.standNumber,
      developmentId: stand.developmentId,
      developmentName: standWithDev?.development?.name || data.developmentName || 'Development',
      developmentLocation: standWithDev?.development?.location || data.developmentLocation || '',
      status: reservation.status,
      createdAt: reservation.createdAt.toISOString(),
      expiresAt: reservation.expiresAt.toISOString(),
      basePriceAtReservation: reservation.basePriceAtReservation ? Number(reservation.basePriceAtReservation) : null,
      discountPercentAtReservation: reservation.discountPercentAtReservation ? Number(reservation.discountPercentAtReservation) : null,
      finalPriceAtReservation: reservation.finalPriceAtReservation ? Number(reservation.finalPriceAtReservation) : null,
      // Include development PDF URLs if available
      termsPdfUrl: standWithDev?.development?.termsPdfUrl || null,
      refundPdfUrl: standWithDev?.development?.refundPdfUrl || null,
      // Include stand and client info
      stand: {
        id: stand.id,
        standNumber: stand.standNumber,
        price: Number(stand.price),
        sizeSqm: stand.sizeSqm ? Number(stand.sizeSqm) : null,
      },
      client: fetchedClient ? {
        id: fetchedClient.id,
        name: fetchedClient.name,
        email: fetchedClient.email,
        phone: fetchedClient.phone,
      } : null,
      agent: fetchedAgent ? {
        id: fetchedAgent.id,
        name: fetchedAgent.name,
        email: fetchedAgent.email,
      } : null,
    };

    return apiSuccess(responseData, 201);

  } catch (error: any) {
    logger.error('Reservation creation error', error, { module: 'API', action: 'POST_RESERVATIONS' });
    return apiError(
      error?.message || 'Failed to create reservation',
      500,
      ErrorCodes.CREATE_ERROR
    );
  }
}

/**
 * PUT /api/admin/reservations
 * Update a reservation status
 * 
 * Role-Based Access:
 * - Admin: Can update any reservation
 * - Agent: Can only update their own reservations
 * - Client: Cannot update reservations
 */
export async function PUT(request: NextRequest) {
  try {
    logger.info('PUT /api/admin/reservations called', { module: 'API', action: 'PUT_RESERVATIONS' });

    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const { id, ...updateData } = await request.json();

    if (!id) {
      return apiError('Reservation ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check existing reservation
    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
      include: { stand: true }
    });

    if (!existingReservation) {
      return apiError('Reservation not found', 404, ErrorCodes.RESERVATION_NOT_FOUND);
    }

    // Agent can only update their own reservations
    if (user.role === 'Agent' && existingReservation.agentId !== user.id) {
      return apiError('You can only update your own reservations', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Update reservation
    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        stand: { include: { development: true } },
        client: true,
        agent: true
      }
    });

    // If status changed to CONFIRMED or CANCELLED, update stand status
    if (updateData.status === 'CONFIRMED') {
      await prisma.stand.update({
        where: { id: reservation.standId },
        data: { status: 'SOLD' }
      });
    } else if (updateData.status === 'CANCELLED' || updateData.status === 'EXPIRED') {
      await prisma.stand.update({
        where: { id: reservation.standId },
        data: { status: 'AVAILABLE' }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: 'Harare',
        userId: user.id,
        action: 'UPDATE',
        module: 'RESERVATIONS',
        recordId: reservation.id,
        description: `Reservation updated: ${updateData.status || 'details changed'}`,
        changes: JSON.stringify(updateData)
      }
    });

    logger.info('Reservation updated', {
      module: 'API',
      action: 'PUT_RESERVATIONS',
      reservationId: reservation.id,
      status: reservation.status
    });

    // Send emails based on status change
    // Type the reservation with includes for type safety
    type ReservationWithIncludes = typeof reservation;
    const standWithDev = reservation.stand as ReservationWithIncludes['stand'] & { development?: { name?: string; location?: string; developerEmail?: string; developerName?: string } | null };
    const development = standWithDev?.development;
    const client = reservation.client as ReservationWithIncludes['client'] & { name?: string; email?: string; phone?: string } | null;
    const agent = reservation.agent as ReservationWithIncludes['agent'] & { name?: string; email?: string } | null;

    const baseEmailData: ReservationEmailData = {
      reservationId: reservation.id,
      reservationDate: reservation.createdAt,
      expiresAt: reservation.expiresAt,
      standNumber: standWithDev?.standNumber || 'N/A',
      standPrice: Number(standWithDev?.price || 0),
      standSize: standWithDev?.sizeSqm ? Number(standWithDev.sizeSqm) : undefined,
      developmentName: development?.name || 'Development',
      developmentLocation: development?.location || '',
      developerEmail: development?.developerEmail || undefined,
      developerName: development?.developerName || undefined,
      clientName: client?.name || 'Client',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || undefined,
      agentName: agent?.name || undefined,
      agentEmail: agent?.email || undefined,
      branch: standWithDev?.branch || 'Harare',
    };

    // Send appropriate emails based on status change
    if (updateData.status === 'CONFIRMED') {
      // Reservation converted to sale
      const saleEmailData: SaleConversionEmailData = {
        ...baseEmailData,
        saleDate: new Date(),
        depositAmount: updateData.depositAmount,
        installmentPlan: updateData.installmentPlan,
        paymentMethod: updateData.paymentMethod,
      };
      sendSaleConversionEmails(saleEmailData).catch(err => {
        logger.error('Failed to send sale conversion emails', err, { module: 'API', action: 'PUT_RESERVATIONS' });
      });
    } else if (updateData.status === 'CANCELLED' || updateData.status === 'EXPIRED') {
      // Reservation cancelled
      const reason = updateData.status === 'EXPIRED'
        ? 'Reservation expired (72-hour window exceeded)'
        : updateData.cancellationReason || 'Cancelled by user';
      sendReservationCancelledEmails(baseEmailData, reason).catch(err => {
        logger.error('Failed to send cancellation emails', err, { module: 'API', action: 'PUT_RESERVATIONS' });
      });
    }

    return apiSuccess(reservation);

  } catch (error: any) {
    logger.error('Reservation update error', error, { module: 'API', action: 'PUT_RESERVATIONS' });
    return apiError(
      error?.message || 'Failed to update reservation',
      500,
      ErrorCodes.UPDATE_ERROR
    );
  }
}

/**
 * DELETE /api/admin/reservations
 * Cancel/delete a reservation
 * 
 * Role-Based Access:
 * - Admin: Can delete any reservation
 * - Agent: Can only delete their own reservations
 */
export async function DELETE(request: NextRequest) {
  try {
    logger.info('DELETE /api/admin/reservations called', { module: 'API', action: 'DELETE_RESERVATIONS' });

    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const { id, reason } = await request.json();

    if (!id) {
      return apiError('Reservation ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch full reservation details for email before deletion
    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        stand: { include: { development: true } },
        client: true,
        agent: true,
        user: true
      }
    });

    if (!existingReservation) {
      return apiError('Reservation not found', 404, ErrorCodes.RESERVATION_NOT_FOUND);
    }

    // Agent can only delete their own reservations
    if (user.role === 'Agent' && existingReservation.agentId !== user.id) {
      return apiError('You can only delete your own reservations', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Prepare email data before deletion
    // Type the reservation with includes for type safety
    type ExistingReservationWithIncludes = typeof existingReservation;
    const standWithDev = existingReservation.stand as ExistingReservationWithIncludes['stand'] & { development?: { name?: string; location?: string; developerEmail?: string; developerName?: string } | null };
    const development = standWithDev?.development;
    const client = existingReservation.client as ExistingReservationWithIncludes['client'] & { name?: string; email?: string; phone?: string } | null;
    const agent = existingReservation.agent as ExistingReservationWithIncludes['agent'] & { name?: string; email?: string } | null;
    const reservationUser = existingReservation.user as ExistingReservationWithIncludes['user'] & { name?: string; email?: string } | null;
    const fallbackAgent = agent || reservationUser;

    const emailData: ReservationEmailData = {
      reservationId: existingReservation.id,
      reservationDate: existingReservation.createdAt,
      expiresAt: existingReservation.expiresAt,
      standNumber: standWithDev?.standNumber || 'N/A',
      standPrice: Number(standWithDev?.price || 0),
      standSize: standWithDev?.sizeSqm ? Number(standWithDev.sizeSqm) : undefined,
      developmentName: development?.name || 'Development',
      developmentLocation: development?.location || '',
      developerEmail: development?.developerEmail || undefined,
      developerName: development?.developerName || undefined,
      clientName: client?.name || 'Client',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || undefined,
      agentName: fallbackAgent?.name || undefined,
      agentEmail: fallbackAgent?.email || undefined,
      branch: standWithDev?.branch || 'Harare',
    };

    // Delete reservation and release stand in transaction
    await prisma.$transaction([
      prisma.reservation.delete({
        where: { id }
      }),
      prisma.stand.update({
        where: { id: existingReservation.standId },
        data: { status: 'AVAILABLE' }
      })
    ]);

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: standWithDev?.branch || 'Harare',
        userId: user.id,
        action: 'DELETE',
        module: 'RESERVATIONS',
        recordId: id,
        description: `Reservation cancelled and stand released`,
        changes: JSON.stringify({ deleted: true, standId: existingReservation.standId, reason })
      }
    });

    logger.info('Reservation deleted', { module: 'API', action: 'DELETE_RESERVATIONS', reservationId: id });

    // Send cancellation emails (async, don't block response)
    const cancellationReason = reason || 'Reservation cancelled by user';
    sendReservationCancelledEmails(emailData, cancellationReason).catch(err => {
      logger.error('Failed to send cancellation emails', err, { module: 'API', action: 'DELETE_RESERVATIONS' });
    });

    return apiSuccess(null);

  } catch (error: any) {
    logger.error('Reservation delete error', error, { module: 'API', action: 'DELETE_RESERVATIONS' });
    return apiError(
      error?.message || 'Failed to delete reservation',
      500,
      ErrorCodes.DELETE_ERROR
    );
  }
}
