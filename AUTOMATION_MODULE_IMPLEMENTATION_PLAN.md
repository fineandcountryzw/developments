# 🚀 AUTOMATION MODULE - IMPLEMENTATION PLAN

**Date:** 2026-01-23  
**Status:** ✅ **PLAN COMPLETE - READY FOR IMPLEMENTATION**

---

## EXECUTIVE SUMMARY

This document provides a **step-by-step implementation plan** for refactoring the Automation module from a scattered, polling-based system to a lean, event-driven architecture with 3 primitives (Trigger/Condition/Action).

**Timeline:** 5 days  
**Risk Level:** Medium (adapter layer ensures backward compatibility)  
**Code Reduction:** ~60% (from 5,000 to 2,000 lines)

---

## IMPLEMENTATION STRATEGY

### Approach: Incremental Migration

**Phase 1:** Build new system alongside old  
**Phase 2:** Migrate automations one by one  
**Phase 3:** Remove old system  
**Phase 4:** Clean up

**Benefits:**
- ✅ No downtime
- ✅ Backward compatible
- ✅ Easy rollback
- ✅ Test incrementally

---

## STEP-BY-STEP IMPLEMENTATION

### DAY 1: FOUNDATION

#### Task 1.1: Create Event Emitter

**File:** `lib/automation/event-emitter.ts`

```typescript
/**
 * Centralized Event Emitter for Automation
 * All modules emit events here instead of calling automation functions directly
 */

interface AutomationEvent {
  id: string;
  type: string;              // 'payment.confirmed', 'deal.updated', etc.
  entityType: string;        // 'payment', 'deal', 'invoice'
  entityId: string;
  payload: Record<string, any>;
  timestamp: Date;
  branch?: string;
  correlationId?: string;
}

const eventQueue: AutomationEvent[] = [];

export function emitEvent(event: AutomationEvent): void {
  // Generate event ID
  event.id = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  event.timestamp = new Date();
  
  // Add to queue
  eventQueue.push(event);
  
  // Process immediately (async, non-blocking)
  processEventQueue().catch(err => {
    console.error('[AUTOMATION] Event processing error:', err);
  });
  
  // Log event
  logEvent(event);
}

async function processEventQueue(): Promise<void> {
  // Process events in queue
  // Find matching automations and execute
  // (Implementation in engine.ts)
}
```

**Integration Points:**
- Replace `handlePaymentSuccess()` calls with `emitEvent()`
- Replace cron job queries with `emitEvent()` on schedule
- Add event emission to deal updates

---

#### Task 1.2: Create Automation Schema

**File:** `prisma/schema.prisma` (add to existing)

```prisma
model Automation {
  id              String   @id @default(cuid())
  name            String
  description     String?  @db.Text
  enabled         Boolean  @default(true)
  
  // Trigger
  triggerType     String   // 'event' | 'schedule' | 'webhook'
  eventType       String?
  schedule        String?  // Cron expression
  webhookUrl      String?
  entityType      String
  
  // Condition (optional)
  condition       Json?
  
  // Actions (array)
  actions         Json     // [{ type, target, template, data, delay }]
  
  // Settings
  branch          String   @default("Harare")
  retryPolicy     Json?    // { maxRetries: 3, backoff: 'exponential', ... }
  
  // Tracking
  lastRunAt       DateTime?
  runCount        Int      @default(0)
  successCount    Int      @default(0)
  failureCount    Int      @default(0)
  
  runs            AutomationRun[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([enabled])
  @@index([triggerType, eventType])
  @@index([branch])
  @@map("automations")
}

model AutomationRun {
  id              String   @id @default(cuid())
  automationId   String
  automation     Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  
  // Event context
  eventType       String
  entityType      String
  entityId        String
  correlationId   String?
  
  // Execution
  status          String   // 'pending' | 'running' | 'completed' | 'failed'
  actionType      String
  actionTarget    String
  
  // Idempotency
  idempotencyKey  String   @unique
  
  // Retry tracking
  retryCount      Int      @default(0)
  maxRetries      Int      @default(3)
  
  // Results
  result          Json?
  errorMessage    String?  @db.Text
  errorStack      String?  @db.Text
  
  // Timing
  startedAt       DateTime?
  completedAt     DateTime?
  durationMs      Int?
  
  branch          String   @default("Harare")
  createdAt       DateTime @default(now())
  
  @@index([automationId])
  @@index([entityId])
  @@index([correlationId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("automation_runs")
}

model AutomationEventLog {
  id                  String   @id @default(cuid())
  eventType           String
  entityType          String
  entityId            String
  payload             Json
  branch              String   @default("Harare")
  triggeredAutomations String[] // Automation IDs that matched
  timestamp           DateTime @default(now())
  
  @@index([eventType])
  @@index([entityId])
  @@index([timestamp(sort: Desc)])
  @@map("automation_event_logs")
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_automation_tables
npx prisma generate
```

---

#### Task 1.3: Add Correlation IDs

**Modify:** `lib/payment-success-handler.ts`

```typescript
export async function handlePaymentSuccess(paymentId: string): Promise<PaymentSuccessResult> {
  // Generate correlation ID
  const correlationId = `payment-${paymentId}`;
  
  // ... existing code ...
  
  // Pass correlationId to contract creation
  // Pass correlationId to email sending
  
  // Log with correlation ID
  logger.info('[PAYMENT_SUCCESS] Handler completed', {
    correlationId,
    paymentId,
    contractId: result.contract.id
  });
}
```

**Modify:** All cron jobs to include correlation IDs

---

### DAY 2: EXECUTION ENGINE

#### Task 2.1: Create Rule Engine

**File:** `lib/automation/rule-engine.ts`

```typescript
/**
 * Rule Evaluation Engine
 * Evaluates conditions against event payloads
 */

interface AutomationCondition {
  field: string;
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'in' | 'not_in';
  value: any;
  logic?: 'AND' | 'OR';
  conditions?: AutomationCondition[];
}

export function evaluateCondition(
  condition: AutomationCondition | null,
  event: AutomationEvent
): boolean {
  if (!condition) return true; // No condition = always true
  
  // Handle nested conditions
  if (condition.conditions && condition.conditions.length > 0) {
    const results = condition.conditions.map(c => evaluateCondition(c, event));
    return condition.logic === 'OR' 
      ? results.some(r => r)
      : results.every(r => r);
  }
  
  // Get field value from event payload
  const fieldValue = getFieldValue(condition.field, event.payload);
  
  // Compare based on operator
  return compare(condition.operator, fieldValue, condition.value);
}

function getFieldValue(field: string, payload: Record<string, any>): any {
  // Support nested fields: 'stand.status', 'client.email'
  const parts = field.split('.');
  let value = payload;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) return null;
  }
  return value;
}

function compare(
  operator: string,
  fieldValue: any,
  conditionValue: any
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'greater':
      return Number(fieldValue) > Number(conditionValue);
    case 'less':
      return Number(fieldValue) < Number(conditionValue);
    case 'contains':
      return String(fieldValue).includes(String(conditionValue));
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    default:
      return false;
  }
}
```

---

#### Task 2.2: Create Action Executor

**File:** `lib/automation/action-executor.ts`

```typescript
/**
 * Action Execution Engine
 * Executes automation actions (email, update, create, notify)
 */

interface AutomationAction {
  type: 'email' | 'update' | 'create' | 'notify' | 'webhook';
  target: string;
  template?: string;
  data?: Record<string, any>;
  delay?: number;
}

export async function executeAction(
  action: AutomationAction,
  event: AutomationEvent,
  automationId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  // Generate idempotency key
  const idempotencyKey = `${automationId}-${event.entityId}-${action.type}-${action.target}`;
  
  // Check if already executed
  const existing = await prisma.automationRun.findUnique({
    where: { idempotencyKey }
  });
  
  if (existing && existing.status === 'completed') {
    return { success: true, result: existing.result };
  }
  
  // Create run record
  const run = await prisma.automationRun.create({
    data: {
      automationId,
      eventType: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      correlationId: event.correlationId,
      status: 'running',
      actionType: action.type,
      actionTarget: action.target,
      idempotencyKey,
      startedAt: new Date(),
      branch: event.branch || 'Harare'
    }
  });
  
  try {
    let result: any;
    
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
    
    // Mark as completed
    const duration = Date.now() - run.startedAt!.getTime();
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
        durationMs: duration
      }
    });
    
    return { success: true, result };
    
  } catch (error: any) {
    // Mark as failed
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        errorMessage: error.message,
        errorStack: error.stack,
        completedAt: new Date()
      }
    });
    
    return { success: false, error: error.message };
  }
}

async function executeEmailAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Resolve target (could be 'client.email', 'developer.email', etc.)
  const email = resolveTarget(action.target, event);
  
  // Get template
  const template = action.template 
    ? await getEmailTemplate(action.template)
    : getDefaultTemplate(action.type);
  
  // Render template with event payload
  const html = renderTemplate(template, event.payload);
  
  // Send email
  const emailResult = await sendEmail({
    to: email,
    subject: template.subject,
    html
  });
  
  return { emailId: emailResult.id, recipient: email };
}

async function executeUpdateAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Update entity (stand, deal, invoice, etc.)
  const entity = await prisma[action.target].update({
    where: { id: event.entityId },
    data: action.data || {}
  });
  
  return { updated: true, entityId: entity.id };
}

async function executeCreateAction(
  action: AutomationAction,
  event: AutomationEvent
): Promise<any> {
  // Create entity (contract, invoice, etc.)
  const entity = await prisma[action.target].create({
    data: {
      ...action.data,
      // Link to source entity
      [`${event.entityType}Id`]: event.entityId
    }
  });
  
  return { created: true, entityId: entity.id };
}
```

---

#### Task 2.3: Create Automation Engine

**File:** `lib/automation/engine.ts`

```typescript
/**
 * Automation Engine
 * Processes events and executes matching automations
 */

import { emitEvent, AutomationEvent } from './event-emitter';
import { evaluateCondition } from './rule-engine';
import { executeAction } from './action-executor';

export async function processEvent(event: AutomationEvent): Promise<void> {
  // Log event
  await logEvent(event);
  
  // Find matching automations
  const automations = await prisma.automation.findMany({
    where: {
      enabled: true,
      triggerType: 'event',
      eventType: event.type,
      entityType: event.entityType,
      ...(event.branch && { branch: event.branch })
    }
  });
  
  if (automations.length === 0) {
    return; // No matching automations
  }
  
  // Process each automation
  for (const automation of automations) {
    // Evaluate condition
    const condition = automation.condition as any;
    if (!evaluateCondition(condition, event)) {
      continue; // Condition not met, skip
    }
    
    // Execute actions
    const actions = automation.actions as AutomationAction[];
    for (const action of actions) {
      await executeAction(action, event, automation.id);
    }
    
    // Update automation stats
    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 }
      }
    });
  }
}
```

---

#### Task 2.4: Create Queue System

**File:** `lib/automation/queue.ts`

```typescript
/**
 * Automation Job Queue
 * Manages pending, running, and failed jobs
 */

interface AutomationJob {
  id: string;
  automationId: string;
  event: AutomationEvent;
  action: AutomationAction;
  idempotencyKey: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledAt?: Date;
  createdAt: Date;
}

class AutomationQueue {
  async add(job: AutomationJob): Promise<void> {
    // Store in database (automation_runs table)
    await prisma.automationRun.create({
      data: {
        id: job.id,
        automationId: job.automationId,
        eventType: job.event.type,
        entityType: job.event.entityType,
        entityId: job.event.entityId,
        correlationId: job.event.correlationId,
        status: 'pending',
        actionType: job.action.type,
        actionTarget: job.action.target,
        idempotencyKey: job.idempotencyKey,
        retryCount: 0,
        maxRetries: job.maxRetries,
        scheduledAt: job.scheduledAt,
        branch: job.event.branch || 'Harare'
      }
    });
  }
  
  async getPendingJobs(limit: number = 10): Promise<AutomationJob[]> {
    const runs = await prisma.automationRun.findMany({
      where: {
        status: 'pending',
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });
    
    // Convert to job format
    return runs.map(run => ({
      id: run.id,
      automationId: run.automationId,
      event: {
        type: run.eventType,
        entityType: run.entityType,
        entityId: run.entityId,
        correlationId: run.correlationId || undefined,
        branch: run.branch
      } as AutomationEvent,
      action: {
        type: run.actionType as any,
        target: run.actionTarget
      } as AutomationAction,
      idempotencyKey: run.idempotencyKey,
      retryCount: run.retryCount,
      maxRetries: run.maxRetries,
      status: run.status as any,
      scheduledAt: run.scheduledAt || undefined,
      createdAt: run.createdAt
    }));
  }
  
  async markRunning(jobId: string): Promise<void> {
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    });
  }
  
  async markCompleted(jobId: string, result: any): Promise<void> {
    const run = await prisma.automationRun.findUnique({ where: { id: jobId } });
    if (!run) return;
    
    const duration = run.startedAt 
      ? Date.now() - run.startedAt.getTime()
      : null;
    
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
        durationMs: duration
      }
    });
    
    // Update automation success count
    await prisma.automation.update({
      where: { id: run.automationId },
      data: { successCount: { increment: 1 } }
    });
  }
  
  async markFailed(jobId: string, error: string, stack?: string): Promise<void> {
    const run = await prisma.automationRun.findUnique({ where: { id: jobId } });
    if (!run) return;
    
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error,
        errorStack: stack,
        completedAt: new Date()
      }
    });
    
    // Update automation failure count
    await prisma.automation.update({
      where: { id: run.automationId },
      data: { failureCount: { increment: 1 } }
    });
  }
  
  async retry(jobId: string): Promise<void> {
    const run = await prisma.automationRun.findUnique({ where: { id: jobId } });
    if (!run) return;
    
    if (run.retryCount >= run.maxRetries) {
      return; // Max retries reached
    }
    
    // Reset to pending for retry
    await prisma.automationRun.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        retryCount: { increment: 1 },
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        errorStack: null
      }
    });
  }
}

export const automationQueue = new AutomationQueue();
```

---

#### Task 2.5: Create Worker

**File:** `lib/automation/worker.ts`

```typescript
/**
 * Automation Worker
 * Processes pending jobs from queue
 */

import { automationQueue } from './queue';
import { executeAction } from './action-executor';
import { retryWithBackoff } from './retry';

let workerRunning = false;

export async function startAutomationWorker(): Promise<void> {
  if (workerRunning) {
    console.warn('[AUTOMATION] Worker already running');
    return;
  }
  
  workerRunning = true;
  console.log('[AUTOMATION] Worker started');
  
  // Process queue every 5 seconds
  setInterval(async () => {
    try {
      await processQueue();
    } catch (error) {
      console.error('[AUTOMATION] Worker error:', error);
    }
  }, 5000);
}

async function processQueue(): Promise<void> {
  const jobs = await automationQueue.getPendingJobs(10);
  
  for (const job of jobs) {
    try {
      // Mark as running
      await automationQueue.markRunning(job.id);
      
      // Execute with retry
      const result = await retryWithBackoff(
        () => executeAction(job.action, job.event, job.automationId),
        job.retryCount,
        {
          maxRetries: job.maxRetries,
          backoff: 'exponential',
          initialDelay: 1000,
          maxDelay: 60000
        }
      );
      
      // Mark as completed
      await automationQueue.markCompleted(job.id, result.result);
      
    } catch (error: any) {
      // Mark as failed
      await automationQueue.markFailed(job.id, error.message, error.stack);
      
      // Retry if not maxed out
      if (job.retryCount < job.maxRetries) {
        await automationQueue.retry(job.id);
      }
    }
  }
}
```

**Start Worker:**
```typescript
// app/api/automation/worker/route.ts
import { startAutomationWorker } from '@/lib/automation/worker';

// Start worker on first request
let workerStarted = false;

export async function GET() {
  if (!workerStarted) {
    startAutomationWorker();
    workerStarted = true;
  }
  
  return NextResponse.json({ status: 'running' });
}
```

---

### DAY 3: MIGRATION

#### Task 3.1: Migrate Payment Automation

**Convert Payment Reminders to Automation:**

```typescript
// Create automation record
await prisma.automation.create({
  data: {
    name: 'Payment Reminders',
    description: 'Send payment reminders on 5th and 20th of month',
    enabled: true,
    triggerType: 'schedule',
    schedule: '0 9 5,20 * *', // 5th and 20th at 09:00 UTC
    entityType: 'invoice',
    condition: {
      field: 'status',
      operator: 'in',
      value: ['OUTSTANDING', 'PAYMENT_PENDING']
    },
    actions: [{
      type: 'email',
      target: 'client.email',
      template: 'payment-reminder'
    }],
    branch: 'Harare',
    retryPolicy: {
      maxRetries: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 60000
    }
  }
});
```

**Create Schedule Handler:**
```typescript
// lib/automation/scheduler.ts
export async function processScheduledAutomations(): Promise<void> {
  const now = new Date();
  const cronExpression = getCronExpression(now); // '0 9 5,20 * *'
  
  const automations = await prisma.automation.findMany({
    where: {
      enabled: true,
      triggerType: 'schedule',
      schedule: cronExpression
    }
  });
  
  for (const automation of automations) {
    // Find entities matching condition
    const entities = await findEntities(automation.entityType, automation.condition);
    
    // Emit events for each entity
    for (const entity of entities) {
      await emitEvent({
        type: `${automation.entityType}.scheduled`,
        entityType: automation.entityType,
        entityId: entity.id,
        payload: entity,
        branch: automation.branch
      });
    }
  }
}
```

**Update Cron Job:**
```typescript
// app/api/cron/send-payment-reminders/route.ts
export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  // ...
  
  // Call scheduler instead of direct logic
  await processScheduledAutomations();
  
  return NextResponse.json({ success: true });
}
```

---

#### Task 3.2: Migrate Pipeline Rules

**Convert Pipeline Rules to Automations:**

```typescript
// Migration script
const rules = await prisma.pipelineRule.findMany({
  where: { enabled: true }
});

for (const rule of rules) {
  await prisma.automation.create({
    data: {
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      triggerType: 'event',
      eventType: 'deal.updated',
      entityType: 'deal',
      condition: rule.condition,
      actions: [rule.action],
      branch: 'Harare' // Default, can be enhanced
    }
  });
}
```

**Wire into Deal Updates:**
```typescript
// app/api/admin/deals/[id]/route.ts (PUT handler)
export async function PUT(...) {
  // ... update deal ...
  
  // Emit event
  await emitEvent({
    type: 'deal.updated',
    entityType: 'deal',
    entityId: id,
    payload: { ...deal, ...updateData },
    branch: user.branch
  });
  
  return NextResponse.json({ success: true, data: deal });
}
```

---

#### Task 3.3: Migrate Payment Success Handler

**Convert to Event-Driven:**

```typescript
// lib/payment-success-handler.ts
export async function handlePaymentSuccess(paymentId: string): Promise<PaymentSuccessResult> {
  // ... fetch payment ...
  
  // Emit event instead of direct execution
  const correlationId = `payment-${paymentId}`;
  
  await emitEvent({
    type: 'payment.confirmed',
    entityType: 'payment',
    entityId: paymentId,
    payload: {
      amount: payment.amount,
      clientId: payment.clientId,
      standId: payment.standId,
      developmentId: payment.stand?.developmentId
    },
    branch: payment.office_location,
    correlationId
  });
  
  // Return success (execution happens async via automation engine)
  return {
    success: true,
    message: 'Payment success event emitted'
  };
}
```

**Create Automation:**
```typescript
// Payment Success → Contract Automation
await prisma.automation.create({
  data: {
    name: 'Payment Success → Contract Creation',
    description: 'When payment is confirmed, mark stand SOLD, create contract, send email',
    enabled: true,
    triggerType: 'event',
    eventType: 'payment.confirmed',
    entityType: 'payment',
    condition: {
      field: 'status',
      operator: 'equals',
      value: 'CONFIRMED'
    },
    actions: [
      {
        type: 'update',
        target: 'stand',
        data: { status: 'SOLD' }
      },
      {
        type: 'create',
        target: 'contract',
        data: { templateId: 'default', status: 'DRAFT - PAYMENT RECEIVED' }
      },
      {
        type: 'email',
        target: 'client.email',
        template: 'contract-created'
      },
      {
        type: 'email',
        target: 'developer.email',
        template: 'contract-created'
      }
    ],
    branch: 'Harare'
  }
});
```

---

#### Task 3.4: Add Adapter Layer

**For Backward Compatibility:**

```typescript
// lib/automation/adapters/payment-automation-adapter.ts
export async function getPaymentAutomationSettings(branch: string) {
  // Try new system first
  const automation = await prisma.automation.findFirst({
    where: {
      branch,
      name: { contains: 'Payment' }
    }
  });
  
  if (automation) {
    // Convert to old format for compatibility
    return {
      enableReminders: automation.name.includes('Reminder'),
      enableEscalation: automation.name.includes('Escalation'),
      // ... map other fields
    };
  }
  
  // Fallback to old table
  return await prisma.paymentAutomationSettings.findUnique({
    where: { branch }
  });
}
```

---

### DAY 4: UI REDESIGN

#### Task 4.1: Create AutomationList Component

**File:** `components/admin/AutomationList.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  eventType?: string;
  schedule?: string;
  lastRunAt: Date | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}

export default function AutomationList() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAutomations();
  }, []);
  
  const fetchAutomations = async () => {
    const res = await fetch('/api/admin/automations');
    const data = await res.json();
    setAutomations(data.data || []);
    setLoading(false);
  };
  
  const toggleEnabled = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled })
    });
    fetchAutomations();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Success Rate</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map(automation => (
              <TableRow key={automation.id}>
                <TableCell>{automation.name}</TableCell>
                <TableCell>
                  {automation.triggerType === 'event' 
                    ? automation.eventType 
                    : automation.schedule}
                </TableCell>
                <TableCell>
                  <Badge variant={automation.enabled ? 'default' : 'secondary'}>
                    {automation.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {automation.lastRunAt 
                    ? new Date(automation.lastRunAt).toLocaleString()
                    : 'Never'}
                </TableCell>
                <TableCell>
                  {automation.runCount > 0
                    ? `${Math.round((automation.successCount / automation.runCount) * 100)}%`
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => toggleEnabled(automation.id, automation.enabled)}
                  >
                    {automation.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

#### Task 4.2: Create AutomationDetail Component

**File:** `components/admin/AutomationDetail.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AutomationDetailProps {
  automationId: string;
}

export default function AutomationDetail({ automationId }: AutomationDetailProps) {
  const [automation, setAutomation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAutomation();
  }, [automationId]);
  
  const fetchAutomation = async () => {
    const res = await fetch(`/api/admin/automations/${automationId}`);
    const data = await res.json();
    setAutomation(data.data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    await fetch(`/api/admin/automations/${automationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automation)
    });
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={automation.name}
              onChange={(e) => setAutomation({ ...automation, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={automation.description || ''}
              onChange={(e) => setAutomation({ ...automation, description: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={automation.enabled}
              onCheckedChange={(enabled) => setAutomation({ ...automation, enabled })}
            />
            <Label>Enabled</Label>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Trigger Type</Label>
            <Select
              value={automation.triggerType}
              onValueChange={(value) => setAutomation({ ...automation, triggerType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {automation.triggerType === 'event' && (
            <div>
              <Label>Event Type</Label>
              <Input
                value={automation.eventType || ''}
                onChange={(e) => setAutomation({ ...automation, eventType: e.target.value })}
                placeholder="payment.confirmed"
              />
            </div>
          )}
          
          {automation.triggerType === 'schedule' && (
            <div>
              <Label>Cron Schedule</Label>
              <Input
                value={automation.schedule || ''}
                onChange={(e) => setAutomation({ ...automation, schedule: e.target.value })}
                placeholder="0 9 5,20 * *"
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Condition (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Condition builder UI */}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Action list UI */}
        </CardContent>
      </Card>
      
      <Button onClick={handleSave}>Save Automation</Button>
    </div>
  );
}
```

---

#### Task 4.3: Create AutomationLogs Component

**File:** `components/admin/AutomationLogs.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  eventType: string;
  entityId: string;
  status: string;
  actionType: string;
  errorMessage?: string;
  durationMs?: number;
  createdAt: Date;
  correlationId?: string;
}

export default function AutomationLogs() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [filters, setFilters] = useState({
    automationId: '',
    entityId: '',
    status: '',
    correlationId: ''
  });
  
  useEffect(() => {
    fetchLogs();
  }, [filters]);
  
  const fetchLogs = async () => {
    const params = new URLSearchParams();
    if (filters.automationId) params.append('automationId', filters.automationId);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.status) params.append('status', filters.status);
    if (filters.correlationId) params.append('correlationId', filters.correlationId);
    
    const res = await fetch(`/api/admin/automations/runs?${params}`);
    const data = await res.json();
    setRuns(data.data || []);
  };
  
  const retryRun = async (runId: string) => {
    await fetch(`/api/admin/automations/runs/${runId}/retry`, { method: 'POST' });
    fetchLogs();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Run History</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Input
            placeholder="Automation ID"
            value={filters.automationId}
            onChange={(e) => setFilters({ ...filters, automationId: e.target.value })}
          />
          <Input
            placeholder="Entity ID"
            value={filters.entityId}
            onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
          />
          <Input
            placeholder="Correlation ID"
            value={filters.correlationId}
            onChange={(e) => setFilters({ ...filters, correlationId: e.target.value })}
          />
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Automation</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map(run => (
              <TableRow key={run.id}>
                <TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
                <TableCell>{run.automationName}</TableCell>
                <TableCell>{run.eventType}</TableCell>
                <TableCell>
                  {run.entityId}
                  {run.correlationId && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({run.correlationId})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {run.durationMs ? `${run.durationMs}ms` : 'N/A'}
                </TableCell>
                <TableCell>
                  {run.status === 'failed' && (
                    <Button size="sm" onClick={() => retryRun(run.id)}>
                      Retry
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

#### Task 4.4: Create Automation API

**File:** `app/api/admin/automations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ success: true, data: automations });
}

export async function POST(request: NextRequest) {
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
    entityType,
    condition,
    actions,
    branch,
    retryPolicy
  } = body;
  
  const automation = await prisma.automation.create({
    data: {
      name,
      description,
      enabled: enabled !== false,
      triggerType,
      eventType,
      schedule,
      entityType,
      condition: condition || null,
      actions: actions || [],
      branch: branch || 'Harare',
      retryPolicy: retryPolicy || {
        maxRetries: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 60000
      }
    }
  });
  
  return NextResponse.json({ success: true, data: automation }, { status: 201 });
}
```

**File:** `app/api/admin/automations/[id]/route.ts`

```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automation = await prisma.automation.findUnique({
    where: { id },
    include: { runs: { take: 10, orderBy: { createdAt: 'desc' } } }
  });
  return NextResponse.json({ success: true, data: automation });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const automation = await prisma.automation.update({
    where: { id },
    data: body
  });
  return NextResponse.json({ success: true, data: automation });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.automation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

**File:** `app/api/admin/automations/runs/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const automationId = searchParams.get('automationId');
  const entityId = searchParams.get('entityId');
  const status = searchParams.get('status');
  const correlationId = searchParams.get('correlationId');
  
  const runs = await prisma.automationRun.findMany({
    where: {
      ...(automationId && { automationId }),
      ...(entityId && { entityId }),
      ...(status && { status }),
      ...(correlationId && { correlationId })
    },
    include: { automation: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  
  return NextResponse.json({ success: true, data: runs });
}
```

---

### DAY 5: TESTING & CLEANUP

#### Task 5.1: Regression Tests

**Test Script:** `scripts/test-automation-regression.ts`

```typescript
/**
 * Regression Tests for Automation Module
 */

async function testPaymentSuccessFlow() {
  // 1. Create payment as CONFIRMED
  const payment = await createPayment({
    status: 'CONFIRMED',
    clientId: 'test-client',
    standId: 'test-stand'
  });
  
  // 2. Wait for automation to process
  await sleep(2000);
  
  // 3. Verify stand is SOLD
  const stand = await getStand('test-stand');
  assert(stand.status === 'SOLD', 'Stand should be SOLD');
  
  // 4. Verify contract created
  const contracts = await getContracts({ standId: 'test-stand' });
  assert(contracts.length === 1, 'Contract should be created');
  
  // 5. Verify email sent
  const runs = await getAutomationRuns({ entityId: payment.id });
  assert(runs.some(r => r.actionType === 'email'), 'Email should be sent');
  
  // 6. Verify correlation ID links all
  const correlationId = `payment-${payment.id}`;
  const allRuns = await getAutomationRuns({ correlationId });
  assert(allRuns.length >= 3, 'Should have payment, contract, email runs');
}

async function testIdempotency() {
  // 1. Create payment as CONFIRMED
  const payment = await createPayment({ status: 'CONFIRMED', ... });
  
  // 2. Emit event twice (simulate duplicate)
  await emitEvent({ type: 'payment.confirmed', entityId: payment.id, ... });
  await emitEvent({ type: 'payment.confirmed', entityId: payment.id, ... });
  
  // 3. Verify only one contract created
  const contracts = await getContracts({ standId: payment.standId });
  assert(contracts.length === 1, 'Should not create duplicate contract');
}

async function testRetry() {
  // 1. Create automation with failing action
  // 2. Trigger automation
  // 3. Verify retry happens
  // 4. Verify max retries respected
}
```

---

#### Task 5.2: Remove Old Files

**After Migration Complete:**

1. Delete `components/admin/AdminPaymentAutomation.tsx`
2. Delete `components/admin/AdminPaymentAutomationDashboard.tsx`
3. Delete `app/api/admin/payment-automation/settings/route.ts`
4. Delete `app/api/admin/payment-automation/logs/route.ts`
5. Delete `app/api/admin/pipeline-rules/route.ts` (or keep as adapter)

**Keep Temporarily (Adapter Layer):**
- `PaymentAutomationSettings` table (read-only adapter)
- `PaymentAutomationLog` table (migrate to AutomationRun)

---

## FILES SUMMARY

### Files to Create (10):
1. `lib/automation/event-emitter.ts`
2. `lib/automation/engine.ts`
3. `lib/automation/rule-engine.ts`
4. `lib/automation/action-executor.ts`
5. `lib/automation/queue.ts`
6. `lib/automation/worker.ts`
7. `lib/automation/scheduler.ts`
8. `app/api/admin/automations/route.ts`
9. `app/api/admin/automations/[id]/route.ts`
10. `app/api/admin/automations/runs/route.ts`

### Files to Delete (5):
1. `components/admin/AdminPaymentAutomation.tsx`
2. `components/admin/AdminPaymentAutomationDashboard.tsx`
3. `app/api/admin/payment-automation/settings/route.ts`
4. `app/api/admin/payment-automation/logs/route.ts`
5. `app/api/admin/pipeline-rules/route.ts` (after migration)

### Files to Modify (7):
1. `lib/payment-success-handler.ts` - Emit events
2. `app/api/admin/payments/route.ts` - Emit events, remove duplicate logic
3. `app/actions/verify-payment.ts` - Emit events
4. `app/api/admin/deals/[id]/route.ts` - Emit events
5. `app/api/admin/deals/[id]/move/route.ts` - Emit events
6. All cron jobs - Convert to event emitters or automations
7. `prisma/schema.prisma` - Add Automation tables

### Files to Merge (2):
1. `components/admin/AutomationSettingsForm.tsx` → `AutomationDetail.tsx`
2. `components/admin/EmailLogsViewer.tsx` → `AutomationLogs.tsx`

---

## PERFORMANCE WINS

### Before:
- 6 cron jobs polling every hour/day/month
- ~100+ DB queries per cron run
- Synchronous execution
- No caching

### After:
- Event-driven (immediate, no polling)
- ~10 DB queries per event (find automations + execute)
- Async execution (non-blocking)
- Cached automation rules

### Expected Improvements:
- **90% reduction** in database queries
- **Instant execution** (no waiting for cron)
- **Better scalability** (queue-based)
- **Lower latency** (events trigger immediately)

---

## NO-REGRESSION CHECKLIST

### Functional Tests:
- [ ] Payment CONFIRMED → Stand SOLD
- [ ] Payment CONFIRMED → Contract created
- [ ] Payment CONFIRMED → Email sent
- [ ] Correlation ID links payment → contract → email
- [ ] Idempotency prevents duplicates
- [ ] Retry works for failed actions
- [ ] Pipeline rules execute on deal update
- [ ] Payment reminders still sent (5th, 20th)
- [ ] Escalation still sent (1st)
- [ ] Follow-ups still sent (10th, 25th)
- [ ] Reservations still expire (hourly)
- [ ] Invoices still generated (25th)
- [ ] Developer reports still sent (Monday)

### Performance Tests:
- [ ] Event emission < 10ms
- [ ] Automation evaluation < 50ms
- [ ] Action execution < 500ms
- [ ] No N+1 queries
- [ ] Queue processing < 100ms per job

### Integration Tests:
- [ ] Payment API → Event → Automation → Contract
- [ ] Deal API → Event → Automation → Rule
- [ ] Cron → Event → Automation → Email
- [ ] Failed action → Retry → Success

---

**Status:** ✅ **IMPLEMENTATION PLAN COMPLETE**

**Next Step:** Begin implementation starting with Day 1 tasks.
