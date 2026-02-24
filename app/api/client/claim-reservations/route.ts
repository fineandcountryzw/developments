/**
 * POST /api/client/claim-reservations
 * Claim unclaimed reservations for the authenticated client
 * Called automatically after login or account creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/access-control';
import { claimReservationsForUser } from '@/lib/reservation-claim';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Verify CLIENT role
    if (user.role?.toUpperCase() !== 'CLIENT') {
      return apiError('Forbidden - Client access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Get client record
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { email: user.email.toLowerCase().trim() },
        ],
      },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });

    if (!client) {
      return apiError('Client record not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Claim reservations
    const result = await claimReservationsForUser({
      userId: user.id,
      clientId: client.id,
      email: client.email,
      phone: client.phone || undefined,
    });

    return apiSuccess({
      claimed: result.claimed,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error('Error claiming reservations', error, {
      module: 'API',
      action: 'CLAIM_RESERVATIONS',
    });
    return apiError('Failed to claim reservations', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
