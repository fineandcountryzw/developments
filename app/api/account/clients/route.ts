import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/clients
 * Get clients list for the branch
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      branch,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          branch: true,
          ownedStands: true,
          createdAt: true,
          _count: {
            select: {
              payments: true,
              installmentPlans: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return apiSuccess(clients, 200, {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    logger.error('ACCOUNT_CLIENTS Error', error, { module: 'API', action: 'GET_ACCOUNT_CLIENTS' });
    return apiError('Failed to fetch clients', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/account/clients
 * Create a new client
 * Requires ACCOUNT or ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const body = await request.json();
    const {
      name,
      firstName,
      lastName,
      email,
      phone,
      nationalId,
      address,
      city,
      branch
    } = body;

    // Validate required fields
    if (!name || !email || !phone) {
      return apiError('Missing required fields: name, email, phone', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // RBAC: Check branch access for ACCOUNT role
    const userBranch = (session.user as { branch?: string }).branch || 'Harare';
    if (role === 'ACCOUNT' && branch && branch !== userBranch) {
      return apiError('Access denied: Cannot create clients for other branches', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Check if email already exists
    const existingClient = await prisma.client.findFirst({
      where: { email }
    });

    if (existingClient) {
      return apiError('Client with this email already exists', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create client
    const client = await prisma.client.create({
      data: {
        name,
        firstName,
        lastName,
        email,
        phone,
        nationalId: nationalId,
        branch: branch || userBranch,
        ownedStands: []
      }
    });

    logger.info('Client created via ACCOUNT API', {
      module: 'API',
      action: 'POST_ACCOUNT_CLIENTS',
      clientId: client.id,
      email: client.email,
      branch: client.branch,
      createdBy: session.user.email
    });

    return apiSuccess({ client }, 201);

  } catch (error: any) {
    logger.error('ACCOUNT_CLIENTS Create error', error, { module: 'API', action: 'POST_ACCOUNT_CLIENTS' });
    return apiError(error.message || 'Failed to create client', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * PUT /api/account/clients
 * Update an existing client
 * Requires ACCOUNT or ADMIN role
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const body = await request.json();
    const {
      clientId,
      name,
      firstName,
      lastName,
      email,
      phone,
      nationalId,
      address,
      city
    } = body;

    // Validate required fields
    if (!clientId) {
      return apiError('Missing required field: clientId', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get existing client
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!existingClient) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // RBAC: Check branch access for ACCOUNT role
    const userBranch = (session.user as { branch?: string }).branch || 'Harare';
    if (role === 'ACCOUNT' && existingClient.branch !== userBranch) {
      return apiError('Access denied: Client not in your branch', 403, ErrorCodes.ACCESS_DENIED);
    }

    // If email is being changed, check if new email already exists
    if (email && email !== existingClient.email) {
      const emailExists = await prisma.client.findFirst({
        where: { 
          email,
          id: { not: clientId }
        }
      });

      if (emailExists) {
        return apiError('Email already in use by another client', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name && { name }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(nationalId && { nationalId }),
        ...(address && { address }),
        ...(city && { city })
      }
    });

    logger.info('Client updated via ACCOUNT API', {
      module: 'API',
      action: 'PUT_ACCOUNT_CLIENTS',
      clientId,
      updatedBy: session.user.email
    });

    return apiSuccess({ client: updatedClient });

  } catch (error: any) {
    logger.error('ACCOUNT_CLIENTS Update error', error, { module: 'API', action: 'PUT_ACCOUNT_CLIENTS' });
    return apiError(error.message || 'Failed to update client', 500, ErrorCodes.UPDATE_ERROR);
  }
}

