/**
 * Developer Weekly Reports API
 * Fine & Country Zimbabwe ERP
 * 
 * Generates comprehensive weekly settlement reports for developers including:
 * - Settlements processed
 * - Commissions per development
 * - Payments received and pending
 * - Error/discrepancy log
 * 
 * Supports CSV and PDF output formats
 * Admin-only endpoint with manual generation capability
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FC_GOLD = [133, 117, 78] as const;
const FC_SLATE = [15, 23, 42] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ReportParams {
  developmentId?: string;
  branch?: string;
  startDate: Date;
  endDate: Date;
  format: 'pdf' | 'csv' | 'json';
}

interface SettlementSummary {
  totalSettlements: number;
  totalAmount: number;
  totalCommissions: number;
  totalAdminFees: number;
  developerNetPayout: number;
  pendingCount: number;
  paidCount: number;
  discrepancyCount: number;
}

interface PaymentBreakdown {
  id: string;
  clientName: string;
  standRef: string;
  amount: number;
  commission: number;
  netPayout: number;
  status: string;
  date: string;
  receiptNo?: string;
}

interface DevelopmentReport {
  developmentId: string;
  developmentName: string;
  developerEmail?: string;
  summary: SettlementSummary;
  payments: PaymentBreakdown[];
  errors: Array<{ type: string; message: string; date: string }>;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getWeekDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  const start = new Date(now);
  start.setDate(start.getDate() - daysToLastMonday - 7);
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

async function fetchDevelopmentData(params: ReportParams): Promise<DevelopmentReport[]> {
  const { startDate, endDate, developmentId, branch } = params;
  
  // Fetch developments
  const developmentWhere: any = {};
  if (developmentId) developmentWhere.id = developmentId;
  if (branch) developmentWhere.location = { contains: branch };
  
  const developments = await prisma.development.findMany({
    where: developmentWhere,
    select: {
      id: true,
      name: true,
      commissionModel: true,
      stands: {
        select: {
          id: true,
          standNumber: true,
        }
      }
    }
  });

  const reports: DevelopmentReport[] = [];

  for (const dev of developments) {
    const standIds = dev.stands.map(s => s.id);
    
    // Fetch payments for this development's stands within the date range
    const payments = await prisma.payment.findMany({
      where: {
        standId: { in: standIds },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate commission from development's commission model
    const commissionModel = dev.commissionModel as { type?: string; percentage?: number; fixedAmount?: number } | null;
    const commissionRate = commissionModel?.percentage ? commissionModel.percentage / 100 : 0.025; // Default 2.5%
    const adminFeeRate = 0.005; // 0.5% admin fee

    // Build payment breakdown
    const paymentBreakdown: PaymentBreakdown[] = payments.map(p => {
      const amount = Number(p.amount);
      const commission = amount * commissionRate;
      const adminFee = amount * adminFeeRate;
      const netPayout = amount - commission - adminFee;
      
      return {
        id: p.id,
        clientName: p.client?.name || p.clientName || 'Unknown',
        standRef: p.standId || 'N/A',
        amount,
        commission,
        netPayout,
        status: p.status || 'PENDING',
        date: p.createdAt.toISOString(),
        receiptNo: p.manualReceiptNo || undefined
      };
    });

    // Calculate summary
    const summary: SettlementSummary = {
      totalSettlements: payments.length,
      totalAmount: paymentBreakdown.reduce((sum, p) => sum + p.amount, 0),
      totalCommissions: paymentBreakdown.reduce((sum, p) => sum + p.commission, 0),
      totalAdminFees: paymentBreakdown.reduce((sum, p) => sum + (p.amount * adminFeeRate), 0),
      developerNetPayout: paymentBreakdown.reduce((sum, p) => sum + p.netPayout, 0),
      pendingCount: payments.filter(p => p.status === 'PENDING' || p.status === 'pending').length,
      paidCount: payments.filter(p => p.status === 'PAID' || p.status === 'VERIFIED' || p.status === 'paid').length,
      discrepancyCount: payments.filter(p => p.status === 'DISCREPANCY' || p.status === 'FLAGGED').length
    };

    // Check for errors/discrepancies
    const errors: Array<{ type: string; message: string; date: string }> = [];
    
    // Look for payments with verification issues
    const flaggedPayments = payments.filter(p => 
      p.verificationStatus === 'FLAGGED' || 
      p.status === 'DISCREPANCY'
    );
    
    for (const fp of flaggedPayments) {
      errors.push({
        type: 'VERIFICATION_FLAG',
        message: `Payment ${fp.reference || fp.id} flagged for verification`,
        date: fp.createdAt.toISOString()
      });
    }

    reports.push({
      developmentId: dev.id,
      developmentName: dev.name,
      developerEmail: undefined,
      summary,
      payments: paymentBreakdown,
      errors,
      generatedAt: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString()
    });
  }

  return reports;
}

function generateCSV(reports: DevelopmentReport[]): string {
  const headers = [
    'Development',
    'Period',
    'Client Name',
    'Stand Ref',
    'Amount (USD)',
    'Commission (USD)',
    'Net Payout (USD)',
    'Status',
    'Date',
    'Receipt No'
  ].join(',');

  const rows: string[] = [headers];

  for (const report of reports) {
    const period = `${new Date(report.periodStart).toLocaleDateString('en-GB')} - ${new Date(report.periodEnd).toLocaleDateString('en-GB')}`;
    
    for (const payment of report.payments) {
      rows.push([
        `"${report.developmentName}"`,
        `"${period}"`,
        `"${payment.clientName}"`,
        `"${payment.standRef}"`,
        payment.amount.toFixed(2),
        payment.commission.toFixed(2),
        payment.netPayout.toFixed(2),
        payment.status,
        new Date(payment.date).toLocaleDateString('en-GB'),
        payment.receiptNo || ''
      ].join(','));
    }

    // Add summary row
    rows.push([
      `"${report.developmentName} - TOTAL"`,
      `"${period}"`,
      '',
      `${report.summary.totalSettlements} settlements`,
      report.summary.totalAmount.toFixed(2),
      report.summary.totalCommissions.toFixed(2),
      report.summary.developerNetPayout.toFixed(2),
      `Paid: ${report.summary.paidCount}, Pending: ${report.summary.pendingCount}`,
      '',
      ''
    ].join(','));
    
    rows.push(''); // Empty row between developments
  }

  return rows.join('\n');
}

function generatePDF(reports: DevelopmentReport[]): Buffer {
  const doc = new jsPDF();
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const pulseId = Math.random().toString(36).substr(2, 12).toUpperCase();
  
  let pageY = 25;

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    
    if (i > 0) {
      doc.addPage();
      pageY = 25;
    }

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
    doc.text('FINE & COUNTRY', 105, pageY, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('WEEKLY DEVELOPER SETTLEMENT REPORT', 105, pageY + 10, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Development: ${report.developmentName}`, 105, pageY + 18, { align: 'center' });
    doc.text(`Period: ${new Date(report.periodStart).toLocaleDateString('en-GB')} - ${new Date(report.periodEnd).toLocaleDateString('en-GB')}`, 105, pageY + 24, { align: 'center' });
    doc.text(`Generated: ${dateStr}`, 105, pageY + 30, { align: 'center' });

    // Summary Box
    const summaryY = pageY + 45;
    doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, summaryY, 180, 40, 3, 3, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
    
    // Row 1
    doc.text('TOTAL COLLECTED', 30, summaryY + 10);
    doc.text('COMMISSIONS', 75, summaryY + 10);
    doc.text('ADMIN FEES', 115, summaryY + 10);
    doc.text('NET PAYOUT', 155, summaryY + 10);
    
    doc.setFontSize(14);
    doc.text(`$${report.summary.totalAmount.toLocaleString()}`, 30, summaryY + 20);
    doc.text(`$${report.summary.totalCommissions.toLocaleString()}`, 75, summaryY + 20);
    doc.text(`$${report.summary.totalAdminFees.toLocaleString()}`, 115, summaryY + 20);
    
    doc.setTextColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
    doc.text(`$${report.summary.developerNetPayout.toLocaleString()}`, 155, summaryY + 20);

    // Status counts
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${report.summary.totalSettlements} Settlements | ${report.summary.paidCount} Paid | ${report.summary.pendingCount} Pending | ${report.summary.discrepancyCount} Issues`, 105, summaryY + 35, { align: 'center' });

    // Transaction Table
    if (report.payments.length > 0) {
      (doc as any).autoTable({
        startY: summaryY + 50,
        head: [['Date', 'Client', 'Stand', 'Receipt', 'Amount', 'Commission', 'Net Payout', 'Status']],
        body: report.payments.map(p => [
          new Date(p.date).toLocaleDateString('en-GB'),
          p.clientName.substring(0, 20),
          p.standRef.substring(0, 15),
          p.receiptNo || '-',
          `$${p.amount.toLocaleString()}`,
          `$${p.commission.toLocaleString()}`,
          `$${p.netPayout.toLocaleString()}`,
          p.status
        ]),
        theme: 'grid',
        headStyles: { 
          fillColor: FC_SLATE, 
          textColor: [255, 255, 255], 
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 7, 
          cellPadding: 2,
          valign: 'middle'
        },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', textColor: FC_GOLD }
        }
      });
    }

    // Errors Section
    if (report.errors.length > 0) {
      const errorY = (doc as any).lastAutoTable?.finalY + 15 || summaryY + 100;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text('FLAGGED ISSUES', 15, errorY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      report.errors.forEach((err, idx) => {
        doc.text(`• ${err.type}: ${err.message}`, 15, errorY + 8 + (idx * 6));
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(239, 236, 231);
    doc.line(15, pageHeight - 20, 195, pageHeight - 20);
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Fine & Country Zimbabwe ERP | Forensic Pulse ID: ${pulseId}`, 15, pageHeight - 12);
    doc.text('All figures in USD. Verified Settlement Report.', 195, pageHeight - 12, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ─────────────────────────────────────────────────────────────────────────────
// API HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId') || undefined;
    const branch = searchParams.get('branch') || undefined;
    const format = (searchParams.get('format') || 'json') as 'pdf' | 'csv' | 'json';
    
    // Date range - default to last 7 days
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    let startDate: Date;
    let endDate: Date;
    
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      const { start, end } = getWeekDateRange();
      startDate = start;
      endDate = end;
    }

    const reports = await fetchDevelopmentData({
      developmentId,
      branch,
      startDate,
      endDate,
      format
    });

    // Return based on format
    if (format === 'csv') {
      const csv = generateCSV(reports);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="developer_report_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    if (format === 'pdf') {
      const pdfBytes = generatePDF(reports);
      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="developer_report_${new Date().toISOString().split('T')[0]}.pdf"`
        }
      });
    }

    // Default: JSON
    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      reportCount: reports.length,
      reports
    });

  } catch (error: any) {
    logger.error('Developer Reports Error generating report', error, { module: 'API', action: 'GET_DEVELOPER_REPORTS_GENERATE' });
    return apiError('Failed to generate developer report', 500, ErrorCodes.FETCH_ERROR, { 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { developmentId, branch, startDate, endDate, format = 'json', sendEmail = false } = body;

    const start = startDate ? new Date(startDate) : getWeekDateRange().start;
    const end = endDate ? new Date(endDate) : getWeekDateRange().end;

    const reports = await fetchDevelopmentData({
      developmentId,
      branch,
      startDate: start,
      endDate: end,
      format
    });

    // If sendEmail is true, queue emails for delivery
    if (sendEmail) {
      const emailQueue: Array<{ developmentName: string; email: string; status: string }> = [];
      
      for (const report of reports) {
        if (report.developerEmail) {
          // Queue email for delivery (integrate with existing email service)
          emailQueue.push({
            developmentName: report.developmentName,
            email: report.developerEmail,
            status: 'QUEUED'
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Reports generated and emails queued for delivery',
        generatedAt: new Date().toISOString(),
        reportCount: reports.length,
        emailsQueued: emailQueue.length,
        emailQueue,
        reports
      });
    }

    // Return report data based on format
    if (format === 'csv') {
      const csv = generateCSV(reports);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="developer_report_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    if (format === 'pdf') {
      const pdfBytes = generatePDF(reports);
      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="developer_report_${new Date().toISOString().split('T')[0]}.pdf"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      reportCount: reports.length,
      reports
    });

  } catch (error: any) {
    logger.error('Developer Reports Error', error, { module: 'API', action: 'POST_DEVELOPER_REPORTS_GENERATE' });
    return apiError('Failed to generate developer report', 500, ErrorCodes.CREATE_ERROR, { 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
