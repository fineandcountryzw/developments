import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    // Support both naming conventions (modal sends email/content, API originally expected recipientEmail/htmlContent)
    const recipientEmail = body.recipientEmail || body.email;
    const subject = body.subject;
    const htmlContent = body.htmlContent || body.content;
    const textContent = body.textContent;

    // Validate inputs
    if (!recipientEmail) {
      return apiError('Recipient email is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!subject) {
      return apiError('Subject is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!htmlContent && !textContent) {
      return apiError('Either HTML or text content is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.info('Sending test email via Resend', {
      module: 'API',
      action: 'POST_PAYMENT_AUTOMATION_TEST_EMAIL',
      to: recipientEmail?.substring(0, 3) + '***',
      subject
    });

    // Send test email via Resend API
    const result = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html: htmlContent || `<p>${textContent || 'This is a test email'}</p>`,
      replyTo: 'accounts@finecountry.co.zw',
    });

    logger.info('Email sent successfully', {
      module: 'API',
      action: 'POST_PAYMENT_AUTOMATION_TEST_EMAIL',
      messageId: result.id,
      recipientEmail: recipientEmail?.substring(0, 3) + '***'
    });

    return apiSuccess({
      messageId: result.id,
      recipientEmail,
      sentAt: new Date().toISOString(),
      message: 'Test email sent successfully'
    });
  } catch (error: any) {
    logger.error('Error sending test email', error, { module: 'API', action: 'POST_PAYMENT_AUTOMATION_TEST_EMAIL' });

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return apiError('Failed to send test email', 500, ErrorCodes.CREATE_ERROR, { details: errorMessage });
  }
}
