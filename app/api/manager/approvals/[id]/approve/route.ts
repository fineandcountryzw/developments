import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/manager/approvals/:id/approve
 * Approve payment or reservation
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { type, notes } = body; // type: 'payment' or 'reservation'

    if (type === 'payment') {
      const payment = await prisma.payment.findUnique({
        where: { id }
      });

      if (!payment) {
        return apiError('Payment not found', 404, ErrorCodes.NOT_FOUND);
      }

      // Verify same branch
      if (payment.officeLocation !== user.branch && user.role !== 'ADMIN') {
        return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
      }

      // Update payment status
      const updated = await prisma.payment.update({
        where: { id },
        data: {
          verificationStatus: 'Verified',
          status: 'CONFIRMED',
          confirmedAt: new Date()
        }
      });

      // Get manager name
      const manager = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true }
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'VERIFICATION',
          description: `Payment ${payment.reference} approved by ${manager?.name || user.email}`,
          metadata: {
            paymentId: id,
            amount: payment.amount,
            approvedBy: manager?.name || user.email,
            notes,
            action: 'approved'
          },
          userId: user.id
        }
      });

      return apiSuccess({ ...updated, message: 'Payment approved successfully' });

    } else if (type === 'reservation') {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
          stand: true
        }
      });

      if (!reservation) {
        return apiError('Reservation not found', 404, ErrorCodes.NOT_FOUND);
      }

      // Verify same branch via stand
      if (reservation.stand?.branch !== user.branch && user.role !== 'ADMIN') {
        return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
      }

      // Update reservation status
      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: 'CONFIRMED'
        }
      });

      // Ensure stand status reflects reservation approval
      if (reservation.standId && reservation.stand?.status !== 'SOLD') {
        await prisma.stand.update({
          where: { id: reservation.standId },
          data: {
            status: 'RESERVED',
            updatedAt: new Date()
          }
        });
      }

      // Get manager name
      const manager = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true }
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'RESERVATION',
          description: `Reservation for stand ${reservation.stand?.standNumber} approved by ${manager?.name || user.email}`,
          metadata: {
            reservationId: id,
            standId: reservation.standId,
            approvedBy: manager?.name || user.email,
            notes,
            action: 'approved'
          },
          userId: user.id
        }
      });

      return apiSuccess({ ...updated, message: 'Reservation approved successfully' });

    } else {
      return apiError('Invalid approval type', 400, ErrorCodes.VALIDATION_ERROR);
    }
  } catch (error: any) {
    logger.error('Error approving item', error, { module: 'API', action: 'APPROVE_ITEM' });
    return apiError(error.message || 'Failed to approve', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
