import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/leads/:id
 * Get lead details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const lead = await prisma.activity.findFirst({
      where: { 
        id,
        userId: user.id,
        type: 'USER_CREATED'
      }
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    return apiSuccess(lead);
  } catch (error: any) {
    logger.error('Error fetching lead', error, { module: 'API', action: 'GET_AGENT_LEAD' });
    return apiError(error.message || 'Failed to fetch lead', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/agent/leads/:id
 * Update lead
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { status, notes, interestedIn } = body;

    // Get existing lead
    const existingLead = await prisma.activity.findUnique({
      where: { id }
    });

    if (!existingLead || existingLead.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or unauthorized' },
        { status: 404 }
      );
    }

    const metadata = existingLead.metadata as any;

    // Update lead metadata
    const updatedLead = await prisma.activity.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          ...(status && { status }),
          ...(notes && { notes }),
          ...(interestedIn && { interestedIn }),
          lastUpdated: new Date()
        }
      }
    });

    return apiSuccess({
      lead: updatedLead,
      message: 'Lead updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating lead', error, { module: 'API', action: 'PUT_AGENT_LEAD' });
    return apiError(error.message || 'Failed to update lead', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/agent/leads/:id
 * Delete lead
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const lead = await prisma.activity.findUnique({
      where: { id }
    });

    if (!lead || lead.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.activity.delete({ where: { id } });

    return apiSuccess({ message: 'Lead deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting lead', error, { module: 'API', action: 'DELETE_AGENT_LEAD' });
    return apiError(error.message || 'Failed to delete lead', 500, ErrorCodes.DELETE_ERROR);
  }
}
