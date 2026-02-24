import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/clients/:id
 * Get client details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { agentId: user.id },
          include: {
            stand: {
              include: {
                development: {
                  select: { name: true, location: true }
                }
              }
            }
          }
        }
      }
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Verify agent has access to this client through reservations
    if (client.reservations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - not your client' },
        { status: 403 }
      );
    }

    return apiSuccess(client);
  } catch (error: any) {
    logger.error('Error fetching client', error, { module: 'API', action: 'GET_AGENT_CLIENT' });
    return apiError(error.message || 'Failed to fetch client', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/agent/clients/:id
 * Update client details
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, national_id } = body;

    // Verify agent has access to this client
    const existingClient = await prisma.client.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { agentId: user.id }
        }
      }
    });

    if (!existingClient) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    if (existingClient.reservations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - not your client' },
        { status: 403 }
      );
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(national_id && { national_id })
      }
    });

    return apiSuccess(updatedClient);
  } catch (error: any) {
    logger.error('Error updating client', error, { module: 'API', action: 'PUT_AGENT_CLIENT' });
    return apiError(error.message || 'Failed to update client', 500, ErrorCodes.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/agent/clients/:id
 * Delete client (soft delete - only if no active reservations)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Verify agent has access and check for active reservations
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        reservations: {
          where: {
            agentId: user.id,
            status: { in: ['PENDING', 'CONFIRMED'] }
          }
        }
      }
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    if (client.reservations.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete client with active reservations' },
        { status: 400 }
      );
    }

    await prisma.client.delete({ where: { id } });

    return apiSuccess({ message: 'Client deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting client', error, { module: 'API', action: 'DELETE_AGENT_CLIENT' });
    return apiError(error.message || 'Failed to delete client', 500, ErrorCodes.DELETE_ERROR);
  }
}
