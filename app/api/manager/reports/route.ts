import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { jsPDF } from 'jspdf';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/reports
 * Generate downloadable reports for Manager Dashboard
 * 
 * Query Parameters:
 * - type: Report type (contracts|revenue|payouts|targets|all)
 * - format: Export format (csv|pdf) - defaults to csv
 * - branch: Filter by branch
 * - period: Time period filter
 * - Other filters specific to report type
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/manager/reports called', { module: 'Manager-API' });

    // Auth check - Manager level access required
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'contracts';
    const format = searchParams.get('format') || 'csv';
    const branch = searchParams.get('branch') || user.branch || 'Harare';

    logger.debug('Report generation parameters', { reportType, format, branch });

    // Generate report based on type
    let reportData: any[] = [];
    let filename = '';
    let headers: string[] = [];
    const userBranch = user.branch || 'Harare';

    switch (reportType) {
      case 'contracts':
        ({ data: reportData, filename, headers } = await generateContractsReport(searchParams, branch));
        break;
      
      case 'revenue':
        ({ data: reportData, filename, headers } = await generateRevenueReport(searchParams, branch, userBranch));
        break;
      
      case 'payouts':
        ({ data: reportData, filename, headers } = await generatePayoutsReport(searchParams, branch));
        break;
      
      case 'targets':
        ({ data: reportData, filename, headers } = await generateTargetsReport(searchParams, branch));
        break;
      
      default:
        return apiError('Invalid report type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Log report generation
    logger.info('Manager report generated successfully', {
      reportType,
      format,
      filename: `${filename}.${format}`,
      recordCount: reportData.length,
      branch,
      module: 'Manager-Reports',
      action: 'REPORT_EXPORT'
    });

    // Format output
    // Revenue reports are always PDF
    if (reportType === 'revenue') {
      const pdfBuffer = generateRevenuePDF(reportData, headers, filename, branch, userBranch);
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
          'Cache-Control': 'no-cache'
        }
      });
    } else if (format === 'csv') {
      // Other reports use CSV
      const csvContent = generateCSV(reportData, headers);
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
          'Cache-Control': 'no-cache'
        }
      });
    } else if (format === 'pdf') {
      return apiError('PDF format is only available for revenue reports. Use CSV for other report types.', 400, ErrorCodes.VALIDATION_ERROR);
    } else {
      return apiError('Invalid format. Use csv or pdf', 400);
    }

  } catch (error: any) {
    logger.error('Failed to generate manager report', error, { 
      module: 'Manager-API',
      endpoint: '/api/manager/reports'
    });
    return apiError('Failed to generate report', 500);
  }
}

// Helper functions for generating specific reports

async function generateContractsReport(searchParams: URLSearchParams, branch: string) {
  const status = searchParams.get('status');
  const developmentId = searchParams.get('developmentId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // Build where clause
  interface ReportWhereClause {
    branch?: string;
    status?: string;
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
  }
  const whereClause: ReportWhereClause = {};
  
  if (branch !== 'all') {
    whereClause.branch = branch;
  }

  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  if (dateFrom || dateTo) {
    whereClause.createdAt = {};
    if (dateFrom) {
      whereClause.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      whereClause.createdAt.lte = new Date(dateTo);
    }
  }

  // Fetch contracts (no relations - schema has no FKs for client/template)
  const contracts = await prisma.generatedContract.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' }
  });

  // Fetch related data separately
  const clientIds = [...new Set(contracts.map(c => c.clientId).filter(Boolean))];
  const templateIds = [...new Set(contracts.map(c => c.templateId).filter(Boolean))];
  const [clients, templates] = await Promise.all([
    clientIds.length > 0 ? prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, email: true, phone: true }
    }) : [],
    templateIds.length > 0 ? prisma.contractTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, name: true }
    }) : []
  ]);
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const templateMap = new Map(templates.map(t => [t.id, t]));

  // Get stand and development information
  const standIds = contracts.map(c => c.standId).filter(Boolean);
  const stands = standIds.length > 0 ? await prisma.stand.findMany({
    where: { id: { in: standIds } },
    include: {
      development: {
        select: { id: true, name: true, location: true }
      }
    }
  }) : [];

  const standMap = stands.reduce((acc, stand) => {
    acc[stand.id] = stand;
    return acc;
  }, {} as Record<string, any>);

  // Filter by development if requested
  let filteredContracts = contracts;
  if (developmentId && developmentId !== 'ALL') {
    filteredContracts = contracts.filter(contract => {
      const stand = standMap[contract.standId];
      return stand?.developmentId === developmentId;
    });
  }

  // Get payment summaries
  const contractsWithPayments = await Promise.all(
    filteredContracts.map(async (contract) => {
      const stand = standMap[contract.standId];
      
      const payments = await prisma.payment.findMany({
        where: {
          clientId: contract.clientId,
          standId: contract.standId,
          status: 'CONFIRMED'
        },
        select: { amount: true, createdAt: true }
      });

      const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const standPrice = stand ? Number(stand.price) : 0;
      const remainingBalance = Math.max(0, standPrice - totalPaid);

      const client = clientMap.get(contract.clientId);
      const template = templateMap.get(contract.templateId);
      
      return {
        'Contract ID': contract.id,
        'Status': contract.status,
        'Client Name': client?.name || 'Unknown',
        'Client Email': client?.email || '',
        'Client Phone': client?.phone || '',
        'Stand Number': stand?.standNumber || 'N/A',
        'Development': stand?.development?.name || 'N/A',
        'Development Location': stand?.development?.location || 'N/A',
        'Stand Price': standPrice,
        'Total Paid': totalPaid,
        'Remaining Balance': remainingBalance,
        'Payment Progress %': standPrice > 0 ? ((totalPaid / standPrice) * 100).toFixed(2) : '0',
        'Payments Count': payments.length,
        'Template': template?.name || 'N/A',
        'Signed At': contract.signedAt ? contract.signedAt.toISOString() : '',
        'Signed By': contract.signedBy || '',
        'Created At': contract.createdAt.toISOString(),
        'Branch': contract.branch
      };
    })
  );

  const headers = [
    'Contract ID', 'Status', 'Client Name', 'Client Email', 'Client Phone',
    'Stand Number', 'Development', 'Development Location', 'Stand Price',
    'Total Paid', 'Remaining Balance', 'Payment Progress %', 'Payments Count',
    'Template', 'Signed At', 'Signed By', 'Created At', 'Branch'
  ];

  const filename = `contracts-report-${branch}-${new Date().toISOString().split('T')[0]}`;

  return { data: contractsWithPayments, filename, headers };
}

async function generateRevenueReport(searchParams: URLSearchParams, branch: string, userBranch: string = 'Harare') {
  const period = searchParams.get('period') || 'month';
  const now = new Date();
  
  let startDate: Date;
  let periodLabel: string;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      periodLabel = 'weekly';
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      periodLabel = 'quarterly';
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = 'monthly';
  }

  const branchFilter = branch === 'all' ? {} : { officeLocation: branch };

  // Fetch payments (no client relation - schema has no FK)
  const payments = await prisma.payment.findMany({
    where: {
      status: 'CONFIRMED',
      createdAt: { gte: startDate },
      ...branchFilter
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch client details separately if needed (for email)
  const clientIds = [...new Set(payments.map(p => p.clientId).filter(Boolean))];
  const clients = clientIds.length > 0 ? await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, email: true }
  }) : [];
  const clientMap = new Map(clients.map(c => [c.id, c]));

  const reportData = payments.map(payment => {
    const client = clientMap.get(payment.clientId);
    return {
      'Payment ID': payment.id,
      'Client Name': client?.name || payment.clientName,
      'Client Email': client?.email || '',
      'Amount': Number(payment.amount),
      'Surcharge Amount': Number(payment.surchargeAmount),
      'Total Amount': Number(payment.amount) + Number(payment.surchargeAmount),
      'Payment Method': payment.method,
      'Payment Type': payment.paymentType,
      'Description': payment.description,
      'Status': payment.status,
      'Office Location': payment.officeLocation,
      'Created At': payment.createdAt.toISOString(),
      'Updated At': payment.updatedAt.toISOString()
    };
  });

  const headers = [
    'Payment ID', 'Client Name', 'Client Email', 'Amount', 'Surcharge Amount',
    'Total Amount', 'Payment Method', 'Payment Type', 'Description', 'Status',
    'Office Location', 'Created At', 'Updated At'
  ];

  const filename = `revenue-report-${periodLabel}-${branch}-${new Date().toISOString().split('T')[0]}`;

  return { data: reportData, filename, headers };
}

async function generatePayoutsReport(searchParams: URLSearchParams, branch: string) {
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const branchFilter = branch === 'all' ? {} : { branch };

  const [commissions, payouts] = await Promise.all([
    prisma.commission.findMany({
      where: {
        month,
        ...branchFilter
      },
      orderBy: { createdAt: 'desc' }
    }),

    prisma.commissionPayout.findMany({
      where: {
        month,
        ...branchFilter
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  
  // Fetch payment details for commissions (Commission doesn't have a direct relation)
  const paymentIds = [...new Set(commissions.map(c => c.paymentId))];
  const payments = await prisma.payment.findMany({
    where: { id: { in: paymentIds } },
    select: { id: true, clientName: true }
  });
  const paymentMap = payments.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { id: string; clientName: string | null }>);

  // Get agent details
  const agentIds = [...new Set([...commissions.map(c => c.agentId), ...payouts.map(p => p.agentId)])];
  const agents = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, email: true }
  });

  const agentMap = agents.reduce((acc, agent) => {
    acc[agent.id] = agent;
    return acc;
  }, {} as Record<string, any>);

  const commissionData = commissions.map(commission => ({
    'Type': 'Commission',
    'ID': commission.id,
    'Agent Name': agentMap[commission.agentId]?.name || 'Unknown',
    'Agent Email': agentMap[commission.agentId]?.email || '',
    'Payment ID': commission.paymentId,
    'Client Name': paymentMap[commission.paymentId]?.clientName || '',
    'Amount': Number(commission.amount),
    'Percentage': commission.percentage,
    'Status': commission.status,
    'Month': commission.month,
    'Branch': commission.branch,
    'Created At': commission.createdAt.toISOString(),
    'Updated At': commission.updatedAt.toISOString(),
    'Notes': ''
  }));

  const payoutData = payouts.map(payout => ({
    'Type': 'Payout',
    'ID': payout.id,
    'Agent Name': agentMap[payout.agentId]?.name || 'Unknown',
    'Agent Email': agentMap[payout.agentId]?.email || '',
    'Payment ID': '',
    'Client Name': '',
    'Amount': Number(payout.total),
    'Percentage': '',
    'Status': payout.status,
    'Month': payout.month,
    'Branch': payout.branch,
    'Created At': payout.createdAt.toISOString(),
    'Updated At': payout.updatedAt.toISOString(),
    'Notes': payout.notes || ''
  }));

  const reportData = [...commissionData, ...payoutData].sort((a, b) => 
    new Date(b['Created At']).getTime() - new Date(a['Created At']).getTime()
  );

  const headers = [
    'Type', 'ID', 'Agent Name', 'Agent Email', 'Payment ID', 'Client Name',
    'Amount', 'Percentage', 'Status', 'Month', 'Branch', 'Created At',
    'Updated At', 'Notes'
  ];

  const filename = `payouts-report-${month}-${branch}-${new Date().toISOString().split('T')[0]}`;

  return { data: reportData, filename, headers };
}

async function generateTargetsReport(searchParams: URLSearchParams, branch: string) {
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
  const branchFilter = branch === 'all' ? {} : { branch };

  // Fetch targets (no relations - schema has no FKs)
  const targets = await prisma.salesTarget.findMany({
    where: {
      targetPeriod: period,
      status: 'ACTIVE',
      ...branchFilter
    },
    orderBy: [{ agentId: 'asc' }, { developmentId: 'asc' }]
  });

  // Fetch related data separately
  const agentIds = [...new Set(targets.map(t => t.agentId))];
  const devIds = [...new Set(targets.map(t => t.developmentId).filter(Boolean))] as string[];
  const [agents, devs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, email: true } }),
    devIds.length ? prisma.development.findMany({ where: { id: { in: devIds } }, select: { id: true, name: true, location: true } }) : []
  ]);
  const agentMap = new Map(agents.map(a => [a.id, a]));
  const devMap = new Map((devs as { id: string; name: string; location: string }[]).map(d => [d.id, d]));

  // Get actual performance (simplified version)
  const reportData = await Promise.all(
    targets.map(async (target) => {
      // Get actual revenue
      const revenueResult = await prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          createdAt: {
            gte: new Date(period + '-01'),
            lte: new Date(new Date(period + '-01').getFullYear(), new Date(period + '-01').getMonth() + 1, 0)
          }
          // Note: Proper agent linking would require more complex joins
        },
        _sum: { amount: true },
        _count: true
      });

      const actualRevenue = Number(revenueResult._sum.amount || 0);
      const revenueTarget = target.revenueTarget ? Number(target.revenueTarget) : 0;
      const revenueProgress = revenueTarget > 0 ? (actualRevenue / revenueTarget) * 100 : 0;

      const agent = agentMap.get(target.agentId);
      const development = target.developmentId ? devMap.get(target.developmentId) : null;
      
      return {
        'Target ID': target.id,
        'Agent Name': agent?.name || 'Unknown',
        'Agent Email': agent?.email || '',
        'Development': development?.name || 'All Developments',
        'Development Location': development?.location || '',
        'Target Period': target.targetPeriod,
        'Target Type': target.targetType,
        'Revenue Target': revenueTarget,
        'Deals Target': target.dealsTarget || 0,
        'Actual Revenue': actualRevenue,
        'Revenue Progress %': revenueProgress.toFixed(2),
        'Set By': target.setBy,
        'Notes': target.notes || '',
        'Status': target.status,
        'Branch': target.branch,
        'Created At': target.createdAt.toISOString(),
        'Updated At': target.updatedAt.toISOString()
      };
    })
  );

  const headers = [
    'Target ID', 'Agent Name', 'Agent Email', 'Development', 'Development Location',
    'Target Period', 'Target Type', 'Revenue Target', 'Deals Target',
    'Actual Revenue', 'Revenue Progress %', 'Set By', 'Notes', 'Status',
    'Branch', 'Created At', 'Updated At'
  ];

  const filename = `targets-report-${period}-${branch}-${new Date().toISOString().split('T')[0]}`;

  return { data: reportData, filename, headers };
}

// CSV generation helper
function generateCSV(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }

  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      // Escape commas and quotes in values
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// PDF generation helper for revenue reports
function generateRevenuePDF(
  data: any[], 
  headers: string[], 
  filename: string, 
  branch: string,
  userBranch: string
): Buffer {
  const doc = new jsPDF();
  const FC_GOLD = [133, 117, 78]; // #85754E
  const FC_SLATE = [15, 23, 42]; // #0F172A
  
  // Branch settings
  const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
    Harare: {
      address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
      phone: '08644 253731',
      email: 'harare@fineandcountry.co.zw'
    },
    Bulawayo: {
      address: '6 Kingsley Crescent, Malindela, Bulawayo',
      phone: '08644 253731',
      email: 'bulawayo@fineandcountry.co.zw'
    }
  };
  
  const branchLabel = branch === 'all' ? userBranch : branch;
  const settings = branchSettings[branchLabel] || branchSettings.Harare;
  const displayBranch = branch === 'all' ? 'All Branches' : branchLabel;
  
  // Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('REVENUE REPORT', 105, 35, { align: 'center' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Branch: ${displayBranch}`, 105, 42, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 47, { align: 'center' });
  
  // Branch contact info
  doc.setFontSize(7);
  doc.text(settings.address, 190, 25, { align: 'right' });
  doc.text(settings.phone, 190, 30, { align: 'right' });
  doc.text(settings.email, 190, 35, { align: 'right' });
  
  // Summary box
  const totalAmount = data.reduce((sum, row) => sum + (Number(row['Total Amount']) || 0), 0);
  const totalPayments = data.length;
  const totalAmountFormatted = totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  
  let y = 60;
  doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(20, y, 170, 25, 3, 3, 'D');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.text('SUMMARY', 25, y + 10);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Revenue: ${totalAmountFormatted}`, 25, y + 18);
  doc.text(`Total Transactions: ${totalPayments}`, 120, y + 18);
  
  y = 95;
  
  // Table header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  
  const colWidths = [25, 40, 30, 25, 30, 20, 20]; // Adjusted for key columns
  const startX = 20;
  let x = startX;
  
  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, 170, 8, 'F');
  doc.text('Date', x + 2, y + 6);
  x += colWidths[0];
  doc.text('Client', x + 2, y + 6);
  x += colWidths[1];
  doc.text('Amount', x + 2, y + 6);
  x += colWidths[2];
  doc.text('Method', x + 2, y + 6);
  x += colWidths[3];
  doc.text('Type', x + 2, y + 6);
  x += colWidths[4];
  doc.text('Status', x + 2, y + 6);
  x += colWidths[5];
  doc.text('Ref', x + 2, y + 6);
  
  y += 10;
  doc.setLineWidth(0.2);
  doc.setDrawColor(200, 200, 200);
  doc.line(startX, y, startX + 170, y);
  y += 3;
  
  // Data rows
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxY = pageHeight - 30;
  
  for (let i = 0; i < data.length; i++) {
    if (y > maxY) {
      doc.addPage();
      y = 20;
    }
    
    const row = data[i];
    x = startX;
    
    // Date (shortened)
    const dateStr = row['Created At'] ? new Date(row['Created At']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
    doc.text(dateStr, x + 2, y);
    x += colWidths[0];
    
    // Client name (truncated)
    const clientName = (row['Client Name'] || '').substring(0, 18);
    doc.text(clientName, x + 2, y);
    x += colWidths[1];
    
    // Amount
    const amount = Number(row['Amount']) || 0;
    doc.text(`$${amount.toLocaleString()}`, x + 2, y);
    x += colWidths[2];
    
    // Method (shortened)
    const method = (row['Payment Method'] || '').substring(0, 8);
    doc.text(method, x + 2, y);
    x += colWidths[3];
    
    // Type (shortened)
    const type = (row['Payment Type'] || '').substring(0, 10);
    doc.text(type, x + 2, y);
    x += colWidths[4];
    
    // Status
    doc.text(row['Status'] || '', x + 2, y);
    x += colWidths[5];
    
    // Reference (truncated)
    const ref = (row['Payment ID'] || '').substring(0, 8);
    doc.text(ref, x + 2, y);
    
    y += 5;
    
    // Row separator
    if (i < data.length - 1) {
      doc.line(startX, y, startX + 170, y);
      y += 2;
    }
  }
  
  // Footer
  y = pageHeight - 20;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('This is a computer-generated document. For inquiries, contact your branch office.', 105, y, { align: 'center' });
  
  // Generate PDF buffer
  return Buffer.from(doc.output('arraybuffer'));
}