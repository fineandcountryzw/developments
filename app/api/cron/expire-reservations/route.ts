/**
 * Cron Job: Expire Reservations
 * 
 * Scheduled task that runs every hour to:
 * 1. Find all PENDING reservations where expiresAt < now()
 * 2. Update Reservation status to EXPIRED
 * 3. Reset Stand status to AVAILABLE
 * 
 * Trigger: Every hour via external cron service (e.g., cron-job.org, EasyCron)
 * Security: Requires CRON_SECRET environment variable
 * Database: Neon PostgreSQL via Prisma
 * 
 * Usage:
 * POST /api/cron/expire-reservations
 * Authorization: Bearer YOUR_CRON_SECRET
 */

import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CronRequest {
  headers: {
    authorization?: string;
  };
}

interface CronResponse {
  json: (data: any) => void;
  status: (code: number) => CronResponse;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expire Reservations Cron Job
 * 
 * Can be called from:
 * 1. Server-side function (Node.js)
 * 2. API endpoint (Express/Fastify)
 * 3. Serverless function (Vercel/Netlify)
 * 4. Direct execution (node -e "require('./dist/api/cron/expire-reservations').expireReservations()")
 */
async function expireReservations(authorizationHeader?: string) {
  const startTime = Date.now();
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECURITY: Verify cron secret
    // ─────────────────────────────────────────────────────────────────────────
    
    if (!CRON_SECRET) {
      logger.error('CRON_SECRET not configured', new Error('CRON_SECRET not set'), {
        module: 'CRON',
        action: 'EXPIRE_RESERVATIONS',
        timestamp: new Date().toISOString(),
      });
      throw new Error('Cron job not configured');
    }
    
    if (authorizationHeader !== `Bearer ${CRON_SECRET}`) {
      logger.error('Unauthorized cron access', new Error('Invalid CRON_SECRET'), {
        module: 'CRON',
        action: 'EXPIRE_RESERVATIONS',
        auth_header: authorizationHeader ? 'present' : 'missing',
        timestamp: new Date().toISOString(),
      });
      throw new Error('Unauthorized');
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // QUERY: Find expired pending reservations
    // ─────────────────────────────────────────────────────────────────────────
    
    const now = new Date();
    
    logger.info('CRON EXPIRE_RESERVATIONS STARTED', {
      module: 'CRON',
      action: 'EXPIRE_RESERVATIONS',
      current_time: now.toISOString(),
      timestamp: now.toISOString(),
    });
    
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now, // Less than current time = expired
        },
      },
      include: {
        stand: {
          select: {
            id: true,
            standNumber: true,
            status: true,
            development: {
              select: {
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    logger.info('CRON EXPIRE_RESERVATIONS FOUND', {
      module: 'CRON',
      action: 'EXPIRE_RESERVATIONS',
      count: expiredReservations.length,
      reservation_ids: expiredReservations.map(r => r.id),
      timestamp: new Date().toISOString(),
    });
    
    if (expiredReservations.length === 0) {
      const duration = Date.now() - startTime;
      return {
        success: true,
        expired_count: 0,
        message: 'No expired reservations found',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE: Expire reservations and reset stands
    // ─────────────────────────────────────────────────────────────────────────
    
    const results = {
      expired_reservations: [] as string[],
      reset_stands: [] as string[],
      errors: [] as { reservation_id: string; error: string }[],
    };
    
    // Process each expired reservation in a transaction
    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Update reservation status to EXPIRED
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              status: 'EXPIRED',
              timerActive: false,
            },
          });
          
          // 2. Reset stand status to AVAILABLE
          await tx.stand.update({
            where: { id: reservation.standId },
            data: {
              status: 'AVAILABLE',
            },
          });
          
          results.expired_reservations.push(reservation.id);
          results.reset_stands.push(reservation.standId);
          
          logger.info('CRON EXPIRE_RESERVATIONS PROCESSED', {
            module: 'CRON',
            action: 'EXPIRE_RESERVATIONS',
            reservation_id: reservation.id,
            stand_id: reservation.standId,
            stand_number: reservation.stand.standNumber,
            development: reservation.stand.development.name,
            client_email: reservation.user?.email?.substring(0, 3) + '***' || 'No email',
            agent_name: reservation.agent?.name || 'Company Lead',
            expired_at: reservation.expiresAt.toISOString(),
            current_time: now.toISOString(),
            hours_past_expiry: Math.floor((now.getTime() - reservation.expiresAt.getTime()) / (1000 * 60 * 60)),
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          reservation_id: reservation.id,
          error: errorMessage,
        });
        
        logger.error('CRON EXPIRE_RESERVATIONS ERROR', error, {
          module: 'CRON',
          action: 'EXPIRE_RESERVATIONS',
          reservation_id: reservation.id,
          stand_id: reservation.standId,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSE: Return summary
    // ─────────────────────────────────────────────────────────────────────────
    
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      expired_count: results.expired_reservations.length,
      reset_stands_count: results.reset_stands.length,
      error_count: results.errors.length,
      expired_reservation_ids: results.expired_reservations,
      reset_stand_ids: results.reset_stands,
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('CRON EXPIRE_RESERVATIONS COMPLETED', {
      module: 'CRON',
      action: 'EXPIRE_RESERVATIONS',
      ...response
    });
    
    return response;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('CRON EXPIRE_RESERVATIONS FATAL_ERROR', error, {
      module: 'CRON',
      action: 'EXPIRE_RESERVATIONS',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    
    throw error;
  }
}

// Next.js route handlers
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const result = await expireReservations(authHeader ?? undefined);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}
