import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { PaymentsService, CreatePaymentInput } from '@/lib/payments/payments.service';
// Enums defined locally since Prisma 7 doesn't export them the same way
const Currency = { USD: 'USD', ZAR: 'ZAR', BWP: 'BWP' } as const;
const PaymentMethod = { BANK: 'BANK', CASH: 'CASH', MOBILE: 'MOBILE' } as const;
const PaymentSource = { API: 'API', PORTAL: 'PORTAL' } as const;
const TransactionStatus = { PENDING: 'PENDING', COMPLETED: 'COMPLETED', FAILED: 'FAILED' } as const;

/**
 * POST /api/client/payments/upload
 * Upload proof of payment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const body = await request.json();
    const { reservationId, standId, amount, paymentType, proofUrl, reference, notes } = body;

    if (!amount || !paymentType || !proofUrl) {
      return apiError('Amount, payment type, and proof of payment are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get client
    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify reservation belongs to client if provided
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId }
      });

      if (!reservation || reservation.clientId !== client.id) {
        return apiError('Invalid reservation', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Create pending payment record using canonical PaymentsService
    const idempotencyKey = `client-upload-${client.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentInput: CreatePaymentInput = {
        amount: Number(amount),
        currency: 'USD',
        method: 'BANK',
        reference: reference || `POP-${Date.now()}`,
        idempotencyKey,
        memo: notes || `${paymentType} payment`,
        clientId: client.id,
        saleId: undefined,
        invoiceId: undefined,
        developmentId: undefined,
        standId: standId || undefined,
        source: 'API',
        postedAt: new Date(),
        status: 'PENDING',  // PENDING until verified
    };

    const payment = await PaymentsService.createPayment(paymentInput);

    // Log the proof of payment upload
    await prisma.activityLog.create({
      data: {
        branch: client.branch || 'Harare',
        userId: session.user.id,
        action: 'PAYMENT_UPLOAD',
        module: 'PAYMENTS',
        recordId: payment.id,
        description: `Payment proof uploaded by ${client.name}`,
        changes: {
          paymentId: payment.id,
          clientId: client.id,
          clientName: client.name,
          amount,
          proofUrl,
          reservationId,
          standId
        }
      }
    });

    return apiSuccess({
      payment,
      message: 'Proof of payment uploaded successfully. Awaiting verification.' 
    });
  } catch (error: any) {
    logger.error('Error uploading payment proof', error, { module: 'API', action: 'POST_CLIENT_PAYMENTS_UPLOAD' });
    return apiError(error.message || 'Failed to upload payment proof', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * GET /api/client/payments/upload
 * Get client's uploaded payment proofs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get pending payments
    const pendingPayments = await prisma.payment.findMany({
      where: {
        clientId: client.id,
        verificationStatus: 'Pending'
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(pendingPayments);
  } catch (error: any) {
    logger.error('Error fetching payment proofs', error, { module: 'API', action: 'GET_CLIENT_PAYMENTS_UPLOAD' });
    return apiError(error.message || 'Failed to fetch payment proofs', 500, ErrorCodes.FETCH_ERROR);
  }
}
