import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/agent/deals/:id/notes
 * Add note to deal
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      );
    }

    // Verify agent has access to this deal
    const deal = await prisma.stand.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { agentId: user.id }
        }
      }
    });

    if (!deal || deal.reservations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Deal not found or unauthorized' },
        { status: 404 }
      );
    }

    // Log activity as a note
    await prisma.activity.create({
      data: {
        type: 'STAND_UPDATE',
        description: `Note added to deal ${deal.standNumber}`,
        metadata: {
          standId: id,
          standNumber: deal.standNumber,
          note: content,
          agentId: user.id,
          action: 'note_added'
        },
        userId: user.id
      }
    });

    return apiSuccess({
      message: 'Note added successfully',
      note: { content, createdAt: new Date() }
    }, 201);
  } catch (error: any) {
    logger.error('Error adding note', error, { module: 'API', action: 'POST_DEAL_NOTE' });
    return apiError(error.message || 'Failed to add note', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * GET /api/agent/deals/:id/notes
 * Get all notes for a deal
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Verify agent has access to this deal
    const deal = await prisma.stand.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { agentId: user.id }
        }
      }
    });

    if (!deal || deal.reservations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Deal not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get all notes for this deal
    const notes = await prisma.activity.findMany({
      where: {
        type: 'STAND_UPDATE',
        metadata: {
          path: ['standId'],
          equals: id
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return apiSuccess(notes);
  } catch (error: any) {
    logger.error('Error fetching notes', error, { module: 'API', action: 'GET_DEAL_NOTES' });
    return apiError(error.message || 'Failed to fetch notes', 500, ErrorCodes.FETCH_ERROR);
  }
}
