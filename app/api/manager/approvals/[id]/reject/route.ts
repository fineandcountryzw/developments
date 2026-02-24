import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/manager/approvals/:id/reject
 * Reject payment or reservation
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { type, reason } = body;

    if (!reason) {
      return apiError('Rejection reason is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

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
          verificationStatus: 'Flagged',
          status: 'FAILED'
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
          description: `Payment ${payment.reference} rejected by ${manager?.name || user.email}`,
          metadata: {
            paymentId: id,
            amount: payment.amount,
            rejectedBy: manager?.name || user.email,
            reason,
            action: 'rejected'
          },
          userId: user.id
        }
      });

      return apiSuccess({
        payment: updated,
        message: 'Payment rejected'
      });

    } else if (type === 'reservation') {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { stand: true }
      });

      if (!reservation) {
        return apiError('Reservation not found', 404, ErrorCodes.RESERVATION_NOT_FOUND);
      }

      // Verify same branch via stand
      if (reservation.stand?.branch !== user.branch && user.role !== 'ADMIN') {
        return apiError('Unauthorized - different branch', 403, ErrorCodes.AUTH_REQUIRED);
      }

      // Cancel reservation
      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: 'CANCELLED'
        }
      });

      // Make stand available again
      await prisma.stand.update({
        where: { id: reservation.standId },
        data: {
          status: 'AVAILABLE',
          reservedBy: null
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
          type: 'RESERVATION',
          description: `Reservation for stand ${reservation.stand?.standNumber} rejected by ${manager?.name || user.email}`,
          metadata: {
            reservationId: id,
            standId: reservation.standId,
            rejectedBy: manager?.name || user.email,
            reason,
            action: 'rejected'
          },
          userId: user.id
        }
      });

      return apiSuccess({
        reservation: updated,
        message: 'Reservation rejected and stand made available'
      });

    } else {
      return apiError('Invalid type', 400, ErrorCodes.VALIDATION_ERROR);
    }
  } catch (error: any) {
    logger.error('Error rejecting item', error, { module: 'API', action: 'REJECT_APPROVAL' });
    return apiError(
      error.message || 'Failed to reject',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
