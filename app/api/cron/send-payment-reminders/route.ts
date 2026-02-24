import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generatePaymentReminderHTML, generatePaymentReminderText } from '@/app/lib/email-templates/payment-reminder';
import { addTrackingToEmailContent } from '@/lib/email-tracking';
import { sendEmail } from '@/lib/email-service';
import { processScheduledAutomations, getCurrentCronExpression } from '@/lib/automation/scheduler';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Using Resend API via sendEmail from lib/email-service
// Removed nodemailer SMTP configuration - now using centralized Resend service

interface RemindableInvoice {
  clientId: string;
  totalAmount: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `send-reminders-${Date.now()}`;
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

    logger.info('Starting payment reminder job', { module: 'CRON', action: 'SEND_PAYMENT_REMINDERS', correlationId });

    // Process scheduled automations first (new system)
    const currentCron = getCurrentCronExpression();
    await processScheduledAutomations('0 9 5,20 * *').catch(err => {
      logger.error('Scheduled automation processing failed', err, { module: 'CRON', action: 'SEND_PAYMENT_REMINDERS', correlationId });
    });

    // Legacy: Continue with direct processing for backward compatibility
    // This can be removed once all automations are migrated
    // Get all clients with outstanding invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['OUTSTANDING', 'PAYMENT_PENDING'] as any[],
        },
        reminderSentAt: null, // Only send to those who haven't received reminder this month
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch clients for the invoices
    const allClientIds = [...new Set(invoices.map(inv => inv.clientId))];
    const allClients = await prisma.client.findMany({
      where: { id: { in: allClientIds } }
    });
    const clientMap = new Map(allClients.map(c => [c.id, c]));

    logger.info('Found invoices requiring reminders', {
      module: 'CRON',
      action: 'SEND_PAYMENT_REMINDERS',
      correlationId,
      count: invoices.length
    });

    // Group invoices by client
    const invoicesByClient = new Map<
      string,
      (typeof invoices)[0][]
    >();

    for (const invoice of invoices) {
      if (!invoicesByClient.has(invoice.clientId)) {
        invoicesByClient.set(invoice.clientId, []);
      }
      invoicesByClient.get(invoice.clientId)!.push(invoice);
    }

    let remindersQueued = 0;
    let remindersSent = 0;
    let remindersFailed = 0;
    const failureDetails: Array<{ clientId: string; error: string }> = [];

    // Send reminders to each client
    for (const [clientId, clientInvoices] of invoicesByClient.entries()) {
      try {
        const client = clientMap.get(clientId);
        if (!client) {
          logger.warn('Client not found for invoice', { clientId, correlationId });
          continue;
        }

        // Calculate total outstanding
        const totalOutstanding = clientInvoices.reduce(
          (sum, inv) => sum + Number(inv.totalAmount || 0),
          0
        );

        // Calculate days overdue
        const oldestInvoice = clientInvoices.reduce((oldest, current) =>
          new Date(current.dueDate) < new Date(oldest.dueDate) ? current : oldest
        );
        const daysOverdue = Math.max(
          0,
          Math.floor(
            (new Date().getTime() - new Date(oldestInvoice.dueDate).getTime()) /
            (1000 * 60 * 60 * 24)
          )
        );

        // Prepare payment methods
        const paymentMethods = [
          {
            method: 'Bank Transfer',
            account: 'Fine & Country Zimbabwe Ltd',
            reference: `INV-${client.id}`,
          },
          {
            method: 'Mobile Money',
            account: 'Ecocash: +263 77 123 4567',
          },
          {
            method: 'Direct Deposit',
            account: 'Contact accounts@finecountry.co.zw for details',
          },
        ];

        remindersQueued++;

        // Generate email content
        const htmlContent = generatePaymentReminderHTML({
          client,
          invoices: clientInvoices,
          totalOutstanding,
          daysOverdue,
          paymentMethods,
        });

        const textContent = generatePaymentReminderText({
          client,
          invoices: clientInvoices,
          totalOutstanding,
          daysOverdue,
          paymentMethods,
        });

        // Add tracking to email (Phase 5B integration)
        const paymentLogId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const trackedHtmlContent = addTrackingToEmailContent(
          htmlContent,
          paymentLogId,
          client.email,
          client.id,
          'REMINDER',
          clientInvoices[0]?.id,
          `${client.firstName} ${client.lastName}`
        );

        // Send email via Resend API
        await sendEmail({
          to: client.email,
          subject: `Payment Reminder: Outstanding Balance of $${totalOutstanding.toFixed(2)}`,
          html: trackedHtmlContent,
          replyTo: process.env.SMTP_REPLY_TO || 'accounts@finecountry.co.zw',
        });

        remindersSent++;

        // Log the reminder for tracking
        await prisma.paymentAutomationLog.create({
          data: {
            invoiceId: clientInvoices[0].id,
            clientId: client.id,
            action: 'REMINDER_SENT',
            emailStatus: 'SENT',
            subject: `Payment Reminder: Outstanding Balance of $${totalOutstanding.toFixed(2)}`,
            recipientEmail: client.email,
            metadata: {
              totalOutstanding,
              daysOverdue,
              invoiceCount: clientInvoices.length,
              paymentLogId,
            },
            branch: client.branch || 'Harare',
          },
        });

        // Update invoice reminder status
        await prisma.invoice.updateMany({
          where: { id: { in: clientInvoices.map((inv) => inv.id) } },
          data: {
            reminderSentAt: new Date(),
            reminderStatus: 'SENT',
          }
        });

        logger.info('Reminder sent', {
          module: 'CRON',
          action: 'SEND_PAYMENT_REMINDERS',
          correlationId,
          clientEmail: client.email?.substring(0, 3) + '***',
          invoiceCount: clientInvoices.length
        });
      } catch (error: any) {
        remindersFailed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        failureDetails.push({ clientId, error: errorMessage });
        logger.error('Failed to send reminder to client', error, {
          module: 'CRON',
          action: 'SEND_PAYMENT_REMINDERS',
          correlationId,
          clientId
        });
      }
    }

    const executionTime = Date.now() - startTime;

    const response = {
      status: 200,
      message: `Payment reminders processed: ${remindersSent} sent, ${remindersFailed} failed`,
      timestamp: new Date().toISOString(),
      correlationId,
      executionTimeMs: executionTime,
      data: {
        remindersQueued,
        remindersSent,
        remindersFailed,
        invoicesProcessed: invoices.length,
        clientsProcessed: invoicesByClient.size,
        details: failureDetails.length > 0 ? failureDetails : [],
      },
    };

    return NextResponse.json(response, {
      status: remindersFailed === 0 ? 200 : 207,
    });
  } catch (error: any) {
    logger.error('Cron job failed', error, {
      module: 'CRON',
      action: 'SEND_PAYMENT_REMINDERS',
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

// Configuration for cron job
export const runtime = 'nodejs';

/**
 * CRON SCHEDULE CONFIGURATION
 *
 * Runs: 5th and 20th of each month at 09:00 UTC
 *
 * Cron Job Setup (cron-job.org):
 * - URL: https://erp.finecountry.co.zw/api/cron/send-payment-reminders
 * - Method: POST
 * - Headers: Authorization: Bearer {CRON_SECRET}
 * - Schedule: 0 9 5,20 * * (5th and 20th at 09:00 UTC)
 *
 * What it does:
 * 1. Finds all invoices with OUTSTANDING or PAYMENT_PENDING status
 * 2. Groups invoices by client
 * 3. Generates personalized reminder emails with:
 *    - Client name and invoice details
 *    - Total outstanding amount
 *    - Days overdue (if applicable)
 *    - Payment method options
 * 4. Sends HTML and plain text emails via SMTP
 * 5. Updates invoices with reminderSentAt timestamp and reminderStatus: SENT
 * 6. Logs all activities with correlation ID for tracking
 *
 * Email Features:
 * - Professional HTML template with brand colors
 * - Plain text fallback for compatibility
 * - Payment method instructions
 * - Dashboard link for quick payment
 * - Contact information for support
 *
 * Returns:
 * {
 *   "status": 200,
 *   "message": "Payment reminders processed: X sent, Y failed",
 *   "data": {
 *     "remindersQueued": number,
 *     "remindersSent": number,
 *     "remindersFailed": number,
 *     "invoicesProcessed": number,
 *     "clientsProcessed": number,
 *     "details": [failed reminder details]
 *   }
 * }
 */
