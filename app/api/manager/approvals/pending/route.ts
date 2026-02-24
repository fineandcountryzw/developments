import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/manager/approvals/pending
 * Get pending items requiring manager approval
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch;

    // Get pending payment verifications
    const pendingPayments = await prisma.payment.findMany({
      where: {
        officeLocation: branch,
        verificationStatus: 'Pending',
        status: 'PENDING'
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Get pending reservations (within 24 hours, not yet confirmed)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const pendingReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        createdAt: { gte: oneDayAgo },
        stand: {
          branch: branch
        }
      },
      include: {
        stand: {
          select: {
            standNumber: true,
            price: true,
            development: {
              select: { name: true }
            }
          }
        },
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const approvals = {
      pendingPayments: pendingPayments.map(p => ({
        id: p.id,
        type: 'payment',
        amount: p.amount,
        clientName: p.client?.name || p.clientName,
        paymentType: p.paymentType,
        method: p.method,
        reference: p.reference,
        createdAt: p.createdAt,
        priority: 'high'
      })),
      pendingReservations: pendingReservations.map(r => ({
        id: r.id,
        type: 'reservation',
        clientName: r.client?.name,
        standNumber: r.stand?.standNumber,
        developmentName: r.stand?.development?.name,
        price: r.stand?.price,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        priority: 'medium'
      })),
      totalPending: pendingPayments.length + pendingReservations.length
    };

    return apiSuccess(approvals);
  } catch (error: any) {
    logger.error('Error fetching pending approvals', error, { module: 'API', action: 'GET_PENDING_APPROVALS' });
    return apiError(error.message || 'Failed to fetch approvals', 500, ErrorCodes.FETCH_ERROR);
  }
}
