import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
const EMAIL_DISABLED = process.env.EMAIL_FEATURE_ENABLED !== 'true';

/**
 * GET /api/email-tracking/click
 * Tracks email link clicks and redirects to original URL
 * Query params: t (tracking data), u (encoded URL)
 */
export async function GET(request: NextRequest) {
  try {
    // If email tracking is disabled, just redirect to target URL sans tracking
    if (EMAIL_DISABLED) {
      const { searchParams } = new URL(request.url);
      const redirectUrl = searchParams.get('u') || '/';
      try {
        const decoded = decodeURIComponent(redirectUrl);
        return NextResponse.redirect(decoded);
      } catch {
        return NextResponse.redirect(redirectUrl);
      }
    }
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get('t');
    const redirectUrl = searchParams.get('u');
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    if (!trackingId || !redirectUrl) {
      return NextResponse.json({ error: 'Missing tracking data' }, { status: 400 });
    }

    // Decode tracking ID
    let trackingData;
    try {
      const decoded = Buffer.from(trackingId, 'base64').toString('utf-8');
      const [paymentLogId, recipientEmail, clientId, action, invoiceId, clientName] = decoded.split('|');
      trackingData = { paymentLogId, recipientEmail, clientId, action, invoiceId, clientName };
    } catch (error) {
      // Invalid tracking ID, just redirect
      return NextResponse.redirect(decodeURIComponent(redirectUrl));
    }

    // Decode redirect URL
    let finalUrl: string;
    try {
      finalUrl = decodeURIComponent(redirectUrl);
    } catch {
      finalUrl = redirectUrl;
    }

    // Determine device type
    const deviceType = getDeviceType(userAgent);

    // Check if we already have a record for this link
    const existing = await prisma.emailClick.findFirst({
      where: {
        paymentLogId: trackingData.paymentLogId,
        recipientEmail: trackingData.recipientEmail,
        linkUrl: finalUrl,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.emailClick.update({
        where: { id: existing.id },
        data: {
          clickCount: existing.clickCount + 1,
          lastClickedAt: new Date(),
          deviceType: deviceType || existing.deviceType,
          userAgent: userAgent.slice(0, 500),
          ipAddress: ipAddress.slice(0, 100),
        },
      });
    } else {
      // Create new record
      await prisma.emailClick.create({
        data: {
          paymentLogId: trackingData.paymentLogId,
          recipientEmail: trackingData.recipientEmail,
          clientId: trackingData.clientId,
          invoiceId: trackingData.invoiceId || null,
          action: trackingData.action,
          clientName: trackingData.clientName || null,
          linkUrl: finalUrl,
          linkText: extractLinkText(finalUrl),
          clickCount: 1,
          deviceType,
          userAgent: userAgent.slice(0, 500),
          ipAddress: ipAddress.slice(0, 100),
          firstClickedAt: new Date(),
          lastClickedAt: new Date(),
          branch: 'Harare',
        },
      });
    }

    // Redirect to original URL
    return NextResponse.redirect(finalUrl);
  } catch (error: any) {
    logger.error('Error tracking email click', error, { module: 'API', action: 'GET_EMAIL_TRACKING_CLICK' });
    // Redirect anyway to avoid breaking user experience
    const redirectUrl = new URL(request.url).searchParams.get('u');
    return NextResponse.redirect(redirectUrl || '/');
  }
}

function getDeviceType(userAgent: string): string | null {
  const ua = userAgent.toLowerCase();

  if (/mobile|android|iphone|phone|blackberry|windows phone|webos/.test(ua)) {
    return 'mobile';
  }

  if (/tablet|ipad|kindle|playbook|nexus/.test(ua)) {
    return 'tablet';
  }

  if (/windows|macintosh|linux|x11/.test(ua)) {
    return 'desktop';
  }

  return null;
}

function extractLinkText(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url.slice(0, 100);
  }
}
