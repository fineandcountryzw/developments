/**
 * Active Reservations API
 * 
 * Returns all PENDING and PAYMENT_PENDING reservations
 * within the 72-hour window for the countdown table.
 */

import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export async function GET() {
  try {
    // Require ADMIN role
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const now = new Date();

    // Fetch active reservations
    const reservations = await prisma.reservation.findMany({
      where: {
        status: {
          in: ['PENDING', 'PAYMENT_PENDING'],
        },
        expiresAt: {
          gt: now,
        },
      },
      include: {
        stand: {
          include: {
            development: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    // Format response
    const formattedReservations = reservations.map((reservation) => {
      const timeRemaining = reservation.expiresAt.getTime() - now.getTime();
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      return {
        id: reservation.id,
        standNumber: reservation.stand.standNumber,
        developmentName: reservation.stand.development.name,
        clientName: reservation.user?.name || 'Unknown',
        clientEmail: reservation.user?.email || 'N/A',
        expiresAt: reservation.expiresAt.toISOString(),
        timeRemaining: `${hours}h ${minutes}m`,
        status: reservation.status,
      };
    });

    return apiSuccess({
      reservations: formattedReservations,
      count: formattedReservations.length,
    });
  } catch (error: any) {
    logger.error('Error fetching active reservations', error, { module: 'API', action: 'GET_ACTIVE_RESERVATIONS' });
    return apiError('Failed to fetch active reservations', 500, ErrorCodes.FETCH_ERROR);
  }
}
