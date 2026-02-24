import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateFollowupEmailHTML, generateFollowupEmailText } from '@/app/lib/email-templates/followup-email';
import { addTrackingToEmailContent } from '@/lib/email-tracking';
import { sendEmail } from '@/lib/email-service';
import { processScheduledAutomations } from '@/lib/automation/scheduler';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Using Resend API via sendEmail from lib/email-service
// Removed nodemailer SMTP configuration - now using centralized Resend service

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `send-followup-${Date.now()}`;
  const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

  try {
    if (EMAIL_DISABLED) {
      return NextResponse.json({ error: 'Email module disabled', correlationId }, { status: 404 });
    }
    // Verify authorization
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', correlationId },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: 'Invalid token', correlationId },
        { status: 403 }
      );
    }

    logger.info('Starting follow-up email job', { module: 'CRON', action: 'SEND_FOLLOWUP', correlationId });

    // Process scheduled automations first (new system)
    await processScheduledAutomations('0 10 10,25 * *').catch(err => {
      logger.error('Scheduled automation processing failed', err, { module: 'CRON', action: 'SEND_FOLLOWUP', correlationId });
    });

    // Legacy: Continue with direct processing for backward compatibility
    // Get OVERDUE invoices that haven't received a follow-up yet this cycle
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'OVERDUE' as any,
        followupSentAt: null, // Only send if follow-up hasn't been sent
      },
      orderBy: { dueDate: 'asc' },
    });

    // Fetch clients for the invoices
    const clientIds = [...new Set(overdueInvoices.map(inv => inv.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } }
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    logger.info('Found invoices for follow-up', {
      module: 'CRON',
      action: 'SEND_FOLLOWUP',
      correlationId,
      count: overdueInvoices.length
    });

    let followupsQueued = 0;
    let followupsSent = 0;
    let followupsFailed = 0;
    const failureDetails: Array<{ invoiceId: string; clientId: string; error: string }> = [];

    // Send follow-up for each overdue invoice
    for (const invoice of overdueInvoices) {
      try {
        const client = clientMap.get(invoice.clientId);
        if (!client) {
          logger.warn('Client not found for invoice', { invoiceId: invoice.id, clientId: invoice.clientId, correlationId });
          continue;
        }

        // Calculate overdue days
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(invoice.dueDate).getTime()) /
          (1000 * 60 * 60 * 24)
        );

        // Get total overdue amount for this client
        const clientInvoices = await prisma.invoice.findMany({
          where: {
            clientId: client.id,
            status: 'OVERDUE' as any,
          },
        });

        const totalOverdueAmount = clientInvoices.reduce(
          (sum, inv) => sum + Number(inv.totalAmount || 0),
          0
        );

        // Count how many reminders/follow-ups already sent
        const previousReminders = await prisma.invoice.count({
          where: {
            clientId: client.id,
            followupSentAt: {
              not: null,
            },
          },
        });

        followupsQueued++;

        // Generate follow-up email
        const htmlContent = generateFollowupEmailHTML({
          client,
          invoice,
          daysOverdue,
          totalOverdueAmount,
          previousReminders,
        });

        const textContent = generateFollowupEmailText({
          client,
          invoice,
          daysOverdue,
          totalOverdueAmount,
          previousReminders,
        });

        // Add tracking to email (Phase 5B integration)
        const paymentLogId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const trackedHtmlContent = addTrackingToEmailContent(
          htmlContent,
          paymentLogId,
          client.email,
          client.id,
          'FOLLOWUP',
          invoice.id,
          `${client.firstName} ${client.lastName}`
        );

        // Send email via Resend API
        await sendEmail({
          to: client.email,
          subject: `URGENT: Follow-up on Invoice #${invoice.invoiceNumber} - ${daysOverdue} Days Overdue`,
          html: trackedHtmlContent,
          replyTo: process.env.SMTP_REPLY_TO || 'accounts@finecountry.co.zw',
        });

        followupsSent++;

        // Log the follow-up for tracking
        await prisma.paymentAutomationLog.create({
          data: {
            invoiceId: invoice.id,
            clientId: client.id,
            action: 'FOLLOWUP_SENT',
            emailStatus: 'SENT',
            subject: `URGENT: Follow-up on Invoice #${invoice.invoiceNumber} - ${daysOverdue} Days Overdue`,
            recipientEmail: client.email,
            metadata: {
              daysOverdue,
              totalOverdueAmount,
              previousReminders,
              paymentLogId,
            },
            branch: client.branch || 'Harare',
          },
        });

        // Update follow-up status
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            followupSentAt: new Date(),
            followupCount: {
              increment: 1,
            },
          }
        });

        logger.info('Follow-up sent', {
          module: 'CRON',
          action: 'SEND_FOLLOWUP',
          correlationId,
          clientEmail: client.email?.substring(0, 3) + '***',
          invoiceNumber: invoice.invoiceNumber,
          daysOverdue
        });
      } catch (error: any) {
        followupsFailed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        failureDetails.push({
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          error: errorMessage,
        });
        logger.error('Failed to send follow-up for invoice', error, {
          module: 'CRON',
          action: 'SEND_FOLLOWUP',
          correlationId,
          invoiceId: invoice.id
        });
      }
    }

    const executionTime = Date.now() - startTime;

    const response = {
      status: 200,
      message: `Follow-up emails processed: ${followupsSent} sent, ${followupsFailed} failed`,
      timestamp: new Date().toISOString(),
      correlationId,
      executionTimeMs: executionTime,
      data: {
        followupsQueued,
        followupsSent,
        followupsFailed,
        invoicesProcessed: overdueInvoices.length,
        details: failureDetails.length > 0 ? failureDetails : [],
      },
    };

    return NextResponse.json(response, {
      status: followupsFailed === 0 ? 200 : 207,
    });
  } catch (error: any) {
    logger.error('Follow-up job failed', error, {
      module: 'CRON',
      action: 'SEND_FOLLOWUP',
      correlationId
    });

    return NextResponse.json(
      {
        status: 500,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
        correlationId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

/**
 * FOLLOW-UP EMAIL CRON JOB
 *
 * Schedule: 10th and 25th of each month at 10:00 UTC
 * Cron Expression: 0 10 10,25 * * (10th and 25th at 10:00 UTC)
 *
 * Setup on cron-job.org:
 * - URL: https://erp.finecountry.co.zw/api/cron/send-followup-emails
 * - Method: POST
 * - Headers: Authorization: Bearer {CRON_SECRET}
 *
 * What it does:
 * 1. Finds all OVERDUE invoices without a follow-up sent
 * 2. For each invoice, sends personalized follow-up email:
 *    - Specific invoice details
 *    - Days overdue with urgency indicator
 *    - Total outstanding on account
 *    - History of previous reminders
 *    - Clear next steps
 *    - Escalated support contact info
 * 3. Tracks follow-up count per invoice
 * 4. Updates followupSentAt timestamp
 * 5. Logs all activities
 *
 * Urgency Levels:
 * - 0-30 days: Yellow/Warning color
 * - 30-60 days: Orange/Urgent color
 * - 60+ days: Red/Critical color
 *
 * Email Features:
 * - Individual invoice focus
 * - Previous reminder count display
 * - Total account balance
 * - Escalated language based on age
 * - Clear payment instructions
 * - Immediate contact options
 *
 * Database Updates:
 * - followupSentAt: Set to current timestamp
 * - followupCount: Incremented for tracking history
 *
 * Returns:
 * {
 *   "status": 200,
 *   "message": "Follow-up emails processed: X sent, Y failed",
 *   "data": {
 *     "followupsQueued": number,
 *     "followupsSent": number,
 *     "followupsFailed": number,
 *     "invoicesProcessed": number
 *   }
 * }
 */
