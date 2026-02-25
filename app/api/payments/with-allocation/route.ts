import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { PaymentsService, CreatePaymentInput } from '@/lib/payments/payments.service';
import { FeeCalculator } from '@/lib/feeCalculator';
import { logger } from '@/lib/logger';

// Enums defined locally since Prisma 7 doesn't export them the same way
const Currency = { USD: 'USD', ZAR: 'ZAR', BWP: 'BWP' } as const;
const PaymentMethod = { BANK: 'BANK', CASH: 'CASH', MOBILE: 'MOBILE', ECOCASH: 'ECOCASH', ZIPIT: 'ZIPIT', TRANSFER: 'TRANSFER' } as const;
const PaymentSource = { API: 'API', PORTAL: 'PORTAL', IMPORT: 'IMPORT', MANUAL: 'MANUAL' } as const;
const TransactionStatus = { PENDING: 'PENDING', COMPLETED: 'COMPLETED', FAILED: 'FAILED' } as const;
type Currency = typeof Currency[keyof typeof Currency];
type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];
type PaymentSource = typeof PaymentSource[keyof typeof PaymentSource];
type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/payments/with-allocation
 * Record a payment with proportional allocation across fees
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    const body = await request.json();
    const {
      reservationId,
      paymentAmount,
      paymentMethod = 'Bank',
      reference,
    } = body;

    // Validate required fields
    if (!reservationId || !paymentAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: reservationId, paymentAmount' },
        { status: 400 }
      );
    }

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Fetch reservation with stand details
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Fetch stand with development
    const stand = await prisma.stand.findUnique({
      where: { id: reservation.standId },
      include: { development: true },
    });

    if (!stand || !stand.development) {
      return NextResponse.json(
        { success: false, error: 'Stand or development not found for reservation' },
        { status: 400 }
      );
    }

    // Get fee breakdown from reservation metadata
    const reservationMetadata = (reservation as any)?.metadata || {};
    const feeBreakdown = reservationMetadata.feeBreakdown || 
      FeeCalculator.calculateStandFees(
        Number(stand.price),
        stand.development as any,
        stand as any
      );

    // Allocate payment proportionally across fees
    const allocation = FeeCalculator.allocatePayment(paymentAmount, feeBreakdown);

    // Create payment record using the canonical PaymentTransaction table
    const idempotencyKey = `alloc-${reservationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get client ID from reservation
    const clientId = reservation.userId || reservation.clientId;
    
    // Create payment via canonical PaymentsService
    const paymentInput: CreatePaymentInput = {
        amount: paymentAmount,
        currency: 'USD',
        method: paymentMethod === 'Ecocash' ? 'ECOCASH' : 
                paymentMethod === 'Zipit' ? 'ZIPIT' : 
                paymentMethod === 'Transfer' ? 'TRANSFER' : 'BANK',
        reference: reference || `PAY-${Date.now()}`,
        idempotencyKey,
        memo: `Payment for stand ${stand.standNumber}`,
        clientId: clientId || 'STAND-ONLY',
        saleId: undefined, // Will be linked if needed
        invoiceId: undefined, // Will be linked if needed
        developmentId: stand.developmentId,
        standId: stand.id,
        source: 'MANUAL',
        postedAt: new Date(),
        createdByUserId: user.id,
    };

    const paymentTransaction = await PaymentsService.createPayment(paymentInput);

    // Get total amount and determine reservation status
    const totalAmount = feeBreakdown.totalAmount;
    const updatedStatus = paymentAmount >= totalAmount ? 'CONFIRMED' : reservation.status;

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: updatedStatus as any,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: stand.development?.location || 'Harare',
        userId: user.id,
        action: 'CREATE',
        module: 'PAYMENTS',
        recordId: paymentTransaction.id,
        description: `Payment of ${paymentAmount.toFixed(2)} recorded for reservation on stand ${stand.standNumber}`,
        changes: JSON.stringify({
          paymentId: paymentTransaction.id,
          reservationId: reservationId,
          amount: paymentAmount,
          allocationStandPrice: allocation.principal,
          allocationVat: allocation.vat,
          allocationAOS: allocation.agreementOfSale,
          allocationEndowment: allocation.endowment,
          allocationCession: allocation.cession,
        })
      },
    });

    // The PaymentsService automatically handles:
    // - Creating PaymentTransaction record
    // - Updating Sale status if linked
    // - Updating Invoice status if linked
    // No need to call handlePaymentSuccess separately
    
    logger.info('[PAYMENT_ALLOCATION] Payment created via canonical service', {
      module: 'API',
      paymentId: paymentTransaction.id,
      amount: paymentAmount,
      reservationId
    });

    return NextResponse.json({
      success: true,
      data: {
        payment: paymentTransaction,
        allocation,
        reservationStatus: {
          totalPrice: totalAmount,
          totalPaid: paymentAmount,
          remainingBalance: Math.max(0, totalAmount - paymentAmount),
          status: updatedStatus,
        },
      },
      message: 'Payment recorded successfully with fee allocation',
    });
  } catch (error: any) {
    logger.error('Error recording payment with allocation', error, { module: 'API', action: 'POST_PAYMENTS_WITH_ALLOCATION' });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record payment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/with-allocation
 * Get payment allocation history for a reservation
 * Now uses canonical PaymentTransaction table
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) {
      return authResult.error;
    }
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');

    if (!reservationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: reservationId' },
        { status: 400 }
      );
    }

    // First get the reservation to find the standId
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { standId: true }
    });

    if (!reservation?.standId) {
      return NextResponse.json({
        success: true,
        data: {
          payments: [],
          totalAllocations: {
            standPrice: 0,
            agreementOfSale: 0,
            endowment: 0,
            cession: 0,
            vat: 0,
          },
          totalPaid: 0,
          message: 'No reservation or stand found',
        },
      });
    }

    // Get payments from canonical PaymentTransaction table filtered by standId
    const paymentsResult = await PaymentsService.listPayments({
      standId: reservation.standId,
      limit: 100
    });

    if (paymentsResult.items.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          payments: [],
          totalAllocations: {
            standPrice: 0,
            agreementOfSale: 0,
            endowment: 0,
            cession: 0,
            vat: 0,
          },
          totalPaid: 0,
          message: 'No payments found for this reservation',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        payments: paymentsResult.items,
        totalAllocations: {
          standPrice: 0,
          agreementOfSale: 0,
          endowment: 0,
          cession: 0,
          vat: 0,
        },
        totalPaid: paymentsResult.items.reduce((sum, p) => sum + Number(p.amount), 0),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching payment allocations', error, { module: 'API', action: 'GET_PAYMENTS_WITH_ALLOCATION' });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
