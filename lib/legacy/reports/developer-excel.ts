/**
 * Developer Report Excel Generation
 * 
 * Generates multi-sheet Excel workbooks using xlsx library.
 */

import * as XLSX from 'xlsx';
import { 
  DeveloperReportData, 
  formatCurrency, 
  formatDate 
} from './developer-report-data';

/**
 * Generate Excel workbook for developer report
 */
export function generateDeveloperExcel(data: DeveloperReportData): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Summary
  const summarySheet = createSummarySheet(data);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Sheet 2: All Stands
  const standsSheet = createStandsSheet(data);
  XLSX.utils.book_append_sheet(workbook, standsSheet, 'All Stands');
  
  // Sheet 3: Payment History
  const paymentsSheet = createPaymentsSheet(data);
  XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'Payment History');
  
  // Sheet 4: Missing Agreements
  const agreementsSheet = createAgreementsSheet(data);
  XLSX.utils.book_append_sheet(workbook, agreementsSheet, 'Missing Agreements');
  
  // Sheet 5: Overdue Accounts
  const overdueSheet = createOverdueSheet(data);
  XLSX.utils.book_append_sheet(workbook, overdueSheet, 'Overdue Accounts');
  
  // Sheet 6: Agent Performance
  const agentsSheet = createAgentsSheet(data);
  XLSX.utils.book_append_sheet(workbook, agentsSheet, 'Agent Performance');
  
  // Sheet 7: Monthly Collections
  const monthlySheet = createMonthlySheet(data);
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Collections');
  
  // Generate buffer
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

/**
 * Create Summary sheet
 */
function createSummarySheet(data: DeveloperReportData): XLSX.WorkSheet {
  const { summary, collections, agreements, overdue, developerName } = data;
  
  const periodText = data.reportPeriod.type === 'ALL_TIME' 
    ? 'All Time' 
    : data.reportPeriod.type === 'THIS_MONTH'
    ? 'This Month'
    : `${formatDate(data.reportPeriod.from)} - ${formatDate(data.reportPeriod.to)}`;
  
  const rows = [
    // Header
    ['FINE & COUNTRY ZIMBABWE', '', '', '', ''],
    ['DEVELOPER PORTFOLIO REPORT', '', '', '', ''],
    ['', '', '', '', ''],
    ['Developer:', developerName, '', 'Generated:', formatDate(data.generatedAt)],
    ['Period:', periodText, '', 'Prepared by:', data.generatedBy],
    ['', '', '', '', ''],
    // Executive Summary
    ['EXECUTIVE SUMMARY', '', '', '', ''],
    ['', '', '', '', ''],
    ['Total Stands in Portfolio', summary.totalStands, '', 'Collection Rate', `${summary.collectionRate.toFixed(1)}%`],
    ['Stands Sold', summary.soldStands, '', 'Total Collected', formatCurrency(summary.totalCollected)],
    ['Stands Available', summary.availableStands, '', 'Total Outstanding', formatCurrency(summary.totalOutstanding)],
    ['Total Portfolio Value', formatCurrency(summary.totalPortfolioValue), '', '', ''],
    ['', '', '', '', ''],
    ['Clients With Agreements', `${summary.clientsWithAgreements} of ${summary.soldStands}`, '', '', ''],
    ['Clients Without Agreements', summary.clientsWithoutAgreements, '', '', ''],
    ['Overdue Accounts', summary.overdueAccounts, '', '', ''],
    ['Overdue Amount', formatCurrency(summary.overdueAmount), '', '', ''],
    ['', '', '', '', ''],
    // Collection Analysis
    ['COLLECTION ANALYSIS', '', '', '', ''],
    ['', '', '', '', ''],
    ['Expected Total Revenue', formatCurrency(collections.expectedRevenue), '', '', ''],
    ['Total Collected So Far', formatCurrency(collections.totalCollected), '', '', ''],
    ['Total Outstanding', formatCurrency(collections.totalOutstanding), '', '', ''],
    ['Collection Rate', `${collections.collectionRate.toFixed(1)}%`, '', '', ''],
    ['Average Payment Per Month', formatCurrency(collections.averagePaymentPerMonth), '', '', ''],
    ['Projected Full Collection Date', collections.projectedFullCollectionDate ? formatDate(collections.projectedFullCollectionDate) : 'N/A', '', '', ''],
    ['', '', '', '', ''],
    // Payment Type Breakdown
    ['PAYMENT TYPE BREAKDOWN', '', '', '', ''],
    ['', '', '', '', ''],
    ['Type', 'Amount', 'Count', '', ''],
    ['Deposits', formatCurrency(collections.paymentTypeBreakdown.deposits.amount), collections.paymentTypeBreakdown.deposits.count, '', ''],
    ['Installments', formatCurrency(collections.paymentTypeBreakdown.installments.amount), collections.paymentTypeBreakdown.installments.count, '', ''],
    ['Legal Fees', formatCurrency(collections.paymentTypeBreakdown.legalFees.amount), collections.paymentTypeBreakdown.legalFees.count, '', ''],
    ['Other', formatCurrency(collections.paymentTypeBreakdown.other.amount), collections.paymentTypeBreakdown.other.count, '', ''],
    ['', '', '', '', ''],
    // Agreement Status
    ['AGREEMENT STATUS', '', '', '', ''],
    ['', '', '', '', ''],
    ['Total Sold', agreements.totalSold, '', '', ''],
    ['Has Agreement', agreements.hasAgreement, '', '', ''],
    ['No Agreement', agreements.noAgreement, '', '', ''],
    ['Pending', agreements.pendingAgreement, '', '', ''],
    ['', '', '', '', ''],
    // Footer
    ['', '', '', '', ''],
    ['Natasha Mugabe | Principal Real Estate Agent | Fine & Country Zimbabwe', '', '', '', ''],
    ['15 Nigels Lane, Borrowdale, Harare | 08644 253731', '', '', '', ''],
    ['CONFIDENTIAL - For developer use only', '', '', '', ''],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 30 }, // A
    { wch: 20 }, // B
    { wch: 5 },  // C
    { wch: 20 }, // D
    { wch: 20 }, // E
  ];
  
  // Style header row
  ws['A1'].s = { 
    font: { bold: true, color: { rgb: 'C5A028' }, sz: 16 },
    alignment: { horizontal: 'center' }
  };
  ws['A2'].s = { 
    font: { bold: true, sz: 14 },
    alignment: { horizontal: 'center' }
  };
  
  // Merge header cells
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });
  
  return ws;
}

/**
 * Create All Stands sheet
 */
function createStandsSheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = [
    'Stand #',
    'Development',
    'Location',
    'Size (sqm)',
    'Price (US$)',
    'Status',
    'Client Name',
    'Client Phone',
    'Client Email',
    'Sale Date',
    'Agent',
    'Has Agreement',
    'Total Paid (US$)',
    'Outstanding (US$)',
    'Last Payment',
    'Days Since Payment',
  ];
  
  const rows = data.stands.map(stand => [
    stand.standNumber,
    stand.developmentName,
    stand.developmentLocation,
    stand.sizeSqm || '',
    stand.price,
    getStatusLabel(stand.status),
    stand.clientName || '',
    stand.clientPhone || '',
    stand.clientEmail || '',
    stand.saleDate ? formatDate(stand.saleDate) : '',
    stand.agentName || '',
    stand.hasAgreement ? 'Yes' : 'No',
    stand.totalPaid,
    stand.outstanding,
    stand.lastPaymentDate ? formatDate(stand.lastPaymentDate) : '',
    stand.daysSinceLastPayment || '',
  ]);
  
  // Add totals row
  const totalsRow = [
    'TOTALS',
    '',
    '',
    '',
    data.summary.totalPortfolioValue,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    data.summary.totalCollected,
    data.summary.totalOutstanding,
    '',
    '',
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, [], totalsRow]);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 },  // Stand #
    { wch: 25 },  // Development
    { wch: 20 },  // Location
    { wch: 12 },  // Size
    { wch: 15 },  // Price
    { wch: 15 },  // Status
    { wch: 25 },  // Client Name
    { wch: 15 },  // Client Phone
    { wch: 25 },  // Client Email
    { wch: 15 },  // Sale Date
    { wch: 15 },  // Agent
    { wch: 14 },  // Has Agreement
    { wch: 15 },  // Total Paid
    { wch: 18 },  // Outstanding
    { wch: 15 },  // Last Payment
    { wch: 18 },  // Days Since
  ];
  
  // Style header row
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'C5A028' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    if (!ws[cellRef].s) ws[cellRef].s = {};
    ws[cellRef].s = headerStyle;
  }
  
  // Add auto-filter
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Create Payment History sheet
 */
function createPaymentsSheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = ['Date', 'Stand #', 'Client', 'Amount (US$)', 'Type', 'Reference', 'Running Total (US$)'];
  
  const rows = data.payments.map(payment => [
    formatDate(payment.date),
    payment.standNumber,
    payment.clientName,
    payment.amount,
    payment.type,
    payment.reference,
    payment.runningTotal,
  ]);
  
  // Add totals row
  const totalsRow = [
    'TOTAL',
    '',
    '',
    data.summary.totalCollected,
    '',
    `${data.payments.length} payments`,
    '',
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, [], totalsRow]);
  
  ws['!cols'] = [
    { wch: 15 }, // Date
    { wch: 12 }, // Stand #
    { wch: 25 }, // Client
    { wch: 15 }, // Amount
    { wch: 20 }, // Type
    { wch: 20 }, // Reference
    { wch: 18 }, // Running Total
  ];
  
  // Style header
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'C5A028' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }
  
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Create Missing Agreements sheet
 */
function createAgreementsSheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = ['Stand #', 'Client Name', 'Client Phone', 'Client Email', 'Sale Date', 'Days Since Sale', 'Purchase Price (US$)', 'Agent'];
  
  const rows = data.agreements.clientsWithoutAgreements.map(client => [
    client.standNumber,
    client.clientName,
    client.clientPhone || '',
    client.clientEmail || '',
    client.saleDate ? formatDate(client.saleDate) : '',
    client.daysSinceSale || '',
    client.purchasePrice,
    client.agentName || '',
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  ws['!cols'] = [
    { wch: 12 }, // Stand #
    { wch: 25 }, // Client Name
    { wch: 15 }, // Client Phone
    { wch: 25 }, // Client Email
    { wch: 15 }, // Sale Date
    { wch: 15 }, // Days Since Sale
    { wch: 18 }, // Purchase Price
    { wch: 15 }, // Agent
  ];
  
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'DC2626' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }
  
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Create Overdue Accounts sheet
 */
function createOverdueSheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = ['Stand #', 'Client Name', 'Client Phone', 'Last Payment Date', 'Days Since Last Payment', 'Amount Overdue (US$)', 'Total Outstanding (US$)', 'Agent'];
  
  const rows = data.overdue.accounts.map(account => [
    account.standNumber,
    account.clientName,
    account.clientPhone || '',
    account.lastPaymentDate ? formatDate(account.lastPaymentDate) : 'Never',
    account.daysSinceLastPayment,
    account.amountOverdue,
    account.totalOutstanding,
    account.agentName || '',
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  ws['!cols'] = [
    { wch: 12 }, // Stand #
    { wch: 25 }, // Client Name
    { wch: 15 }, // Client Phone
    { wch: 18 }, // Last Payment Date
    { wch: 22 }, // Days Since Last Payment
    { wch: 18 }, // Amount Overdue
    { wch: 22 }, // Total Outstanding
    { wch: 15 }, // Agent
  ];
  
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'DC2626' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }
  
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Create Agent Performance sheet
 */
function createAgentsSheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = ['Agent Code', 'Agent Name', 'Stands Sold', 'Total Value (US$)', 'Total Collected (US$)', 'Collection Rate (%)', 'Agreements Signed', 'Overdue Accounts'];
  
  const rows = data.agents
    .sort((a, b) => b.totalCollected - a.totalCollected)
    .map(agent => [
      agent.agentCode || 'Unknown',
      agent.agentName || 'Unknown Agent',
      agent.standsSold,
      agent.totalValue,
      agent.totalCollected,
      agent.collectionRate.toFixed(1),
      agent.agreementsSigned,
      agent.overdueAccounts,
    ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  ws['!cols'] = [
    { wch: 15 }, // Agent Code
    { wch: 20 }, // Agent Name
    { wch: 12 }, // Stands Sold
    { wch: 18 }, // Total Value
    { wch: 20 }, // Total Collected
    { wch: 18 }, // Collection Rate
    { wch: 18 }, // Agreements Signed
    { wch: 16 }, // Overdue Accounts
  ];
  
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'C5A028' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }
  
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Create Monthly Collections sheet
 */
function createMonthlySheet(data: DeveloperReportData): XLSX.WorkSheet {
  const headers = ['Month', 'Payment Count', 'Amount Collected (US$)', 'Cumulative Total (US$)'];
  
  const rows = data.collections.monthlyCollections.map(month => [
    month.monthLabel,
    month.paymentCount,
    month.amountCollected,
    month.cumulativeTotal,
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  ws['!cols'] = [
    { wch: 15 }, // Month
    { wch: 15 }, // Payment Count
    { wch: 22 }, // Amount Collected
    { wch: 22 }, // Cumulative Total
  ];
  
  const headerStyle = { 
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'C5A028' } },
    alignment: { horizontal: 'center' }
  };
  
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }
  
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: headers.length - 1 })}` };
  
  return ws;
}

/**
 * Helper function to get status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'Available';
    case 'SOLD_PAID_UP': return 'Paid Up';
    case 'SOLD_ON_TRACK': return 'On Track';
    case 'SOLD_OVERDUE': return 'Overdue';
    case 'SOLD_NO_AGREEMENT': return 'No Agreement';
    case 'SOLD_NO_CLIENT': return 'No Client';
    default: return status;
  }
}

/**
 * Generate filename for Excel report
 */
export function generateExcelFilename(developerName: string, periodType: string): string {
  const sanitizedName = developerName.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date().toISOString().split('T')[0];
  return `FC_${sanitizedName}_Report_${periodType}_${date}.xlsx`;
}
