/**
 * Admin API: Trigger Weekly Developer Reports
 * Fine & Country Zimbabwe ERP
 * 
 * This endpoint allows administrators to manually trigger the weekly
 * developer report generation and email sending.
 * 
 * SECURITY:
 * - Requires admin authentication
 * - Developer emails are fetched ONLY from Neon DB
 * - No developer info is exposed in responses
 * - All email addresses are validated before sending
 * 
 * Usage:
 * POST /api/admin/reports/trigger-weekly
 * 
 * Optional query params:
 * - developmentId: Trigger for specific development only
 * - preview: Returns report data without sending emails (true/false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for report generation

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }
    const admin = authResult.user;

    logger.info('Manual trigger by admin', { 
      module: 'API', 
      action: 'POST_ADMIN_REPORTS_TRIGGER_WEEKLY',
      adminEmail: admin.email?.substring(0, 3) + '***'
    });

    // Parse request body for options
    let options: { developmentId?: string; preview?: boolean } = {};
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
      const previewUrl = new URL('/api/cron/weekly-developer-report', request.url);
      previewUrl.searchParams.set('preview', 'true');
      if (options.developmentId) {
        previewUrl.searchParams.set('developmentId', options.developmentId);
      }

      // For preview, we'll fetch from the cron endpoint in preview mode
      // (This would need to be implemented in the cron route)
      return NextResponse.json({
        success: true,
        message: 'Preview mode not yet implemented. Trigger without preview to send emails.',
        triggeredBy: admin.email,
        timestamp: new Date().toISOString()
      });
    }

    // Trigger the cron job via internal fetch
    const cronUrl = new URL('/api/cron/weekly-developer-report', request.url);
    
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
    logger.info('Manual trigger completed', {
      module: 'API',
      action: 'POST_ADMIN_REPORTS_TRIGGER_WEEKLY',
      adminEmail: admin.email?.substring(0, 3) + '***',
      duration: `${duration}ms`,
      reportsGenerated: cronResult.reportsGenerated,
      emailsSent: cronResult.emailsSent,
      emailsFailed: cronResult.emailsFailed
    });

    return NextResponse.json({
      success: cronResult.success,
      triggeredBy: admin.email,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results: {
        reportsGenerated: cronResult.reportsGenerated,
        emailsSent: cronResult.emailsSent,
        emailsFailed: cronResult.emailsFailed,
        skippedNoEmail: cronResult.skippedNoEmail || 0,
        skippedInvalidEmail: cronResult.skippedInvalidEmail || 0
      },
      // Details are sanitized - no email addresses exposed
      summary: cronResult.details?.map((d: any) => ({
        development: d.development,
        status: d.status,
        error: d.error
      })) || []
    });

  } catch (error: any) {
    logger.error('Admin Reports Manual trigger failed', error, { module: 'API', action: 'POST_ADMIN_REPORTS_TRIGGER_WEEKLY' });
    return apiError('Failed to trigger weekly reports', 500, ErrorCodes.CREATE_ERROR, {
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// GET handler for checking status/configuration
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    // Check configuration status
    const hasResendKey = !!process.env.RESEND_API_KEY;
    const hasCronSecret = !!process.env.CRON_SECRET;
    const hasAdminEmails = !!process.env.ADMIN_EMAILS;

    return NextResponse.json({
      configured: hasResendKey && hasCronSecret,
      schedule: 'Every Monday at 08:00 AM (CAT)',
      cronExpression: '0 6 * * 1',
      services: {
        resendEmail: hasResendKey,
        cronSecret: hasCronSecret,
        adminNotifications: hasAdminEmails
      },
      endpoints: {
        cron: '/api/cron/weekly-developer-report',
        manualTrigger: '/api/admin/reports/trigger-weekly'
      },
      securityNotes: [
        'Developer emails are fetched ONLY from Neon database',
        'Email addresses are validated before sending',
        'No developer info exposed in public endpoints',
        'All operations logged for audit trail'
      ]
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
