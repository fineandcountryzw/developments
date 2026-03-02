/**
 * Email Queue Service
 * 
 * Provides a simple queue mechanism for failed emails that can be retried later.
 * This is used when email sending fails and needs to be retried via cron job.
 */

import prisma from '@/lib/prisma';

/**
 * Queue an email for retry
 */
export async function queueEmailForRetry(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  retryAfter?: Date;
  context?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { to, subject, html, from, retryAfter, context, metadata } = params;

  try {
    await prisma.$executeRaw`
      INSERT INTO email_queue (id, to_address, subject, html_content, from_address, status, retry_count, retry_after, context, metadata, created_at, updated_at)
      VALUES (
        ${'email-' + Date.now() + '-' + Math.random().toString(36).substring(7)},
        ${to},
        ${subject},
        ${html},
        ${from || 'noreply@fineandcountryerp.com'},
        ${'PENDING'},
        ${0},
        ${retryAfter || new Date(Date.now() + 60 * 60 * 1000)}, -- Default: retry after 1 hour
        ${context || 'general'},
        ${JSON.stringify(metadata || {})},
        ${new Date()},
        ${new Date()}
      )
    `;
    
    console.log('[EMAIL_QUEUE] Queued email for retry:', {
      to,
      subject,
      context,
      retryAfter: retryAfter?.toISOString()
    });
  } catch (error) {
    console.error('[EMAIL_QUEUE] Failed to queue email:', error);
    // Don't throw - just log the error
  }
}

/**
 * Get pending emails for retry
 */
export async function getPendingEmails(limit = 50): Promise<any[]> {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM email_queue 
      WHERE status = 'PENDING' 
        AND (retry_after IS NULL OR retry_after <= NOW())
        AND retry_count < 5
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return result;
  } catch (error) {
    console.error('[EMAIL_QUEUE] Failed to get pending emails:', error);
    return [];
  }
}

/**
 * Mark email as processed (success)
 */
export async function markEmailProcessed(id: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE email_queue 
      SET status = 'SENT', updated_at = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('[EMAIL_QUEUE] Failed to mark email as processed:', error);
  }
}

/**
 * Mark email as failed and increment retry count
 */
export async function markEmailFailed(id: string, error: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE email_queue 
      SET status = CASE 
        WHEN retry_count >= 4 THEN 'FAILED' 
        ELSE 'PENDING' 
      END,
      retry_count = retry_count + 1,
      retry_after = NOW() + (POWER(2, retry_count + 1) * 60 * 1000), -- Exponential backoff
      last_error = ${error},
      updated_at = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('[EMAIL_QUEUE] Failed to mark email as failed:', error);
  }
}

/**
 * Process pending emails in the queue
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  failed: number;
  pending: number;
}> {
  const { sendEmail } = await import('./email-service');
  
  const pendingEmails = await getPendingEmails();
  let processed = 0;
  let failed = 0;

  for (const email of pendingEmails) {
    try {
      await sendEmail({
        to: email.to_address,
        subject: email.subject,
        html: email.html_content,
        from: email.from_address,
      });
      
      await markEmailProcessed(email.id);
      processed++;
    } catch (error) {
      await markEmailFailed(
        email.id, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      failed++;
    }
  }

  const remaining = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count FROM email_queue 
    WHERE status = 'PENDING' AND retry_count < 5
  `;

  return {
    processed,
    failed,
    pending: Number(remaining[0]?.count || 0)
  };
}
