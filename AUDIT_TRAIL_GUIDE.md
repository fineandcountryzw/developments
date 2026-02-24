# 🔍 Audit Trail System Guide

**Forensic Activity Tracking for Fine & Country Zimbabwe ERP**

This comprehensive audit trail system permanently logs every critical user action in the Neon database, providing complete visibility into system operations for security monitoring, compliance, and analytics.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Activity Types](#activity-types)
4. [Server Actions API](#server-actions-api)
5. [Lead Log Component](#lead-log-component)
6. [Integration Guide](#integration-guide)
7. [Security & Compliance](#security--compliance)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

### Purpose

The Audit Trail system tracks:
- ✅ **User Logins** - Authentication events
- ✅ **Reservations** - Stand bookings with metadata
- ✅ **Payment Uploads** - Proof of payment submissions
- ✅ **Verifications** - Agent payment confirmations
- ✅ **Stand Updates** - Status changes (AVAILABLE → RESERVED → SOLD)
- ✅ **User Management** - New user creation
- ✅ **Agent Assignments** - Lead distribution

### Architecture

```
┌─────────────────┐
│  User Action    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Server Action   │ ← logActivity()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Neon PostgreSQL │ ← activities table
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admin Dashboard │ ← LeadLog component
└─────────────────┘
```

### Key Features

- 🔒 **Role-Based Access**: ADMIN-only access to activity logs
- 🔄 **Real-Time Updates**: 30-second polling for live feed
- 📊 **Rich Metadata**: JSON storage for context (stand IDs, amounts, etc.)
- 🎨 **Color-Coded Badges**: Visual distinction by activity type
- 👤 **User Avatars**: Automatic initials or profile images
- ⏱️ **Relative Timestamps**: "Just now", "5m ago", "2h ago"
- 🛡️ **Security Context**: IP address, device type, browser tracking
- 🚨 **Fraud Detection**: Multi-IP reservation alerts, rapid-fire detection

---

## 🗄️ Database Schema

### Activity Model

```prisma
model Activity {
  id          String       @id @default(cuid())
  type        ActivityType
  description String
  metadata    Json?        // Stand IDs, agent names, amounts, etc.
  
  // Relations
  userId      String       @map("user_id")
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime     @default(now()) @map("created_at")

  @@index([userId])
  @@index([type])
  @@index([createdAt(sort: Desc)])
  @@map("activities")
}
```

### ActivityType Enum

```prisma
enum ActivityType {
  LOGIN
  RESERVATION
  PAYMENT_UPLOAD
  VERIFICATION
  STAND_UPDATE
  USER_CREATED
  AGENT_ASSIGNED
}
```

### Indexes

- `activities_user_id_idx` - Fast user-specific queries
- `activities_type_idx` - Filter by activity type
- `activities_created_at_idx` - Descending chronological order

---

## 📊 Activity Types

### 1. LOGIN

**Triggered**: User successfully authenticates  
**Example**: `"User logged in"`  
**Metadata**:
```json
{
  "timestamp": "2025-12-28T10:30:00Z"
}
```

### 2. RESERVATION

**Triggered**: Client creates a new reservation  
**Example**: `"Reserved stand in Glen Lorne Heights"`  
**Metadata**:
```json
{
  "standId": "clxy5m8n90001",
  "developmentName": "Glen Lorne Heights",
  "security": {
    "ipAddress": "41.206.35.142",
    "deviceType": "mobile",
    "browser": "Chrome",
    "os": "Android",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2025-12-28T10:30:00Z"
  }
}
```

### 3. PAYMENT_UPLOAD

**Triggered**: Client uploads proof of payment  
**Example**: `"Uploaded proof of payment"`  
**Metadata**:
```json
{
  "reservationId": "clxy7k2p40002",
  "popUrl": "https://utfs.io/f/abc123.pdf"
}
```

### 4. VERIFICATION

**Triggered**: Agent verifies payment and confirms sale  
**Example**: `"Verified payment for stand GLH-A15"`  
**Metadata**:
```json
{
  "reservationId": "clxy7k2p40002",
  "standId": "clxy5m8n90001",
  "amount": 50000
}
```
**Badge Color**: Green (Sale completed)

### 5. STAND_UPDATE

**Triggered**: Stand status changes  
**Example**: `"Stand status changed: RESERVED → SOLD"`  
**Metadata**:
```json
{
  "standId": "clxy5m8n90001",
  "oldStatus": "RESERVED",
  "newStatus": "SOLD"
}
```

### 6. USER_CREATED

**Triggered**: Admin creates a new user account  
**Example**: `"Created AGENT user: [email protected]"`  
**Metadata**:
```json
{
  "newUserId": "clxy9m1k80005",
  "email": "[email protected]",
  "role": "AGENT"
}
```

### 7. AGENT_ASSIGNED

**Triggered**: Client is assigned to an agent  
**Example**: `"Assigned agent: John Mukono"`  
**Metadata**:
```json
{
  "clientId": "clxy3n8k70003",
  "agentId": "clxy4p2m80004",
  "agentName": "John Mukono"
}
```

---

## 🔧 Server Actions API

### Core Functions

#### `logActivity(input: LogActivityInput)`

Generic activity logger for custom events.

```typescript
import { logActivity } from '@/app/actions/activity';

await logActivity({
  type: 'RESERVATION',
  description: 'Reserved stand in Glen Lorne Heights',
  metadata: {
    standId: 'clxy5m8n90001',
    developmentName: 'Glen Lorne Heights'
  }
});
```

**Access**: ADMIN, AGENT, CLIENT  
**Returns**: `{ success: boolean, activity?: Activity, error?: string }`

---

#### `getActivities(input?: GetActivitiesInput)`

Fetch recent activities for admin dashboard.

```typescript
import { getActivities } from '@/app/actions/activity';

const result = await getActivities({
  limit: 20,
  type: 'VERIFICATION', // Optional filter
  userId: 'clxy3n8k70003' // Optional filter
});

console.log(result.activities); // Array of ActivityWithUser
```

**Access**: ADMIN only  
**Returns**: `{ success: boolean, activities: ActivityWithUser[], error?: string }`

---

### Convenience Helpers

#### `logLogin()`

```typescript
import { logLogin } from '@/app/actions/activity';

// In your auth callback
await logLogin();
```

---

#### `logReservation(standId, developmentName)`

```typescript
import { logReservation } from '@/app/actions/activity';

await logReservation(
  'clxy5m8n90001',
  'Glen Lorne Heights'
);
```

---

#### `logPaymentUpload(reservationId, popUrl)`

```typescript
import { logPaymentUpload } from '@/app/actions/activity';

await logPaymentUpload(
  'clxy7k2p40002',
  'https://utfs.io/f/abc123.pdf'
);
```

---

#### `logVerification(reservationId, standId, amount)`

```typescript
import { logVerification } from '@/app/actions/activity';

await logVerification(
  'clxy7k2p40002',
  'clxy5m8n90001',
  50000
);
```

---

#### `logStandUpdate(standId, oldStatus, newStatus)`

```typescript
import { logStandUpdate } from '@/app/actions/activity';

await logStandUpdate(
  'clxy5m8n90001',
  'RESERVED',
  'SOLD'
);
```

---

#### `logUserCreated(newUserId, email, role)`

```typescript
import { logUserCreated } from '@/app/actions/activity';

await logUserCreated(
  'clxy9m1k80005',
  '[email protected]',
  'AGENT'
);
```

---

#### `logAgentAssigned(clientId, agentId, agentName)`

```typescript
import { logAgentAssigned } from '@/app/actions/activity';

await logAgentAssigned(
  'clxy3n8k70003',
  'clxy4p2m80004',
  'John Mukono'
);
```

---

## 📱 Lead Log Component

### Usage

```tsx
import LeadLog from '@/components/admin/LeadLog';

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      
      {/* Live Activity Feed */}
      <LeadLog
        refreshInterval={30000} // 30 seconds (default)
        maxItems={20}          // Show last 20 activities (default)
      />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `refreshInterval` | `number` | `30000` | Auto-refresh interval (milliseconds) |
| `maxItems` | `number` | `20` | Maximum activities to display |

### Features

#### 1. Color-Coded Badges

Each activity type has a unique badge:

- 🔵 **Login** - Blue
- 🟡 **Reservation** - Gold (#85754E)
- 🟣 **Payment Upload** - Purple
- 🟢 **Verification (Sale)** - Green
- 🟠 **Stand Update** - Amber
- 🔷 **User Created** - Cyan
- 🟦 **Agent Assigned** - Indigo

#### 2. User Avatars

- **Profile Image**: Shows user's profile picture if available
- **Initials**: Auto-generated from name or email
- **Consistent Colors**: Same user always gets same color

#### 3. Relative Timestamps

- `"Just now"` - < 60 seconds
- `"5m ago"` - < 60 minutes
- `"2h ago"` - < 24 hours
- `"3d ago"` - 24+ hours

#### 4. Metadata Display

Rich metadata shown in expandable code blocks:

```json
{
  "standId": "clxy5m8n90001",
  "developmentName": "Glen Lorne Heights",
  "amount": 50000
}
```

#### 5. Auto-Refresh

Green pulse indicator shows live status. Updates every 30 seconds.

---

## 🔌 Integration Guide

### 1. Add to Admin Dashboard

**File**: `app/admin/page.tsx`

```tsx
import LeadLog from '@/components/admin/LeadLog';

export default function AdminDashboard() {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Stats & Metrics */}
        <div className="lg:col-span-2">
          <h2>System Overview</h2>
          {/* Your existing dashboard content */}
        </div>
        
        {/* Right: Live Activity Feed */}
        <div>
          <LeadLog />
        </div>
        
      </div>
    </div>
  );
}
```

---

### 2. Log Reservation Creation

**File**: `app/actions/create-reservation.ts`

```typescript
import { logReservation } from './activity';

export async function createReservation(input: CreateReservationInput) {
  // ... existing reservation logic ...
  
  const reservation = await prisma.reservation.create({
    data: {
      standId: input.standId,
      userId: session.id,
      // ... other fields ...
    },
    include: {
      stand: {
        include: {
          development: true
        }
      }
    }
  });
  
  // Log the activity
  await logReservation(
    reservation.standId,
    reservation.stand.development.name
  );
  
  return { success: true, reservation };
}
```

---

### 3. Log Payment Upload

**File**: `components/ProofOfPaymentUploader.tsx`

```typescript
import { logPaymentUpload } from '@/app/actions/activity';

async function handleUpload(reservationId: string, fileUrl: string) {
  // ... existing upload logic ...
  
  // Update reservation with popUrl
  await updateReservation(reservationId, { popUrl: fileUrl });
  
  // Log the activity
  await logPaymentUpload(reservationId, fileUrl);
  
  toast.success('Payment uploaded successfully');
}
```

---

### 4. Log Payment Verification

**File**: `app/actions/verify-payment.ts`

```typescript
import { logVerification } from './activity';

export async function verifyPayment(input: VerifyPaymentInput) {
  // ... existing verification logic ...
  
  // Update reservation to CONFIRMED
  const reservation = await prisma.reservation.update({
    where: { id: input.reservationId },
    data: { status: 'CONFIRMED' }
  });
  
  // Log the activity
  await logVerification(
    reservation.id,
    reservation.standId,
    50000 // amount from input
  );
  
  return { success: true };
}
```

---

### 5. Log Authentication

**File**: `lib/auth.ts` or auth callback

```typescript
import { logLogin } from '@/app/actions/activity';

// In your sign-in success callback
export async function onSignInSuccess() {
  await logLogin();
}
```

---

## 🔒 Security & Compliance

### Role-Based Access Control

| Function | ADMIN | AGENT | CLIENT |
|----------|-------|-------|--------|
| `logActivity()` | ✅ | ✅ | ✅ |
| `getActivities()` | ✅ | ❌ | ❌ |
| View LeadLog | ✅ | ❌ | ❌ |

### Data Protection

- ✅ **Cascade Deletion**: Activities deleted when user is deleted
- ✅ **Immutable Records**: No update or delete operations on activities
- ✅ **Encrypted Connection**: TLS to Neon PostgreSQL
- ✅ **Indexed Queries**: Fast retrieval without full table scans

### Compliance Features

- 📜 **Audit Trail**: Permanent record of all system actions
- 🕒 **Timestamps**: Precise `createdAt` for every event
- 👤 **User Attribution**: Every activity linked to authenticated user
- 📊 **Metadata**: Contextual information for forensic analysis

---

## 🧪 Testing

### 1. Test Activity Logging

```typescript
// In your test file or console
import { logActivity } from '@/app/actions/activity';

await logActivity({
  type: 'RESERVATION',
  description: 'Test reservation',
  metadata: { test: true }
});

console.log('Activity logged successfully');
```

### 2. Verify Database Entry

```sql
-- In Neon SQL Editor
SELECT * FROM activities
ORDER BY created_at DESC
LIMIT 5;
```

### 3. Test LeadLog Component

1. Navigate to `/admin`
2. Check that activities appear in the feed
3. Verify auto-refresh after 30 seconds
4. Test manual "Refresh now" button

### 4. Test Filters

```typescript
// Test type filter
const verifications = await getActivities({ type: 'VERIFICATION' });
console.log('Verifications:', verifications.activities.length);

// Test user filter
const userActivities = await getActivities({ userId: 'clxy3n8k70003' });
console.log('User activities:', userActivities.activities.length);
```

---

## 🚨 Troubleshooting

### Issue: "Property 'activity' does not exist on PrismaClient"

**Solution**:
```bash
cd /Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp
npx prisma generate
```

Then restart your TypeScript server (VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server").

---

## 🛡️ Fraud Prevention

### Security Context Tracking

Every activity automatically captures:
- **IP Address**: From `x-forwarded-for`, `x-real-ip`, or Cloudflare headers
- **Device Type**: Mobile, tablet, or desktop
- **Browser**: Chrome, Safari, Firefox, Edge, Opera
- **Operating System**: Windows, macOS, Linux, iOS, Android
- **User Agent**: Full user agent string

### Fraud Detection Alerts

**Use Case**: Multiple users trying to reserve the same high-value stand

```typescript
import { runFraudChecks } from '@/lib/fraud-detection';

// Run fraud checks when user creates reservation
const alerts = await runFraudChecks(userId, ipAddress);

if (alerts.length > 0) {
  alerts.forEach((alert) => {
    console.warn('[FRAUD_ALERT]', alert.type, alert.message);
    
    // Send notification to admin
    // Block reservation if severity === 'high'
  });
}
```

**Alert Types**:

1. **Multiple Reservations**: Same IP, > 3 reservations in 60 minutes
2. **Rapid Attempts**: < 30 seconds between reservation attempts
3. **Device Switching**: Same user, 3+ different devices/IPs in 24 hours

### Example Fraud Query

```sql
-- Find IPs with multiple reservations
SELECT 
  metadata->'security'->>'ipAddress' as ip_address,
  COUNT(*) as reservation_count,
  COUNT(DISTINCT user_id) as unique_users
FROM activities
WHERE type = 'RESERVATION'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY metadata->'security'->>'ipAddress'
HAVING COUNT(*) > 3
ORDER BY reservation_count DESC;
```

---

## 📊 Admin Command Center

### Unified Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Command Center                      │
├──────────────────────────────────┬──────────────────────────┤
│  System Diagnostics              │  Live Lead Log           │
│  - DB Latency: 45ms              │  - Recent activities     │
│  - Email Health: 97.5%           │  - IP tracking           │
│  - Active Holds: 12              │  - Device info           │
│  - Service Status                │  - Auto-refresh          │
├──────────────────────────────────┴──────────────────────────┤
│  Active 72-Hour Countdown Table                             │
│  - Stand | Development | Client | Status | Time Remaining   │
└─────────────────────────────────────────────────────────────┘
```

**Access**: Navigate to `/admin/command-center`

**Features**:
- ✅ Real-time diagnostics (left column)
- ✅ Live activity feed with security context (right column)
- ✅ Active reservations countdown table (bottom row)
- ✅ Auto-refresh every 30 seconds

---

### Issue: Activities not showing in LeadLog

**Check**:
1. User has ADMIN role
2. Activities exist in database:
   ```sql
   SELECT COUNT(*) FROM activities;
   ```
3. Browser console for errors
4. Network tab shows successful API call to `getActivities()`

**Solution**:
```typescript
// Manual test
const result = await getActivities();
console.log('Activities:', result);
```

---

### Issue: "Failed to log activity" error

**Check**:
1. User is authenticated
2. User has required role (ADMIN/AGENT/CLIENT)
3. Neon database connection is working

**Solution**:
```bash
# Test database connection
npx prisma db pull
```

---

### Issue: Metadata not displaying

**Cause**: Empty or null metadata

**Solution**:
```typescript
// Always provide metadata object (even if empty)
await logActivity({
  type: 'LOGIN',
  description: 'User logged in',
  metadata: { timestamp: new Date().toISOString() } // Not null
});
```

---

## 📊 Analytics Queries

### Most Active Users

```sql
SELECT 
  u.name,
  u.email,
  COUNT(a.id) as activity_count
FROM activities a
JOIN users u ON a.user_id = u.id
WHERE a.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.name, u.email
ORDER BY activity_count DESC
LIMIT 10;
```

### Activity Breakdown by Type

```sql
SELECT 
  type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM activities
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY count DESC;
```

### Peak Activity Hours

```sql
SELECT 
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(*) as activity_count
FROM activities
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

### Recent Verifications (Sales)

```sql
SELECT 
  a.created_at,
  u.name as agent_name,
  a.metadata->>'standId' as stand_id,
  a.metadata->>'amount' as amount
FROM activities a
JOIN users u ON a.user_id = u.id
WHERE a.type = 'VERIFICATION'
ORDER BY a.created_at DESC
LIMIT 20;
```

---

## 🎯 Best Practices

### 1. Always Log Critical Actions

```typescript
// ✅ Good - Log every important action
await createReservation(...);
await logReservation(standId, devName);

// ❌ Bad - Missing audit trail
await createReservation(...);
// No log!
```

### 2. Include Rich Metadata

```typescript
// ✅ Good - Detailed context
await logVerification(reservationId, standId, 50000);

// ❌ Bad - Missing details
await logActivity({
  type: 'VERIFICATION',
  description: 'Payment verified'
  // No metadata!
});
```

### 3. Use Convenience Helpers

```typescript
// ✅ Good - Use pre-built helper
await logReservation(standId, devName);

// ❌ Bad - Manual logging (error-prone)
await logActivity({
  type: 'RESERVATION',
  description: `Reserved stand in ${devName}`,
  metadata: { standId, developmentName: devName }
});
```

### 4. Handle Errors Gracefully

```typescript
// ✅ Good - Non-blocking
try {
  await logActivity(...);
} catch (error) {
  console.error('Failed to log activity:', error);
  // Don't block main action
}

// Perform main action anyway
return createReservation(...);
```

---

## 🚀 Future Enhancements

- [ ] **Export to CSV**: Download activity logs for reporting
- [ ] **Advanced Filters**: Date range, multiple types, search
- [ ] **WebSocket Updates**: Real-time push instead of polling
- [ ] **Activity Heatmap**: Visual representation of usage patterns
- [ ] **Alerts**: Webhook notifications for critical events
- [ ] **Retention Policy**: Auto-archive activities older than 1 year

---

## 📚 Related Documentation

- [System Diagnostics Guide](./SYSTEM_DIAGNOSTICS_GUIDE.md)
- [Payment Verification Guide](./PAYMENT_VERIFICATION_GUIDE.md)
- [Auth Client Reference](./AUTH_CLIENT_REFERENCE.md)

---

## 📞 Support

For issues with the audit trail system:

1. Check [Troubleshooting](#troubleshooting) section
2. Review forensic logs: `grep -r "LOG_ACTIVITY" logs/`
3. Verify database: `SELECT * FROM activities ORDER BY created_at DESC LIMIT 10;`

---

**Last Updated**: December 28, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
