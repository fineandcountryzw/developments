import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

/**
 * GET /api/email-tracking/pixel/:trackingId
 * Transparent 1x1 pixel that tracks email opens
 * Called from tracking pixel in email HTML: <img src="/api/email-tracking/pixel/[id]" alt="" />
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ trackingId: string }> }
) {
  try {
    // If tracking is disabled, still return pixel to avoid broken images
    if (EMAIL_DISABLED) {
      return getPixelResponse();
    }
    const { trackingId } = await context.params;
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    // Decode tracking ID (format: base64(paymentLogId|recipientEmail|clientId|action))
    let trackingData;
    try {
      const decoded = Buffer.from(trackingId, 'base64').toString('utf-8');
      const [paymentLogId, recipientEmail, clientId, action, invoiceId, clientName] = decoded.split('|');
      trackingData = { paymentLogId, recipientEmail, clientId, action, invoiceId, clientName };
    } catch (error) {
      // Invalid tracking ID, just return pixel
      return getPixelResponse();
    }

    // Determine device type from user agent
    const deviceType = getDeviceType(userAgent);

    // Check if we already have a record for this email
    const existing = await prisma.emailOpen.findFirst({
      where: {
        paymentLogId: trackingData.paymentLogId,
        recipientEmail: trackingData.recipientEmail,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.emailOpen.update({
        where: { id: existing.id },
        data: {
          openCount: existing.openCount + 1,
          lastOpenedAt: new Date(),
          deviceType: deviceType || existing.deviceType,
          userAgent: userAgent.slice(0, 500),
          ipAddress: ipAddress.slice(0, 100),
        },
      });
    } else {
      // Create new record
      await prisma.emailOpen.create({
        data: {
          paymentLogId: trackingData.paymentLogId,
          recipientEmail: trackingData.recipientEmail,
          clientId: trackingData.clientId,
          invoiceId: trackingData.invoiceId || null,
          action: trackingData.action,
          clientName: trackingData.clientName || null,
          openCount: 1,
          deviceType,
          userAgent: userAgent.slice(0, 500),
          ipAddress: ipAddress.slice(0, 100),
          firstOpenedAt: new Date(),
          lastOpenedAt: new Date(),
          branch: 'Harare', // Could be extracted from tracking data
        },
      });
    }

    return getPixelResponse();
  } catch (error: any) {
    logger.error('Error tracking email open', error, { module: 'API', action: 'GET_EMAIL_TRACKING_PIXEL' });
    // Return pixel even on error to avoid breaking email
    return getPixelResponse();
  }
}

function getDeviceType(userAgent: string): string | null {
  const ua = userAgent.toLowerCase();

  // Mobile
  if (
    /mobile|android|iphone|ipad|phone|blackberry|windows phone|webos/.test(ua)
  ) {
    return 'mobile';
  }

  // Tablet
  if (/tablet|ipad|kindle|playbook|nexus/.test(ua)) {
    return 'tablet';
  }

  // Desktop
  if (/windows|macintosh|linux|x11/.test(ua)) {
    return 'desktop';
  }

  return null;
}

function getPixelResponse(): Response {
  // Return a 1x1 transparent GIF pixel
  const pixel = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff,
    0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a, 0x00, 0x01, 0x00, 0x2c, 0x00, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
