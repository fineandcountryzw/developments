import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import { getDataFilter } from '@/lib/dashboard-permissions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendInvitationEmail } from '@/lib/email-service';
import crypto from 'crypto';

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * GET /api/manager/team
 * Get manager's team members (agents in same branch)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch || 'Harare';

    // Get role-based data filter - ensures managers only see their branch data
    const dataFilter = getDataFilter(user.role, user.id, branch);

    // Get all agents in the branch (role-based filtering)
    const team = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        branch: dataFilter?.branch || branch, // Enforce branch filtering for managers
      },
      select: {
        id: true,
        name: true,
        email: true,
        branch: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    // Get performance metrics for each team member
    const teamWithMetrics = await Promise.all(
      team.map(async (member) => {
        const [totalClients, activeReservations, totalCommissions] = await Promise.all([
          prisma.client.count({
            where: {
              reservations: {
                some: { agentId: member.id }
              }
            }
          }),
          prisma.reservation.count({
            where: {
              agentId: member.id,
              status: { in: ['PENDING', 'CONFIRMED'] }
            }
          }),
          prisma.stand.count({
            where: {
              status: 'SOLD',
              reservations: {
                some: { agentId: member.id }
              }
            }
          })
        ]);

        return {
          ...member,
          metrics: {
            totalClients,
            activeReservations,
            totalCommissions
          }
        };
      })
    );

    return apiSuccess(teamWithMetrics);
  } catch (error: any) {
    logger.error('Error fetching team', error, { module: 'API', action: 'GET_TEAM' });
    return apiError(
      error.message || 'Failed to fetch team',
      500,
      ErrorCodes.FETCH_ERROR
    );
  }
}

/**
 * POST /api/manager/team
 * Create a new agent invitation (manager can only invite for own branch)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { email, fullName, branch } = body || {};

    if (!email || typeof email !== 'string') {
      return apiError('Valid email is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const targetBranch = user.role === 'ADMIN' && branch ? branch : (user.branch || 'Harare');

    // Prevent duplicate users
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return apiError('User with this email already exists', 409, ErrorCodes.CONFLICT);
    }

    // Prevent duplicate pending invitations
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      return apiError('Pending invitation already exists for this email', 409, ErrorCodes.CONFLICT);
    }

    const invitationToken = generateInviteToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        fullName: fullName || email.split('@')[0],
        role: 'AGENT',
        branch: targetBranch,
        token: hashInviteToken(invitationToken),
        status: 'PENDING',
        invitedBy: user.id,
        expiresAt
      }
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.fineandcountryerp.com';
    await sendInvitationEmail({
      email: invitation.email,
      fullName: invitation.fullName || invitation.email.split('@')[0],
      role: 'AGENT',
      branch: invitation.branch,
      invitationLink: `${baseUrl}/accept-invitation?token=${invitationToken}`,
      invitedByName: user.email
    });

    return apiSuccess({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      branch: invitation.branch,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      message: 'Invitation sent'
    }, 201);
  } catch (error: any) {
    logger.error('Error inviting team member', error, { module: 'API', action: 'CREATE_TEAM_MEMBER' });
    return apiError(
      error.message || 'Failed to invite team member',
      500,
      ErrorCodes.CREATE_ERROR
    );
  }
}
