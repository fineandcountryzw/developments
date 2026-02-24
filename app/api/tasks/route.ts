import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks
 * Get all tasks for the authenticated user
 * Query params: status, priority, agentId, clientId, dealId
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('GET /api/tasks called', { module: 'Task-API' });

    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const agentId = searchParams.get('agentId');
    const clientId = searchParams.get('clientId');
    const dealId = searchParams.get('dealId');
    const branch = searchParams.get('branch') || user.branch || 'Harare';

    // Build where clause
    const where: any = {
      userId: user.id,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (priority) {
      where.priority = priority.toUpperCase();
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (dealId) {
      where.dealId = dealId;
    }

    if (branch && branch !== 'all') {
      where.branch = branch;
    }

    // Verify prisma is initialized
    if (!prisma || !prisma.task) {
      logger.error('Prisma client not initialized or Task model not available (GET)', undefined, { module: 'Task-API' });
      return apiError('Database connection error. Please ensure Prisma client is properly initialized.', 500);
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return apiSuccess(tasks);

  } catch (error: any) {
    logger.error('Failed to fetch tasks', error, { 
      module: 'Task-API',
      endpoint: '/api/tasks'
    });
    
    // Provide more specific error message
    const errorMessage = error?.message || 'Failed to fetch tasks';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
      return apiError('Tasks table does not exist. Please run the database migration.', 500);
    }
    
    return apiError(errorMessage, 500);
  }
}

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('POST /api/tasks called', { module: 'Task-API' });

    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { 
      title, 
      description, 
      notes, 
      status, 
      priority, 
      dueDate, 
      agentId, 
      clientId, 
      dealId, 
      tags,
      metadata 
    } = body;

    // Validation
    if (!title || title.trim().length === 0) {
      return apiError('Task title is required', 400);
    }

    // Verify prisma is initialized
    if (!prisma || !prisma.task) {
      logger.error('Prisma client not initialized or Task model not available (POST)', undefined, { module: 'Task-API' });
      return apiError('Database connection error. Please ensure Prisma client is properly initialized.', 500);
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        status: (status?.toUpperCase() || 'PENDING') as any,
        priority: (priority?.toUpperCase() || 'MEDIUM') as any,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: user.id,
        agentId: agentId || (user.role === 'AGENT' ? user.id : null),
        clientId: clientId || null,
        dealId: dealId || null,
        branch: user.branch || 'Harare',
        tags: tags || [],
        metadata: metadata || null,
      },
    });

    // Log activity
    await prisma.auditTrail.create({
      data: {
        action: 'TASK_CREATED',
        resourceType: 'TASK',
        resourceId: task.id,
        userId: user.id,
        details: {
          taskTitle: task.title,
          taskStatus: task.status,
          createdBy: user.email,
        },
      },
    }).catch(err => logger.warn('Audit log failed', { error: err }));

    logger.info('Task created successfully', {
      taskId: task.id,
      userId: user.id,
      module: 'Task-API'
    });

    return apiSuccess(task, 201);

  } catch (error: any) {
    logger.error('Failed to create task', error, { 
      module: 'Task-API',
      endpoint: '/api/tasks'
    });
    return apiError(error.message || 'Failed to create task', 500);
  }
}
