/**
 * Action Execution Engine
 * Executes automation actions (email, update, create, notify, webhook)
 * 
 * @module lib/automation/action-executor
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email-service';
import { AutomationEvent } from './event-emitter';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationAction {
  type: 'email' | 'update' | 'create' | 'notify' | 'webhook';
  target: string;            // Email address, entity ID, webhook URL
  template?: string;         // Email template ID
  data?: Record<string, any>; // Action-specific data
  delay?: number;            // Delay in seconds (optional)
}

export interface ActionExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute an automation action
 * 
 * @param action - Action to execute
 * @param event - Event that triggered the action
 * @param automationId - Automation ID (for logging)
 * @returns Execution result
 */
export async function executeAction(
  action: AutomationAction,
  event: AutomationEvent,
  automationId: string
): Promise<ActionExecutionResult> {
  const startTime = Date.now();
  
  // Generate idempotency key
  const idempotencyKey = `${automationId}-${event.entityId}-${action.type}-${action.target}`;
  
  logger.info('[AUTOMATION] Executing action', {
    module: 'ActionExecutor',
    automationId,
    actionType: action.type,
    actionTarget: action.target,
    entityId: event.entityId,
    idempotencyKey
  });
  
  // Check if already executed (idempotency)
  const existing = await prisma.automationRun.findUnique({
    where: { idempotencyKey }
  });
  
  if (existing && existing.status === 'completed') {
    logger.info('[AUTOMATION] Action already executed (idempotency)', {
      module: 'ActionExecutor',
      idempotencyKey,
      existingRunId: existing.id
    });
    
    return {
      success: true,
      result: existing.result
    };
  }
  
  try {
    let result: any;
    
    // Execute based on action type
    switch (action.type) {
      case 'email':
        result = await executeEmailAction(action, event);
        break;
      
      case 'update':
        result = await executeUpdateAction(action, event);
        break;
      
      case 'create':
        result = await executeCreateAction(action, event);
        break;
      
      case 'notify':
        result = await executeNotifyAction(action, event);
        break;
      
      case 'webhook':
        result = await executeWebhookAction(action, event);
        break;
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('[AUTOMATION] Action executed successfully', {
      module: 'ActionExecutor',
      automationId,
      actionType: action.type,
      durationMs: duration,
      result
    });
    
    return {
      success: true,
      result
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('[AUTOMATION] Action execution failed', {
      module: 'ActionExecutor',
      automationId,
      actionType: action.type,
      durationMs: duration,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute email action
 */
async function executeEmailAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Resolve target (could be 'client.email', 'developer.email', etc.)
  const email = resolveTarget(action.target, event);
  
  if (!email) {
    throw new Error(`Email target not found: ${action.target}`);
  }
  
  // Get template (if specified)
  // For now, use default templates based on action type
  // TODO: Implement template system
  const subject = action.template 
    ? `Automation: ${action.template}`
    : `Automation Notification`;
  
  const html = action.data?.html || `
    <h2>Automation Notification</h2>
    <p>This is an automated message triggered by: ${event.type}</p>
    <pre>${JSON.stringify(event.payload, null, 2)}</pre>
  `;
  
  // Send email
  const emailResult = await sendEmail({
    to: email,
    subject,
    html
  });
  
  return {
    emailId: emailResult.id || 'unknown',
    recipient: email,
    subject
  };
}

/**
 * Execute update action
 */
async function executeUpdateAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Update entity (stand, deal, invoice, etc.)
  const entityType = action.target; // 'stand', 'deal', 'invoice'
  const updateData = action.data || {};
  
  // Map entity type to Prisma model
  const modelMap: Record<string, string> = {
    'stand': 'stand',
    'deal': 'deal',
    'invoice': 'invoice',
    'reservation': 'reservation',
    'payment': 'payment'
  };
  
  const modelName = modelMap[entityType];
  if (!modelName) {
    throw new Error(`Unknown entity type for update: ${entityType}`);
  }
  
  // Use Prisma dynamic access
  const model = (prisma as any)[modelName];
  if (!model) {
    throw new Error(`Prisma model not found: ${modelName}`);
  }
  
  const entity = await model.update({
    where: { id: event.entityId },
    data: updateData
  });
  
  return {
    updated: true,
    entityType,
    entityId: entity.id
  };
}

/**
 * Execute create action
 */
async function executeCreateAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Create entity (contract, invoice, etc.)
  const entityType = action.target; // 'contract', 'invoice'
  const createData = {
    ...action.data,
    // Link to source entity
    [`${event.entityType}Id`]: event.entityId
  };
  
  // Map entity type to Prisma model
  const modelMap: Record<string, string> = {
    'contract': 'generatedContract',
    'invoice': 'invoice',
    'deal': 'deal'
  };
  
  const modelName = modelMap[entityType];
  if (!modelName) {
    throw new Error(`Unknown entity type for create: ${entityType}`);
  }
  
  // Use Prisma dynamic access
  const model = (prisma as any)[modelName];
  if (!model) {
    throw new Error(`Prisma model not found: ${modelName}`);
  }
  
  const entity = await model.create({
    data: createData
  });
  
  return {
    created: true,
    entityType,
    entityId: entity.id
  };
}

/**
 * Execute notify action
 */
async function executeNotifyAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // For now, notify is same as email
  // TODO: Implement notification system (in-app, push, etc.)
  return executeEmailAction(action, event);
}

/**
 * Execute webhook action
 */
async function executeWebhookAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  const webhookUrl = action.target;
  
  if (!webhookUrl) {
    throw new Error('Webhook URL not provided');
  }
  
  // Call webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
      correlationId: event.correlationId
    })
  });
  
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json().catch(() => ({}));
  
  return {
    webhookUrl,
    status: response.status,
    result
  };
}

/**
 * Resolve target value from event payload
 * Supports nested paths like 'client.email', 'stand.development.name'
 */
function resolveTarget(target: string, event: AutomationEvent): string | null {
  // If target is a direct value, return it
  if (target.includes('@')) {
    return target; // Looks like an email
  }
  
  // Otherwise, try to resolve from payload
  const parts = target.split('.');
  let value: any = event.payload;
  
  for (const part of parts) {
    if (value === null || value === undefined) {
      return null;
    }
    value = value[part];
  }
  
  return value ? String(value) : null;
}
