import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent, getAuthenticatedUser, isAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/commissions
 * Fetch commission data for an agent based on their sales
 * 
 * Query Parameters:
 * - agentId: Filter by agent ID
 * 
 * Role-Based Access:
 * - Admin: Can see all commissions (can pass any agentId)
 * - Agent: Can only see their own commissions (agentId enforced)
 * - Client: No access
 * 
 * Returns commission breakdown with status (earned/pending/projected)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let agentId = searchParams.get('agentId');

    // Use new unified auth - allow agents to view their own commissions
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Role-based access enforcement
    if (user.role === 'Client') {
      logger.warn('Access denied for Client role', { module: 'API', action: 'GET_COMMISSIONS' });
      return apiError('Clients cannot access commission data', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (user.role === 'Agent') {
      // Agents can only see their own commissions
      agentId = user.id;
      logger.debug('Agent access enforced', { module: 'API', action: 'GET_COMMISSIONS', agentId });
    }

    if (!agentId) {
      return apiError('agentId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.info('GET /api/admin/commissions', { 
      module: 'API', 
      action: 'GET_COMMISSIONS',
      agentId, 
      requestedBy: user.email,
      role: user.role 
    });

    // Get all reservations for the agent (their sales)
    const reservations = await prisma.reservation.findMany({
      where: {
        agentId: agentId,
        status: { in: ['CONFIRMED', 'PAYMENT_PENDING'] }
      }
    });

    logger.debug('Found reservations for agent', { module: 'API', action: 'GET_COMMISSIONS', count: reservations.length });

    // Fetch stand details for each reservation
    const commissionsPromises = reservations.map(async (reservation) => {
      try {
        const stand = await prisma.stand.findUnique({
          where: { id: reservation.standId },
          include: { development: true }
        }).catch((err) => {
          logger.error('Stand query error', err, { module: 'API', action: 'GET_COMMISSIONS', reservationId: reservation.id });
          return null;
        });

        if (!stand) {
          logger.warn('Stand not found for reservation', { module: 'API', action: 'GET_COMMISSIONS', reservationId: reservation.id, standId: reservation.standId });
          return null;
        }

        // Validate and convert price to number
        let standPrice = 0;
        if (stand.price !== null && stand.price !== undefined) {
          const rawPrice = stand.price as unknown;
          const price = typeof rawPrice === 'number'
            ? rawPrice
            : typeof rawPrice === 'string'
              ? parseFloat(rawPrice)
              : parseFloat((rawPrice as { toString?: () => string }).toString?.() || '0');
          standPrice = !isNaN(price) ? price : 0;
        }
        
        const commissionRate = 0.05; // 5% default commission rate
        const commissionAmount = standPrice * commissionRate;
        
        // Ensure commission amount is a valid number
        if (!isNaN(commissionAmount) && isFinite(commissionAmount)) {
          logger.debug('Calculated commission', {
            module: 'API',
            action: 'GET_COMMISSIONS',
            standId: stand.id,
            price: standPrice,
            amount: commissionAmount
          });
        } else {
          logger.error('Invalid commission calculation', new Error('Invalid commission amount'), {
            module: 'API',
            action: 'GET_COMMISSIONS',
            standId: stand.id,
            price: standPrice,
            amount: commissionAmount
          });
        }

      // Determine status based on reservation status
      let status: 'earned' | 'pending' | 'projected' = 'pending';
      if (reservation.status === 'CONFIRMED') {
        status = 'earned'; // Commission earned once confirmed
      } else if (reservation.status === 'PAYMENT_PENDING') {
        status = 'pending'; // Commission pending payment confirmation
      }

        return {
          id: reservation.id,
          standId: stand.id,
          standNumber: stand.standNumber,
          developmentName: stand.development?.name,
          clientName: 'Client', // TODO: Get from user/client relation
          standPrice: Number(standPrice) || 0,
          commissionRate: Number((commissionRate * 100)) || 0, // Return as percentage (5.0)
          amount: Number(commissionAmount) || 0,
          status: status,
          reservationStatus: reservation.status,
          date: reservation.createdAt.toISOString(),
          clientId: reservation.clientId
        };
      } catch (reservationErr: any) {
        logger.error('Error processing reservation', reservationErr, { module: 'API', action: 'GET_COMMISSIONS', reservationId: reservation.id });
        return null; // Return null for this reservation, continue with others
      }
    });

    const commissionsRaw = await Promise.all(commissionsPromises);
    
    // Filter out null values from failed processing
    const commissions = commissionsRaw.filter(c => c !== null);

    if (commissions.length === 0) {
      logger.warn('No valid commissions found for agent', { module: 'API', action: 'GET_COMMISSIONS', agentId });
    }

    // Safely calculate summaries with validated numbers
    const validCommissions = commissions.filter(c => typeof c.amount === 'number' && !isNaN(c.amount));
    
    return apiSuccess({
      data: commissions,
      count: commissions.length,
      summary: {
        totalEarned: validCommissions
          .filter(c => c.status === 'earned')
          .reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
        totalPending: validCommissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
        totalProjected: 0 // Projected commissions not currently tracked
      }
    });

  } catch (error: any) {
    logger.error('Error fetching commissions', error, { module: 'API', action: 'GET_COMMISSIONS' });
    return apiError(
      error.message || 'Failed to fetch commissions',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}
