import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { generateUniqueAgentCode } from '@/lib/agent-code-generator';

/**
 * Agents API
 * - GET: List agents with pagination and search
 * - POST: Create new agent
 * - PATCH: Update existing agent
 * - DELETE: Delete an agent
 * 
 * Access: ADMIN, MANAGER, ACCOUNT
 */

// Allowed roles for agent management
const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNT'];

/**
 * GET /api/admin/agents
 * List all agents with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/admin/agents called", {
      module: "API",
      action: "GET_AGENTS",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Query parameters
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const search = request.nextUrl.searchParams.get('search') || '';
    const status = request.nextUrl.searchParams.get('status');
    const branch = request.nextUrl.searchParams.get('branch');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (branch) {
      where.branch = branch;
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agent.count({ where }),
    ]);

    logger.info("Agents fetched successfully", {
      module: "API",
      action: "GET_AGENTS",
      count: agents.length,
    });

    return apiSuccess({
      agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error fetching agents", {
      module: "API",
      action: "GET_AGENTS",
      error,
    });
    return apiError("Failed to fetch agents", 500);
  }
}

/**
 * POST /api/admin/agents
 * Create a new agent
 */
export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/admin/agents called", {
      module: "API",
      action: "CREATE_AGENT",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const { name, email, phone, branch, agentStatus } = body;

    // Validate required fields
    if (!name) {
      return apiError("Agent name is required", 400);
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingAgent = await prisma.agent.findUnique({
        where: { email },
      });

      if (existingAgent) {
        return apiError("An agent with this email already exists", 400);
      }
    }

    // Generate unique agent code
    const code = await generateUniqueAgentCode();

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        branch: branch || 'Harare',
        status: agentStatus || 'ACTIVE',
        code,
      } as any,
    });

    logger.info("Agent created successfully", {
      module: "API",
      action: "CREATE_AGENT",
      agentId: agent.id,
    });

    return apiSuccess(agent, 201);
  } catch (error) {
    logger.error("Error creating agent", {
      module: "API",
      action: "CREATE_AGENT",
      error,
    });
    return apiError("Failed to create agent", 500);
  }
}

/**
 * PATCH /api/admin/agents
 * Update an existing agent
 */
export async function PATCH(request: NextRequest) {
  try {
    logger.info("PATCH /api/admin/agents called", {
      module: "API",
      action: "UPDATE_AGENT",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const { id, name, email, phone, branch, status, agentStatus, generateNewCode } = body;

    // Validate required fields
    if (!id) {
      return apiError("Agent ID is required", 400);
    }

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return apiError("Agent not found", 404);
    }

    // Check if email already exists for another agent
    if (email && email !== existingAgent.email) {
      const agentWithEmail = await prisma.agent.findUnique({
        where: { email },
      });

      if (agentWithEmail) {
        return apiError("An agent with this email already exists", 400);
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (branch !== undefined) updateData.branch = branch;
    // Accept either status or agentStatus from the request
    if (status !== undefined) updateData.status = status;
    else if (agentStatus !== undefined) updateData.status = agentStatus;
    
    // Generate new code if requested
    if (generateNewCode) {
      const newCode = await generateUniqueAgentCode();
      updateData.code = newCode;
    }

    // Update agent
    const agent = await prisma.agent.update({
      where: { id },
      data: updateData,
    });

    logger.info("Agent updated successfully", {
      module: "API",
      action: "UPDATE_AGENT",
      agentId: agent.id,
    });

    return apiSuccess(agent);
  } catch (error) {
    logger.error("Error updating agent", {
      module: "API",
      action: "UPDATE_AGENT",
      error,
    });
    return apiError("Failed to update agent", 500);
  }
}

/**
 * DELETE /api/admin/agents
 * Delete an agent
 */
export async function DELETE(request: NextRequest) {
  try {
    logger.info("DELETE /api/admin/agents called", {
      module: "API",
      action: "DELETE_AGENT",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }

    const agentId = request.nextUrl.searchParams.get('id');

    if (!agentId) {
      return apiError("Agent ID is required", 400);
    }

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!existingAgent) {
      return apiError("Agent not found", 404);
    }

    // Delete agent
    await prisma.agent.delete({
      where: { id: agentId },
    });

    logger.info("Agent deleted successfully", {
      module: "API",
      action: "DELETE_AGENT",
      agentId,
    });

    return apiSuccess({ message: "Agent deleted successfully" });
  } catch (error) {
    logger.error("Error deleting agent", {
      module: "API",
      action: "DELETE_AGENT",
      error,
    });
    return apiError("Failed to delete agent", 500);
  }
}
