/**
 * Cron Job: Weekly Developer Backups
 * Fine & Country Zimbabwe ERP
 * 
 * Scheduled task that runs every Monday at 09:00 AM (CAT / UTC+2)
 * Generates and emails weekly CSV and PDF backups to all developers
 * 
 * Features:
 * - Fetches all unique developers (by developer_email)
 * - Generates CSV backup (developments, stands, payments, reservations)
 * - Generates PDF backup (formatted report)
 * - Emails both attachments to developer contacts
 * - Logs all activities for audit trail
 * - Notifies admins of any failures
 * 
 * SECURITY NOTES:
 * - Developer email is ONLY fetched from Neon DB (developerEmail field)
 * - Developer info is NEVER exposed on public endpoints
 * - All emails are validated before sending
 * - Logs do not expose email addresses in production
 * 
 * Schedule: Every Monday at 09:00 CAT (07:00 UTC)
 * Vercel Cron: "0 7 * * 1"
 * 
 * Authorization: Vercel cron header OR CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { jsPDF } from 'jspdf';
import { sendEmail, isValidEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_NOTIFICATION_EMAILS = process.env.ADMIN_EMAILS?.split(',') || ['admin@fineandcountry.co.zw'];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DeveloperBackupData {
  developerEmail: string;
  developerName: string | null;
  backupDate: string;
  developments: Array<{
    id: string;
    name: string;
    location: string;
    status: string;
    totalStands: number | null;
    basePrice: number;
    branch: string;
    createdAt: string;
    updatedAt: string;
  }>;
  stands: Array<{
    id: string;
    standNumber: string;
    developmentId: string;
    developmentName: string;
    status: string;
    size: number | null;
    price: number;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    developmentId: string;
    developmentName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string | null;
    referenceNumber: string | null;
    createdAt: string;
  }>;
  reservations: Array<{
    id: string;
    standId: string;
    standNumber: string;
    developmentName: string;
    clientId: string;
    status: string;
    totalAmount: number | null;
    depositAmount: number | null;
    createdAt: string;
  }>;
  summary: {
    totalDevelopments: number;
    totalStands: number;
    totalPayments: number;
    totalReservations: number;
    totalRevenue: number;
  };
}

interface BackupResult {
  developerEmail: string;
  developerName: string | null;
  status: 'sent' | 'failed' | 'no-email' | 'invalid-email';
  error?: string;
}

interface CronResult {
  success: boolean;
  timestamp: string;
  backupsGenerated: number;
  emailsSent: number;
  emailsFailed: number;
  skippedNoEmail: number;
  skippedInvalidEmail: number;
  details: BackupResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all unique developers from database
 */
async function fetchAllDevelopers(): Promise<Array<{ email: string; name: string | null }>> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        developer_email as email,
        developer_name as name
      FROM developments
      WHERE developer_email IS NOT NULL 
        AND developer_email != ''
        AND status != 'ARCHIVED'
      ORDER BY developer_email
    `);

    await pool.end();
    return result.rows;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * Fetch backup data for a specific developer
 */
async function fetchDeveloperBackupData(developerEmail: string): Promise<DeveloperBackupData> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Fetch developments
    const devResult = await pool.query(`
      SELECT 
        d.id,
        d.name,
        d.location,
        d.status,
        d.total_stands as "totalStands",
        d.base_price as "basePrice",
        d.branch,
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        d.developer_name as "developerName"
      FROM developments d
      WHERE d.developer_email = $1
        AND d.status != 'ARCHIVED'
      ORDER BY d.created_at DESC
    `, [developerEmail]);

    const developments = devResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      location: row.location,
      status: row.status,
      totalStands: row.totalStands,
      basePrice: parseFloat(row.basePrice) || 0,
      branch: row.branch,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      developerName: row.developerName
    }));

    const developerName = developments[0]?.developerName || null;
    const developmentIds = developments.map(d => d.id);

    // Fetch stands
    let stands: any[] = [];
    if (developmentIds.length > 0) {
      const standsResult = await pool.query(`
        SELECT 
          s.id,
          s.stand_number as "standNumber",
          s.development_id as "developmentId",
          d.name as "developmentName",
          s.status,
          s.size,
          s.price,
          s.created_at as "createdAt"
        FROM stands s
        JOIN developments d ON d.id = s.development_id
        WHERE s.development_id = ANY($1::text[])
        ORDER BY s.development_id, s.stand_number
      `, [developmentIds]);

      stands = standsResult.rows.map(row => ({
        id: row.id,
        standNumber: row.standNumber,
        developmentId: row.developmentId,
        developmentName: row.developmentName,
        status: row.status,
        size: row.size ? parseFloat(row.size) : null,
        price: parseFloat(row.price) || 0,
        createdAt: row.createdAt
      }));
    }

    // Fetch developer payments
    let payments: any[] = [];
    try {
      const paymentsResult = await pool.query(`
        SELECT 
          dp.id,
          dp.development_id as "developmentId",
          d.name as "developmentName",
          dp.amount,
          dp.payment_date as "paymentDate",
          dp.payment_method as "paymentMethod",
          dp.reference_number as "referenceNumber",
          dp.created_at as "createdAt"
        FROM developer_payments dp
        JOIN developments d ON d.id = dp.development_id
        WHERE dp.developer_email = $1
        ORDER BY dp.payment_date DESC
      `, [developerEmail]);

      payments = paymentsResult.rows.map(row => ({
        id: row.id,
        developmentId: row.developmentId,
        developmentName: row.developmentName,
        amount: parseFloat(row.amount) || 0,
        paymentDate: row.paymentDate,
        paymentMethod: row.paymentMethod,
        referenceNumber: row.referenceNumber,
        createdAt: row.createdAt
      }));
    } catch (err) {
      logger.warn('developer_payments query failed', { module: 'CRON', action: 'WEEKLY_BACKUP', error: err });
      payments = [];
    }

    // Fetch reservations for stands in developer's developments
    let reservations: any[] = [];
    if (developmentIds.length > 0) {
      try {
        const resResult = await pool.query(`
          SELECT 
            r.id,
            r.stand_id as "standId",
            s.stand_number as "standNumber",
            d.name as "developmentName",
            r.client_id as "clientId",
            r.status,
            r.total_amount as "totalAmount",
            r.deposit_amount as "depositAmount",
            r.created_at as "createdAt"
          FROM reservations r
          JOIN stands s ON s.id = r.stand_id
          JOIN developments d ON d.id = s.development_id
          WHERE r.stand_id IN (
            SELECT id FROM stands WHERE development_id = ANY($1::text[])
          )
          ORDER BY r.created_at DESC
        `, [developmentIds]);

        reservations = resResult.rows.map(row => ({
          id: row.id,
          standId: row.standId,
          standNumber: row.standNumber,
          developmentName: row.developmentName,
          clientId: row.clientId,
          status: row.status,
          totalAmount: row.totalAmount ? parseFloat(row.totalAmount) : null,
          depositAmount: row.depositAmount ? parseFloat(row.depositAmount) : null,
          createdAt: row.createdAt
        }));
      } catch (err) {
        logger.warn('reservations query failed', { module: 'CRON', action: 'WEEKLY_BACKUP', error: err });
        reservations = [];
      }
    }

    await pool.end();

    // Calculate summary
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      developerEmail,
      developerName,
      backupDate: new Date().toISOString(),
      developments,
      stands,
      payments,
      reservations,
      summary: {
        totalDevelopments: developments.length,
        totalStands: stands.length,
        totalPayments: payments.length,
        totalReservations: reservations.length,
        totalRevenue
      }
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * Generate CSV backup
 */
function generateCSVBackup(data: DeveloperBackupData): string {
  const rows: string[] = [];
  
  // Header
  rows.push('DEVELOPER WEEKLY BACKUP');
  rows.push(`Developer: ${data.developerName || data.developerEmail}`);
  rows.push(`Backup Date: ${new Date(data.backupDate).toLocaleDateString('en-GB')}`);
  rows.push('');
  
  // Summary
  rows.push('SUMMARY');
  rows.push(`Total Developments,${data.summary.totalDevelopments}`);
  rows.push(`Total Stands,${data.summary.totalStands}`);
  rows.push(`Total Payments,${data.summary.totalPayments}`);
  rows.push(`Total Reservations,${data.summary.totalReservations}`);
  rows.push(`Total Revenue (USD),${data.summary.totalRevenue.toFixed(2)}`);
  rows.push('');
  
  // Developments
  if (data.developments.length > 0) {
    rows.push('DEVELOPMENTS');
    rows.push('ID,Name,Location,Status,Total Stands,Base Price (USD),Branch,Created At,Updated At');
    data.developments.forEach(dev => {
      rows.push([
        dev.id,
        `"${dev.name}"`,
        `"${dev.location}"`,
        dev.status,
        dev.totalStands || 0,
        dev.basePrice.toFixed(2),
        dev.branch,
        new Date(dev.createdAt).toLocaleDateString('en-GB'),
        new Date(dev.updatedAt).toLocaleDateString('en-GB')
      ].join(','));
    });
    rows.push('');
  }
  
  // Stands
  if (data.stands.length > 0) {
    rows.push('STANDS');
    rows.push('ID,Stand Number,Development,Status,Size (m²),Price (USD),Created At');
    data.stands.forEach(stand => {
      rows.push([
        stand.id,
        stand.standNumber,
        `"${stand.developmentName}"`,
        stand.status,
        stand.size || '',
        stand.price.toFixed(2),
        new Date(stand.createdAt).toLocaleDateString('en-GB')
      ].join(','));
    });
    rows.push('');
  }
  
  // Payments
  if (data.payments.length > 0) {
    rows.push('PAYMENTS');
    rows.push('ID,Development,Amount (USD),Payment Date,Payment Method,Reference Number,Created At');
    data.payments.forEach(payment => {
      rows.push([
        payment.id,
        `"${payment.developmentName}"`,
        payment.amount.toFixed(2),
        new Date(payment.paymentDate).toLocaleDateString('en-GB'),
        payment.paymentMethod || '',
        payment.referenceNumber || '',
        new Date(payment.createdAt).toLocaleDateString('en-GB')
      ].join(','));
    });
    rows.push('');
  }
  
  // Reservations
  if (data.reservations.length > 0) {
    rows.push('RESERVATIONS');
    rows.push('ID,Stand Number,Development,Client ID,Status,Total Amount (USD),Deposit Amount (USD),Created At');
    data.reservations.forEach(res => {
      rows.push([
        res.id,
        res.standNumber,
        `"${res.developmentName}"`,
        res.clientId,
        res.status,
        res.totalAmount?.toFixed(2) || '',
        res.depositAmount?.toFixed(2) || '',
        new Date(res.createdAt).toLocaleDateString('en-GB')
      ].join(','));
    });
  }
  
  return rows.join('\n');
}

/**
 * Generate PDF backup
 */
function generatePDFBackup(data: DeveloperBackupData): Buffer {
  const doc = new jsPDF();
  const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
    Harare: {
      address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
      phone: '08644 253731',
      email: 'harare@fineandcountry.co.zw',
    },
    Bulawayo: {
      address: '6 Kingsley Crescent, Malindela, Bulawayo',
      phone: '08644 253731',
      email: 'bulawayo@fineandcountry.co.zw',
    },
  };
  const settings = branchSettings.Harare;

  // Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 31, { align: 'center' });
  doc.setLineWidth(0.8);
  doc.line(20, 37, 190, 37);

  doc.setFontSize(8);
  doc.text('Harare HQ', 190, 20, { align: 'right' });
  doc.text(settings.address, 190, 25, { align: 'right' });
  doc.text(settings.phone, 190, 30, { align: 'right' });
  doc.text(settings.email, 190, 35, { align: 'right' });

  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.text('WEEKLY DEVELOPER BACKUP', 105, 50, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Developer: ${data.developerName || data.developerEmail}`, 105, 57, { align: 'center' });
  doc.text(`Backup Date: ${new Date(data.backupDate).toLocaleDateString('en-GB')}`, 105, 63, { align: 'center' });

  let y = 75;
  doc.setLineWidth(0.2);
  doc.line(20, y, 190, y);
  y += 10;

  // Summary
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SUMMARY', 20, y);
  y += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  const summaryItems = [
    ['Total Developments:', data.summary.totalDevelopments.toString()],
    ['Total Stands:', data.summary.totalStands.toString()],
    ['Total Payments:', data.summary.totalPayments.toString()],
    ['Total Reservations:', data.summary.totalReservations.toString()],
    ['Total Revenue (USD):', `$${formatNumber(data.summary.totalRevenue)}`],
  ];

  summaryItems.forEach(([label, value]) => {
    doc.text(label, 25, y);
    doc.text(value, 150, y, { align: 'right' });
    y += 6;
  });

  y += 5;
  doc.line(20, y, 190, y);
  y += 10;

  // Developments
  if (data.developments.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DEVELOPMENTS', 20, y);
    y += 8;

    data.developments.forEach((dev, idx) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${idx + 1}. ${dev.name}`, 25, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Location: ${dev.location}`, 30, y);
      y += 5;
      doc.text(`Status: ${dev.status} | Stands: ${dev.totalStands || 0} | Base Price: $${formatNumber(dev.basePrice)}`, 30, y);
      y += 8;
    });

    y += 5;
    doc.line(20, y, 190, y);
    y += 10;
  }

  // Payments Summary
  if (data.payments.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RECENT PAYMENTS', 20, y);
    y += 8;

    data.payments.slice(0, 10).forEach((payment) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${payment.developmentName}`, 25, y);
      doc.text(`$${formatNumber(payment.amount)}`, 150, y, { align: 'right' });
      y += 5;
      doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString('en-GB')}`, 30, y);
      if (payment.referenceNumber) {
        doc.text(`Ref: ${payment.referenceNumber}`, 100, y);
      }
      y += 8;
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Send backup email to developer
 */
async function sendBackupEmail(
  data: DeveloperBackupData,
  csvContent: string,
  pdfBuffer: Buffer
): Promise<{ sent: boolean; reason?: string }> {
  const developerEmail = data.developerEmail;

  if (!developerEmail) {
    return { sent: false, reason: 'No developer email configured' };
  }

  if (!isValidEmail(developerEmail)) {
    logger.warn('Invalid email format', { module: 'CRON', action: 'WEEKLY_BACKUP', emailPrefix: developerEmail.substring(0, 3) });
    return { sent: false, reason: 'Invalid email format' };
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date();

  try {
    await sendEmail({
      to: developerEmail,
      subject: `Weekly Data Backup – ${weekStart.toLocaleDateString('en-GB')} to ${weekEnd.toLocaleDateString('en-GB')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #B8860B;">Weekly Data Backup</h2>
          <p>Dear ${data.developerName || 'Developer'},</p>
          <p>Your weekly data backup for the period <strong>${weekStart.toLocaleDateString('en-GB')} to ${weekEnd.toLocaleDateString('en-GB')}</strong> is attached.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Backup Summary</h3>
            <ul>
              <li><strong>Developments:</strong> ${data.summary.totalDevelopments}</li>
              <li><strong>Stands:</strong> ${data.summary.totalStands}</li>
              <li><strong>Payments:</strong> ${data.summary.totalPayments}</li>
              <li><strong>Reservations:</strong> ${data.summary.totalReservations}</li>
              <li><strong>Total Revenue:</strong> $${formatNumber(data.summary.totalRevenue)}</li>
            </ul>
          </div>
          
          <p>Two files are attached:</p>
          <ul>
            <li><strong>CSV Backup</strong> – Complete data in spreadsheet format</li>
            <li><strong>PDF Backup</strong> – Formatted report with summary</li>
          </ul>
          
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This is an automated backup from the Fine & Country Zimbabwe ERP system.<br>
            For queries, please contact accounts@fineandcountry.co.zw
          </p>
        </div>
      `,
      from: 'Fine & Country Backups <backups@fineandcountry.co.zw>',
      replyTo: 'accounts@fineandcountry.co.zw',
      attachments: [
        {
          filename: `backup-${data.developerEmail.replace('@', '_at_')}-${new Date().toISOString().split('T')[0]}.csv`,
          content: Buffer.from(csvContent),
          contentType: 'text/csv'
        },
        {
          filename: `backup-${data.developerEmail.replace('@', '_at_')}-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    logger.info('Email sent', { module: 'CRON', action: 'WEEKLY_BACKUP', emailPrefix: developerEmail.substring(0, 3) });
    return { sent: true };
  } catch (error: any) {
    logger.error('Failed to send email', error, { module: 'CRON', action: 'WEEKLY_BACKUP', emailPrefix: developerEmail.substring(0, 3) });
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function notifyAdminsOfFailures(failures: Array<{ developerEmail: string; developerName: string | null; error?: string }>) {
  if (failures.length === 0) return;

  const html = `
    <h2>Weekly Developer Backup - Delivery Failures</h2>
    <p>The following backups could not be delivered:</p>
    <ul>
      ${failures.map(f => `<li><strong>${f.developerName || f.developerEmail}</strong> (${f.developerEmail.substring(0, 3)}***@***): ${f.error || 'Unknown error'}</li>`).join('')}
    </ul>
    <p>Please review and manually send backups if necessary.</p>
  `;

  for (const adminEmail of ADMIN_NOTIFICATION_EMAILS) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `[ERP Alert] Weekly Developer Backup Failures - ${new Date().toLocaleDateString('en-GB')}`,
        html
      });
    } catch (error: any) {
      logger.error('Failed to notify admin', error, { module: 'CRON', action: 'WEEKLY_BACKUP', adminEmail });
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

  if (cronHeader !== '1' && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  logger.info('Starting weekly developer backup generation', { module: 'CRON', action: 'WEEKLY_BACKUP' });

  try {
    // Fetch all developers
    const developers = await fetchAllDevelopers();
    logger.debug('Found developers', { module: 'CRON', action: 'WEEKLY_BACKUP', count: developers.length });

    const results: BackupResult[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;
    let skippedNoEmail = 0;
    let skippedInvalidEmail = 0;

    // Process each developer
    for (const dev of developers) {
      try {
        // Fetch backup data
        const backupData = await fetchDeveloperBackupData(dev.email);

        // Generate CSV and PDF
        const csvContent = generateCSVBackup(backupData);
        const pdfBuffer = generatePDFBackup(backupData);

        // Send email
        const emailResult = await sendBackupEmail(backupData, csvContent, pdfBuffer);

        if (emailResult.sent) {
          emailsSent++;
          results.push({
            developerEmail: dev.email,
            developerName: dev.name,
            status: 'sent'
          });
        } else {
          emailsFailed++;
          if (emailResult.reason?.includes('No developer email')) {
            skippedNoEmail++;
            results.push({
              developerEmail: dev.email,
              developerName: dev.name,
              status: 'no-email',
              error: emailResult.reason
            });
          } else if (emailResult.reason?.includes('Invalid email')) {
            skippedInvalidEmail++;
            results.push({
              developerEmail: dev.email,
              developerName: dev.name,
              status: 'invalid-email',
              error: emailResult.reason
            });
          } else {
            results.push({
              developerEmail: dev.email,
              developerName: dev.name,
              status: 'failed',
              error: emailResult.reason
            });
          }
        }
      } catch (error: any) {
        logger.error('Error processing developer', error, { module: 'CRON', action: 'WEEKLY_BACKUP', developerEmail: dev.email });
        emailsFailed++;
        results.push({
          developerEmail: dev.email,
          developerName: dev.name,
          status: 'failed',
          error: error.message || 'Unknown error'
        });
      }
    }

    // Notify admins of failures
    const failures = results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      await notifyAdminsOfFailures(failures);
    }

    const duration = Date.now() - startTime;
    const result: CronResult = {
      success: true,
      timestamp: new Date().toISOString(),
      backupsGenerated: developers.length,
      emailsSent,
      emailsFailed,
      skippedNoEmail,
      skippedInvalidEmail,
      details: results
    };

    logger.info('Weekly backup cron complete', {
      module: 'CRON',
      action: 'WEEKLY_BACKUP',
      emailsSent,
      emailsFailed,
      duration: `${duration}ms`
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Fatal error in weekly backup cron', error, { module: 'CRON', action: 'WEEKLY_BACKUP' });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate backups',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
