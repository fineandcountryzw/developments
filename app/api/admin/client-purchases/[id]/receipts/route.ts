import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['ADMIN', 'ACCOUNT', 'MANAGER'];

/**
 * GET /api/admin/client-purchases/[id]/receipts
 * List all receipts (payments with receiptNo) for a purchase
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

    // Verify purchase exists and get client/development info
    const purchase = await (prisma as any).clientPurchase.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        development: { select: { id: true, name: true } },
        stand: { select: { id: true, standNumber: true } },
      },
    });

    if (!purchase) {
      return apiError('Purchase not found', 404, 'NOT_FOUND');
    }

    const payments = await (prisma as any).purchasePayment.findMany({
      where: {
        clientPurchaseId: id,
        receiptNo: { not: null },
        status: 'CONFIRMED',
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Enrich with purchase context
    const receipts = payments.map((p: any) => ({
      id: p.id,
      receiptNo: p.receiptNo,
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      method: p.method,
      reference: p.reference,
      description: p.description,
      client: purchase.client,
      development: purchase.development,
      stand: purchase.stand,
      purchaseId: purchase.id,
      purchasePrice: Number(purchase.purchasePrice),
      createdAt: p.createdAt,
    }));

    return apiSuccess(receipts);
  } catch (error: any) {
    logger.error('GET purchase receipts error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
