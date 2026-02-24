import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAgent, getAuthenticatedUser, isAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation/middleware';
import { clientSchema } from '@/lib/validation/schemas';
import { broadcastClientUpdate } from '@/lib/realtime';

export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/admin/clients called', { module: 'API', action: 'GET_CLIENTS' });

    // Use new unified auth - allow agents to access (for their own clients)
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Query parameters
    const branch = request.nextUrl.searchParams.get('branch');
    const search = request.nextUrl.searchParams.get('search');
    let agentId = request.nextUrl.searchParams.get('agentId');
    
    // Pagination parameters
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Role-Based Access Control Enforcement (roles are uppercase from auth)
    if (user.role === 'AGENT') {
      // Agents can only see clients from their own reservations
      agentId = user.id;
      logger.debug('Agent access enforced', { module: 'API', agentId });
    } else if (user.role === 'CLIENT') {
      // Clients can only see themselves
      return apiSuccess([{ id: user.id, email: user.email, name: 'Client User', branch: user.branch }]);
    }

    // Build where clause
    interface ClientWhere {
      branch?: string;
      id?: { in: string[] };
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        phone?: { contains: string; mode: 'insensitive' };
      }>;
    }
    const where: ClientWhere = {};
    if (branch) {
      where.branch = branch;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    // If agentId is provided, first get client IDs from reservations
    let clientIdsFromAgent: string[] = [];
    if (agentId) {
      try {
        const agentReservations = await prisma.reservation.findMany({
          where: { agentId: agentId },
          select: { clientId: true }
        });
        clientIdsFromAgent = agentReservations
          .map(r => r.clientId)
          .filter((id): id is string => id !== null);
        
        if (clientIdsFromAgent.length === 0) {
          logger.info('No clients found for agent', { module: 'API', agentId });
          return apiSuccess([]);
        }
        
        where.id = { in: clientIdsFromAgent };
        logger.debug('Filtering clients by agentId', { module: 'API', agentId, clientCount: clientIdsFromAgent.length });
      } catch (reservationError: any) {
        logger.error('Error fetching agent reservations', reservationError, { module: 'API' });
        // Continue without agent filter if it fails
      }
    }

    // Get total count for pagination
    const total = await prisma.client.count({ where });
    
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        reservations: true,
        payments: true,
        purchases: {
          include: {
            development: { select: { id: true, name: true } },
            stand: { select: { id: true, standNumber: true } },
            purchasePayments: {
              where: { status: 'CONFIRMED' },
              select: { amount: true },
            },
          },
        },
      }
    });

    logger.info('Fetched clients successfully', { 
      module: 'API', 
      count: clients.length,
      total,
      page,
      limit,
      filter: { branch: branch || 'ALL', search: search || 'NONE' } 
    });

    return apiSuccess({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Client fetch error', error, { module: 'API' });
    return apiError(error?.message || 'Failed to fetch clients', 500, ErrorCodes.FETCH_ERROR);
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.debug('POST /api/admin/clients called', { module: 'API' });

    // Use new unified auth - require admin for creating clients with rate limiting
    const authResult = await requireAdmin(request, { limit: 20, windowMs: 60000 }); // 20 requests per minute
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(request, clientSchema, {
      module: 'API',
      action: 'POST_CLIENTS'
    });
    if (!validation.success) {
      return validation.error;
    }
    const data = validation.data;

    // Create client
    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        nationalId: data.nationalId || null,
        branch: data.branch || 'Harare',
        isPortalUser: data.isPortalUser || false,
        ...(data.kyc && { kyc: data.kyc }),
        ...(data.ownedStands && { ownedStands: data.ownedStands })
      },
      include: {
        reservations: true,
        payments: true
      }
    });

    // Log activity
    if (user?.email) {
      await prisma.activityLog.create({
        data: {
          branch: data.branch || 'Harare',
          userId: null,
          action: 'CREATE',
          module: 'CLIENTS',
          recordId: client.id,
          description: `Client created: ${client.name}`,
          changes: JSON.stringify(client)
        }
      });
    }

    logger.info('Client created', { 
      module: 'API', 
      action: 'POST_CLIENTS',
      id: client.id,
      name: client.name,
      branch: client.branch
    });

    // Broadcast real-time update
    try {
      broadcastClientUpdate('created', client, {
        branch: client.branch
      });
    } catch (err) {
      logger.error('Failed to broadcast client update', err instanceof Error ? err : undefined, { module: 'API' });
    }

    return apiSuccess(client, 201);
  } catch (error: any) {
    logger.error('Client creation error', error, { module: 'API', action: 'POST_CLIENTS' });

    // Check for unique constraint violation
    if (error?.code === 'P2002') {
      return apiError(
        'Client with this email already exists in this branch',
        409,
        ErrorCodes.DUPLICATE_KEY
      );
    }

    return apiError(
      error?.message || 'Unknown error',
      500,
      ErrorCodes.CREATE_ERROR
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    logger.info('PUT /api/admin/clients called', { module: 'API', action: 'PUT_CLIENTS' });

    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id, ...updateData } = await request.json();

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        reservations: true,
        payments: true
      }
    });

    // Log activity
    if (user?.email) {
      await prisma.activityLog.create({
        data: {
          branch: client.branch,
          userId: null,
          action: 'UPDATE',
          module: 'CLIENTS',
          recordId: client.id,
          description: `Client updated: ${client.name}`,
          changes: JSON.stringify(updateData)
        }
      });
    }

    logger.info('Client updated', { module: 'API', action: 'PUT_CLIENTS', id: client.id });

    return apiSuccess(client);
  } catch (error: any) {
    logger.error('Client update error', error, { module: 'API', action: 'PUT_CLIENTS' });
    return apiError(
      error?.message || 'Unknown error',
      500,
      ErrorCodes.UPDATE_ERROR
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logger.info('DELETE /api/admin/clients called', { module: 'API', action: 'DELETE_CLIENTS' });

    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await request.json();

    const client = await prisma.client.delete({
      where: { id }
    });

    // Log activity
    if (user?.email) {
      await prisma.activityLog.create({
        data: {
          branch: client.branch,
          userId: null,
          action: 'DELETE',
          module: 'CLIENTS',
          recordId: client.id,
          description: `Client deleted: ${client.name}`,
          changes: JSON.stringify({ deleted: true, client })
        }
      });
    }

    logger.info('Client deleted', { module: 'API', action: 'DELETE_CLIENTS', id });

    // Broadcast real-time update
    try {
      broadcastClientUpdate('deleted', client, {
        branch: client.branch
      });
    } catch (err) {
      logger.error('Failed to broadcast client update', err instanceof Error ? err : undefined, { module: 'API' });
    }

    return apiSuccess(null);
  } catch (error: any) {
    logger.error('Client delete error', error, { module: 'API', action: 'DELETE_CLIENTS' });
    return apiError(
      error?.message || 'Unknown error',
      500,
      ErrorCodes.DELETE_ERROR
    );
  }
}
