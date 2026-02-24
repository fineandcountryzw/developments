/**
 * Automation API Routes
 * CRUD operations for automations
 * 
 * @module app/api/admin/automations
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/automations
 * List all automations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const enabled = searchParams.get('enabled');
    
    const automations = await prisma.automation.findMany({
      where: {
        ...(branch && { branch }),
        ...(enabled !== null && { enabled: enabled === 'true' })
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { runs: true }
        }
      }
    });
    
    return apiSuccess(automations);
  } catch (error: any) {
    logger.error('Error fetching automations', error, { module: 'API', action: 'GET_AUTOMATIONS' });
    return apiError('Failed to fetch automations', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/automations
 * Create a new automation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    
    const body = await request.json();
    const {
      name,
      description,
      enabled,
      triggerType,
      eventType,
      schedule,
      webhookUrl,
      entityType,
      condition,
      actions,
      branch,
      retryPolicy
    } = body;
    
    // Validate required fields
    if (!name || !triggerType || !entityType) {
      return apiError('Missing required fields: name, triggerType, entityType', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    // Validate trigger type specific fields
    if (triggerType === 'event' && !eventType) {
      return apiError('eventType is required for event triggers', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    if (triggerType === 'schedule' && !schedule) {
      return apiError('schedule is required for schedule triggers', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    if (triggerType === 'webhook' && !webhookUrl) {
      return apiError('webhookUrl is required for webhook triggers', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    // Validate actions
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return apiError('At least one action is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    const automation = await prisma.automation.create({
      data: {
        name,
        description,
        enabled: enabled !== false,
        triggerType,
        eventType,
        schedule,
        webhookUrl,
        entityType,
        condition: condition || null,
        actions: actions,
        branch: branch || 'Harare',
        retryPolicy: retryPolicy || {
          maxRetries: 3,
          backoff: 'exponential',
          initialDelay: 1000,
          maxDelay: 60000
        }
      }
    });
    
    // Invalidate automation cache if event-based
    if (automation.triggerType === 'event' && automation.eventType && automation.entityType) {
      const { invalidateAutomationCache } = await import('@/lib/automation/engine-optimized');
      invalidateAutomationCache(automation.eventType, automation.entityType, automation.branch);
    }
    
    return apiSuccess(automation, 201);
  } catch (error: any) {
    logger.error('Error creating automation', error, { module: 'API', action: 'POST_AUTOMATIONS' });
    return apiError('Failed to create automation', 500, ErrorCodes.CREATE_ERROR);
  }
}
