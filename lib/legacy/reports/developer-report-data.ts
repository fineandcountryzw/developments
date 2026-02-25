/**
 * Developer Report Data Fetching and Aggregation
 * 
 * Fetches all data for a developer report and aggregates statistics.
 */

import prisma from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export type PeriodType = 'ALL_TIME' | 'THIS_MONTH' | 'CUSTOM';

export interface Period {
  type: PeriodType;
  from?: Date;
  to?: Date;
}

export interface DeveloperReportData {
  developerName: string;
  developerEmail: string | null;
  developerPhone: string | null;
  reportPeriod: Period;
  generatedAt: Date;
  generatedBy: string;
  
  // Executive Summary
  summary: {
    totalStands: number;
    soldStands: number;
    availableStands: number;
    totalPortfolioValue: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    clientsWithAgreements: number;
    clientsWithoutAgreements: number;
    overdueAccounts: number;
    overdueAmount: number;
  };
  
  // Stands breakdown
  stands: StandReportData[];
  
  // Collections analysis
  collections: {
    expectedRevenue: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    averagePaymentPerMonth: number;
    projectedFullCollectionDate: Date | null;
    paymentTypeBreakdown: PaymentTypeBreakdown;
    monthlyCollections: MonthlyCollection[];
  };
  
  // Agreements
  agreements: {
    totalSold: number;
    hasAgreement: number;
    noAgreement: number;
    pendingAgreement: number;
    clientsWithoutAgreements: ClientWithoutAgreement[];
  };
  
  // Overdue accounts
  overdue: {
    totalOverdue: number;
    totalOverdueAmount: number;
    accounts: OverdueAccount[];
  };
  
  // Agent performance
  agents: AgentPerformance[];
  
  // Payment history
  payments: PaymentHistoryItem[];
}

export interface StandReportData {
  id: string;
  standNumber: string;
  developmentName: string;
  developmentLocation: string;
  sizeSqm: number | null;
  price: number;
  status: 'AVAILABLE' | 'SOLD_PAID_UP' | 'SOLD_ON_TRACK' | 'SOLD_OVERDUE' | 'SOLD_NO_AGREEMENT' | 'SOLD_NO_CLIENT';
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  saleDate: Date | null;
  agentName: string | null;
  agentCode: string | null;
  hasAgreement: boolean;
  totalPaid: number;
  outstanding: number;
  lastPaymentDate: Date | null;
  daysSinceLastPayment: number | null;
  isOverdue: boolean;
}

export interface PaymentTypeBreakdown {
  deposits: { amount: number; count: number };
  installments: { amount: number; count: number };
  legalFees: { amount: number; count: number };
  other: { amount: number; count: number };
}

export interface MonthlyCollection {
  month: string;
  monthLabel: string;
  paymentCount: number;
  amountCollected: number;
  cumulativeTotal: number;
}

export interface ClientWithoutAgreement {
  standId: string;
  standNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  saleDate: Date | null;
  daysSinceSale: number | null;
  purchasePrice: number;
  agentName: string | null;
}

export interface OverdueAccount {
  standId: string;
  standNumber: string;
  clientName: string;
  clientPhone: string | null;
  lastPaymentDate: Date | null;
  daysSinceLastPayment: number;
  amountOverdue: number;
  totalOutstanding: number;
  agentName: string | null;
  agentCode: string | null;
}

export interface AgentPerformance {
  agentCode: string | null;
  agentName: string | null;
  standsSold: number;
  totalValue: number;
  totalCollected: number;
  collectionRate: number;
  agreementsSigned: number;
  overdueAccounts: number;
}

export interface PaymentHistoryItem {
  id: string;
  date: Date;
  standNumber: string;
  clientName: string;
  amount: number;
  type: string;
  reference: string;
  runningTotal: number;
}

/**
 * Build date filter for queries based on period
 */
function buildDateFilter(period: Period): { createdAt?: { gte?: Date; lte?: Date } } {
  if (period.type === 'ALL_TIME') return {};
  if (period.type === 'THIS_MONTH') {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return { createdAt: { gte: start, lte: end } };
  }
  if (period.type === 'CUSTOM' && period.from && period.to) {
    return { createdAt: { gte: period.from, lte: period.to } };
  }
  return {};
}

/**
 * Calculate days since a date
 */
function daysSince(date: Date | null): number | null {
  if (!date) return null;
  const diff = new Date().getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date
 */
export function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return format(new Date(date), 'do MMMM yyyy');
}

/**
 * Fetch all developers list with basic stats
 */
export async function getAllDevelopers(): Promise<Array<{
  name: string;
  email: string | null;
  phone: string | null;
  developments: number;
  totalStands: number;
  soldStands: number;
  availableStands: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  overdueCount: number;
  noAgreementCount: number;
}>> {
  // Get all developments grouped by developer
  const developments = await prisma.development.findMany({
    where: {
      developerName: { not: null },
    },
    include: {
      stands: {
        include: {
          payments: true,
          offlineSales: {
            include: { client: true },
            orderBy: { saleDate: 'desc' },
            take: 1,
          },
          generatedContracts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  // Group by developer
  const developerMap = new Map<string, typeof developments>();
  developments.forEach(dev => {
    const name = dev.developerName || 'Unknown Developer';
    if (!developerMap.has(name)) {
      developerMap.set(name, []);
    }
    developerMap.get(name)!.push(dev);
  });

  // Calculate stats per developer
  const results = await Promise.all(
    Array.from(developerMap.entries()).map(async ([name, devDevelopments]) => {
      const allStands = devDevelopments.flatMap(d => d.stands);
      const soldStands = allStands.filter(s => s.status === 'SOLD');
      const availableStands = allStands.filter(s => s.status === 'AVAILABLE');
      
      // Calculate total portfolio value
      const totalPortfolioValue = allStands.reduce((sum, s) => sum + Number(s.price), 0);
      
      // Calculate collected and outstanding
      let totalCollected = 0;
      let totalOutstanding = 0;
      let overdueCount = 0;
      let noAgreementCount = 0;
      
      for (const stand of soldStands) {
        const standPrice = Number(stand.price);
        const totalPaid = stand.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const outstanding = standPrice - totalPaid;
        
        totalCollected += totalPaid;
        totalOutstanding += outstanding;
        
        // Check overdue (no payment in 60 days)
        const lastPayment = stand.payments.length > 0
          ? stand.payments.reduce((latest, p) => 
              new Date(p.createdAt) > new Date(latest) ? p.createdAt : latest,
              stand.payments[0].createdAt
            )
          : null;
        
        const daysSincePayment = lastPayment ? daysSince(lastPayment) : null;
        if (daysSincePayment && daysSincePayment > 60 && outstanding > 0) {
          overdueCount++;
        }
        
        // Check agreement
        const hasAgreement = stand.generatedContracts.length > 0;
        const hasClient = stand.offlineSales.length > 0 && stand.offlineSales[0].client;
        if (!hasAgreement && hasClient) {
          noAgreementCount++;
        }
      }
      
      const collectionRate = totalPortfolioValue > 0 
        ? (totalCollected / totalPortfolioValue) * 100 
        : 0;
      
      return {
        name,
        email: devDevelopments[0]?.developerEmail || null,
        phone: devDevelopments[0]?.developerPhone || null,
        developments: devDevelopments.length,
        totalStands: allStands.length,
        soldStands: soldStands.length,
        availableStands: availableStands.length,
        totalCollected,
        totalOutstanding,
        collectionRate: Math.round(collectionRate * 10) / 10,
        overdueCount,
        noAgreementCount,
      };
    })
  );

  return results.sort((a, b) => b.totalCollected - a.totalCollected);
}

/**
 * Fetch full report data for one developer
 */
export async function getDeveloperReportData(
  developerName: string,
  period: Period,
  generatedBy: string
): Promise<DeveloperReportData> {
  const dateFilter = buildDateFilter(period);
  
  // Get all developments for this developer
  const developments = await prisma.development.findMany({
    where: { developerName },
    include: {
      stands: {
        include: {
          payments: {
            where: dateFilter,
            orderBy: { createdAt: 'asc' },
          },
          offlineSales: {
            include: { 
              client: true,
              payments: true,
            },
            orderBy: { saleDate: 'desc' },
            take: 1,
          },
          generatedContracts: {
            include: { client: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          development: true,
        },
      },
    },
  });

  const developerEmail = developments[0]?.developerEmail || null;
  const developerPhone = developments[0]?.developerPhone || null;
  
  const allStands = developments.flatMap(d => d.stands);
  const soldStands = allStands.filter(s => s.status === 'SOLD');
  const availableStands = allStands.filter(s => s.status === 'AVAILABLE');
  
  // Calculate summary stats
  let totalCollected = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let clientsWithAgreements = 0;
  let clientsWithoutAgreements = 0;
  let pendingAgreements = 0;
  
  const standReportData: StandReportData[] = [];
  const clientsWithoutAgreementList: ClientWithoutAgreement[] = [];
  const overdueAccountsList: OverdueAccount[] = [];
  const agentMap = new Map<string, AgentPerformance>();
  const allPayments: PaymentHistoryItem[] = [];
  
  // Payment type breakdown
  const paymentTypeBreakdown: PaymentTypeBreakdown = {
    deposits: { amount: 0, count: 0 },
    installments: { amount: 0, count: 0 },
    legalFees: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  };

  for (const stand of allStands) {
    const standPrice = Number(stand.price);
    const offlineSale = stand.offlineSales[0];
    const client = offlineSale?.client;
    const generatedContract = stand.generatedContracts[0];
    
    const totalPaid = stand.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = standPrice - totalPaid;
    
    // Last payment date
    const lastPayment = stand.payments.length > 0
      ? stand.payments.reduce((latest, p) => 
          new Date(p.createdAt) > new Date(latest) ? p.createdAt : latest,
          stand.payments[0].createdAt
        )
      : null;
    
    const daysSincePayment = lastPayment ? daysSince(lastPayment) : null;
    const isOverdue = daysSincePayment && daysSincePayment > 60 && outstanding > 0;
    
    // Determine status
    let status: StandReportData['status'];
    if (stand.status === 'AVAILABLE') {
      status = 'AVAILABLE';
    } else if (stand.status === 'SOLD') {
      if (!client) {
        status = 'SOLD_NO_CLIENT';
      } else if (outstanding <= 0) {
        status = 'SOLD_PAID_UP';
      } else if (isOverdue) {
        status = 'SOLD_OVERDUE';
      } else if (!generatedContract) {
        status = 'SOLD_NO_AGREEMENT';
      } else {
        status = 'SOLD_ON_TRACK';
      }
    } else {
      status = 'AVAILABLE';
    }
    
    // Track stands
    const standData: StandReportData = {
      id: stand.id,
      standNumber: stand.standNumber,
      developmentName: stand.development.name,
      developmentLocation: stand.development.location,
      sizeSqm: stand.sizeSqm ? Number(stand.sizeSqm) : null,
      price: standPrice,
      status,
      clientName: client?.name || null,
      clientPhone: client?.phone || null,
      clientEmail: client?.email || null,
      saleDate: offlineSale?.saleDate || null,
      agentName: stand.soldBy || offlineSale?.client?.agentId || null,
      agentCode: stand.soldBy || null,
      hasAgreement: !!generatedContract,
      totalPaid,
      outstanding: Math.max(0, outstanding),
      lastPaymentDate: lastPayment,
      daysSinceLastPayment: daysSincePayment,
      isOverdue: isOverdue || false,
    };
    
    standReportData.push(standData);
    
    // Update summary stats for sold stands
    if (stand.status === 'SOLD') {
      totalCollected += totalPaid;
      totalOutstanding += outstanding;
      
      // Agreement tracking
      if (generatedContract) {
        clientsWithAgreements++;
      } else if (client) {
        clientsWithoutAgreements++;
        clientsWithoutAgreementList.push({
          standId: stand.id,
          standNumber: stand.standNumber,
          clientName: client.name,
          clientPhone: client.phone,
          clientEmail: client.email,
          saleDate: offlineSale?.saleDate || null,
          daysSinceSale: daysSince(offlineSale?.saleDate),
          purchasePrice: standPrice,
          agentName: stand.soldBy || null,
        });
      }
      
      // Overdue tracking
      if (isOverdue) {
        overdueCount++;
        overdueAmount += outstanding;
        overdueAccountsList.push({
          standId: stand.id,
          standNumber: stand.standNumber,
          clientName: client?.name || 'Unknown',
          clientPhone: client?.phone || null,
          lastPaymentDate: lastPayment,
          daysSinceLastPayment: daysSincePayment || 0,
          amountOverdue: outstanding,
          totalOutstanding: outstanding,
          agentName: stand.soldBy || null,
          agentCode: stand.soldBy || null,
        });
      }
      
      // Agent tracking
      const agentCode = stand.soldBy || 'Unknown';
      if (!agentMap.has(agentCode)) {
        agentMap.set(agentCode, {
          agentCode,
          agentName: stand.soldBy || 'Unknown Agent',
          standsSold: 0,
          totalValue: 0,
          totalCollected: 0,
          collectionRate: 0,
          agreementsSigned: 0,
          overdueAccounts: 0,
        });
      }
      
      const agent = agentMap.get(agentCode)!;
      agent.standsSold++;
      agent.totalValue += standPrice;
      agent.totalCollected += totalPaid;
      if (generatedContract) agent.agreementsSigned++;
      if (isOverdue) agent.overdueAccounts++;
      
      // Payment type breakdown
      for (const payment of stand.payments) {
        const amount = Number(payment.amount);
        const paymentType = payment.paymentType?.toLowerCase() || '';
        
        if (paymentType.includes('deposit')) {
          paymentTypeBreakdown.deposits.amount += amount;
          paymentTypeBreakdown.deposits.count++;
        } else if (paymentType.includes('installment')) {
          paymentTypeBreakdown.installments.amount += amount;
          paymentTypeBreakdown.installments.count++;
        } else if (paymentType.includes('legal') || paymentType.includes('aos') || paymentType.includes('cession')) {
          paymentTypeBreakdown.legalFees.amount += amount;
          paymentTypeBreakdown.legalFees.count++;
        } else {
          paymentTypeBreakdown.other.amount += amount;
          paymentTypeBreakdown.other.count++;
        }
        
        // Add to payment history
        allPayments.push({
          id: payment.id,
          date: payment.createdAt,
          standNumber: stand.standNumber,
          clientName: client?.name || 'Unknown',
          amount,
          type: payment.paymentType || 'Payment',
          reference: payment.reference,
          runningTotal: 0, // Will calculate after sorting
        });
      }
    }
  }
  
  // Calculate agent collection rates
  const agents = Array.from(agentMap.values()).map(agent => ({
    ...agent,
    collectionRate: agent.totalValue > 0 
      ? Math.round((agent.totalCollected / agent.totalValue) * 1000) / 10 
      : 0,
  }));
  
  // Sort and calculate running total for payments
  allPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningTotal = 0;
  allPayments.forEach(p => {
    runningTotal += p.amount;
    p.runningTotal = runningTotal;
  });
  
  // Calculate monthly collections (last 12 months)
  const monthlyCollections: MonthlyCollection[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    const monthLabel = format(monthStart, 'MMM yyyy');
    
    const monthPayments = allPayments.filter(p => {
      const d = new Date(p.date);
      return d >= monthStart && d <= monthEnd;
    });
    
    const amountCollected = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    
    monthlyCollections.push({
      month: monthStart.toISOString(),
      monthLabel,
      paymentCount: monthPayments.length,
      amountCollected,
      cumulativeTotal: 0, // Will calculate after
    });
  }
  
  // Calculate cumulative totals
  let cumulative = 0;
  monthlyCollections.forEach(m => {
    cumulative += m.amountCollected;
    m.cumulativeTotal = cumulative;
  });
  
  // Calculate average payment per month
  const totalPortfolioValue = allStands.reduce((sum, s) => sum + Number(s.price), 0);
  const soldPortfolioValue = soldStands.reduce((sum, s) => sum + Number(s.price), 0);
  const monthsWithPayments = monthlyCollections.filter(m => m.paymentCount > 0).length;
  const averagePaymentPerMonth = monthsWithPayments > 0 
    ? totalCollected / monthsWithPayments 
    : 0;
  
  // Project full collection date
  let projectedFullCollectionDate: Date | null = null;
  if (totalOutstanding > 0 && averagePaymentPerMonth > 0) {
    const monthsToComplete = totalOutstanding / averagePaymentPerMonth;
    projectedFullCollectionDate = new Date();
    projectedFullCollectionDate.setMonth(
      projectedFullCollectionDate.getMonth() + Math.ceil(monthsToComplete)
    );
  }

  return {
    developerName,
    developerEmail,
    developerPhone,
    reportPeriod: period,
    generatedAt: new Date(),
    generatedBy,
    summary: {
      totalStands: allStands.length,
      soldStands: soldStands.length,
      availableStands: availableStands.length,
      totalPortfolioValue,
      totalCollected,
      totalOutstanding: Math.max(0, totalOutstanding),
      collectionRate: soldPortfolioValue > 0 
        ? Math.round((totalCollected / soldPortfolioValue) * 1000) / 10 
        : 0,
      clientsWithAgreements,
      clientsWithoutAgreements,
      overdueAccounts: overdueCount,
      overdueAmount,
    },
    stands: standReportData,
    collections: {
      expectedRevenue: soldPortfolioValue,
      totalCollected,
      totalOutstanding: Math.max(0, totalOutstanding),
      collectionRate: soldPortfolioValue > 0 
        ? Math.round((totalCollected / soldPortfolioValue) * 1000) / 10 
        : 0,
      averagePaymentPerMonth,
      projectedFullCollectionDate,
      paymentTypeBreakdown,
      monthlyCollections,
    },
    agreements: {
      totalSold: soldStands.length,
      hasAgreement: clientsWithAgreements,
      noAgreement: clientsWithoutAgreements,
      pendingAgreement: pendingAgreements,
      clientsWithoutAgreements: clientsWithoutAgreementList.sort(
        (a, b) => (b.daysSinceSale || 0) - (a.daysSinceSale || 0)
      ),
    },
    overdue: {
      totalOverdue: overdueCount,
      totalOverdueAmount: overdueAmount,
      accounts: overdueAccountsList.sort(
        (a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment
      ),
    },
    agents,
    payments: allPayments,
  };
}
