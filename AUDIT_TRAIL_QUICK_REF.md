# 🔍 Audit Trail Quick Reference

**Fast reference for the Fine & Country Zimbabwe ERP audit system**

---

## 🚀 Quick Start

### 1. Import Functions

```typescript
import { 
  logActivity,
  logReservation,
  logVerification,
  getActivities 
} from '@/app/actions/activity';
```

### 2. Log an Activity

```typescript
// Generic logging
await logActivity({
  type: 'RESERVATION',
  description: 'Reserved stand in Glen Lorne Heights',
  metadata: { standId: 'abc123', developmentName: 'Glen Lorne Heights' }
});

// Or use convenience helpers
await logReservation('abc123', 'Glen Lorne Heights');
```

### 3. Display Live Feed (Admin Only)

```tsx
import LeadLog from '@/components/admin/LeadLog';

<LeadLog refreshInterval={30000} maxItems={20} />
```

---

## 📊 Activity Types

| Type | Badge Color | Use Case | Convenience Helper |
|------|-------------|----------|-------------------|
| `LOGIN` | 🔵 Blue | User authentication | `logLogin()` |
| `RESERVATION` | 🟡 Gold | Stand booking | `logReservation(standId, devName)` |
| `PAYMENT_UPLOAD` | 🟣 Purple | POP submission | `logPaymentUpload(reservationId, popUrl)` |
| `VERIFICATION` | 🟢 Green | Payment confirmed | `logVerification(reservationId, standId, amount)` |
| `STAND_UPDATE` | 🟠 Amber | Status change | `logStandUpdate(standId, oldStatus, newStatus)` |
| `USER_CREATED` | 🔷 Cyan | New user account | `logUserCreated(userId, email, role)` |
| `AGENT_ASSIGNED` | 🟦 Indigo | Lead assignment | `logAgentAssigned(clientId, agentId, name)` |

---

## 🔧 Common Patterns

### Log Reservation

```typescript
// After creating reservation
const reservation = await prisma.reservation.create({ ... });

await logReservation(
  reservation.standId,
  reservation.stand.development.name
);
```

### Log Payment Upload

```typescript
// After uploading file
await updateReservation(id, { popUrl: fileUrl });

await logPaymentUpload(reservationId, fileUrl);
```

### Log Verification

```typescript
// After agent verifies payment
await prisma.reservation.update({
  where: { id: reservationId },
  data: { status: 'CONFIRMED' }
});

await logVerification(reservationId, standId, amount);
```

### Fetch Activities (Admin)

```typescript
// Get last 20 activities
const result = await getActivities();

// Filter by type
const sales = await getActivities({ type: 'VERIFICATION' });

// Filter by user
const userLogs = await getActivities({ userId: 'clxy123' });
```

---

## 🎨 LeadLog Component Props

```tsx
<LeadLog
  refreshInterval={30000}  // Auto-refresh (ms)
  maxItems={20}           // Max activities
/>
```

**Default**: Auto-refresh every 30 seconds, show last 20 activities

---

## 🔒 Access Control

| Function | ADMIN | AGENT | CLIENT |
|----------|-------|-------|--------|
| Log activities | ✅ | ✅ | ✅ |
| View activities | ✅ | ❌ | ❌ |

---

## 🗄️ Database Schema

```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  type ActivityType NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX activities_user_id_idx ON activities(user_id);
CREATE INDEX activities_type_idx ON activities(type);
CREATE INDEX activities_created_at_idx ON activities(created_at DESC);
```

---

## 🧪 Testing

### Test Logging

```typescript
await logActivity({
  type: 'RESERVATION',
  description: 'Test reservation',
  metadata: { test: true }
});
```

### Verify in Database

```sql
SELECT * FROM activities 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check LeadLog

1. Go to `/admin`
2. View live activity feed
3. Verify auto-refresh works

---

## 🚨 Troubleshooting

### Prisma Not Recognizing Activity Model

```bash
npx prisma generate
# Then restart TypeScript server (Cmd+Shift+P → "TypeScript: Restart TS Server")
```

### Activities Not Showing

```typescript
// Test directly
const result = await getActivities();
console.log(result.activities);
```

### Failed to Log Activity

```typescript
// Check authentication
const session = await getCurrentUser();
console.log('User:', session);
```

---

## 📊 Quick Queries

### Most Active Users (Last 7 Days)

```sql
SELECT u.name, COUNT(a.id) as activities
FROM activities a
JOIN users u ON a.user_id = u.id
WHERE a.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.name
ORDER BY activities DESC
LIMIT 10;
```

### Activity Breakdown

```sql
SELECT type, COUNT(*) as count
FROM activities
GROUP BY type
ORDER BY count DESC;
```

### Recent Sales

```sql
SELECT a.created_at, u.name, a.metadata->>'standId'
FROM activities a
JOIN users u ON a.user_id = u.id
WHERE a.type = 'VERIFICATION'
ORDER BY a.created_at DESC
LIMIT 20;
```

---

## 🎯 Best Practices

✅ **DO**: Use convenience helpers (`logReservation()` etc.)  
✅ **DO**: Include rich metadata for context  
✅ **DO**: Handle logging errors gracefully (don't block main action)  
✅ **DO**: Log all critical user actions  

❌ **DON'T**: Block main actions if logging fails  
❌ **DON'T**: Log sensitive data (passwords, tokens) in metadata  
❌ **DON'T**: Expose activity logs to non-admin users  

---

## 📚 Full Documentation

See [AUDIT_TRAIL_GUIDE.md](./AUDIT_TRAIL_GUIDE.md) for complete documentation.

---

**Files**:
- `prisma/schema.prisma` - Activity model
- `app/actions/activity.ts` - Server actions
- `components/admin/LeadLog.tsx` - UI component

**Last Updated**: December 28, 2025
