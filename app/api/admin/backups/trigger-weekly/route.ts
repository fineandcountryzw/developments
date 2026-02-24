/**
 * Admin API: Trigger Weekly Developer Backups
 * Fine & Country Zimbabwe ERP
 * 
 * This endpoint allows administrators to manually trigger the weekly
 * developer backup generation and email sending.
 * 
 * SECURITY:
 * - Requires admin authentication
 * - Developer emails are fetched ONLY from Neon DB
 * - No developer info is exposed in responses
 * - All email addresses are validated before sending
 * 
 * Usage:
 * POST /api/admin/backups/trigger-weekly
 * 
 * Optional query params:
 * - developerEmail: Trigger for specific developer only
 * - preview: Returns backup data without sending emails (true/false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for backup generation

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let admin: { email?: string } | null = null;

  try {
    // Verify admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    admin = authResult.user;

    logger.info('Manual backup trigger', { module: 'API', action: 'TRIGGER_BACKUPS', adminEmail: admin.email });

    // Parse request body for options
    let options: { developerEmail?: string; preview?: boolean } = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body provided, use defaults
    }

    // Get the CRON_SECRET for internal API call
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    // If preview mode, just return what would be sent
    if (options.preview) {
      return NextResponse.json({
        success: true,
        message: 'Preview mode not yet implemented. Trigger without preview to send backups.',
        triggeredBy: admin.email,
        timestamp: new Date().toISOString()
      });
    }

    // Trigger the cron job via internal fetch
    const cronUrl = new URL('/api/cron/weekly-developer-backups', request.url);
    if (options.developerEmail) {
      cronUrl.searchParams.set('developerEmail', options.developerEmail);
    }
    
    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });

    const cronResult = await cronResponse.json();

    const duration = Date.now() - startTime;

    // Log the manual trigger for audit
    logger.info('Manual backup trigger completed', {
      module: 'API',
      action: 'TRIGGER_BACKUPS',
      adminEmail: admin.email,
      duration: `${duration}ms`,
      backupsGenerated: cronResult.backupsGenerated,
      emailsSent: cronResult.emailsSent,
      emailsFailed: cronResult.emailsFailed
    });

    return NextResponse.json({
      success: cronResult.success,
      message: 'Weekly developer backups triggered successfully',
      triggeredBy: admin.email,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      result: {
        backupsGenerated: cronResult.backupsGenerated,
        emailsSent: cronResult.emailsSent,
        emailsFailed: cronResult.emailsFailed,
        skippedNoEmail: cronResult.skippedNoEmail,
        skippedInvalidEmail: cronResult.skippedInvalidEmail,
        details: cronResult.details?.map((d: any) => ({
          developerEmail: d.developerEmail?.substring(0, 3) + '***@***',
          developerName: d.developerName,
          status: d.status,
          error: d.error
        })) || []
      }
    });
  } catch (error: any) {
    logger.error('Error triggering backups', error, { module: 'API', action: 'TRIGGER_BACKUPS' });
    return apiError(
      error.message || 'Failed to trigger backups',
      500,
      ErrorCodes.INTERNAL_ERROR,
      { triggeredBy: admin?.email }
    );
  }
}

/**
 * GET /api/admin/backups/trigger-weekly
 * Get information about the weekly backup cron job
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    return NextResponse.json({
      success: true,
      cron: '/api/cron/weekly-developer-backups',
      schedule: 'Every Monday at 09:00 CAT (07:00 UTC)',
      description: 'Generates CSV and PDF backups for all developers and emails them',
      features: [
        'CSV backup (complete data in spreadsheet format)',
        'PDF backup (formatted report with summary)',
        'Automatic email delivery to developer_email',
        'Developer emails are fetched ONLY from Neon database',
        'No developer info exposed in public endpoints'
      ],
      manualTrigger: {
        endpoint: 'POST /api/admin/backups/trigger-weekly',
        body: {
          developerEmail: 'Optional - trigger for specific developer',
          preview: 'Optional - preview mode (not yet implemented)'
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch backup info' },
      { status: 500 }
    );
  }
}
