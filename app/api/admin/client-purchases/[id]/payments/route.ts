import { NextRequest } from 'next/server';
import { requireAdmin, requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['ADMIN', 'ACCOUNT', 'MANAGER'];

function generateReceiptNo(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${y}${m}${d}-${rand}`;
}

/**
 * GET /api/admin/client-purchases/[id]/payments
 * List payments for a specific purchase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const { id } = await params;

    const payments = await (prisma as any).purchasePayment.findMany({
      where: { clientPurchaseId: id },
      orderBy: { paymentDate: 'desc' },
    });

    return apiSuccess(payments);
  } catch (error: any) {
    logger.error('GET purchase payments error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/client-purchases/[id]/payments
 * Add a payment to a purchase, auto-generates receiptNo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, paymentDate, method, reference, description } = body;

    if (!amount || !paymentDate) {
      return apiError('Missing required fields: amount, paymentDate', 400, 'VALIDATION_ERROR');
    }

    // Verify purchase exists (include client for Payment Ledger sync)
    const purchase = await (prisma as any).clientPurchase.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
    if (!purchase) {
      return apiError('Purchase not found', 404, 'NOT_FOUND');
    }

    // Generate unique receipt number
    let receiptNo = generateReceiptNo();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await (prisma as any).purchasePayment.findUnique({
        where: { receiptNo },
      });
      if (!existing) break;
      receiptNo = generateReceiptNo();
      attempts++;
    }

    const payment = await (prisma as any).purchasePayment.create({
      data: {
        clientPurchaseId: id,
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate),
        method: method || 'CASH',
        reference,
        description,
        receiptNo,
        status: 'CONFIRMED',
        createdBy: user.id,
      },
    });

    // Sync to main Payment Ledger (Billing)
    if (purchase) {
      // Use a unique reference based on the receiptNo to link back to PurchasePayment
      const paymentReference = `CP-${receiptNo}`;

      await (prisma as any).payment.create({
        data: {
          clientId: purchase.clientId,
          clientName: purchase.client.name,
          amount: parseFloat(amount),
          method: method || 'CASH',
          paymentType: 'Installment',
          officeLocation: purchase.branch || 'Harare',
          reference: paymentReference,
          manualReceiptNo: receiptNo,
          description: `Client Purchase Payment - ${receiptNo}`,
          status: 'COMPLETED',
          verificationStatus: 'Verified',
          standId: purchase.standId,
          developmentId: purchase.developmentId,
          confirmedAt: new Date(),
          receivedByName: user.email,
        },
      });

      logger.info('Payment synced to Ledger', {
        purchasePaymentId: payment.id,
        paymentReference,
        receiptNo,
        purchaseId: id,
      });
    }

    // Check if purchase is now fully paid
    const allPayments = await (prisma as any).purchasePayment.findMany({
      where: { clientPurchaseId: id, status: 'CONFIRMED' },
    });
    const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    if (totalPaid >= Number(purchase.purchasePrice)) {
      await (prisma as any).clientPurchase.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });
    }

    logger.info('PurchasePayment created', { paymentId: payment.id, purchaseId: id, receiptNo });
    return apiSuccess(payment, 201);
  } catch (error: any) {
    logger.error('POST purchase payment error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
