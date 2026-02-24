# System Diagnostics Quick Reference

## 🎯 One-Liner
Real-time health dashboard for Neon DB, Better Auth, Resend, and UploadThing with 30-second auto-refresh.

---

## 🚀 Quick Access

**Dashboard URL:** `/admin/diagnostics`  
**API Endpoint:** `GET /api/admin/diagnostics`  
**Required Role:** ADMIN  
**Auto-refresh:** Every 30 seconds  
**Cache Duration:** 30 seconds  

---

## 📊 Vital Signs

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| **DB Latency** | <100ms (green pulse) | 100-1000ms | >1000ms (cold start) |
| **Email Health** | ≥95% delivery | 85-95% | <85% |
| **Storage** | <80% used | 80-95% | >95% |

---

## 🔍 Service Status

### Neon PostgreSQL
- **Test:** `SELECT 1` with latency measurement
- **Operational:** Latency <1000ms
- **Degraded:** Latency ≥1000ms (cold start warning)
- **Offline:** Query fails

### Better Auth
- **Test:** Count active (non-expired) sessions
- **Operational:** Query succeeds
- **Offline:** Query fails
- **Metric:** Total active sessions + total users

### Resend Email
- **Test:** Fetch last 50 emails, calculate delivery rate
- **Operational:** ≥95% delivered
- **Degraded:** <95% delivered
- **Offline:** API fails or key missing
- **Filter:** "Purchase Confirmed" emails only

### UploadThing
- **Test:** Validate API key, fetch storage usage
- **Operational:** <80% storage used
- **Degraded:** ≥80% storage used
- **Offline:** API fails or key missing

---

## 📈 Business Metrics

### Active Holds
```sql
SELECT COUNT(*) FROM reservations 
WHERE status = 'PENDING' AND expires_at > NOW();
```
Current stands in 72-hour reservation window.

### Lead Velocity (7 Days)
- **Gold bars:** Reservations created per day
- **Green bars:** Confirmations per day
- **Insight:** Conversion rate = Confirmations ÷ Reservations

---

## 🎨 Dashboard Colors

**Fine & Country Branding:**
- Gold: `#85754E`
- Slate: `#0A1629`
- Green (good): Operational services
- Amber (warning): Degraded services
- Red (critical): Offline services

---

## 🔐 Access Control

**Allowed:**
- ✅ ADMIN role

**Blocked:**
- ❌ AGENT role (403 Forbidden)
- ❌ CLIENT role (403 Forbidden)
- ❌ Unauthenticated (401 Unauthorized)

---

## 🧪 Test Commands

### Check Diagnostics
```bash
curl -X GET http://localhost:5173/api/admin/diagnostics \
  -H "Cookie: session_token=YOUR_SESSION" \
  | jq .status
```

### Expected Response
```json
{
  "timestamp": "2025-12-28T14:30:00.000Z",
  "status": "healthy",
  "services": {
    "database": { "status": "operational", "latencyMs": 87 },
    "auth": { "status": "operational", "activeSessions24h": 12 },
    "email": { "status": "operational", "deliveryRate": 99.2 },
    "storage": { "status": "operational", "storageUsagePercent": 12.3 }
  },
  "metrics": {
    "activeHolds": 8,
    "leadVelocity": { "last7Days": [...] }
  }
}
```

---

## 🚨 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Unauthorized" | Not logged in | Log in as ADMIN |
| "Access denied" | Wrong role | Change user role to ADMIN |
| DB latency >1000ms | Cold start | Wait 1-2 min for warm-up |
| Email <95% | Bounces/spam | Check Resend dashboard |
| Storage >80% | Too many files | Delete unused uploads |
| Dashboard won't load | API error | Check browser console logs |

---

## 📝 Forensic Logs

**Key Events:**
```
[DIAGNOSTICS][STARTED] { admin_id, admin_email }
[DIAGNOSTICS][DATABASE] { latency_ms, cold_start, status }
[DIAGNOSTICS][AUTH] { active_sessions, total_users }
[DIAGNOSTICS][EMAIL] { delivery_rate, stats }
[DIAGNOSTICS][STORAGE] { usage_percent, total_files }
[DIAGNOSTICS][COMPLETED] { overall_status, duration_ms }
```

**Search Commands:**
```bash
# All diagnostic runs
grep "DIAGNOSTICS" production.log

# Database issues
grep "DIAGNOSTICS.*DATABASE.*degraded\|offline" production.log

# Failed diagnostics
grep "DIAGNOSTICS.*ERROR" production.log
```

---

## 📊 Status Badge Legend

**● Operational (Green)**
- All metrics within normal range
- No action required

**⚠️ Degraded (Amber)**
- Service slow or limited
- Monitor and investigate
- Examples: Cold start, low email rate, high storage

**❌ Offline (Red)**
- Service completely unavailable
- Immediate action required
- Examples: API key invalid, network error

---

## 🔄 Refresh Behavior

**Auto-refresh:**
- Interval: Every 30 seconds
- Applies to: Dashboard only (not direct API calls)
- Can be disabled by closing/leaving page

**Manual refresh:**
- Click "Refresh" button in header
- Bypasses cache (always fetches fresh data)

**Cache:**
- Duration: 30 seconds
- Scope: Per-user (private cache)
- Benefit: Reduces API load when multiple admins viewing

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [app/api/admin/diagnostics/route.ts](app/api/admin/diagnostics/route.ts) | Health check API |
| [app/admin/diagnostics/page.tsx](app/admin/diagnostics/page.tsx) | Dashboard UI |
| [SYSTEM_DIAGNOSTICS_GUIDE.md](SYSTEM_DIAGNOSTICS_GUIDE.md) | Full documentation |

---

## 🎓 Usage Example

```typescript
// Fetch diagnostics
const response = await fetch('/api/admin/diagnostics');
const data = await response.json();

// Check status
if (data.status === 'healthy') {
  console.log('✅ All systems operational');
} else {
  console.warn('⚠️ Issues detected:', data.status);
}

// Access metrics
console.log('DB:', data.services.database.latencyMs, 'ms');
console.log('Email:', data.services.email.deliveryRate, '%');
console.log('Holds:', data.metrics.activeHolds);
```

---

## ⚡ Performance

**API Response Time:**
- Normal: 200-500ms
- Cold start: 1-3 seconds
- Timeout: 5-10 seconds

**Dashboard Load Time:**
- Initial: 300-800ms
- Cached: 50-200ms

---

## 🔗 External Links

- [Neon Console](https://console.neon.tech/)
- [Resend Dashboard](https://resend.com/dashboard)
- [UploadThing Dashboard](https://uploadthing.com/dashboard)

---

**Status:** ✅ Production Ready  
**Last Updated:** December 28, 2025  
**Version:** 1.0.0
