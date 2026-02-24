/**
 * Cron Job: Weekly Backups
 * Fine & Country Zimbabwe ERP
 * 
 * Scheduled task that runs every Monday at 09:00 AM (CAT / UTC+2)
 * Generates weekly backup ZIPs (CSV + PDF) for all developers + admin
 * Uploads to UploadThing, tracks in BackupJob table, emails download links
 * 
 * Schedule: Every Monday at 09:00 CAT (07:00 UTC)
 * Vercel Cron: "0 7 * * 1"
 * 
 * Authorization: Vercel cron header OR CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateBackup, getISOWeekDates } from '@/lib/services/backup-generator';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const CRON_SECRET = process.env.CRON_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * GET /api/cron/weekly-backups
 * Triggered by Vercel Cron every Monday at 07:00 UTC (09:00 CAT)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-vercel-cron');

    if (!cronHeader && authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn('[CRON] Unauthorized backup cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[CRON] Starting weekly backups generation');

    const now = new Date();
    // Get PREVIOUS week's dates (backup covers the week that just ended)
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const { weekStart, weekEnd, weekLabel } = getISOWeekDates(lastWeek);

    const results: Array<{
      scopeType: string;
      scopeId: string;
      status: string;
      error?: string;
    }> = [];

    // ── 1. Generate Developer Backups ──────────────────────────────────
    const developers = await prisma.development.findMany({
      where: {
        developerEmail: { not: null },
      },
      select: {
        developerEmail: true,
      },
      distinct: ['developerEmail'],
    });

    const uniqueEmails = [...new Set(
      developers
        .map((d) => d.developerEmail)
        .filter((email): email is string => !!email)
    )];

    logger.info(`[CRON] Found ${uniqueEmails.length} developers for backup`);

    for (const email of uniqueEmails) {
      try {
        const result = await generateBackup({
          scopeType: 'DEVELOPER',
          scopeId: email,
          weekStart,
          weekEnd,
          weekLabel,
        });

        // Send email notification
        try {
          await sendBackupEmail(email, weekLabel, result.backupJobId);
          await prisma.backupJob.update({
            where: { id: result.backupJobId },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          });
        } catch (emailError) {
          logger.error(`[CRON] Email failed for ${email}:`, emailError instanceof Error ? emailError : undefined);
          await prisma.backupJob.update({
            where: { id: result.backupJobId },
            data: {
              emailError: emailError instanceof Error ? emailError.message : String(emailError),
            },
          });
        }

        results.push({ scopeType: 'DEVELOPER', scopeId: email, status: 'success' });
      } catch (error) {
        logger.error(`[CRON] Backup failed for developer ${email}:`, error instanceof Error ? error : undefined);
        results.push({
          scopeType: 'DEVELOPER',
          scopeId: email,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ── 2. Generate Admin Backup ───────────────────────────────────────
    try {
      const adminResult = await generateBackup({
        scopeType: 'ADMIN',
        scopeId: 'admin',
        weekStart,
        weekEnd,
        weekLabel,
      });

      results.push({ scopeType: 'ADMIN', scopeId: 'admin', status: 'success' });
      logger.info('[CRON] Admin backup generated successfully');
    } catch (error) {
      logger.error('[CRON] Admin backup failed:', error instanceof Error ? error : undefined);
      results.push({
        scopeType: 'ADMIN',
        scopeId: 'admin',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // ── 3. Summary ─────────────────────────────────────────────────────
    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    logger.info(
      `[CRON] Weekly backups complete: ${successful} successful, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      weekLabel,
      timestamp: new Date().toISOString(),
      total: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    logger.error('[CRON] Fatal error in weekly backup cron:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Send backup notification email via Resend
 */
async function sendBackupEmail(
  recipientEmail: string,
  weekLabel: string,
  backupJobId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://developmentsfc.vercel.app';
  const downloadUrl = `${appUrl}/api/backups/${backupJobId}/download`;

  await resend.emails.send({
    from: 'DevelopmentSFC <noreply@developmentsfc.com>',
    to: recipientEmail,
    subject: `Weekly Backup Ready - ${weekLabel}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #C5A059 0%, #8B6F3A 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #1f2937; color: #9ca3af; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; }
            .button { display: inline-block; background: #C5A059; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .files { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
            .file-item { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
            .file-item:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">📦 Weekly Backup Ready</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Week ${weekLabel}</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your weekly backup for <strong>${weekLabel}</strong> has been generated and is ready for download.</p>
            
            <div class="files">
              <p style="font-weight: bold; margin-top: 0;">📁 Backup Contents:</p>
              <div class="file-item">📊 developments.csv — Development projects</div>
              <div class="file-item">🏗️ stands.csv — Stand inventory & financials</div>
              <div class="file-item">📋 reservations.csv — Reservations</div>
              <div class="file-item">📝 contracts.csv — Contracts & agreements</div>
              <div class="file-item">💳 payments.csv — Payment transactions</div>
              <div class="file-item">🧾 receipts.csv — Payment receipts</div>
              <div class="file-item">📅 installments.csv — Payment schedules</div>
              <div class="file-item">🔗 allocations.csv — Payment allocations</div>
              <div class="file-item">📊 recon_summary.csv — Reconciliation</div>
              <div class="file-item">📄 backup_summary.pdf — Visual report</div>
            </div>

            <div style="text-align: center;">
              <a href="${downloadUrl}" class="button">Download Backup ZIP</a>
            </div>

            <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
              You can also access all your backups from your Developer Dashboard under the "Backup & Data" tab.
            </p>
          </div>
          <div class="footer">
            <p>Fine & Country Zimbabwe — DevelopmentSFC Platform</p>
            <p>This is an automated weekly backup notification.</p>
          </div>
        </body>
      </html>
    `,
  });
}
