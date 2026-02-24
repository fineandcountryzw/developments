/**
 * Reservation Server Actions
 * 
 * Server-side functions for managing 72-hour reservation system.
 * Uses Neon PostgreSQL via Prisma with forensic audit trail.
 */

'use server';

import prisma from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingReservationWithDetails {
  id: string;
  standId: string;
  userId: string | null;
  agentId: string | null;
  isCompanyLead: boolean;
  assignedLeadType: string | null;
  termsAcceptedAt: Date;
  expiresAt: Date;
  status: string;
  timerActive: boolean;
  popUrl: string | null;
  hasAttachment: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined Relations
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  stand: {
    id: string;
    standNumber: string;
    price: number;
    sizeSqm: number | null;
    status: string;
    development: {
      id: string;
      name: string;
      location: string;
    };
  };
  agent: {
    id: string;
    name: string;
    email: string | null;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Pending Reservations
 * 
 * Fetches all reservations with PENDING status that haven't expired yet.
 * Includes related user (client) email, stand details, and attachment status.
 * 
 * Query Optimizations:
 * - Filters by status = 'PENDING'
 * - Filters by expiresAt > now (only future reservations)
 * - Includes user email from users table
 * - Includes stand with development details
 * - Computes hasAttachment from popUrl
 * 
 * @returns Array of pending reservations with full details
 */
export async function getPendingReservations(): Promise<PendingReservationWithDetails[]> {
  try {
    const now = new Date();
    
    console.log('[RESERVATIONS][QUERY_PENDING]', {
      status: 'PENDING',
      filter: 'expiresAt > now',
      timestamp: now.toISOString(),
    });
    
    const reservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          gt: now, // Only future expiry dates
        },
      },
      include: {
        // Join User (Client) - Get email from neon_auth.users_sync
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // Join Stand with Development details
        stand: {
          include: {
            development: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        // Join Agent (if assigned)
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'asc', // Soonest to expire first
      },
    });
    
    // Map results to include hasAttachment computed field
    const reservationsWithAttachment = reservations.map((reservation) => ({
      ...reservation,
      hasAttachment: reservation.popUrl !== null,
      // Convert Decimal to number for price and sizeSqm
      stand: {
        ...reservation.stand,
        price: Number(reservation.stand.price),
        sizeSqm: reservation.stand.sizeSqm ? Number(reservation.stand.sizeSqm) : null,
      },
    }));
    
    console.log('[RESERVATIONS][QUERY_SUCCESS]', {
      count: reservationsWithAttachment.length,
      with_attachment: reservationsWithAttachment.filter(r => r.hasAttachment).length,
      without_attachment: reservationsWithAttachment.filter(r => !r.hasAttachment).length,
      timestamp: new Date().toISOString(),
    });
    
    return reservationsWithAttachment;
  } catch (error) {
    console.error('[RESERVATIONS][QUERY_ERROR]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    throw new Error('Failed to fetch pending reservations');
  }
}

/**
 * Get Reservation by ID
 * 
 * Fetches a single reservation with all related data.
 * 
 * @param id - Reservation ID
 * @returns Reservation with full details or null if not found
 */
export async function getReservationById(id: string): Promise<PendingReservationWithDetails | null> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stand: {
          include: {
            development: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!reservation) {
      return null;
    }
    
    return {
      ...reservation,
      hasAttachment: reservation.popUrl !== null,
      stand: {
        ...reservation.stand,
        price: Number(reservation.stand.price),
        sizeSqm: reservation.stand.sizeSqm ? Number(reservation.stand.sizeSqm) : null,
      },
    };
  } catch (error) {
    console.error('[RESERVATIONS][GET_BY_ID_ERROR]', {
      reservation_id: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    throw new Error('Failed to fetch reservation');
  }
}

/**
 * Get Expired Reservations
 * 
 * Fetches all reservations that have expired (expiresAt < now).
 * Useful for cleanup jobs and reporting.
 * 
 * @returns Array of expired reservations
 */
export async function getExpiredReservations(): Promise<PendingReservationWithDetails[]> {
  try {
    const now = new Date();
    
    const reservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now, // Past expiry dates
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stand: {
          include: {
            development: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'desc', // Most recently expired first
      },
    });
    
    const reservationsWithAttachment = reservations.map((reservation) => ({
      ...reservation,
      hasAttachment: reservation.popUrl !== null,
      stand: {
        ...reservation.stand,
        price: Number(reservation.stand.price),
        sizeSqm: reservation.stand.sizeSqm ? Number(reservation.stand.sizeSqm) : null,
      },
    }));
    
    console.log('[RESERVATIONS][EXPIRED_QUERY]', {
      count: reservationsWithAttachment.length,
      timestamp: new Date().toISOString(),
    });
    
    return reservationsWithAttachment;
  } catch (error) {
    console.error('[RESERVATIONS][EXPIRED_QUERY_ERROR]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    throw new Error('Failed to fetch expired reservations');
  }
}

/**
 * Get Reservations by User
 * 
 * Fetches all reservations for a specific user (client).
 * 
 * @param userId - User ID
 * @returns Array of user's reservations
 */
export async function getReservationsByUser(userId: string): Promise<PendingReservationWithDetails[]> {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        stand: {
          include: {
            development: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return reservations.map((reservation) => ({
      ...reservation,
      hasAttachment: reservation.popUrl !== null,
      stand: {
        ...reservation.stand,
        price: Number(reservation.stand.price),
        sizeSqm: reservation.stand.sizeSqm ? Number(reservation.stand.sizeSqm) : null,
      },
    }));
  } catch (error) {
    console.error('[RESERVATIONS][USER_QUERY_ERROR]', {
      user_id: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    throw new Error('Failed to fetch user reservations');
  }
}
