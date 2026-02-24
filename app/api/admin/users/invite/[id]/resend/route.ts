import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendInvitationEmail } from '@/lib/email-service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Generate a unique invitation token
 * Uses crypto.randomBytes for security (256 bits entropy)
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash invitation token before storage
 * Tokens are never stored in plaintext
 */
function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/admin/users/invite/[id]/resend
 * Resend invitation email. Only for PENDING, non-expired invitations.
 * Optionally extends expiresAt by 7 days.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let invitationId = '';
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const { id } = await params;
    invitationId = id;
    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot resend: invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    // Allow resending expired invitations - will extend expiry
    const wasExpired = invitation.expiresAt < new Date();

    // CRITICAL: Generate a NEW token for resend
    // The stored token is a hash - we cannot reverse it to get plaintext
    // We must generate fresh token, hash for storage, send plaintext in email
    const newPlaintextToken = generateInviteToken();
    const newTokenHash = hashInviteToken(newPlaintextToken);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://www.fineandcountryerp.com';
    const invitationLink = `${baseUrl}/accept-invitation?token=${newPlaintextToken}`;

    // Extend expiry by 7 days on resend (or renew if expired)
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const emailAttemptTime = new Date();

    // Update invitation with new token hash and expiry BEFORE sending email
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { 
        token: newTokenHash,
        expiresAt: newExpiresAt, 
        updatedAt: new Date(),
        emailAttempts: { increment: 1 },
        lastEmailAttempt: emailAttemptTime,
      }
    });

    // Send email with NEW plaintext token
    let emailSent = false;
    let emailError: string | undefined;
    try {
      await sendInvitationEmail({
        email: invitation.email,
        fullName: invitation.fullName || invitation.email.split('@')[0],
        role: invitation.role,
        branch: invitation.branch,
        invitationLink,
        invitedByName: user.email,
      });
      emailSent = true;
      
      // Update email success tracking
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { 
          emailSentAt: emailAttemptTime,
          emailFailedAt: null,
          emailFailureReason: null,
        }
      });
    } catch (err: any) {
      emailError = err?.message || 'Email send failed';
      logger.error('Resend email failed', err, { 
        module: 'API', 
        action: 'RESEND_INVITATION', 
        invitationId,
        email: invitation.email 
      });
      
      // Update email failure tracking
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { 
          emailFailedAt: emailAttemptTime,
          emailFailureReason: emailError,
        }
      });
    }

    await prisma.auditTrail.create({
      data: {
        action: wasExpired ? 'INVITATION_RENEWED' : 'INVITATION_RESENT',
        resourceType: 'INVITATION',
        resourceId: invitationId,
        userId: user.id,
        details: {
          email: invitation.email,
          role: invitation.role,
          branch: invitation.branch,
          previousExpiresAt: invitation.expiresAt.toISOString(),
          newExpiresAt: newExpiresAt.toISOString(),
          wasExpired,
          tokenRegenerated: true,
          emailSent,
          emailError: emailError || null,
        },
        branch: invitation.branch,
      },
    });

    return NextResponse.json({
      success: true,
      message: wasExpired ? 'Expired invitation renewed and email sent' : 'Invitation email resent',
      expiresAt: newExpiresAt.toISOString(),
      wasExpired,
      emailSent,
      emailError: emailError || null,
    });
  } catch (error: any) {
    logger.error('Resend invitation error', error, { module: 'API', action: 'RESEND_INVITATION', invitationId: invitationId });
    return NextResponse.json(
      { error: error?.message || 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
