# System Diagnostics - "Forensic Pulse"

## Overview

Complete system health monitoring solution for Fine & Country Zimbabwe ERP. Tests all external dependencies in real-time and provides high-contrast dashboard for agents and managers.

**Created:** December 28, 2025

---

## Architecture

### Components

```
Admin Dashboard (UI)
        ↓
    GET /api/admin/diagnostics
        ↓
    Parallel Health Checks:
    ├─► Neon PostgreSQL (latency + cold start)
    ├─► Better Auth (active sessions)
    ├─► Resend (email delivery rate)
    ├─► UploadThing (storage usage)
    ├─► Active Holds Count
    └─► Lead Velocity (7-day trend)
        ↓
    JSON Response + 30s Cache
        ↓
    Dashboard Visualizations
```

---

## Files Created

### 1. API Endpoint
**File:** [app/api/admin/diagnostics/route.ts](app/api/admin/diagnostics/route.ts)

**Function:** `GET /api/admin/diagnostics`

**Features:**
- ✅ Neon DB latency measurement with cold start detection (>1000ms = degraded)
- ✅ Better Auth active session count
- ✅ Resend email delivery success rate (last 50 confirmation emails)
- ✅ UploadThing API validation and storage usage percentage
- ✅ Active holds (72-hour window reservations)
- ✅ Lead velocity (7-day reservations vs confirmations)
- ✅ ADMIN-only access (Neon Auth)
- ✅ 30-second response caching
- ✅ Comprehensive forensic logging

**Security:**
- Requires ADMIN role
- Authorization check before diagnostics
- No sensitive data exposure (abstracts errors)

**Response Format:**
```typescript
interface DiagnosticResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    database: {
      status: 'operational' | 'degraded' | 'offline';
      latencyMs: number;
      coldStart: boolean;
      connectionPool: { active: number; idle: number };
      error?: string;
    };
    auth: {
      status: 'operational' | 'degraded' | 'offline';
      activeSessions24h: number;
      totalUsers: number;
      error?: string;
    };
    email: {
      status: 'operational' | 'degraded' | 'offline';
      deliveryRate: number;
      last50Emails: {
        sent: number;
        delivered: number;
        failed: number;
        pending: number;
      };
      error?: string;
    };
    storage: {
      status: 'operational' | 'degraded' | 'offline';
      storageUsagePercent: number;
      totalFiles: number;
      error?: string;
    };
  };
  metrics: {
    activeHolds: number;
    leadVelocity: {
      last7Days: Array<{
        date: string;
        reservations: number;
        confirmations: number;
      }>;
    };
  };
}
```

### 2. Admin Dashboard
**File:** [app/admin/diagnostics/page.tsx](app/admin/diagnostics/page.tsx)

**Features:**
- ✅ **Vital Signs Cards:** DB Latency (<100ms = green pulse), Email Health (delivery %), Active Holds
- ✅ **Lead Velocity Chart:** 7-day bar chart showing reservations vs confirmations
- ✅ **Service Status List:** Neon, Better Auth, Resend, UploadThing with badges
- ✅ **Auto-refresh:** Every 30 seconds
- ✅ **Fine & Country Branding:** Gold (#85754E), Slate (#0A1629), Inter font
- ✅ **High Contrast:** Accessible color scheme for all lighting conditions
- ✅ **Loading States:** Spinner and skeleton screens
- ✅ **Error Handling:** User-friendly error messages with retry button

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│  System Diagnostics              Last updated: 14:30:45 │
│  Overall Status: [●] Operational                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ DB Latency  │  │Email Health │  │Active Holds │    │
│  │    12ms ●   │  │   99.2% ↑   │  │     8       │    │
│  │ [Connection │  │ [47/50 OK]  │  │ [72H window]│    │
│  │   Warm]     │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────┤
│  Lead Velocity (7 Days)                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Bar Chart: Gold=Reservations, Green=Confirmed] │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Service Status                                         │
│  ├─ Neon PostgreSQL      12ms          [●] Operational │
│  ├─ Better Auth          8 sessions    [●] Operational │
│  ├─ Resend Email         99.2%         [●] Operational │
│  └─ UploadThing          12.3% used    [●] Operational │
└─────────────────────────────────────────────────────────┘
```

---

## Health Check Details

### 1. Neon Database

**Test:** `SELECT 1` query with latency measurement

**Status Logic:**
- **Operational:** Latency < 1000ms
- **Degraded:** Latency ≥ 1000ms (cold start)
- **Offline:** Query fails

**Cold Start Detection:**
- Neon serverless scales to zero after inactivity
- First query after idle period takes 1-3 seconds
- Subsequent queries are fast (<100ms)
- Dashboard shows "Cold Start" warning if >1000ms

**Connection Pool:**
- Prisma manages connection pooling
- Shows estimated active/idle connections
- No manual configuration required

**Forensic Logs:**
```
[DIAGNOSTICS][DATABASE] {
  latency_ms: 87,
  cold_start: false,
  status: "operational"
}
```

### 2. Better Auth

**Test:** Count active (non-expired) sessions and total users

**Status Logic:**
- **Operational:** Query succeeds
- **Offline:** Query fails

**Metrics:**
- Active sessions: Non-expired session tokens
- Total users: All registered accounts
- No 24-hour filter (sessions don't have updatedAt field)

**Use Case:**
- Identify user engagement levels
- Detect session management issues
- Monitor authentication health

**Forensic Logs:**
```
[DIAGNOSTICS][AUTH] {
  active_sessions: 12,
  total_users: 45,
  status: "operational"
}
```

### 3. Resend Email

**Test:** Fetch last 50 emails via Resend API, calculate delivery rate

**Status Logic:**
- **Operational:** Delivery rate ≥ 95%
- **Degraded:** Delivery rate < 95%
- **Offline:** API call fails or RESEND_API_KEY not configured

**Metrics:**
- Filters for "Purchase Confirmed" emails (via subject or tags)
- Counts: sent, delivered, failed, pending
- Delivery rate = (delivered / sent) × 100

**Email Event States:**
- `delivered`: Successfully reached inbox
- `bounced`: Invalid/non-existent email
- `complained`: Marked as spam
- `queued`/`sent`: In transit

**API Endpoint:** `GET https://api.resend.com/emails?limit=50`

**Forensic Logs:**
```
[DIAGNOSTICS][EMAIL] {
  delivery_rate: "99.20",
  stats: { sent: 50, delivered: 49, failed: 1, pending: 0 },
  status: "operational"
}
```

### 4. UploadThing

**Test:** Validate API key and fetch storage usage stats

**Status Logic:**
- **Operational:** Usage < 80%
- **Degraded:** Usage ≥ 80%
- **Offline:** API call fails or UPLOADTHING_SECRET not configured

**Metrics:**
- Total storage bytes used
- App storage limit (default 1GB)
- Usage percentage
- Total files uploaded

**API Endpoint:** `POST https://api.uploadthing.com/v6/getUsageInfo`

**Headers:**
```
X-Uploadthing-Api-Key: YOUR_SECRET
Content-Type: application/json
```

**Forensic Logs:**
```
[DIAGNOSTICS][STORAGE] {
  usage_percent: "12.34",
  total_files: 156,
  status: "operational"
}
```

---

## Business Metrics

### Active Holds

**Query:**
```sql
SELECT COUNT(*) 
FROM reservations 
WHERE status = 'PENDING' 
  AND expires_at > NOW();
```

**Meaning:**
- Number of stands currently in 72-hour reservation window
- Excludes expired/confirmed/cancelled reservations
- Real-time snapshot of pending purchases

**Dashboard Display:**
- Large card with clock icon
- Updates every 30 seconds
- No historical trend (point-in-time metric)

### Lead Velocity

**Query:**
```sql
-- Reservations created in last 7 days
SELECT created_at FROM reservations 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Confirmations in last 7 days
SELECT updated_at FROM reservations 
WHERE status = 'CONFIRMED' 
  AND updated_at >= NOW() - INTERVAL '7 days';
```

**Calculation:**
1. Group by date (last 7 days)
2. Count reservations per day (created_at)
3. Count confirmations per day (updated_at)
4. Return array of {date, reservations, confirmations}

**Dashboard Display:**
- Bar chart with dual bars per day
- Gold bars = Reservations
- Green bars = Confirmations
- Hover shows exact counts
- X-axis: Day names (Mon, Tue, Wed...)

**Business Insights:**
- Conversion rate: Confirmations ÷ Reservations
- Trend detection: Increasing/decreasing activity
- Day-of-week patterns

---

## Usage Guide

### For Administrators

#### Access Dashboard
1. Log in with ADMIN role
2. Navigate to `/admin/diagnostics`
3. Dashboard loads automatically

#### Interpret Status Badges

**Operational (Green):**
- ✅ Service functioning normally
- ✅ All metrics within acceptable range
- ✅ No action required

**Degraded (Amber):**
- ⚠️ Service functional but slow/limited
- ⚠️ DB cold start (>1s latency)
- ⚠️ Email delivery <95%
- ⚠️ Storage usage >80%
- ⚠️ Monitor and investigate

**Offline (Red):**
- ❌ Service completely unavailable
- ❌ API key invalid
- ❌ Network/connection error
- ❌ Immediate action required

#### Refresh Data
- Auto-refreshes every 30 seconds
- Click "Refresh" button for manual update
- Cache duration: 30 seconds (prevents API spam)

#### Troubleshoot Issues

**DB Latency >1000ms:**
- Wait 1-2 minutes for connection warm-up
- Neon scales from zero after idle period
- Subsequent requests will be fast

**Email Delivery <95%:**
- Check Resend dashboard for bounces
- Verify client email addresses
- Review spam complaints

**Storage >80%:**
- Audit large files in UploadThing dashboard
- Delete unused proofs of payment
- Consider upgrading storage plan

### For Developers

#### API Integration
```typescript
// Fetch diagnostics
const response = await fetch('/api/admin/diagnostics', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
});

const data: DiagnosticResult = await response.json();

// Check overall status
if (data.status === 'healthy') {
  console.log('All systems operational');
} else if (data.status === 'degraded') {
  console.warn('Some services degraded:', data.services);
} else {
  console.error('Critical issues detected!', data.services);
}

// Access specific metrics
console.log('DB Latency:', data.services.database.latencyMs, 'ms');
console.log('Email Rate:', data.services.email.deliveryRate, '%');
console.log('Active Holds:', data.metrics.activeHolds);
```

#### Add to Navigation
```tsx
// In your admin layout/sidebar
<Link href="/admin/diagnostics">
  <Activity size={20} />
  System Health
</Link>
```

#### Embed Vital Signs
```tsx
// Use API data in other components
import { useEffect, useState } from 'react';

function QuickHealthWidget() {
  const [health, setHealth] = useState<{ dbMs: number; emailRate: number } | null>(null);
  
  useEffect(() => {
    fetch('/api/admin/diagnostics')
      .then(r => r.json())
      .then(data => setHealth({
        dbMs: data.services.database.latencyMs,
        emailRate: data.services.email.deliveryRate,
      }));
  }, []);
  
  return (
    <div>
      <p>DB: {health?.dbMs}ms</p>
      <p>Email: {health?.emailRate}%</p>
    </div>
  );
}
```

---

## Monitoring & Alerts

### Production Logs

**Search Patterns:**
```bash
# All diagnostic runs
grep "DIAGNOSTICS" production.log

# Database issues
grep "DIAGNOSTICS.*DATABASE.*degraded\|offline" production.log

# Email delivery issues
grep "DIAGNOSTICS.*EMAIL.*degraded\|offline" production.log

# Failed API calls
grep "DIAGNOSTICS.*ERROR" production.log
```

**Key Metrics:**
- Diagnostic execution frequency (should be ~every 30s per user)
- Overall status distribution (healthy vs degraded vs critical)
- Service-specific failure rates

### Automated Alerts

**Recommended Setup:**
- Monitor overall `status` field
- Alert on `status: 'critical'` (any service offline)
- Warning on `status: 'degraded'` (service slow/limited)

**Alert Examples:**

```bash
# Slack webhook
if [ "$STATUS" == "critical" ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"🚨 ERP System Health: CRITICAL"}'
fi

# Email alert
if [ "$DB_LATENCY" -gt 5000 ]; then
  echo "DB latency critical: ${DB_LATENCY}ms" | \
    mail -s "ERP Health Alert" admin@fineandcountry.co.zw
fi
```

### External Monitoring

**Uptime Monitoring:**
- Use UptimeRobot or Pingdom
- Monitor `/api/admin/diagnostics` endpoint
- Check for HTTP 200 status
- Parse JSON for `status: 'healthy'`

**Example:**
```bash
# UptimeRobot keyword monitor
# Endpoint: https://your-domain.com/api/admin/diagnostics
# Keyword: "healthy"
# Alert if keyword not found
```

---

## Testing

### Local Testing

#### Test API Endpoint
```bash
# With authentication
curl -X GET http://localhost:5173/api/admin/diagnostics \
  -H "Cookie: session_token=YOUR_SESSION" \
  | jq
```

#### Expected Response (Healthy)
```json
{
  "timestamp": "2025-12-28T14:30:00.000Z",
  "status": "healthy",
  "services": {
    "database": {
      "status": "operational",
      "latencyMs": 87,
      "coldStart": false,
      "connectionPool": { "active": 1, "idle": 0 }
    },
    "auth": {
      "status": "operational",
      "activeSessions24h": 12,
      "totalUsers": 45
    },
    "email": {
      "status": "operational",
      "deliveryRate": 99.2,
      "last50Emails": {
        "sent": 50,
        "delivered": 49,
        "failed": 1,
        "pending": 0
      }
    },
    "storage": {
      "status": "operational",
      "storageUsagePercent": 12.3,
      "totalFiles": 156
    }
  },
  "metrics": {
    "activeHolds": 8,
    "leadVelocity": {
      "last7Days": [
        { "date": "2025-12-22", "reservations": 3, "confirmations": 2 },
        { "date": "2025-12-23", "reservations": 5, "confirmations": 4 },
        ...
      ]
    }
  }
}
```

#### Test Error Handling
```bash
# Unauthorized (no session)
curl -X GET http://localhost:5173/api/admin/diagnostics
# Expected: { "error": "Unauthorized" }, 401

# Forbidden (CLIENT role)
curl -X GET http://localhost:5173/api/admin/diagnostics \
  -H "Cookie: client_session=..."
# Expected: { "error": "Access denied. ADMIN role required." }, 403
```

### Integration Testing

#### Simulate Cold Start
```sql
-- Pause Neon database for 5 minutes
-- (via Neon console)
-- Then run diagnostic
-- Expected: latencyMs > 1000, coldStart = true
```

#### Simulate Email Failure
```bash
# Temporarily set invalid Resend key
export RESEND_API_KEY="re_invalid"
# Run diagnostic
# Expected: email.status = "offline", error message present
```

#### Simulate Storage Full
```bash
# Upload files until >80% usage
# Run diagnostic
# Expected: storage.status = "degraded"
```

---

## Performance

### API Response Times

| Condition | Duration |
|-----------|----------|
| All healthy | 200-500ms |
| DB cold start | 1-3 seconds |
| API timeouts | 5-10 seconds |

### Caching Strategy

- **Cache Duration:** 30 seconds
- **Cache-Control:** `private, max-age=30`
- **Benefit:** Reduces API calls when multiple admins view dashboard
- **Trade-off:** Metrics can be up to 30s stale

### Parallel Execution

All health checks run in parallel via `Promise.all()`:
- DB latency test
- Auth session count
- Email delivery check
- Storage usage fetch
- Active holds count
- Lead velocity query

**Total Time:** Max of individual durations (not sum)

---

## Security

### Authentication
- ✅ Neon Auth getCurrentUser() validates session
- ✅ requireRole(['ADMIN']) enforces access control
- ✅ No public endpoint (admin-only)

### Data Exposure
- ✅ No sensitive data in responses (connection strings hidden)
- ✅ Errors abstracted (no stack traces to client)
- ✅ API keys not returned

### Rate Limiting
- ✅ 30-second cache prevents spam
- ✅ No per-user rate limit (trusted admins)
- ✅ External APIs have their own rate limits (Resend, UploadThing)

---

## Troubleshooting

### Common Issues

**Issue:** "Unauthorized" error
- **Cause:** Not logged in or session expired
- **Solution:** Log in with ADMIN account

**Issue:** "Access denied. ADMIN role required"
- **Cause:** User role is AGENT or CLIENT
- **Solution:** Admin must change user role in database

**Issue:** Database shows "Offline"
- **Cause:** Neon connection string invalid or database paused
- **Solution:** Verify DATABASE_URL, check Neon console

**Issue:** Email shows "Offline" with "RESEND_API_KEY not configured"
- **Cause:** Environment variable missing
- **Solution:** Add RESEND_API_KEY to .env

**Issue:** Storage shows "Offline" with "UPLOADTHING_SECRET not configured"
- **Cause:** Environment variable missing
- **Solution:** Add UPLOADTHING_SECRET to .env

**Issue:** Dashboard stuck on loading spinner
- **Cause:** API endpoint unreachable or slow
- **Solution:** Check browser console for network errors, verify API route exists

**Issue:** Lead velocity chart shows "No data available"
- **Cause:** No reservations in last 7 days
- **Solution:** Normal if system is new or inactive

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic health checks for all services
- ✅ Real-time vital signs dashboard
- ✅ 7-day lead velocity chart

### Phase 2 (Planned)
- [ ] Historical trend graphs (30-day latency, email rate)
- [ ] Webhook alerts (Slack, email)
- [ ] Mobile-responsive dashboard
- [ ] Export diagnostics to CSV
- [ ] Scheduled diagnostics (cron job)

### Phase 3 (Future)
- [ ] Predictive analytics (forecast failures)
- [ ] Incident timeline (log all degraded events)
- [ ] Service SLA tracking (99.9% uptime)
- [ ] Multi-region health checks
- [ ] Integration with Datadog/New Relic

---

## API Reference

### GET /api/admin/diagnostics

**Authentication:** Required (ADMIN role)

**Headers:**
```
Content-Type: application/json
Cookie: session_token=YOUR_SESSION
```

**Response (200 OK):**
```json
{
  "timestamp": "2025-12-28T14:30:00.000Z",
  "status": "healthy" | "degraded" | "critical",
  "services": { ... },
  "metrics": { ... }
}
```

**Response (401 Unauthorized):**
```json
{ "error": "Unauthorized" }
```

**Response (403 Forbidden):**
```json
{ "error": "Access denied. ADMIN role required." }
```

**Response (500 Internal Server Error):**
```json
{ "error": "Internal server error" }
```

**Caching:**
- Duration: 30 seconds
- Header: `Cache-Control: private, max-age=30`

---

**Status:** ✅ Production Ready  
**Last Updated:** December 28, 2025  
**Version:** 1.0.0
