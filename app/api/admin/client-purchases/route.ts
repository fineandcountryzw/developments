import { NextRequest } from 'next/server';
import { requireAdmin, requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['ADMIN', 'ACCOUNT', 'MANAGER'];

/**
 * GET /api/admin/client-purchases
 * List all purchases, optionally filtered by clientId, developmentId, branch
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const { searchParams } = request.nextUrl;
    const clientId = searchParams.get('clientId');
    const developmentId = searchParams.get('developmentId');
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (developmentId) where.developmentId = developmentId;
    if (branch) where.branch = branch;
    if (status) where.status = status;

    const [purchases, total] = await Promise.all([
      (prisma as any).clientPurchase.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          development: { select: { id: true, name: true, location: true } },
          stand: { select: { id: true, standNumber: true, price: true, status: true } },
          purchasePayments: {
            select: { id: true, amount: true, paymentDate: true, receiptNo: true, status: true },
            orderBy: { paymentDate: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma as any).clientPurchase.count({ where }),
    ]);

    // Compute totalPaid and balance for each purchase
    const enriched = purchases.map((p: any) => {
      const totalPaid = p.purchasePayments
        .filter((pp: any) => pp.status === 'CONFIRMED')
        .reduce((sum: number, pp: any) => sum + Number(pp.amount), 0);
      return {
        ...p,
        totalPaid,
        balance: Number(p.purchasePrice) - totalPaid,
      };
    });

    return apiSuccess(enriched, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    logger.error('GET /api/admin/client-purchases error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/client-purchases
 * Create a new purchase linking client ↔ development ↔ stand
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { clientId, developmentId, standId, purchasePrice, depositAmount, periodMonths, monthlyAmount, startDate, notes, branch } = body;

    if (!clientId || !developmentId || !standId || !purchasePrice || !startDate) {
      return apiError('Missing required fields: clientId, developmentId, standId, purchasePrice, startDate', 400, 'VALIDATION_ERROR');
    }

    // Check stand doesn't already have an active purchase
    const existingActive = await (prisma as any).clientPurchase.findFirst({
      where: {
        standId,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
      },
    });

    if (existingActive) {
      return apiError('This stand already has an active purchase', 409, 'CONFLICT');
    }

    // Verify stand exists and belongs to the development
    const stand = await prisma.stand.findFirst({
      where: { id: standId, developmentId },
    });
    if (!stand) {
      return apiError('Stand not found in the specified development', 404, 'NOT_FOUND');
    }

    // Create the purchase
    const purchase = await (prisma as any).clientPurchase.create({
      data: {
        clientId,
        developmentId,
        standId,
        purchasePrice: parseFloat(purchasePrice),
        depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
        periodMonths: parseInt(periodMonths, 10) || 12,
        monthlyAmount: monthlyAmount ? parseFloat(monthlyAmount) : 0,
        startDate: new Date(startDate),
        notes,
        branch: branch || 'Harare',
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        development: { select: { id: true, name: true } },
        stand: { select: { id: true, standNumber: true } },
      },
    });

    // Mark stand as SOLD
    await prisma.stand.update({
      where: { id: standId },
      data: { status: 'SOLD', soldAt: new Date() },
    });

    // Update development available stands count
    const dev = await prisma.development.findUnique({ where: { id: developmentId } });
    if (dev && dev.availableStands !== null && dev.availableStands > 0) {
      await prisma.development.update({
        where: { id: developmentId },
        data: { availableStands: dev.availableStands - 1 },
      });
    }

    logger.info('ClientPurchase created', { purchaseId: purchase.id, clientId, standId });
    return apiSuccess(purchase, 201);
  } catch (error: any) {
    logger.error('POST /api/admin/client-purchases error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
