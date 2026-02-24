import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAgent, getAuthenticatedUser } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/receipts
 * List all receipts with filters - accessible by admin, agents, clients
 */
export async function GET(request: NextRequest) {
  try {
    // Allow agents and admins
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const clientId = request.nextUrl.searchParams.get('clientId');
    const branch = request.nextUrl.searchParams.get('branch');
    const paymentType = request.nextUrl.searchParams.get('paymentType');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    const where: any = {};
    
    // Role-based filtering (roles are uppercase from auth)
    if (user.role === 'AGENT') {
      // Agents can only see receipts for their clients
      const agentClients = await prisma.reservation.findMany({
        where: { agentId: user.id },
        select: { clientId: true }
      });
      const clientIds = agentClients.map(r => r.clientId).filter((id): id is string => id !== null);
      if (clientIds.length === 0) {
        // Agent has no clients, return empty result
        return apiSuccess({
          data: [],
          totals: {
            count: 0,
            totalAmount: 0,
            deposits: 0,
            installments: 0,
            fullPayments: 0
          }
        });
      }
      where.clientId = { in: clientIds };
    } else if (user.role === 'CLIENT') {
      // Clients can only see their own receipts
      where.clientEmail = user.email;
    }

    // Additional filters
    if (clientId) where.clientId = clientId;
    if (branch) where.branch = branch;
    if (paymentType) where.paymentType = paymentType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        payment: {
          select: { id: true, reference: true, verificationStatus: true }
        },
        installment: {
          select: { id: true, installmentNo: true, planId: true }
        }
      }
    });

    // Calculate totals
    const totals = {
      count: receipts.length,
      totalAmount: receipts.reduce((sum, r) => sum + Number(r.amount), 0),
      deposits: receipts.filter(r => r.paymentType === 'Deposit').length,
      installments: receipts.filter(r => r.paymentType === 'Installment').length,
      fullPayments: receipts.filter(r => r.paymentType === 'Full Payment').length
    };

    // Transform to DTO format expected by UI
    const transformedReceipts = receipts.map((receipt: any) => ({
      ...receipt,
      amount: Number(receipt.amount) || 0,
      issuedBy: receipt.receivedBy || '',
      paymentReference: receipt.payment?.reference || '',
      installmentNumber: receipt.installment?.installmentNo || null,
    }));

    return apiSuccess({
      data: transformedReceipts,
      totals
    });

  } catch (error: any) {
    logger.error('Receipts API Error', error, { module: 'API', action: 'GET_RECEIPTS' });
    return apiError(error.message || 'Failed to fetch receipts', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/receipts
 * Generate a receipt for a payment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const {
      paymentId,
      installmentId,
      clientId,
      clientName,
      clientEmail,
      amount,
      paymentMethod,
      paymentType,
      description,
      standNumber,
      developmentName,
      branch,
      receivedBy
    } = body;

    // Validate required fields
    if (!clientId || !clientName || !amount || !paymentMethod || !paymentType || !branch) {
      return apiError('Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate payment if provided
    if (paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return apiError('Payment not found', 404, ErrorCodes.NOT_FOUND);
      }
      if (Number(payment.amount) !== Number(amount)) {
        return apiError(
          `Amount mismatch: Receipt amount ($${amount}) does not match payment amount ($${payment.amount})`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      // Check for duplicate receipt
      const existingReceipt = await prisma.receipt.findFirst({
        where: { paymentId }
      });
      if (existingReceipt) {
        return apiError('Receipt already exists for this payment', 409, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Validate installment belongs to client
    if (installmentId) {
      const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
        include: { plan: true }
      });
      if (!installment) {
        return apiError('Installment not found', 404, ErrorCodes.NOT_FOUND);
      }
      if (installment.plan.clientId !== clientId) {
        return apiError('Installment does not belong to this client', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Create receipt with retry logic
    const receipt = await createReceiptWithRetry({
      paymentId,
      installmentId,
      clientId,
      clientName,
      clientEmail,
      amount,
      paymentMethod,
      paymentType,
      description,
      standNumber,
      developmentName,
      branch,
      receivedBy
    });

    return apiSuccess({
      receipt,
      message: `Receipt ${receipt.receiptNumber} generated successfully`
    }, 201);

  } catch (error: any) {
    logger.error('Receipts API Create error', error, { module: 'API', action: 'POST_RECEIPTS' });
    return apiError(error.message || 'Failed to generate receipt', 500, ErrorCodes.CREATE_ERROR);
  }
}

// Helper to generate unique receipt numbers
async function generateReceiptNumber(branch: string): Promise<string> {
  const prefix = branch === 'Harare' ? 'FC-HRE' : 'FC-BYO';
  const year = new Date().getFullYear();
  
  const count = await prisma.receipt.count({
    where: {
      branch,
      receiptNumber: { startsWith: `${prefix}-${year}` }
    }
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}-${year}-${sequence}`;
}

// Helper to create receipt with retry on unique constraint violation
async function createReceiptWithRetry(data: any, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const receiptNumber = await generateReceiptNumber(data.branch);
      const receipt = await prisma.receipt.create({
        data: { ...data, receiptNumber }
      });
      return receipt;
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === 'P2002' && i < maxRetries - 1) {
        logger.warn('Receipt number collision detected, retrying...', {
          module: 'API',
          action: 'CREATE_RECEIPT_RETRY',
          attempt: i + 1,
          branch: data.branch
        });
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to generate unique receipt number after multiple attempts');
}
