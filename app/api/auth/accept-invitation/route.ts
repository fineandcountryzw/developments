import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json();

    logger.info('Accepting invitation', { module: 'AUTH', action: 'ACCEPT_INVITATION', tokenPrefix: token?.substring(0, 10) });

    // Validate input
    if (!token) {
      return apiError('Invitation token is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!password || !confirmPassword) {
      return apiError('Password and confirmation are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (password !== confirmPassword) {
      return apiError('Passwords do not match', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (password.length < 8) {
      return apiError('Password must be at least 8 characters long', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Find invitation by token
    const tokenHash = hashInviteToken(token);
    let invitation = await prisma.invitation.findUnique({
      where: { token: tokenHash }
    });

    if (!invitation) {
      // Backward compatibility: try legacy plaintext token
      invitation = await prisma.invitation.findUnique({
        where: { token }
      });
    }

    if (!invitation) {
      logger.warn('Invitation not found', { module: 'AUTH', action: 'ACCEPT_INVITATION', tokenPrefix: token?.substring(0, 10) });
      return apiError('Invalid invitation token', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      logger.warn('Invitation expired', { module: 'AUTH', action: 'ACCEPT_INVITATION', email: invitation.email });
      return apiError('Invitation has expired. Please request a new invitation.', 410, ErrorCodes.EXPIRED);
    }

    // Check if already accepted
    if (invitation.status === 'ACCEPTED') {
      logger.warn('Invitation already accepted', { module: 'AUTH', action: 'ACCEPT_INVITATION', email: invitation.email });
      return apiError('This invitation has already been accepted', 400, ErrorCodes.CONFLICT);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (existingUser) {
      logger.warn('User already exists', { module: 'AUTH', action: 'ACCEPT_INVITATION', email: invitation.email });
      return apiError('User account already exists with this email', 409, ErrorCodes.CONFLICT);
    }

    // Hash the password
    const hashedPassword = await hash(password, 12);
    logger.debug('Password hashed for new user', { module: 'AUTH', action: 'ACCEPT_INVITATION' });

    // Create user account with hashed password
    const newUser = await prisma.user.create({
      data: {
        email: invitation.email,
        name: invitation.fullName || invitation.email.split('@')[0],
        password: hashedPassword,
        passwordChangedAt: new Date(),
        role: invitation.role as any,
        branch: invitation.branch,
        isActive: true,
        lastLogin: new Date()
      }
    });

    logger.info('User account created from invitation', {
      module: 'AUTH',
      action: 'ACCEPT_INVITATION',
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // Mark invitation as accepted
    const invalidatedToken = hashInviteToken(crypto.randomBytes(32).toString('hex'));
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        token: invalidatedToken
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: 'USER_ACCOUNT_CREATED',
        resourceType: 'USER',
        resourceId: newUser.id,
        userId: newUser.id,
        details: {
          email: newUser.email,
          role: newUser.role,
          branch: newUser.branch,
          method: 'invitation_acceptance'
        },
        branch: newUser.branch
      }
    });

    // Create welcome session/token (if using custom session)
    // In production, this would be handled by your auth provider

    return apiSuccess({
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        branch: newUser.branch
      }
    }, 201);

  } catch (error: any) {
    logger.error('Invitation acceptance error', error, { module: 'AUTH', action: 'ACCEPT_INVITATION' });
    return apiError(
      error?.message || 'Failed to accept invitation',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

// GET endpoint to validate invitation
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const tokenHash = hashInviteToken(token);
    let invitation = await prisma.invitation.findUnique({
      where: { token: tokenHash },
      select: {
        id: true,
        email: true,
        role: true,
        branch: true,
        fullName: true,
        status: true,
        expiresAt: true,
        createdAt: true
      }
    });

    if (!invitation) {
      // Backward compatibility: try legacy plaintext token
      invitation = await prisma.invitation.findUnique({
        where: { token },
        select: {
          id: true,
          email: true,
          role: true,
          branch: true,
          fullName: true,
          status: true,
          expiresAt: true,
          createdAt: true
        }
      });
    }

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    const isExpired = invitation.expiresAt < new Date();
    const isAccepted = invitation.status === 'ACCEPTED';

    return NextResponse.json({
      invitation: {
        ...invitation,
        isExpired,
        isAccepted,
        daysRemaining: Math.ceil(
          (invitation.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        )
      }
    });

  } catch (error: any) {
    logger.error('Invitation validation error', error, { module: 'AUTH', action: 'VALIDATE_INVITATION' });
    return apiError('Failed to validate invitation', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
