import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/client/profile
 * Get client's own profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } },
      include: {
        reservations: {
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
      return apiError('Client profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    return apiSuccess(client);
  } catch (error: any) {
    logger.error('Error fetching client profile', error, { module: 'API', action: 'GET_CLIENT_PROFILE' });
    return apiError(error.message || 'Failed to fetch profile', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/client/profile
 * Update client's own profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const body = await request.json();
    const { name, phone, national_id } = body;

    // Get current client
    const existingClient = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } }
    });

    if (!existingClient) {
      return apiError('Client profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Update allowed fields only
    const updatedClient = await prisma.client.update({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(national_id && { national_id })
      }
    });

    return apiSuccess({
      client: updatedClient,
      message: 'Profile updated successfully' 
    });
  } catch (error: any) {
    logger.error('Error updating profile', error, { module: 'API', action: 'PUT_CLIENT_PROFILE' });
    return apiError(error.message || 'Failed to update profile', 500, ErrorCodes.UPDATE_ERROR);
  }
}
