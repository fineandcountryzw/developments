/**
 * Centralized Stands Financial Service
 * 
 * This service provides unified financial calculations for stands across all dashboards.
 * Ensures consistency of outstanding balances, payment statuses, and installment tracking
 * across Admin, Manager, Account, and Developer views.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from 'decimal.js';

export interface StandFinancialData {
  standId: string;
  standNumber: string;
  developmentId: string;
  developmentName: string;
  branch: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  standPrice: number;
  totalPaid: number;
  balance: number;
  outstanding: number; // Alias for balance (used in reports)
  arrears: number; // Overdue amount
  paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue';
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  installmentPlan: boolean;
  totalInstallments: number;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
  contractStatus: 'signed' | 'pending' | 'none';
  contractId: string | null;
  ledger: PaymentLedgerEntry[];
}

export interface PaymentLedgerEntry {
  id: string;
  date: string;
  type: 'payment' | 'installment' | 'adjustment';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status: 'confirmed' | 'pending' | 'rejected' | 'overdue';
  method?: string;
  reference?: string;
}

export interface StandsQueryOptions {
  developmentIds?: string[];
  branch?: string;
  status?: string;
  search?: string;
  clientId?: string;
  includeAllData?: boolean;
}

/**
 * Core calculation function - All dashboards use this
 * Prevents discrepancies between Admin/Manager/Account/Developer views
 */
export async function calculateStandFinancials(standId: string): Promise<StandFinancialData | null> {
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: {
      development: {
        select: {
          id: true,
          name: true,
          branch: true,
        },
      },
      payments: {
        where: {
          status: 'confirmed',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          reference: true,
          receipt: {
            select: {
              receiptNumber: true,
              pdfUrl: true,
            },
          },
        },
      },
      installmentPlans: {
        include: {
          installments: {
            orderBy: {
              dueDate: 'asc',
            },
            select: {
              id: true,
              installmentNo: true,
              amountDue: true,
              amountPaid: true,
              status: true,
              dueDate: true,
            },
          },
        },
        take: 1,
      },
      generatedContracts: {
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          status: true,
          signedAt: true,
        },
        take: 1,
      },
      reservations: {
        where: {
          status: 'CONFIRMED',
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!stand) return null;

  return transformStandToFinancialData(stand);
}

/**
 * Batch query for multiple stands with financial calculations
 * Used by all dashboard views for consistency
 */
export async function getStandsWithFinancials(
  options: StandsQueryOptions = {}
): Promise<StandFinancialData[]> {
  const where: any = {};

  // Filter by development IDs (for developer/manager scope)
  if (options.developmentIds && options.developmentIds.length > 0) {
    where.developmentId = { in: options.developmentIds };
  }

  // Filter by branch
  if (options.branch && options.branch !== 'all') {
    where.development = {
      branch: options.branch,
    };
  }

  // Filter by client (for client portal, future use)
  if (options.clientId) {
    where.reservations = {
      some: {
        clientId: options.clientId,
        status: 'CONFIRMED',
      },
    };
  }

  const stands = await prisma.stand.findMany({
    where,
    include: {
      development: {
        select: {
          id: true,
          name: true,
          branch: true,
        },
      },
      payments: {
        where: {
          status: 'confirmed',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          reference: true,
          receipt: {
            select: {
              receiptNumber: true,
              pdfUrl: true,
            },
          },
        },
      },
      installmentPlans: {
        include: {
          installments: {
            orderBy: {
              dueDate: 'asc',
            },
            select: {
              id: true,
              installmentNo: true,
              amountDue: true,
              amountPaid: true,
              status: true,
              dueDate: true,
            },
          },
        },
        take: 1,
      },
      generatedContracts: {
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          status: true,
          signedAt: true,
        },
        take: 1,
      },
      reservations: {
        where: {
          status: 'CONFIRMED',
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`[stands-financial-service] Query returned ${stands.length} stands`);

  let transformedStands = stands.map(transformStandToFinancialData);

  // Apply status filter after transformation (since it's calculated)
  if (options.status && options.status !== 'all') {
    transformedStands = transformedStands.filter(
      (s) => s.paymentStatus === options.status
    );
  }

  // Apply search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    transformedStands = transformedStands.filter(
      (s) =>
        s.standNumber.toLowerCase().includes(searchLower) ||
        s.developmentName.toLowerCase().includes(searchLower) ||
        s.clientName.toLowerCase().includes(searchLower)
    );
  }

  return transformedStands;
}

/**
 * Core transformation logic - Single source of truth for all calculations
 * This ensures Admin/Manager/Account/Developer see identical numbers
 */
function transformStandToFinancialData(stand: any): StandFinancialData {
  // Calculate total paid from confirmed payments
  const totalPaid = stand.payments.reduce(
    (sum: number, p: { amount: Decimal }) => sum + p.amount.toNumber(),
    0
  );

  const standPrice = stand.price?.toNumber() || 0;
  const balance = standPrice - totalPaid;
  const outstanding = balance; // Alias for reports

  // Build ledger (payment history)
  const ledger: PaymentLedgerEntry[] = [];
  let runningBalance = standPrice;

  // Add initial balance entry
  ledger.push({
    id: 'initial',
    date: stand.createdAt.toISOString(),
    type: 'installment',
    description: 'Stand purchase price',
    debit: standPrice,
    credit: 0,
    balance: runningBalance,
    status: 'confirmed',
  });

  // Add all payments to ledger
  stand.payments.forEach((payment: any) => {
    runningBalance -= payment.amount.toNumber();
    ledger.push({
      id: payment.id,
      date: payment.createdAt.toISOString(),
      type: 'payment',
      description: `Payment via ${payment.method}`,
      debit: 0,
      credit: payment.amount.toNumber(),
      balance: runningBalance,
      status: payment.status,
      method: payment.method,
      reference: payment.receiptNumber,
    });
  });

  // Calculate payment status
  let paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
  if (balance <= 0) {
    paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    paymentStatus = 'partial';
  }

  // Calculate installment metrics
  const installmentPlan = stand.installmentPlans[0];
  const totalInstallments = installmentPlan?.installments?.length || 0;
  const paidInstallments =
    installmentPlan?.installments?.filter(
      (inst: { status: string }) => inst.status === 'paid'
    ).length || 0;
  const pendingInstallments =
    installmentPlan?.installments?.filter(
      (inst: { status: string }) => inst.status === 'pending'
    ).length || 0;
  const overdueInstallments =
    installmentPlan?.installments?.filter((inst: { status: string; dueDate: Date }) => 
      inst.status === 'overdue' ||
      (inst.status === 'pending' && new Date(inst.dueDate) < new Date())
    ).length || 0;

  // Calculate arrears (overdue amount)
  let arrears = 0;
  if (installmentPlan?.installments) {
    const overdueInsts = installmentPlan.installments.filter(
      (inst: { status: string; dueDate: Date }) =>
        inst.status === 'overdue' ||
        (inst.status === 'pending' && new Date(inst.dueDate) < new Date())
    );
    arrears = overdueInsts.reduce(
      (sum: number, inst: { amountDue: Decimal; amountPaid: Decimal }) => 
        sum + (inst.amountDue.toNumber() - inst.amountPaid.toNumber()),
      0
    );
  }

  // Update payment status based on arrears
  if (overdueInstallments > 0 && balance > 0) {
    paymentStatus = 'overdue';
  }

  // Get last payment date  
  const lastPaymentDate =
    stand.payments.length > 0
      ? stand.payments[stand.payments.length - 1].createdAt.toISOString()
      : null;

  // Get next due date
  const nextDueInstallment = installmentPlan?.installments
    ?.filter((inst: { status: string }) => inst.status === 'pending')
    .sort(
      (a: { dueDate: Date }, b: { dueDate: Date }) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )[0];
  const nextDueDate = nextDueInstallment?.dueDate?.toISOString() || null;

  // Get client from confirmed reservation
  const client = stand.reservations[0]?.client;

  // Get contract status
  const contract = stand.generatedContracts[0];

  return {
    standId: stand.id,
    standNumber: stand.standNumber,
    developmentId: stand.development?.id || '',
    developmentName: stand.development?.name || 'Unknown',
    branch: stand.development?.branch || 'Unknown',
    clientId: client?.id || null,
    clientName: client?.name || 'No Client',
    clientEmail: client?.email || '',
    standPrice,
    totalPaid,
    balance,
    outstanding,
    arrears,
    paymentStatus,
    lastPaymentDate,
    nextDueDate,
    installmentPlan: !!installmentPlan,
    totalInstallments,
    paidInstallments,
    pendingInstallments,
    overdueInstallments,
    contractStatus: contract?.signedAt ? 'signed' : contract?.id ? 'pending' : 'none',
    contractId: contract?.id || null,
    ledger,
  };
}

/**
 * Get aggregated statistics for stands
 * Used by dashboard KPI cards
 */
export async function getStandsStatistics(options: StandsQueryOptions = {}) {
  const stands = await getStandsWithFinancials(options);

  return {
    totalStands: stands.length,
    soldStands: stands.length, // All stands with clients
    totalRevenue: stands.reduce((sum, s) => sum + s.totalPaid, 0),
    totalOutstanding: stands.reduce((sum, s) => sum + s.balance, 0),
    totalArrears: stands.reduce((sum, s) => sum + s.arrears, 0),
    standsFullyPaid: stands.filter((s) => s.paymentStatus === 'paid').length,
    standsPartiallyPaid: stands.filter((s) => s.paymentStatus === 'partial').length,
    standsPending: stands.filter((s) => s.paymentStatus === 'pending').length,
    standsOverdue: stands.filter((s) => s.paymentStatus === 'overdue').length,
    installmentPlans: stands.filter((s) => s.installmentPlan).length,
    contractsSigned: stands.filter((s) => s.contractStatus === 'signed').length,
  };
}

/**
 * Get payment history for a specific stand
 */
export async function getStandPayments(standId: string) {
  const payments = await prisma.payment.findMany({
    where: { standId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      method: true,
      status: true,
      createdAt: true,
      reference: true,
      receipt: {
        select: {
          receiptNumber: true,
          pdfUrl: true,
        },
      },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    amount: p.amount.toNumber(),
    method: p.method,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    receiptNumber: p.receipt?.receiptNumber || p.reference,
    receiptUrl: p.receipt?.pdfUrl || null,
  }));
}
