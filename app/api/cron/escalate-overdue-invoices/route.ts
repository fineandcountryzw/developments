import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  generateOverdueEscalationHTML,
  generateOverdueEscalationText,
} from '@/lib/email-templates/overdue-escalation-simple';
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
  const correlationId = `escalate-overdue-${Date.now()}`;
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

    logger.info('Starting overdue invoice escalation job', { module: 'CRON', action: 'ESCALATE_OVERDUE', correlationId });

    // Process scheduled automations first (new system)
    await processScheduledAutomations('0 8 1 * *').catch(err => {
      logger.error('Scheduled automation processing failed', err, { module: 'CRON', action: 'ESCALATE_OVERDUE', correlationId });
    });

    // Legacy: Continue with direct processing for backward compatibility
    // Get invoices that are 30+ days overdue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        dueDate: {
          lte: thirtyDaysAgo,
        },
        status: {
          notIn: ['PAID', 'CANCELLED', 'OVERDUE' as any],
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Fetch clients for the invoices
    const clientIds = [...new Set(overdueInvoices.map(inv => inv.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } }
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    logger.info('Found overdue invoices for escalation', {
      module: 'CRON',
      action: 'ESCALATE_OVERDUE',
      correlationId,
      count: overdueInvoices.length
    });

    let escalationsQueued = 0;
    let escalationsSent = 0;
    let escalationsFailed = 0;
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const failureDetails: Array<{ clientId: string; error: string }> = [];

    // Group by client for bulk email
    const invoicesByClient = new Map<string, (typeof overdueInvoices)[0][]>();
    for (const invoice of overdueInvoices) {
      if (!invoicesByClient.has(invoice.clientId)) {
        invoicesByClient.set(invoice.clientId, []);
      }
      invoicesByClient.get(invoice.clientId)!.push(invoice);
    }

    // Send escalation emails
    for (const [clientId, clientInvoices] of invoicesByClient.entries()) {
      try {
        const client = clientMap.get(clientId);
        if (!client) {
          logger.warn('Client not found for invoice', { clientId, correlationId });
          continue;
        }

        // Calculate overdue details
        const totalOverdue = clientInvoices.reduce(
          (sum, inv) => sum + Number(inv.totalAmount || 0),
          0
        );

        const oldestInvoice = clientInvoices.reduce((oldest, current) =>
          new Date(current.dueDate) < new Date(oldest.dueDate) ? current : oldest
        );

        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(oldestInvoice.dueDate).getTime()) /
          (1000 * 60 * 60 * 24)
        );

        // Get last reminder date if available
        const lastReminder = clientInvoices.find((inv) => inv.reminderSentAt);

        escalationsQueued++;

        // Map invoices to expected format
        const mappedInvoices = clientInvoices.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          totalAmount: Number(inv.totalAmount),
          dueDate: inv.dueDate.toISOString()
        }));

        // Generate escalation email
        const htmlContent = generateOverdueEscalationHTML({
          client,
          invoices: mappedInvoices,
          totalOverdue,
          daysOverdue
        });

        const textContent = generateOverdueEscalationText({
          client,
          invoices: mappedInvoices,
          totalOverdue,
          daysOverdue
        });

        // Add tracking to email (Phase 5B integration)
        const paymentLogId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const trackedHtmlContent = addTrackingToEmailContent(
          htmlContent,
          paymentLogId,
          client.email || '',
          client.id || '',
          'ESCALATION',
          clientInvoices[0]?.id,
          `${client.firstName || ''} ${client.lastName || ''}`.trim()
        );

        // Send to client via Resend API
        await sendEmail({
          to: client.email,
          subject: `⚠️ CRITICAL: Overdue Payment Notice - ${daysOverdue} Days Overdue`,
          html: trackedHtmlContent,
          replyTo: process.env.SMTP_REPLY_TO || 'accounts@finecountry.co.zw',
        });

        // Send to admin for awareness/follow-up
        if (adminEmails.length > 0) {
          const adminSummary = `
CLIENT: ${client.firstName} ${client.lastName} (${client.email})
TOTAL OVERDUE: $${totalOverdue.toFixed(2)}
DAYS OVERDUE: ${daysOverdue}
INVOICE COUNT: ${clientInvoices.length}

INVOICE DETAILS:
${clientInvoices
              .map((inv) => `- #${inv.invoiceNumber}: $${Number(inv.totalAmount).toFixed(2)} (Due: ${new Date(inv.dueDate).toLocaleDateString()})`)
              .join('\n')}

ACTION TAKEN: Escalation email sent to client
NEXT STEP: Follow-up email scheduled for 10th/25th of month
          `;

          await sendEmail({
            to: adminEmails,
            subject: `[OVERDUE ALERT] ${client.firstName} ${client.lastName} - ${daysOverdue} Days Overdue`,
            html: `<pre style="font-family: monospace; white-space: pre-wrap;">${adminSummary}</pre>`,
          });
        }

        escalationsSent++;

        // Log the escalation for tracking
        await prisma.paymentAutomationLog.create({
          data: {
            invoiceId: clientInvoices[0].id,
            clientId: client.id,
            action: 'ESCALATION_SENT',
            emailStatus: 'SENT',
            subject: `⚠️ CRITICAL: Overdue Payment Notice - ${daysOverdue} Days Overdue`,
            recipientEmail: client.email,
            metadata: {
              totalOverdue,
              daysOverdue,
              invoiceCount: clientInvoices.length,
              paymentLogId,
            },
            branch: client.branch || 'Harare',
          },
        });

        // Mark invoices as OVERDUE
        await prisma.invoice.updateMany({
          where: { id: { in: clientInvoices.map((inv) => inv.id) } },
          data: {
            status: 'OVERDUE' as any,
            escalatedAt: new Date(),
          }
        });

        logger.info('Escalation sent', {
          module: 'CRON',
          action: 'ESCALATE_OVERDUE',
          correlationId,
          clientEmail: client.email?.substring(0, 3) + '***',
          daysOverdue
        });
      } catch (error: any) {
        escalationsFailed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        failureDetails.push({ clientId, error: errorMessage });
        logger.error('Failed to escalate invoices for client', error, {
          module: 'CRON',
          action: 'ESCALATE_OVERDUE',
          correlationId,
          clientId
        });
      }
    }

    const executionTime = Date.now() - startTime;

    const response = {
      status: 200,
      message: `Overdue invoices escalated: ${escalationsSent} escalated, ${escalationsFailed} failed`,
      timestamp: new Date().toISOString(),
      correlationId,
      executionTimeMs: executionTime,
      data: {
        escalationsQueued,
        escalationsSent,
        escalationsFailed,
        invoicesEscalated: overdueInvoices.length,
        clientsEscalated: invoicesByClient.size,
        details: failureDetails.length > 0 ? failureDetails : [],
      },
    };

    return NextResponse.json(response, {
      status: escalationsFailed === 0 ? 200 : 207,
    });
  } catch (error: any) {
    logger.error('Escalation job failed', error, {
      module: 'CRON',
      action: 'ESCALATE_OVERDUE',
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
 * OVERDUE INVOICE ESCALATION CRON JOB
 *
 * Schedule: 1st of each month at 08:00 UTC
 * Cron Expression: 0 8 1 * * (1st at 08:00 UTC)
 *
 * Setup on cron-job.org:
 * - URL: https://erp.finecountry.co.zw/api/cron/escalate-overdue-invoices
 * - Method: POST
 * - Headers: Authorization: Bearer {CRON_SECRET}
 *
 * What it does:
 * 1. Finds all invoices 30+ days overdue
 * 2. Groups them by client
 * 3. Sends CRITICAL escalation email to each client:
 *    - Red header with warning symbols
 *    - Overdue details and consequences
 *    - Legal action notice
 *    - Urgent call to action
 * 4. Notifies admin team of escalation
 * 5. Updates invoice status to OVERDUE
 * 6. Logs escalation timestamp
 *
 * Email Recipients:
 * - Client: escalation@client.email
 * - Admin: configured in ADMIN_EMAILS env variable
 *
 * Invoice Status Changes:
 * - Before: OUTSTANDING, PAYMENT_PENDING
 * - After: OVERDUE
 * - Additional field: escalatedAt timestamp
 *
 * Returns:
 * {
 *   "status": 200,
 *   "message": "Overdue invoices escalated: X escalated, Y failed",
 *   "data": {
 *     "escalationsQueued": number,
 *     "escalationsSent": number,
 *     "escalationsFailed": number,
 *     "invoicesEscalated": number,
 *     "clientsEscalated": number
 *   }
 * }
 */
