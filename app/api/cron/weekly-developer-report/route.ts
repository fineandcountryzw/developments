/**
 * Cron Job: Weekly Developer Settlement Reports
 * Fine & Country Zimbabwe ERP
 * 
 * Scheduled task that runs every Monday at 08:00 AM (CAT / UTC+2)
 * Generates and emails weekly settlement reports to all developers
 * 
 * Features:
 * - Aggregates settlements, commissions, and payments from the past 7 days
 * - Includes development info: name, location, stands, pricing, features, overview
 * - Generates PDF reports per development
 * - Sends automated emails to developer contacts (developerEmail from DB)
 * - Logs all activities for audit trail
 * - Notifies admins of any failures
 * 
 * SECURITY NOTES:
 * - Developer email is ONLY fetched from Neon DB (developerEmail field)
 * - Developer info is NEVER exposed on public endpoints or landing pages
 * - All emails are validated before sending
 * - Logs do not expose email addresses in production
 * 
 * Schedule: Every Monday at 08:00 CAT (06:00 UTC)
 * Vercel Cron: "0 6 * * 1"
 * 
 * Authorization: Vercel cron header OR CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { sendEmail, isValidEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_NOTIFICATION_EMAILS = process.env.ADMIN_EMAILS?.split(',') || ['admin@fineandcountry.co.zw'];
const FC_GOLD = [133, 117, 78] as const;
const FC_SLATE = [15, 23, 42] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DevelopmentInfo {
  id: string;
  name: string;
  location: string;
  overview: string | null;
  phase: string;
  totalStands: number | null;
  availableStands: number | null;
  basePrice: number;
  pricePerSqm: number | null;
  features: string[];
  standSizes: Record<string, number> | null;
  standTypes: string[];
  documentUrls: string[];
  imageUrls: string[];
  // Developer info (INTERNAL ONLY - never exposed publicly)
  developerEmail: string | null;
  developerName: string | null;
  developerPhone: string | null;
}

interface WeeklyReportData {
  development: DevelopmentInfo;
  totalSettlements: number;
  totalAmount: number;
  totalCommissions: number;
  developerNetPayout: number;
  payments: Array<{
    clientName: string;
    standRef: string;
    amount: number;
    commission: number;
    netPayout: number;
    status: string;
    date: string;
    receiptNo?: string;
  }>;
  errors: Array<{ type: string; message: string }>;
}

interface CronResult {
  success: boolean;
  timestamp: string;
  reportsGenerated: number;
  emailsSent: number;
  emailsFailed: number;
  skippedNoEmail: number;
  skippedInvalidEmail: number;
  details: Array<{
    development: string;
    status: 'sent' | 'failed' | 'no-email' | 'invalid-email';
    error?: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getLastWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  
  // End: Today at 23:59:59
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  // Start: 7 days ago at 00:00:00
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

/**
 * Fetch all developments with their developer email from Neon DB
 * SECURITY: Developer info is fetched ONLY from database, never from external sources
 */
async function fetchDevelopmentsWithDevEmail(): Promise<DevelopmentInfo[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(`
      SELECT 
        id, name, location, overview, phase,
        total_stands, available_stands, base_price, price_per_sqm,
        features, stand_sizes, stand_types, document_urls, image_urls,
        developer_email, developer_name, developer_phone
      FROM developments
      WHERE status != 'ARCHIVED'
      ORDER BY name
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      location: row.location || 'Unknown Location',
      overview: row.overview,
      phase: row.phase || 'SERVICING',
      totalStands: row.total_stands ? Number(row.total_stands) : null,
      availableStands: row.available_stands ? Number(row.available_stands) : null,
      basePrice: Number(row.base_price) || 0,
      pricePerSqm: row.price_per_sqm ? Number(row.price_per_sqm) : null,
      features: Array.isArray(row.features) ? row.features : [],
      standSizes: row.stand_sizes || null,
      standTypes: Array.isArray(row.stand_types) ? row.stand_types : [],
      documentUrls: Array.isArray(row.document_urls) ? row.document_urls : [],
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
      // INTERNAL ONLY: Developer contact info
      developerEmail: row.developer_email || null,
      developerName: row.developer_name || null,
      developerPhone: row.developer_phone || null,
    }));
  } finally {
    await pool.end();
  }
}

/**
 * Fetch payment data for a specific development
 */
async function fetchPaymentsForDevelopment(developmentId: string, start: Date, end: Date): Promise<WeeklyReportData['payments']> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return [];

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Get stand IDs for this development
    const standsResult = await pool.query(
      'SELECT id, stand_number FROM stands WHERE development_id = $1',
      [developmentId]
    );

    const standIds = standsResult.rows.map(s => s.id);
    if (standIds.length === 0) return [];

    // Fetch payments for these stands within the date range
    const paymentsResult = await pool.query(`
      SELECT 
        p.id, p.amount, p.status, p.created_at, p.reference,
        p.manual_receipt_no, p.verification_status,
        p.stand_id, p.client_name,
        c.name as client_full_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.stand_id = ANY($1)
        AND p.created_at >= $2
        AND p.created_at <= $3
      ORDER BY p.created_at DESC
    `, [standIds, start.toISOString(), end.toISOString()]);

    // Get commission model for this development
    const devResult = await pool.query(
      'SELECT commission_model FROM developments WHERE id = $1',
      [developmentId]
    );
    const commissionModel = devResult.rows[0]?.commission_model || null;
    const commissionRate = commissionModel?.percentage ? commissionModel.percentage / 100 : 0.025;
    const adminFeeRate = 0.005;

    return paymentsResult.rows.map(p => {
      const amount = Number(p.amount) || 0;
      const commission = amount * commissionRate;
      const netPayout = amount - commission - (amount * adminFeeRate);
      
      return {
        clientName: p.client_full_name || p.client_name || 'Unknown',
        standRef: p.stand_id || 'N/A',
        amount,
        commission,
        netPayout,
        status: p.status || 'PENDING',
        date: p.created_at?.toISOString() || new Date().toISOString(),
        receiptNo: p.manual_receipt_no || undefined
      };
    });
  } finally {
    await pool.end();
  }
}

async function generateDeveloperReports(): Promise<WeeklyReportData[]> {
  const { start, end } = getLastWeekRange();
  
  logger.info('Fetching data for weekly developer report', {
    module: 'CRON',
    action: 'WEEKLY_DEVELOPER_REPORT',
    start: start.toISOString(),
    end: end.toISOString()
  });
  
  // Fetch all developments with developer email from Neon DB
  const developments = await fetchDevelopmentsWithDevEmail();

  logger.debug('Found active developments', {
    module: 'CRON',
    action: 'WEEKLY_DEVELOPER_REPORT',
    count: developments.length
  });

  const reports: WeeklyReportData[] = [];

  for (const dev of developments) {
    // Fetch payments for this development within date range
    const payments = await fetchPaymentsForDevelopment(dev.id, start, end);

    // Skip developments with no payments this week (but include them for info reports)
    // We now include ALL developments with developerEmail, even without payments
    const errors: Array<{ type: string; message: string }> = [];
    
    // Check for any flagged payments
    const flaggedPayments = payments.filter(p => 
      p.status === 'DISCREPANCY' || p.status === 'FLAGGED'
    );
    
    for (const fp of flaggedPayments) {
      errors.push({
        type: 'VERIFICATION_FLAG',
        message: `Payment ${fp.receiptNo || 'unknown'} requires attention`
      });
    }

    reports.push({
      development: dev,
      totalSettlements: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      totalCommissions: payments.reduce((sum, p) => sum + p.commission, 0),
      developerNetPayout: payments.reduce((sum, p) => sum + p.netPayout, 0),
      payments,
      errors
    });
  }

  return reports;
}

function generateReportPDF(report: WeeklyReportData): Uint8Array {
  const doc = new jsPDF();
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const { start, end } = getLastWeekRange();
  const pulseId = Math.random().toString(36).substr(2, 12).toUpperCase();
  const dev = report.development;
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('WEEKLY DEVELOPMENT REPORT', 105, 35, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Development: ${dev.name}`, 105, 45, { align: 'center' });
  doc.text(`Location: ${dev.location}`, 105, 52, { align: 'center' });
  doc.text(`Period: ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`, 105, 59, { align: 'center' });
  doc.text(`Generated: ${dateStr}`, 105, 66, { align: 'center' });

  // Development Info Box
  let currentY = 80;
  doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, currentY, 180, 45, 3, 3, 'D');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.text('DEVELOPMENT DETAILS', 20, currentY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Estate Progress: ${dev.phase || 'N/A'}`, 20, currentY + 20);
  doc.text(`Total Stands: ${dev.totalStands || 'N/A'}`, 80, currentY + 20);
  doc.text(`Available: ${dev.availableStands || 'N/A'}`, 140, currentY + 20);
  doc.text(`Base Price: $${dev.basePrice?.toLocaleString() || '0'}`, 20, currentY + 30);
  doc.text(`Price/sqm: $${dev.pricePerSqm?.toLocaleString() || 'N/A'}`, 80, currentY + 30);
  doc.text(`Types: ${dev.standTypes?.join(', ') || 'N/A'}`, 140, currentY + 30);
  if (dev.features && dev.features.length > 0) {
    doc.text(`Features: ${dev.features.slice(0, 4).join(', ')}${dev.features.length > 4 ? '...' : ''}`, 20, currentY + 40);
  }
  currentY += 55;

  // Financial Summary Box
  doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.roundedRect(15, currentY, 180, 35, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  
  doc.text('TOTAL COLLECTED', 35, currentY + 12);
  doc.text('COMMISSIONS', 90, currentY + 12);
  doc.text('NET PAYOUT', 145, currentY + 12);
  
  doc.setFontSize(16);
  doc.text(`$${report.totalAmount.toLocaleString()}`, 35, currentY + 25);
  doc.text(`$${report.totalCommissions.toLocaleString()}`, 90, currentY + 25);
  
  doc.setTextColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.text(`$${report.developerNetPayout.toLocaleString()}`, 145, currentY + 25);
  currentY += 45;

  // Transaction Table
  if (report.payments.length > 0) {
    (doc as any).autoTable({
      startY: currentY,
      head: [['Date', 'Client', 'Stand', 'Receipt', 'Amount', 'Commission', 'Net Payout', 'Status']],
      body: report.payments.map(p => [
        new Date(p.date).toLocaleDateString('en-GB'),
        p.clientName.substring(0, 18),
        p.standRef.substring(0, 12),
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
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 7, 
        cellPadding: 2
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', textColor: FC_GOLD }
      }
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('No transactions recorded this week.', 105, currentY + 10, { align: 'center' });
  }

  // Errors Section
  if (report.errors.length > 0) {
    const errorY = (doc as any).lastAutoTable?.finalY + 15 || currentY + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text('⚠ ITEMS REQUIRING ATTENTION', 15, errorY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    report.errors.forEach((err, idx) => {
      doc.text(`• ${err.type}: ${err.message}`, 15, errorY + 8 + (idx * 6));
    });
  }

  // Document Links Section (if any)
  if (dev.documentUrls && dev.documentUrls.length > 0) {
    const docsY = (doc as any).lastAutoTable?.finalY + 30 || currentY + 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
    doc.text('ATTACHED DOCUMENTS', 15, docsY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 238);
    dev.documentUrls.slice(0, 5).forEach((url, idx) => {
      const filename = url.split('/').pop() || `Document ${idx + 1}`;
      doc.text(`• ${filename}`, 15, docsY + 6 + (idx * 5));
    });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(239, 236, 231);
  doc.line(15, pageHeight - 20, 195, pageHeight - 20);
  
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Fine & Country Zimbabwe ERP | Pulse ID: ${pulseId}`, 15, pageHeight - 12);
  doc.text('All figures in USD. Automated Weekly Report.', 195, pageHeight - 12, { align: 'right' });

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

function generateReportEmailHTML(report: WeeklyReportData): string {
  const { start, end } = getLastWeekRange();
  const dev = report.development;
  
  // Format stand sizes for display
  const standSizesDisplay = dev.standSizes 
    ? Object.entries(dev.standSizes).map(([k, v]) => `${k}: ${v}sqm`).join(', ')
    : 'N/A';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 0; }
        .container { max-width: 650px; margin: 0 auto; padding: 20px; background: #fff; }
        .header { text-align: center; border-bottom: 2px solid #85754e; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #0f172a; margin: 0; font-size: 24px; }
        .header h2 { color: #666; margin: 5px 0 0 0; font-size: 14px; font-weight: normal; }
        .dev-info { background: linear-gradient(135deg, #f8f7f4 0%, #f0ede8 100%); border-radius: 8px; padding: 20px; margin: 20px 0; }
        .dev-info h3 { margin: 0 0 15px 0; color: #85754e; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .info-item { font-size: 13px; }
        .info-item label { display: block; color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
        .info-item span { color: #0f172a; font-weight: 500; }
        .features-list { margin: 15px 0 0 0; padding: 0; }
        .features-list span { display: inline-block; background: #85754e; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin: 2px 4px 2px 0; }
        .overview { background: #f9f9f9; border-left: 3px solid #85754e; padding: 15px; margin: 20px 0; font-style: italic; color: #555; font-size: 13px; }
        .summary { background: #f8f8f8; border-left: 4px solid #85754e; padding: 20px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
        .summary-item label { display: block; font-size: 11px; color: #666; text-transform: uppercase; }
        .summary-item .value { font-size: 24px; font-weight: bold; color: #0f172a; }
        .summary-item .value.highlight { color: #85754e; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        th { background: #0f172a; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; }
        tr:hover { background: #f9f9f9; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; margin-top: 30px; font-size: 11px; color: #999; }
        .alert { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; padding: 10px; border-radius: 4px; margin: 15px 0; }
        .docs-section { margin: 20px 0; }
        .docs-section h4 { color: #0f172a; font-size: 13px; margin-bottom: 10px; }
        .docs-section a { display: block; color: #2563eb; text-decoration: none; font-size: 12px; padding: 5px 0; }
        .docs-section a:hover { text-decoration: underline; }
        .no-transactions { text-align: center; padding: 30px; color: #666; font-style: italic; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>FINE & COUNTRY</h1>
          <h2>Weekly Development Report</h2>
          <p style="margin: 10px 0 0 0; color: #666; font-size: 13px;">
            <strong>${dev.name}</strong><br>
            ${dev.location}<br>
            <span style="font-size: 12px;">${start.toLocaleDateString('en-GB')} – ${end.toLocaleDateString('en-GB')}</span>
          </p>
        </div>

        <!-- Development Information Section -->
        <div class="dev-info">
          <h3>Development Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Estate Progress</label>
              <span>${dev.phase || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Total Stands</label>
              <span>${dev.totalStands || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Available Stands</label>
              <span>${dev.availableStands || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Stand Types</label>
              <span>${dev.standTypes?.join(', ') || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Price per Stand</label>
              <span>$${dev.basePrice?.toLocaleString() || '0'}</span>
            </div>
            <div class="info-item">
              <label>Price per sqm</label>
              <span>$${dev.pricePerSqm?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <label>Stand Sizes</label>
              <span>${standSizesDisplay}</span>
            </div>
          </div>
          ${dev.features && dev.features.length > 0 ? `
            <div class="features-list">
              <label style="display: block; color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Features & Amenities</label>
              ${dev.features.map(f => `<span>${f}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        ${dev.overview ? `
          <div class="overview">
            <strong>Overview:</strong> ${dev.overview}
          </div>
        ` : ''}

        <!-- Financial Summary -->
        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <label>Total Collected</label>
              <div class="value">$${report.totalAmount.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <label>Commissions</label>
              <div class="value">$${report.totalCommissions.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <label>Net Payout</label>
              <div class="value highlight">$${report.developerNetPayout.toLocaleString()}</div>
            </div>
          </div>
          <p style="text-align: center; margin: 15px 0 0 0; font-size: 12px; color: #666;">
            ${report.totalSettlements} settlement${report.totalSettlements !== 1 ? 's' : ''} processed this week
          </p>
        </div>

        ${report.errors.length > 0 ? `
          <div class="alert">
            <strong>⚠ Items Requiring Attention:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px;">
              ${report.errors.map(e => `<li>${e.message}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${report.payments.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Stand</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: right;">Net Payout</th>
              </tr>
            </thead>
            <tbody>
              ${report.payments.map(p => `
                <tr>
                  <td>${new Date(p.date).toLocaleDateString('en-GB')}</td>
                  <td>${p.clientName}</td>
                  <td>${p.standRef}</td>
                  <td style="text-align: right;">$${p.amount.toLocaleString()}</td>
                  <td style="text-align: right; color: #85754e; font-weight: bold;">$${p.netPayout.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-transactions">
            No transactions recorded for this week.
          </div>
        `}

        ${dev.documentUrls && dev.documentUrls.length > 0 ? `
          <div class="docs-section">
            <h4>📄 Development Documents</h4>
            ${dev.documentUrls.slice(0, 5).map(url => {
              const filename = url.split('/').pop() || 'Document';
              return `<a href="${url}" target="_blank">📎 ${filename}</a>`;
            }).join('')}
            ${dev.documentUrls.length > 5 ? `<p style="font-size: 11px; color: #666;">+ ${dev.documentUrls.length - 5} more documents (see attached PDF)</p>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          <p>This is an automated report from the Fine & Country Zimbabwe ERP system.</p>
          <p>For queries, please contact accounts@fineandcountry.co.zw</p>
          <p style="margin-top: 15px; color: #ccc;">Report generated: ${new Date().toISOString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send report email to developer
 * SECURITY: Email is sent ONLY to developerEmail from database
 * Email address is validated before sending
 */
async function sendReportEmail(report: WeeklyReportData, pdfBuffer: Uint8Array): Promise<{ sent: boolean; reason?: string }> {
  const developerEmail = report.development.developerEmail;
  
  // SECURITY: Validate email exists
  if (!developerEmail) {
    return { sent: false, reason: 'No developer email configured' };
  }
  
  // SECURITY: Validate email format
  if (!isValidEmail(developerEmail)) {
    logger.warn('Invalid email format', {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT',
      emailPrefix: developerEmail.substring(0, 3)
    });
    return { sent: false, reason: 'Invalid email format' };
  }

  const { start, end } = getLastWeekRange();
  const dev = report.development;
  
  try {
    await sendEmail({
      to: developerEmail,
      subject: `Weekly Development Report – ${dev.name} (${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')})`,
      html: generateReportEmailHTML(report),
      from: 'Fine & Country Reports <reports@fineandcountry.co.zw>',
      replyTo: 'accounts@fineandcountry.co.zw',
      attachments: [
        {
          filename: `Weekly_Report_${dev.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    });
    
    // Log success without exposing full email (privacy)
    logger.info('Email sent for development', {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT',
      developmentName: dev.name,
      emailPrefix: developerEmail.substring(0, 3)
    });
    return { sent: true };
  } catch (error: any) {
    logger.error('Failed to send email for development', error, {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT',
      developmentName: dev.name
    });
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function notifyAdminsOfFailures(failures: Array<{ development: string; email?: string; error?: string }>) {
  if (failures.length === 0) return;

  const html = `
    <h2>Weekly Developer Report - Delivery Failures</h2>
    <p>The following reports could not be delivered:</p>
    <ul>
      ${failures.map(f => `<li><strong>${f.development}</strong> (${f.email || 'No email'}): ${f.error || 'Unknown error'}</li>`).join('')}
    </ul>
    <p>Please review and manually send reports if necessary.</p>
  `;

  for (const adminEmail of ADMIN_NOTIFICATION_EMAILS) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `[ERP Alert] Weekly Developer Report Failures - ${new Date().toLocaleDateString('en-GB')}`,
        html
      });
    } catch (error: any) {
      logger.error('Failed to notify admin', error, {
        module: 'CRON',
        action: 'WEEKLY_DEVELOPER_REPORT',
        adminEmail
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-vercel-cron');
  
  // Allow Vercel cron or secret-based auth
  if (!cronHeader && authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.error('Unauthorized access attempt', new Error('Invalid CRON_SECRET'), {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT'
    });
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  logger.info('Starting weekly developer report generation', {
    module: 'CRON',
    action: 'WEEKLY_DEVELOPER_REPORT'
  });
  const startTime = Date.now();

  const result: CronResult = {
    success: true,
    timestamp: new Date().toISOString(),
    reportsGenerated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    skippedNoEmail: 0,
    skippedInvalidEmail: 0,
    details: []
  };

  try {
    // Generate reports for all developments with activity
    const reports = await generateDeveloperReports();
    result.reportsGenerated = reports.length;

    logger.info('Generated reports', {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT',
      count: reports.length
    });

    // Process each report
    for (const report of reports) {
      const dev = report.development;
      
      // Check for developer email
      if (!dev.developerEmail) {
        result.skippedNoEmail = (result.skippedNoEmail || 0) + 1;
        result.details.push({
          development: dev.name,
          status: 'no-email',
          error: 'No developer email configured'
        });
        continue;
      }
      
      // Validate email format
      if (!isValidEmail(dev.developerEmail)) {
        result.skippedInvalidEmail = (result.skippedInvalidEmail || 0) + 1;
        result.details.push({
          development: dev.name,
          status: 'invalid-email',
          error: 'Invalid email format'
        });
        continue;
      }

      try {
        // Generate PDF with development info
        const pdfBuffer = generateReportPDF(report);
        
        // Send email with PDF attachment
        const sendResult = await sendReportEmail(report, pdfBuffer);
        
        if (sendResult.sent) {
          result.emailsSent++;
          result.details.push({
            development: dev.name,
            status: 'sent'
          });
        } else {
          result.emailsFailed++;
          result.details.push({
            development: dev.name,
            status: 'failed',
            error: sendResult.reason || 'Email send failed'
          });
        }
      } catch (error) {
        result.emailsFailed++;
        result.details.push({
          development: dev.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Notify admins of any failures
    const failures = result.details.filter(d => d.status === 'failed');
    if (failures.length > 0) {
      await notifyAdminsOfFailures(failures);
    }

    // Log completion
    const duration = Date.now() - startTime;
    logger.info('Weekly Report Cron Completed', {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT',
      duration: `${duration}ms`,
      reportsGenerated: result.reportsGenerated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      skippedNoEmail: result.skippedNoEmail || 0,
      skippedInvalidEmail: result.skippedInvalidEmail || 0
    });

    // Log to database for audit trail using direct SQL (serverless compatible)
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl) {
        const pool = new Pool({ connectionString: databaseUrl });
        await pool.query(`
          INSERT INTO activity_logs (id, branch, action, module, record_id, description, changes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          `log_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 8)}`,
          'Harare',
          'WEEKLY_DEVELOPER_REPORT',
          'CRON',
          'SYSTEM',
          `Weekly developer report: ${result.reportsGenerated} reports, ${result.emailsSent} sent, ${result.emailsFailed} failed. Duration: ${duration}ms`,
          JSON.stringify({
            reportsGenerated: result.reportsGenerated,
            emailsSent: result.emailsSent,
            emailsFailed: result.emailsFailed,
            skippedNoEmail: result.skippedNoEmail || 0,
            skippedInvalidEmail: result.skippedInvalidEmail || 0,
            duration: `${duration}ms`
          })
        ]);
        await pool.end();
      }
    } catch (logError: any) {
      logger.warn('Failed to log activity', { error: logError, module: 'CRON', action: 'WEEKLY_DEVELOPER_REPORT' });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Weekly Report Cron Critical error', error, {
      module: 'CRON',
      action: 'WEEKLY_DEVELOPER_REPORT'
    });
    
    result.success = false;
    
    // Notify admins of critical failure
    await notifyAdminsOfFailures([{
      development: 'SYSTEM',
      error: `Critical cron failure: ${error instanceof Error ? error.message : 'Unknown error'}`
    }]);

    return NextResponse.json(
      { 
        ...result, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST handler for manual triggering (admin only)
export async function POST(request: NextRequest) {
  // For manual triggers, check for admin auth or cron secret
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Use CRON_SECRET for manual triggers' },
      { status: 401 }
    );
  }

  // Delegate to GET handler for actual processing
  return GET(request);
}
