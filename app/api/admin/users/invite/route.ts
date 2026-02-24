import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendInvitationEmail } from '@/lib/email-service';
import { validateRequest } from '@/lib/validation/middleware';
import { userInviteSchema } from '@/lib/validation/schemas';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Generate a unique invitation token
 * Uses crypto.randomBytes for security
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash invitation token before storage
 */
function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/admin/users/invite called', { module: 'API', action: 'POST_USER_INVITE' });
    
    // Use requireAdmin for consistent auth
    const authResult = await requireAdmin(request, { limit: 5, windowMs: 60000 });
    if ('error' in authResult) {
      logger.warn('Admin auth failed for user invite', { module: 'API', action: 'POST_USER_INVITE' });
      return authResult.error;
    }
    
    const { user } = authResult;
    logger.debug('Admin verified', { module: 'API', action: 'POST_USER_INVITE', adminEmail: user.email, role: user.role });

    // Validate request body
    const validation = await validateRequest(request, userInviteSchema, {
      module: 'API',
      action: 'POST_USER_INVITE'
    });
    if (!validation.success) {
      return validation.error;
    }
    const body = validation.data;
    
    // Support both single email and multiple emails
    const emailList = body.emails || (body.email ? [body.email] : []);
    const { role, branch, fullName, name } = body;
    
    logger.debug('Invitation request', { module: 'API', action: 'POST_USER_INVITE', 
      emailCount: emailList.length, 
      role, 
      branch, 
      invitedBy: user.email 
    });

    // Check for existing users
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emailList } },
      select: { email: true }
    });

    if (existingUsers.length > 0) {
      const existingEmails = existingUsers.map(u => u.email);
      logger.warn('Users already exist', { module: 'API', action: 'POST_USER_INVITE', existingEmails });
      return apiError(
        `Users with these emails already exist: ${existingEmails.join(', ')}`,
        409,
        ErrorCodes.CONFLICT,
        { existingEmails }
      );
    }

    // Check for pending invitations
    const existingInvitations = await prisma.invitation.findMany({
      where: { 
        email: { in: emailList },
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      select: { email: true }
    });

    if (existingInvitations.length > 0) {
      const pendingEmails = existingInvitations.map(i => i.email);
      logger.warn('Pending invitations exist', { module: 'API', action: 'POST_USER_INVITE', pendingEmails });
      return apiError(
        `Pending invitations already exist for: ${pendingEmails.join(', ')}`,
        409,
        ErrorCodes.PENDING_INVITATION,
        { pendingEmails }
      );
    }

    // Create invitations for all emails
    interface InviteResult {
      email: string;
      invitationId?: string;
      error?: string;
    }
    const results = {
      successful: [] as (InviteResult & {
        id: string;
        role: string;
        branch: string;
        status: string;
        expiresAt: Date;
        createdAt: Date;
        emailSent: boolean;
        emailError?: string;
      })[],
      failed: [] as InviteResult[]
    };

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    for (const inviteEmail of emailList) {
      try {
        // Generate unique token
        const invitationToken = generateInviteToken();
        
        logger.debug('Creating invitation', {
          module: 'API',
          action: 'POST_USER_INVITE',
          email: inviteEmail,
          tokenPrefix: invitationToken.substring(0, 8)
        });

        // Create invitation record
        const invitation = await prisma.invitation.create({
          data: {
            email: inviteEmail,
            role: role as 'ADMIN' | 'MANAGER' | 'AGENT' | 'ACCOUNT' | 'CLIENT',
            branch,
            invitedBy: user.id,
            token: hashInviteToken(invitationToken),
            expiresAt,
            fullName: fullName || inviteEmail.split('@')[0],
            status: 'PENDING',
          }
        });

        logger.info('Invitation created', {
          module: 'API',
          action: 'POST_USER_INVITE',
          invitationId: invitation.id,
          email: inviteEmail
        });

        // Send invitation email
        let emailSent = false;
        let emailError: string | undefined;
        const emailAttemptTime = new Date();
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.fineandcountryerp.com';
          await sendInvitationEmail({
            email: inviteEmail,
            fullName: fullName || inviteEmail.split('@')[0],
            role,
            branch,
            invitationLink: `${baseUrl}/accept-invitation?token=${invitationToken}`,
            invitedByName: user.email,
          });
          emailSent = true;
          logger.info('Invitation email sent', { module: 'API', action: 'POST_USER_INVITE', email: inviteEmail });
          
          // Update invitation with email tracking
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              emailSentAt: emailAttemptTime,
              emailAttempts: 1,
              lastEmailAttempt: emailAttemptTime,
            }
          });
        } catch (emailErr: any) {
          emailError = emailErr?.message || 'Email send failed';
          logger.error('Email send failed', emailErr, { module: 'API', action: 'POST_USER_INVITE', email: inviteEmail });
          
          // Update invitation with failure tracking
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              emailFailedAt: emailAttemptTime,
              emailFailureReason: emailError,
              emailAttempts: 1,
              lastEmailAttempt: emailAttemptTime,
            }
          });
          // Don't fail - invitation was created successfully
        }

        // Create audit trail
        await prisma.auditTrail.create({
          data: {
            action: 'USER_INVITED',
            resourceType: 'INVITATION',
            resourceId: invitation.id,
            userId: user.id,
            details: {
              email: inviteEmail,
              role,
              branch,
              tokenPrefix: invitationToken.substring(0, 8) + '...',
              expiresAt: expiresAt.toISOString(),
              emailSent,
              emailError: emailError || null,
            },
            branch
          }
        });

        results.successful.push({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          branch: invitation.branch,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          emailSent,
          emailError,
        });

      } catch (inviteError: any) {
        logger.error('Invitation creation failed', inviteError, { module: 'API', action: 'POST_USER_INVITE', email: inviteEmail });
        results.failed.push({
          email: inviteEmail,
          error: inviteError?.message || 'Failed to create invitation'
        });
      }
    }

    logger.info('Invitation batch complete', { 
      module: 'API', 
      action: 'POST_USER_INVITE',
      successful: results.successful.length, 
      failed: results.failed.length 
    });

    return apiSuccess(
      {
        invitations: results.successful,
        failed: results.failed,
        message: `${results.successful.length} invitation(s) sent successfully${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`
      },
      201
    );

  } catch (error: any) {
    logger.error('Invitation error', error, { module: 'API', action: 'POST_USER_INVITE' });
    return apiError(
      error?.message || 'Failed to send invitation',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// Get pending invitations
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/admin/users/invite called', { module: 'API', action: 'GET_USER_INVITE' });
    
    // Use requireAdmin for consistent auth
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      logger.warn('Admin auth failed for GET user invite', { module: 'API', action: 'GET_USER_INVITE' });
      return authResult.error;
    }
    
    const { user } = authResult;
    logger.debug('Admin verified for GET', { module: 'API', action: 'GET_USER_INVITE',
      email: user.email,
      role: user.role
    });

    // Get branch filter from query params
    const branch = request.nextUrl.searchParams.get('branch');
    const status = request.nextUrl.searchParams.get('status');

    const where: any = {};
    
    if (branch) {
      where.branch = branch;
    }
    
    if (status) {
      where.status = status;
    } else {
      // Default: show all PENDING (including expired), ACCEPTED, and REVOKED
      // Admins need to see expired invitations to delete them
      where.status = { in: ['PENDING', 'ACCEPTED', 'REVOKED'] };
    }

    logger.debug('Fetching invitations', { module: 'API', action: 'GET_USER_INVITE', branch, status });

    const invitations = await prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Fetch inviter details separately (invitedBy is just a user ID string)
    const inviterIds = Array.from(new Set(invitations.map(inv => inv.invitedBy).filter(Boolean)));
    const inviters = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, email: true, name: true }
    });
    const inviterMap = new Map(inviters.map(u => [u.id, u]));

    // Transform for frontend - compute expired status for PENDING invitations
    const now = new Date();
    const transformedInvitations = invitations.map(inv => {
      // If PENDING but expired, mark as EXPIRED for UI
      const isExpired = inv.status === 'PENDING' && inv.expiresAt < now;
      return {
        id: inv.id,
        email: inv.email,
        fullName: inv.fullName,
        role: inv.role,
        branch: inv.branch,
        status: isExpired ? 'EXPIRED' : inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString(),
        invitedBy: inviterMap.get(inv.invitedBy) ? {
          email: inviterMap.get(inv.invitedBy)!.email,
          name: inviterMap.get(inv.invitedBy)!.name
        } : null
      };
    });

    logger.debug('Invitations retrieved', { module: 'API', action: 'GET_USER_INVITE', count: invitations.length });

    return apiSuccess({
      invitations: transformedInvitations,
      count: transformedInvitations.length
    });

  } catch (error: any) {
    logger.error('Get invitations error', error, { module: 'API', action: 'GET_USER_INVITE' });
    return apiError(
      error?.message || 'Failed to fetch invitations',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
