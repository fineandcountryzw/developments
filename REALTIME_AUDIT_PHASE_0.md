# Real-Time Updates System Audit (Phase 0)

## Current System Analysis

### 1. Existing Real-Time Infrastructure

The system already has a basic real-time implementation using **Server-Sent Events (SSE)**:

**Backend Files:**
- `lib/realtime.ts` - Provides broadcast functions for payment, reservation, activity, stand, and client updates
- `lib/realtime-connections.ts` - Manages SSE connections and broadcast logic with role-based filtering
- `app/api/realtime/route.ts` - SSE endpoint for establishing connections

**Event System:**
- `lib/events/event-emitter.ts` - Central event emission system with idempotency check
- `lib/events/types.ts` - Event type definitions and configuration (50+ event types)
- `lib/events/handlers/notification-handler.ts` - In-app notification creation
- `lib/events/handlers/audit-handler.ts` - Audit email sending
- `lib/events/recipients/resolver.ts` - Role-based recipient resolution

**Notification Service:**
- `lib/notifications.ts` - Pre-built notification helpers for common events
- Prisma model `Notification` (line 591) - Stores notifications in DB

### 2. Event Sources in System

The system has comprehensive event tracking for all key business operations:

#### Inventory Events
- **Stand Events:** Reserved, Sold, Released
- **Reservation Events:** Created, Updated, Expired, Cancelled
- **Contract Events:** Created, Sent, Signed, Resent, Approved, Rejected

#### Financial Events
- **Payment Events:** Recorded, Verified, Rejected
- **Receipt Events:** Issued, Voided
- **Installment Events:** Paid, Overdue
- **Payout Events:** Initiated, Approved, Completed

#### System Events
- **User Events:** Invited, Role Changed
- **Access Events:** Denied (security alerts)
- **Import Events:** Job completed/failed
- **Report Events:** Recon report completed

### 3. Current Notification System

**Notification Model Structure:**
```prisma
model Notification {
  id              String           @id @default(cuid())
  type            NotificationType // 50+ types
  severity        SeverityLevel    @default(INFO) // INFO, WARN, CRITICAL
  title           String
  message         String
  actorUserId     String?          // Who triggered the event
  actorRole       UserRole?
  recipientUserId String           // Who receives the notification
  recipientRole   UserRole?
  entityType      EntityType       // What the notification is about
  entityId        String
  developmentId   String?          // Scope to specific development
  metadata        Json?
  isRead          Boolean          @default(false)
  readAt          DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

**Event Configuration:**
Each event type has configuration defining:
- Severity level (INFO/WARN/CRITICAL)
- Whether to send audit email
- Whether to create in-app notification
- Recipient roles (ADMIN, MANAGER, AGENT, ACCOUNT)
- Whether to notify client/developer
- Example: `EVENT_CONFIG[NotificationType.PAYMENT_RECORDED]`

### 4. RBAC Roles and Scoping Rules

**User Roles (6 defined):**
1. **ADMIN** - Full system access (all events)
2. **MANAGER** - Branch management (branch-scoped events)
3. **AGENT** - Client/lead management (own clients/leads)
4. **ACCOUNT** - Finance operations (finance-wide events)
5. **CLIENT** - Own records only
6. **DEVELOPER** - Own developments only

**Event Recipient Resolution:**
- `resolveRecipients()` in `lib/events/recipients/resolver.ts` handles role-based filtering
- Uses field-level security to prevent data leaks
- Events are scoped by development/branch/user

### 5. Current Real-Time Limitations

**SSE Implementation Issues:**
1. **Vercel Compatibility:** SSE on Vercel has connection timeout limits (~30-60 seconds)
2. **Scalability:** No multi-instance support (connections stored in memory)
3. **Durability:** No offline event buffering
4. **Message Ordering:** No guaranteed delivery order
5. **Reconnection:** Manual reconnection logic required on client
6. **Payload Size:** Limited by HTTP response size

## Event Catalog (Phase 0 Deliverable)

### Event Source Breakdown

| Event Name | Producer Action | Payload Fields | Audience | Channel Scope |
|---|---|---|---|---|
| **Inventory Events** | | | | |
| STAND_RESERVED | Stand reserved by client | standId, standNumber, developmentId, clientId, agentId, reservationId | ADMIN, MANAGER, AGENT, CLIENT (if developer), DEVELOPER (if scope) | private-dev-<developmentId>, private-user-<clientId> |
| STAND_SOLD | Stand marked as sold | standId, standNumber, developmentId, clientId, salePrice | ADMIN, MANAGER, AGENT, ACCOUNT, CLIENT, DEVELOPER | private-dev-<developmentId>, private-user-<clientId> |
| STAND_RELEASED | Stand released from reservation | standId, standNumber, developmentId, previousClientId, reason | ADMIN, MANAGER, DEVELOPER | private-dev-<developmentId> |
| RESERVATION_UPDATED | Reservation status changed | reservationId, standId, clientId, status, expiresAt | ADMIN, MANAGER, AGENT, CLIENT | private-user-<clientId>, private-dev-<developmentId> |
| **Financial Events** | | | | |
| PAYMENT_RECORDED | Payment recorded | paymentId, clientId, standId, developmentId, amount, method | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| PAYMENT_VERIFIED | Payment verified | paymentId, clientId, standId, developmentId, amount, verifiedBy | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| PAYMENT_REJECTED | Payment rejected | paymentId, clientId, standId, developmentId, amount, reason | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| RECEIPT_ISSUED | Receipt issued | receiptId, paymentId, clientId, developmentId, amount, receiptNumber | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| RECEIPT_VOIDED | Receipt voided | receiptId, paymentId, clientId, developmentId, amount, reason, voidedBy | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| INSTALLMENT_PAID | Installment paid | installmentId, planId, clientId, developmentId, amount, installmentNo | ADMIN, MANAGER, ACCOUNT, CLIENT | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| INSTALLMENT_OVERDUE | Installment overdue | installmentId, planId, clientId, developmentId, amount, daysOverdue | ADMIN, MANAGER, AGENT, CLIENT | private-user-<clientId>, private-dev-<developmentId> |
| PAYOUT_INITIATED | Payout initiated | payoutId, agentId, developmentId, amount, month | ADMIN, MANAGER, ACCOUNT | private-admin, private-accounts |
| PAYOUT_APPROVED | Payout approved | payoutId, agentId, developmentId, amount, approvedBy | ADMIN, MANAGER, ACCOUNT | private-admin, private-accounts |
| PAYOUT_COMPLETED | Payout completed | payoutId, agentId, developmentId, amount, completedAt | ADMIN, MANAGER, ACCOUNT | private-admin, private-accounts |
| **Contract Events** | | | | |
| CONTRACT_CREATED | Contract generated | contractId, templateId, standId, clientId, developmentId | ADMIN, MANAGER, AGENT, CLIENT | private-user-<clientId>, private-dev-<developmentId> |
| CONTRACT_SENT | Contract sent for signature | contractId, clientId, developerId, developmentId | ADMIN, MANAGER, AGENT, CLIENT, DEVELOPER | private-user-<clientId>, private-dev-<developmentId> |
| CONTRACT_SIGNED | Contract signed | contractId, clientId, developerId, developmentId, signedBy | ADMIN, MANAGER, AGENT, ACCOUNT, CLIENT, DEVELOPER | private-user-<clientId>, private-dev-<developmentId>, private-accounts |
| **System Events** | | | | |
| USER_INVITED | User invited to system | invitationId, email, role, branch, invitedBy | ADMIN, MANAGER | private-admin |
| USER_ROLE_CHANGED | User role updated | userId, email, previousRole, newRole, changedBy | ADMIN, MANAGER | private-admin |
| ACCESS_DENIED | Access denied to resource | resource, action, attemptedBy, attemptedRole, reason | ADMIN, MANAGER | private-admin |
| IMPORT_JOB_COMPLETED | Import job finished | jobId, filename, recordCount, status, errors | ADMIN, MANAGER | private-admin |
| RECON_REPORT_COMPLETED | Recon report generated | reportId, period, developmentId, status | ADMIN, MANAGER, ACCOUNT | private-admin, private-accounts, private-dev-<developmentId> |

### Recipient Resolution Logic

**For Each Event Type:**
1. **Role-based recipients:** All users with specific roles (ADMIN, MANAGER, AGENT, ACCOUNT)
2. **Client notification:** Client associated with the entity (if `notifyClient = true`)
3. **Developer notification:** Developer of the development (if `notifyDeveloper = true` and `developmentId` exists)
4. **Agent notification:** Agent assigned to the client (if applicable)

**Example Flow:** Payment Recorded event
- ADMIN, MANAGER, ACCOUNT roles receive notification
- Client receives notification
- If payment is development-specific, developer receives notification
- If payment is stand-specific, agent associated with stand/client receives notification

## Architecture Recommendation (Phase 1)

### Transport Selection: Pusher

**Why Pusher?**
1. **Vercel Compatible:** HTTP-based WebSockets, works well with serverless
2. **Managed Service:** No infrastructure to maintain
3. **Reliable:** Automatic reconnections, message buffering
4. **Scalable:** Handles 100k+ concurrent connections
5. **Auth:** Built-in private channel authentication
6. **Cost:** Reasonable pricing for ERP-scale (1000+ monthly active users)

### Channel Naming Scheme

```javascript
// User-specific notifications (private)
private-user-<userId>

// Development-scoped events (private)
private-dev-<developmentId>

// Role-specific channels (private)
private-admin          // ADMIN, MANAGER
private-accounts       // ACCOUNT role
private-agents         // AGENT role (branch-scoped)
```

### Authentication Strategy

1. **Server-side authentication:** Verify user session and role before issuing channel auth
2. **Channel auth endpoint:** `app/api/pusher/auth/route.ts`
3. **Token-based auth:** Use `pusher.signature` to validate requests
4. **Role validation:** Check user role and ownership before allowing subscription
5. **No sensitive data in channel names:** Use internal IDs, not user emails or development names

## Summary

The system already has a comprehensive event-driven architecture with:
- 50+ event types covering all business operations
- Role-based access control (RBAC) on all events
- In-app notifications stored in database
- Email notifications for audit purposes
- Current SSE implementation with basic real-time functionality

**Key Gaps for Production:**
1. Replace SSE with managed WebSocket solution (Pusher recommended)
2. Add durable event storage and offline buffering
3. Implement proper channel authentication and scoping
4. Add client-side reconnection and state synchronization logic
