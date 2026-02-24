# In-App Notifications + Audit Emails - Architecture Audit Report

## Executive Summary

This document provides a comprehensive audit of the existing codebase to inform the design of a production-ready In-App Notifications and Audit Emails system using Resend.

---

## Phase 1: Audit Findings

### 1. Existing Resend Integration

**Location**: `lib/email-service.ts` and `lib/resend.ts`

**Current Implementation**:
- Uses Resend SDK (`resend` npm package)
- API Key: `RESEND_API_KEY` environment variable
- From Email: `AUTH_EMAIL_FROM` or `noreply@fineandcountryerp.com`
- Direct fetch API calls to `https://api.resend.com/emails`
- Validation helper: `validateResendApiKey()` in `lib/email-service.ts`

**Key Functions**:
- `sendEmail()` - Generic email sending with HTML/text support
- `sendInvitationEmail()` - User invitation emails
- `resendInvitationEmail()` - Resend invitations
- `validateResendConfig()` - API key validation

**Usage Points**:
- `app/api/emails/send/route.ts` - Email sending API
- `app/api/cron/send-payment-reminders/route.ts` - Payment reminders
- `app/api/cron/send-followup-emails/route.ts` - Follow-up emails
- `app/api/cron/escalate-overdue-invoices/route.ts` - Invoice escalation
- `app/actions/verify-payment.ts` - Payment confirmation
- `app/api/auth/forgot-password/route.ts` - Password reset

### 2. Mutation Points for Critical Events

#### Contracts
- `app/api/admin/contracts/generate/route.ts` - Contract creation
- `app/api/admin/contracts/[id]/send-docuseal/route.ts` - Contract sent for signature
- `app/api/admin/contracts/[id]/signatures/route.ts` - Contract signed
- `app/api/webhooks/docuseal/route.ts` - DocuSeal webhook (signed/completed)

#### Inventory/Stands
- `app/api/admin/stands/route.ts` - Stand creation, update, deletion
- `app/api/admin/reservations/route.ts` - Stand reservation
- `app/api/client/reservations/route.ts` - Client reservations
- `app/api/client/claim-reservations/route.ts` - Reservation claims

#### Receipts
- `app/api/admin/receipts/route.ts` - Receipt issuance
- `app/api/client/documents/[id]/download/route.ts` - Receipt download

#### Installments
- `app/api/admin/installments/route.ts` - Installment creation
- `app/api/admin/installments/[id]/route.ts` - Installment updates
- `app/api/cron/generate-invoices/route.ts` - Invoice generation

#### Payments
- `app/api/admin/payments/route.ts` - Payment recording, verification, rejection
- `app/actions/verify-payment.ts` - Payment verification action

#### Payouts
- `app/api/admin/commission-payouts/route.ts` - Payout initiation, approval, completion

#### User Management
- `app/api/admin/users/route.ts` - User creation, role changes
- `app/api/admin/users/invite/route.ts` - User invitations
- `app/api/admin/permissions/route.ts` - Permission changes

### 3. Auth and RBAC Enforcement Patterns

**Primary Auth Functions**:
- `requireAdmin()` - `lib/adminAuth.ts` and `lib/access-control.ts`
- `requireRole(['ADMIN', 'AGENT'])` - Role-based access
- `getAuthenticatedUser()` - Get current user

**Pattern**:
```typescript
const authResult = await requireAdmin();
if (authResult.error) return authResult.error;
const user = authResult.user;
```

**User Object Structure**:
```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string | null;
}
```

**RBAC Roles**:
- `ADMIN` - Full access
- `MANAGER` - Management access
- `AGENT` - Agent access
- `CLIENT` - Client access
- `ACCOUNT` - Accountant access
- `DEVELOPER` - Developer access

### 4. DB/ORM and Event Emission Points

**Database**: PostgreSQL via Prisma ORM

**Prisma Client**: `lib/prisma.ts`

**Existing Event System**: `lib/events/`
- `lib/events/types.ts` - Event type definitions
- `lib/events/event-emitter.ts` - Event emitter
- `lib/events/handlers/notification-handler.ts` - Notification handler
- `lib/events/handlers/audit-handler.ts` - Audit handler (newly created)
- `lib/events/recipients/resolver.ts` - Recipient resolver

**Event Types Defined**:
- `NotificationType` enum: CONTRACT_CREATED, CONTRACT_SENT, CONTRACT_SIGNED, etc.
- `SeverityLevel` enum: INFO, WARN, CRITICAL
- `EntityType` enum: CONTRACT, STAND, PAYMENT, RECEIPT, etc.

**Current Event Emission**:
```typescript
// In app/api/admin/deals/[id]/move/route.ts
import { emitEvent } from '@/lib/automation/event-emitter';
emitEvent('deal.moved', { dealId, fromStage, toStage });
```

---

## Phase 2: Design

### A. Event Catalog

| Event Name | Triggers | Recipients | Title/Message | Audit? | Severity |
|------------|----------|------------|---------------|--------|----------|
| contract.sent | Contract sent for signature | Client, Agent | "Contract sent for signature" | YES | INFO |
| contract.resend | Contract resent | Client, Agent | "Contract resent" | YES | INFO |
| contract.approved | Contract approved | Client, Agent, Admin | "Contract approved" | YES | INFO |
| contract.rejected | Contract rejected | Client, Agent, Admin | "Contract rejected" | YES | WARN |
| docuseal.completed | Contract fully signed | Client, Agent, Admin | "Contract signed" | YES | INFO |
| payment.recorded | Payment recorded | Client, Agent, Admin | "Payment recorded" | YES | INFO |
| receipt.issued | Receipt issued | Client | "Receipt issued" | YES | INFO |
| payout.initiated | Payout initiated | Agent, Admin | "Payout initiated" | YES | INFO |
| payout.approved | Payout approved | Agent, Admin | "Payout approved" | YES | INFO |
| payout.completed | Payout completed | Agent | "Payout completed" | YES | INFO |
| stand.reserved | Stand reserved | Client, Agent, Admin | "Stand reserved" | YES | INFO |
| stand.sold | Stand sold | Client, Agent, Admin | "Stand sold" | YES | INFO |
| stand.released | Stand released | Agent, Admin | "Stand released" | YES | WARN |
| role.changed | User role changed | User, Admin | "Role changed" | YES | CRITICAL |
| permission.changed | Permission changed | User, Admin | "Permission changed" | YES | CRITICAL |
| access.denied | Access denied | Admin | "Access denied" | YES | WARN |

### B. Notification Schema

```prisma
model Notification {
  id              String   @id @default(uuid())
  type            String   // NotificationType enum value
  title           String
  message         String
  severity        String   // INFO | WARN | CRITICAL
  
  // Actor (who triggered)
  actorUserId     String?
  actorRole       String?
  
  // Recipient
  recipientUserId String
  
  // Entity reference
  entityType      String   // CONTRACT | STAND | PAYMENT | etc.
  entityId        String
  developmentId   String?
  
  // Metadata
  metadata        Json?
  
  // Status
  isRead          Boolean  @default(false)
  readAt          DateTime?
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Indexes
  @@index([recipientUserId, isRead, createdAt])
  @@index([entityType, entityId])
  @@index([type, createdAt])
  @@index([developmentId])
}
```

### C. EventLog Schema (Idempotency)

```prisma
model EventLog {
  id              String   @id @default(uuid())
  
  // Event identification
  eventName       String
  entityType      String
  entityId        String
  externalEventId String?  // For webhook events (e.g., DocuSeal submissionId)
  status          String   // SUCCESS | FAILED | PENDING
  
  // Idempotency key (unique constraint)
  uniqueKey       String   @unique
  
  // Event data
  payload         Json?
  
  // Audit email tracking
  auditEmailSent  Boolean  @default(false)
  auditEmailSentAt DateTime?
  
  // Timestamps
  createdAt       DateTime @default(now())
  
  // Indexes
  @@index([eventName, entityType, entityId])
  @@index([uniqueKey])
  @@index([createdAt])
}
```

### D. API Routes

1. **GET /api/notifications**
   - Query params: `page`, `limit`, `unreadOnly`, `type`, `severity`
   - Returns: Paginated notifications for authenticated user
   - Security: User can only see their own notifications

2. **POST /api/notifications/read**
   - Body: `{ notificationIds: string[] }`
   - Marks specific notifications as read
   - Security: User can only update their own notifications

3. **POST /api/notifications/read-all**
   - Marks all unread notifications as read
   - Security: User can only update their own notifications

4. **GET /api/notifications/unread-count**
   - Returns: `{ count: number }`
   - Security: User can only see their own count

### E. UI Components

1. **Header Bell Icon**
   - Shows unread count badge
   - Click opens dropdown preview
   - Real-time updates via polling or SSE

2. **Notification Dropdown**
   - Shows last 5 notifications
   - Click notification to navigate
   - "View All" link to full page

3. **Notifications Page**
   - Full list with filters
   - Pagination
   - Mark as read/unread
   - Deep links to entities

### F. Audit Email Configuration

**Environment Variables**:
```bash
# Already present
RESEND_API_KEY=your_api_key

# New variables needed
AUDIT_EMAIL_TO=compliance@company.com,admin@company.com
AUDIT_EMAIL_FROM=no-reply@fineandcountryerp.com
AUDIT_EMAIL_ENABLED=true
APP_BASE_URL=https://yourdomain.com
```

**Audit Email Format**:
```
Subject: [AUDIT][INFO] contract.sent — Gardenia Oakley — contract-123

Body:
- Timestamp: 2026-02-01 11:08:22 UTC (13:08:22 CAT)
- Actor: user-123 (ADMIN) - john@company.com
- Entity: CONTRACT - contract-123
- Development: Gardenia Oakley (dev-456)
- Action: Contract sent for signature to client@email.com
- Link: https://yourdomain.com/admin/contracts/contract-123
```

### G. Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Route / Action                        │
│  (Contract, Payment, Stand mutation)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              emitEvent(eventName, payload)                   │
│         (lib/events/event-emitter.ts)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌─────────────────┐      ┌──────────────────────┐
│  Notification   │      │  Audit Email Handler │
│    Handler      │      │  (if audit-worthy)   │
│                 │      │                      │
│ - Resolve       │      │ - Check idempotency  │
│   recipients    │      │ - Build email        │
│ - Create in-app │      │ - Send via Resend    │
│   notifications │      │ - Log to EventLog    │
└─────────────────┘      └──────────────────────┘
```

### H. Security Considerations

1. **RBAC Enforcement**:
   - Server must validate user can access entity before creating notification
   - Never rely on client-side permissions
   - Use existing `requireRole()` and `requireAdmin()` functions

2. **Data Minimization**:
   - Do not include full ID numbers in notifications
   - Use internal IDs only
   - Redact sensitive PII in audit emails

3. **Idempotency**:
   - Use EventLog table to prevent duplicate emails
   - Unique key: `${eventName}:${entityType}:${entityId}:${externalEventId || 'manual'}`

4. **Fail-Safe**:
   - Audit email failures must not block core transactions
   - Log errors and continue
   - Retry mechanism for failed emails

### I. Files to Touch

**Database**:
- `prisma/schema.prisma` - Add Notification and EventLog models
- `prisma/migrations/` - Create migration

**API Routes**:
- `app/api/notifications/route.ts` - GET list
- `app/api/notifications/read/route.ts` - POST mark read
- `app/api/notifications/read-all/route.ts` - POST mark all read
- `app/api/notifications/unread-count/route.ts` - GET count

**Event System**:
- `lib/events/event-emitter.ts` - Enhance emitEvent
- `lib/events/handlers/notification-handler.ts` - Create notifications
- `lib/events/handlers/audit-handler.ts` - Send audit emails
- `lib/events/recipients/resolver.ts` - Resolve recipients by role/entity

**Email**:
- `lib/audit-email.ts` - New: Audit email service
- `lib/email-service.ts` - Enhance with audit email function

**UI Components**:
- `components/notifications/NotificationBell.tsx` - Bell icon with badge
- `components/notifications/NotificationDropdown.tsx` - Dropdown preview
- `app/notifications/page.tsx` - Full notifications page

**Integration Points**:
- `app/api/admin/contracts/generate/route.ts` - Emit contract.created
- `app/api/admin/payments/route.ts` - Emit payment.recorded
- `app/api/admin/stands/route.ts` - Emit stand.reserved/sold
- `app/api/webhooks/docuseal/route.ts` - Emit docuseal.completed
- (And other mutation points...)

---

## Phase 3: Review Checklist

Before proceeding with implementation, confirm:

- [ ] Event catalog covers all required audit events
- [ ] Notification schema meets all requirements
- [ ] EventLog schema provides adequate idempotency
- [ ] RBAC rules are clear and unambiguous
- [ ] No data leak risks identified
- [ ] Environment variables are acceptable
- [ ] Implementation plan is complete

**STOP**: Do not proceed with DB migrations until this document is reviewed and approved.
