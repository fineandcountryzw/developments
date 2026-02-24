import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/leads
 * List agent's leads (prospects who haven't reserved yet)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Get clients who are agent's leads (have no reservations or only expired ones)
    const leads = await prisma.activity.findMany({
      where: {
        userId: user.id,
        type: 'USER_CREATED',
        ...(status && {
          metadata: {
            path: ['status'],
            equals: status
          }
        })
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return apiSuccess(leads);
  } catch (error: any) {
    logger.error('Error fetching leads', error, { module: 'API', action: 'GET_AGENT_LEADS' });
    return apiError(error.message || 'Failed to fetch leads', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/agent/leads
 * Create new lead
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { name, email, phone, source, notes, interestedIn } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Create activity log for lead
    const lead = await prisma.activity.create({
      data: {
        type: 'USER_CREATED',
        description: `New lead: ${name}`,
        metadata: {
          name,
          email,
          phone,
          source: source || 'Manual',
          notes,
          interestedIn,
          status: 'new',
          agentId: user.id,
          isLead: true
        },
        userId: user.id
      }
    });

    return apiSuccess({
      lead,
      message: 'Lead created successfully'
    }, 201);
  } catch (error: any) {
    logger.error('Error creating lead', error, { module: 'API', action: 'POST_AGENT_LEADS' });
    return apiError(error.message || 'Failed to create lead', 500, ErrorCodes.CREATE_ERROR);
  }
}
