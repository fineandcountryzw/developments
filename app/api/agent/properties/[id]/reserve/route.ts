import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendReservationCreatedEmails, type ReservationEmailData } from '@/lib/reservation-emails';

/**
 * POST /api/agent/properties/:id/reserve
 * Create a reservation for a property for an agent's client
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id: propertyId } = await params;
    const body = await request.json();
    const { clientId, reservationType = 'RESERVED' } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Verify property exists
    const property = await prisma.stand.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    // Verify property is available
    if (property.status !== 'AVAILABLE') {
      return NextResponse.json(
        { success: false, error: 'Property is not available for reservation' },
        { status: 409 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Fetch agent details for email
    const agent = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true }
    });

    // Check if property already has a reservation
    const existingReservation = await prisma.reservation.findFirst({
      where: { standId: propertyId }
    });

    if (existingReservation) {
      return NextResponse.json(
        { success: false, error: 'Property already has an active reservation' },
        { status: 409 }
      );
    }

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        standId: propertyId,
        clientId: clientId,
        agentId: user.id,
        status: reservationType,
        termsAcceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        stand: {
          select: {
            standNumber: true,
            price: true,
            development: {
              select: {
                name: true,
                location: true
              }
            }
          }
        }
      }
    });

    // Update stand status to RESERVED
    await prisma.stand.update({
      where: { id: propertyId },
      data: { status: 'RESERVED' }
    });

    // Log activity
    await prisma.auditTrail.create({
      data: {
        action: 'PROPERTY_RESERVED',
        resourceType: 'RESERVATION',
        resourceId: reservation.id,
        userId: user.id,
        details: {
          clientName: client.name,
          propertyNumber: property.standNumber,
          developmentName: property.developmentId
        }
      }
    }).catch(err => logger.warn('Audit log failed', { error: err, module: 'API', action: 'RESERVE_PROPERTY' }));

    // Send reservation confirmation emails (async, don't block response)
    // Only send if client has a valid email address
    if (client.email && client.email.trim()) {
      const emailData: ReservationEmailData = {
        reservationId: reservation.id,
        reservationDate: new Date(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        standNumber: property.standNumber,
        standPrice: Number(property.price),
        standSize: property.sizeSqm ? Number(property.sizeSqm) : undefined,
        developmentName: reservation.stand.development?.name || 'Development',
        developmentLocation: reservation.stand.development?.location || '',
        developerEmail: undefined,
        developerName: undefined,
        clientName: client.name,
        clientEmail: client.email.toLowerCase().trim(),
        clientPhone: client.phone || undefined,
        agentName: agent?.name || undefined,
        agentEmail: agent?.email || undefined,
        branch: property.branch || 'Harare',
      };

      sendReservationCreatedEmails(emailData).catch(err => {
        logger.error('Failed to send reservation emails', err, { module: 'API', action: 'RESERVE_PROPERTY', clientId, clientEmail: client.email });
      });
    } else {
      logger.warn('Cannot send reservation email - client email missing', {
        module: 'API',
        action: 'RESERVE_PROPERTY',
        clientId,
        hasEmail: !!client.email
      });
    }

    return apiSuccess({
      reservation,
      message: `Property reserved for ${client.name} successfully`
    }, 201);

  } catch (error: any) {
    logger.error('Error reserving property', error, { module: 'API', action: 'RESERVE_PROPERTY' });
    return apiError(error.message || 'Failed to reserve property', 500, ErrorCodes.CREATE_ERROR);
  }
}
