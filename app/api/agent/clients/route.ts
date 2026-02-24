import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent, getAuthenticatedUser } from '@/lib/access-control';
import { getDataFilter } from '@/lib/dashboard-permissions';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/clients
 * Get clients for the authenticated agent
 * Includes clients created by agent and those from agent's reservations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Get role-based data filter - ensures agents only see their own data
    const dataFilter = getDataFilter(user.role, user.id);

    // Get client IDs from the agent's reservations (role-based filtering)
    const agentReservations = await prisma.reservation.findMany({
      where: { 
        agentId: dataFilter?.agentId || user.id, // Enforce agent filter
      },
      select: { clientId: true }
    });

    const clientIds = agentReservations
      .map(r => r.clientId)
      .filter((id): id is string => id !== null);
    
    const uniqueClientIds = [...new Set(clientIds)];

    if (uniqueClientIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Fetch all clients
    const clients = await prisma.client.findMany({
      where: {
        id: { in: uniqueClientIds }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reservations: {
          select: { standId: true, status: true }
        }
      }
    });

    return apiSuccess(clients);
  } catch (error: any) {
    logger.error('Error fetching agent clients', error, { module: 'API', action: 'GET_AGENT_CLIENTS' });
    return apiSuccess([], 200); // Return 200 with empty data to prevent dashboard errors
  }
}

/**
 * POST /api/agent/clients
 * Create a new client for the authenticated agent
 * Stores client in shared clients table, linked to agent
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse request body
    const body = await request.json();
    const { name, email, phone, address, idNumber, budget, lookingFor, preferences } = body;

    // Validation
    if (!name || !email || !phone) {
      return apiError('Name, email, and phone are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('Invalid email format', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check for duplicate email in the agent's branch
    const branch = user.branch || 'Harare';
    const existingClient = await prisma.client.findUnique({
      where: { 
        email_branch: {
          email: email.toLowerCase().trim(),
          branch: branch
        }
      }
    });

    if (existingClient) {
      return apiError('Client with this email already exists in this branch', 409, ErrorCodes.CONFLICT);
    }

    // Create client in shared clients table
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        branch: branch,
        nationalId: idNumber?.trim() || null,
        isPortalUser: false,
        agentId: user.id, // Tag with agent ID
        isProspect: true, // Mark as prospect
        budget: budget ? parseFloat(budget) : null,
        lookingFor: lookingFor?.trim() || null,
        preferences: preferences || null,
      }
    });

    // Log activity
    await prisma.auditTrail.create({
      data: {
        action: 'CLIENT_CREATED',
        resourceType: 'CLIENT',
        resourceId: client.id,
        userId: user.id,
        details: {
          clientName: client.name,
          clientEmail: client.email,
          createdBy: user.email
        }
      }
    }).catch(err => logger.warn('Audit log failed', { error: err, module: 'API', action: 'POST_AGENT_CLIENTS' }));

    return apiSuccess({
      client,
      message: 'Client created successfully'
    }, 201);

  } catch (error: any) {
    logger.error('Error creating client', error, { module: 'API', action: 'POST_AGENT_CLIENTS' });
    return apiError(error.message || 'Failed to create client', 500, ErrorCodes.CREATE_ERROR);
  }
}
