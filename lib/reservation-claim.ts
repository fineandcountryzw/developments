/**
 * Reservation Claim Service
 * Links unclaimed reservations to user accounts by email/phone
 * 
 * When a user creates an account or logs in, this service:
 * 1. Finds reservations created with matching email/phone but no userId/clientId
 * 2. Links them to the authenticated user's account
 * 3. Ensures idempotency (safe to run multiple times)
 */

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * Claim reservations for a user by email/phone
 * This is idempotent - safe to call multiple times
 */
export async function claimReservationsForUser(params: {
  userId: string;
  clientId: string;
  email: string;
  phone?: string;
}): Promise<{ claimed: number; errors: string[] }> {
  const { userId, clientId, email, phone } = params;
  const errors: string[] = [];
  let claimed = 0;

  try {
    // Normalize email for matching
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone?.trim().replace(/\s/g, '');

    // Find unclaimed reservations matching email or phone
    // Unclaimed = no userId or clientId, or userId/clientId doesn't match current user
    // Also check reservations where clientId exists but matches our email/phone
    const unclaimedReservations = await prisma.reservation.findMany({
      where: {
        AND: [
          {
            OR: [
              // No user/client linked
              { userId: null },
              { clientId: null },
              // Or linked to a different user (shouldn't happen, but safety check)
              { userId: { not: userId } },
              { clientId: { not: clientId } },
              // Or clientId exists but matches our email (same client, different userId)
              {
                AND: [
                  { clientId: { not: null } },
                  {
                    client: {
                      email: {
                        equals: normalizedEmail,
                        mode: 'insensitive',
                      },
                    },
                  },
                ],
              },
            ],
          },
          {
            OR: [
              // Match by client email (via Client relation)
              {
                client: {
                  email: {
                    equals: normalizedEmail,
                    mode: 'insensitive',
                  },
                },
              },
              // Match by user email (via User relation) - if reservation was created with a temp user
              {
                user: {
                  email: {
                    equals: normalizedEmail,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          },
        ],
        // Only claim active/pending reservations
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
        // Only claim recent reservations (within last 30 days)
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Also check by phone if provided
    let phoneMatchedReservations: typeof unclaimedReservations = [];
    if (normalizedPhone) {
      phoneMatchedReservations = await prisma.reservation.findMany({
        where: {
          AND: [
            {
              OR: [
                { userId: null },
                { clientId: null },
                { userId: { not: userId } },
                { clientId: { not: clientId } },
              ],
            },
            {
              client: {
                phone: {
                  contains: normalizedPhone,
                  mode: 'insensitive',
                },
              },
            },
          ],
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          client: {
            select: {
              id: true,
              email: true,
              phone: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    }

    // Combine and deduplicate
    const allUnclaimed = [
      ...unclaimedReservations,
      ...phoneMatchedReservations,
    ].filter(
      (res, index, self) =>
        index === self.findIndex((r) => r.id === res.id)
    );

    // Verify each reservation matches email/phone before claiming
    const toClaim = allUnclaimed.filter((reservation) => {
      const clientEmail = reservation.client?.email?.toLowerCase().trim();
      const clientPhone = reservation.client?.phone?.trim().replace(/\s/g, '');
      const userEmail = reservation.user?.email?.toLowerCase().trim();

      // Must match email
      const emailMatch =
        clientEmail === normalizedEmail || userEmail === normalizedEmail;

      // Phone match is optional but preferred
      const phoneMatch = normalizedPhone
        ? clientPhone?.includes(normalizedPhone) ||
          normalizedPhone.includes(clientPhone || '')
        : true;

      return emailMatch && phoneMatch;
    });

    // Claim each reservation
    for (const reservation of toClaim) {
      try {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            userId: userId,
            clientId: clientId,
          },
        });

        claimed++;

        logger.info('Reservation claimed', {
          module: 'ReservationClaim',
          action: 'CLAIM_RESERVATION',
          reservationId: reservation.id,
          userId,
          clientId,
          email: normalizedEmail.substring(0, 3) + '***',
        });
      } catch (error: any) {
        const errorMsg = `Failed to claim reservation ${reservation.id}: ${error.message}`;
        errors.push(errorMsg);
        logger.error('Failed to claim reservation', error, {
          module: 'ReservationClaim',
          action: 'CLAIM_RESERVATION',
          reservationId: reservation.id,
        });
      }
    }

    if (claimed > 0) {
      logger.info('Reservations claimed successfully', {
        module: 'ReservationClaim',
        action: 'CLAIM_RESERVATIONS',
        userId,
        clientId,
        claimed,
        totalFound: allUnclaimed.length,
      });
    }

    return { claimed, errors };
  } catch (error: any) {
    logger.error('Error claiming reservations', error, {
      module: 'ReservationClaim',
      action: 'CLAIM_RESERVATIONS',
      userId,
      email: email.substring(0, 3) + '***',
    });
    return { claimed: 0, errors: [error.message || 'Unknown error'] };
  }
}

/**
 * Check if user has unclaimed reservations (for UI display)
 */
export async function hasUnclaimedReservations(email: string, phone?: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone?.trim().replace(/\s/g, '');

    const count = await prisma.reservation.count({
      where: {
        AND: [
          {
            OR: [
              { userId: null },
              { clientId: null },
            ],
          },
          {
            OR: [
              {
                client: {
                  email: {
                    equals: normalizedEmail,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              ...(normalizedPhone
                ? [
                    {
                      client: {
                        phone: {
                          contains: normalizedPhone,
                          mode: Prisma.QueryMode.insensitive,
                        },
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return count > 0;
  } catch (error) {
    logger.error('Error checking unclaimed reservations', error instanceof Error ? error : new Error(String(error)), {
      module: 'ReservationClaim',
      action: 'CHECK_UNCLAIMED',
    });
    return false;
  }
}
