/**
 * Pusher Authentication Endpoint
 * 
 * Handles authentication for private channels using Pusher's authentication mechanism.
 * Validates user session and role before issuing channel access token.
 * 
 * @module app/api/pusher/auth/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { pusherServer } from '@/lib/pusher';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pusher/auth
 * Authenticate user for private channel access
 * 
 * Body: {
 *   socket_id: string,
 *   channel_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn('Pusher auth failed - No session', {
        module: 'PUSHER',
        action: 'AUTH',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { socket_id, channel_name } = await request.json();
    
    if (!socket_id || !channel_name) {
      logger.warn('Pusher auth failed - Missing required fields', {
        module: 'PUSHER',
        action: 'AUTH',
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate channel access based on channel name
    const accessGranted = await validateChannelAccess(
      session.user.id,
      session.user.role,
      channel_name
    );

    if (!accessGranted) {
      logger.warn('Pusher auth failed - Access denied', {
        module: 'PUSHER',
        action: 'AUTH',
        userId: session.user.id,
        role: session.user.role,
        channelName: channel_name,
      });
      return NextResponse.json(
        { error: 'Channel access denied' },
        { status: 403 }
      );
    }

    // Generate authentication signature
    const authResponse = pusherServer.authenticate(socket_id, channel_name);
    
    logger.info('Pusher auth successful', {
      module: 'PUSHER',
      action: 'AUTH',
      userId: session.user.id,
      role: session.user.role,
      channelName: channel_name,
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    logger.error('Pusher auth error', error as Error, {
      module: 'PUSHER',
      action: 'AUTH_ERROR',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate channel access based on channel type and user permissions
 */
async function validateChannelAccess(
  userId: string,
  userRole: string,
  channelName: string
): Promise<boolean> {
  // Validate user-specific channels: private-user-<userId>
  const userChannelMatch = channelName.match(/^private-user-(\w+)$/);
  if (userChannelMatch) {
    const targetUserId = userChannelMatch[1];
    return userId === targetUserId;
  }

  // Validate development-specific channels: private-dev-<developmentId>
  const devChannelMatch = channelName.match(/^private-dev-(\w+)$/);
  if (devChannelMatch) {
    const developmentId = devChannelMatch[1];
    return await validateDevelopmentAccess(userId, userRole, developmentId);
  }

  // Validate role-specific channels
  if (channelName === 'private-admin') {
    return userRole === 'ADMIN' || userRole === 'MANAGER';
  }

  if (channelName === 'private-accounts') {
    return userRole === 'ACCOUNT';
  }

  if (channelName === 'private-agents') {
    return userRole === 'AGENT';
  }

  logger.warn('Unknown channel type', {
    module: 'PUSHER',
    action: 'VALIDATION',
    channelName,
    userId,
    role: userRole,
  });

  return false;
}

/**
 * Validate if user has access to a development-specific channel
 */
async function validateDevelopmentAccess(
  userId: string,
  userRole: string,
  developmentId: string
): Promise<boolean> {
  // ADMIN and MANAGER roles have access to all developments
  if (userRole === 'ADMIN' || userRole === 'MANAGER') {
    return true;
  }

  // DEVELOPER role can access their own developments
  if (userRole === 'DEVELOPER') {
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { developerEmail: true },
    });

    if (!development?.developerEmail) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    return user?.email === development.developerEmail;
  }

  // AGENT role can access developments where they have clients/leads
  if (userRole === 'AGENT') {
    const hasAccess = await prisma.reservation.findFirst({
      where: {
        agentId: userId,
        stand: { developmentId },
      },
      select: { id: true },
    });

    return !!hasAccess;
  }

  // CLIENT role can access developments where they have stands/reservations
  if (userRole === 'CLIENT') {
    const hasAccess = await prisma.reservation.findFirst({
      where: {
        userId,
        stand: { developmentId },
      },
      select: { id: true },
    });

    return !!hasAccess;
  }

  return false;
}
