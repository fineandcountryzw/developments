import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['ADMIN', 'ACCOUNT', 'MANAGER'];

/**
 * GET /api/admin/client-purchases/[id]/statement
 * Generate an on-demand statement for a purchase
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: installment schedule vs actual payments with running balance
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
    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Fetch purchase with relations
    const purchase = await (prisma as any).clientPurchase.findUnique({
      where: { id, branch: user.role === 'ADMIN' ? undefined : user.branch },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        development: { select: { id: true, name: true, location: true } },
        stand: { select: { id: true, standNumber: true, price: true } },
        purchasePayments: {
          where: { status: 'CONFIRMED' },
          orderBy: { paymentDate: 'asc' },
        },
      },
    });

    if (!purchase) {
      return apiError('Purchase not found', 404, 'NOT_FOUND');
    }

    // Additional branch authorization check for non-admin roles
    if (user.role !== 'ADMIN' && purchase.branch !== user.branch) {
      logger.warn('Unauthorized statement access attempt', {
        module: 'API',
        action: 'GET_STATEMENT',
        userId: user.id,
        userBranch: user.branch,
        purchaseBranch: purchase.branch,
        purchaseId: id,
      });
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    // Generate installment schedule
    const schedule: Array<{
      installmentNo: number;
      dueDate: string;
      amountDue: number;
      type: string;
    }> = [];

    const startDate = new Date(purchase.startDate);
    const purchasePrice = Number(purchase.purchasePrice);
    const depositAmount = Number(purchase.depositAmount);
    const periodMonths = purchase.periodMonths;
    const monthlyAmount = Number(purchase.monthlyAmount);

    // First entry: deposit
    if (depositAmount > 0) {
      schedule.push({
        installmentNo: 0,
        dueDate: startDate.toISOString().split('T')[0],
        amountDue: depositAmount,
        type: 'DEPOSIT',
      });
    }

    // Monthly installments
    const balanceAfterDeposit = purchasePrice - depositAmount;
    const computedMonthly = monthlyAmount > 0 ? monthlyAmount : (periodMonths > 0 ? balanceAfterDeposit / periodMonths : 0);

    for (let i = 1; i <= periodMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      schedule.push({
        installmentNo: i,
        dueDate: dueDate.toISOString().split('T')[0],
        amountDue: i === periodMonths
          ? balanceAfterDeposit - computedMonthly * (periodMonths - 1) // last installment gets remainder
          : computedMonthly,
        type: 'INSTALLMENT',
      });
    }

    // Build statement lines: merge schedule + actual payments
    const payments = purchase.purchasePayments.map((p: any) => ({
      id: p.id,
      date: new Date(p.paymentDate).toISOString().split('T')[0],
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      receiptNo: p.receiptNo,
    }));

    // Filter by date range if provided
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    // Build combined timeline
    type StatementLine = {
      date: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
      type: 'SCHEDULE' | 'PAYMENT';
      receiptNo?: string;
    };

    const lines: StatementLine[] = [];
    let runningBalance = purchasePrice;

    // Opening balance line
    lines.push({
      date: startDate.toISOString().split('T')[0],
      description: 'Purchase Price',
      debit: purchasePrice,
      credit: 0,
      balance: runningBalance,
      type: 'SCHEDULE',
    });

    // Add all payments as credits
    const allEvents: Array<{ date: string; amount: number; desc: string; type: 'SCHEDULE' | 'PAYMENT'; receiptNo?: string }> = [];

    for (const p of payments) {
      allEvents.push({
        date: p.date,
        amount: p.amount,
        desc: `Payment - ${p.method}${p.reference ? ` (${p.reference})` : ''}`,
        type: 'PAYMENT',
        receiptNo: p.receiptNo,
      });
    }

    // Sort by date
    allEvents.sort((a, b) => a.date.localeCompare(b.date));

    for (const evt of allEvents) {
      const evtDate = new Date(evt.date);
      if (from && evtDate < from) continue;
      if (to && evtDate > to) continue;

      runningBalance -= evt.amount;
      lines.push({
        date: evt.date,
        description: evt.desc,
        debit: 0,
        credit: evt.amount,
        balance: Math.max(0, runningBalance),
        type: evt.type,
        receiptNo: evt.receiptNo,
      });
    }

    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    const statement = {
      purchase: {
        id: purchase.id,
        purchasePrice,
        depositAmount,
        periodMonths,
        monthlyAmount: computedMonthly,
        startDate: startDate.toISOString().split('T')[0],
        status: purchase.status,
      },
      client: purchase.client,
      development: purchase.development,
      stand: purchase.stand,
      schedule,
      lines,
      summary: {
        totalDue: purchasePrice,
        totalPaid,
        balance: purchasePrice - totalPaid,
        paymentsCount: payments.length,
      },
      generatedAt: new Date().toISOString(),
      dateRange: { from: fromDate, to: toDate },
    };

    return apiSuccess(statement);
  } catch (error: any) {
    logger.error('GET purchase statement error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
