/**
 * Email Tracking Utilities
 * Functions for creating tracking pixels and tracked links in email templates
 */

/**
 * Creates a tracking pixel URL for email opens
 * @param paymentLogId - ID of the payment automation log
 * @param recipientEmail - Email address of recipient
 * @param clientId - Client ID
 * @param action - Action type (REMINDER | ESCALATION | FOLLOWUP)
 * @param invoiceId - Optional invoice ID
 * @param clientName - Optional client name
 * @returns Tracking pixel HTML or URL
 */
export function createTrackingPixel(
  paymentLogId: string,
  recipientEmail: string,
  clientId: string,
  action: string,
  invoiceId?: string,
  clientName?: string
): string {
  const trackingData = `${paymentLogId}|${recipientEmail}|${clientId}|${action}|${invoiceId || ''}|${clientName || ''}`;
  const encoded = Buffer.from(trackingData).toString('base64');
  const pixelUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/email-tracking/pixel/${encoded}`;

  return `<img src="${pixelUrl}" alt="" width="1" height="1" border="0" style="display:none;" />`;
}

/**
 * Creates a tracked link for email clicks
 * @param originalUrl - Original URL to redirect to
 * @param paymentLogId - ID of the payment automation log
 * @param recipientEmail - Email address of recipient
 * @param clientId - Client ID
 * @param action - Action type
 * @param invoiceId - Optional invoice ID
 * @param clientName - Optional client name
 * @returns Tracked URL that records clicks before redirecting
 */
export function createTrackedLink(
  originalUrl: string,
  paymentLogId: string,
  recipientEmail: string,
  clientId: string,
  action: string,
  invoiceId?: string,
  clientName?: string
): string {
  const trackingData = `${paymentLogId}|${recipientEmail}|${clientId}|${action}|${invoiceId || ''}|${clientName || ''}`;
  const encoded = Buffer.from(trackingData).toString('base64');
  const encodedUrl = encodeURIComponent(originalUrl);
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  return `${baseUrl}/api/email-tracking/click?t=${encoded}&u=${encodedUrl}`;
}

/**
 * Replaces links in HTML email with tracked links
 * @param htmlContent - HTML email content
 * @param paymentLogId - ID of the payment automation log
 * @param recipientEmail - Email address of recipient
 * @param clientId - Client ID
 * @param action - Action type
 * @param invoiceId - Optional invoice ID
 * @param clientName - Optional client name
 * @returns HTML with tracked links
 */
export function addTrackingToEmailContent(
  htmlContent: string,
  paymentLogId: string,
  recipientEmail: string,
  clientId: string,
  action: string,
  invoiceId?: string,
  clientName?: string
): string {
  // Find all href links
  const linkRegex = /href=['"]([^'"]+)['"]/g;
  let tracked = htmlContent;

  tracked = tracked.replace(linkRegex, (match, url) => {
    // Skip mailto, tel, and already-tracked links
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/api/email-tracking/')) {
      return match;
    }

    const trackedUrl = createTrackedLink(
      url,
      paymentLogId,
      recipientEmail,
      clientId,
      action,
      invoiceId,
      clientName
    );

    return `href="${trackedUrl}"`;
  });

  // Add tracking pixel at the end of the email (before closing body or at end)
  const pixel = createTrackingPixel(
    paymentLogId,
    recipientEmail,
    clientId,
    action,
    invoiceId,
    clientName
  );

  // Insert before closing body tag if exists, otherwise append
  if (tracked.includes('</body>')) {
    tracked = tracked.replace('</body>', `${pixel}</body>`);
  } else {
    tracked = tracked + pixel;
  }

  return tracked;
}

/**
 * Formats analytics data for display
 */
export function formatAnalyticsNumber(value: number, decimals = 2): string {
  if (value < 1000) {
    return value.toString();
  } else if (value < 1000000) {
    return (value / 1000).toFixed(decimals) + 'K';
  } else {
    return (value / 1000000).toFixed(decimals) + 'M';
  }
}

/**
 * Calculates engagement rate percentage
 */
export function calculateEngagementRate(
  totalSent: number,
  totalOpened: number,
  totalClicked: number
): { openRate: number; clickRate: number } {
  return {
    openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
  };
}

/**
 * Converts date range to SQL format
 */
export function formatDateRange(startDate: Date, endDate: Date) {
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}
