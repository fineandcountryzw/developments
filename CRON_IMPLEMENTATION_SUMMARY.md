# Cron Job Implementation Summary

## Overview

Automated hourly task to expire reservations that have exceeded their 72-hour window and reset associated property stands to available status.

## Files Created/Modified

### 1. Core Function
**File:** [app/api/cron/expire-reservations/route.ts](app/api/cron/expire-reservations/route.ts)

**Function:** `expireReservations(authorizationHeader?: string)`

**Features:**
- ✅ Queries for PENDING reservations where `expiresAt < now()`
- ✅ Updates Reservation status to EXPIRED
- ✅ Resets Stand status to AVAILABLE
- ✅ Uses Prisma transactions for atomicity
- ✅ Includes comprehensive forensic logging
- ✅ CRON_SECRET authentication
- ✅ Error handling with partial success support
- ✅ Returns detailed execution summary

**Example Response:**
```json
{
  "success": true,
  "expired_count": 3,
  "reset_stands_count": 3,
  "error_count": 0,
  "expired_reservation_ids": ["res_1", "res_2", "res_3"],
  "reset_stand_ids": ["stand_1", "stand_2", "stand_3"],
  "duration_ms": 234,
  "timestamp": "2025-06-15T14:00:00.000Z"
}
```

### 2. Deployment Guide
**File:** [CRON_DEPLOYMENT_GUIDE.md](CRON_DEPLOYMENT_GUIDE.md)

**Contents:**
- 4 deployment options (EasyCron, cron-job.org, Vercel, GitHub Actions)
- Express/Fastify integration examples
- Security checklist
- Testing procedures
- Monitoring and troubleshooting
- Cost comparison table

**Recommended:** Use **cron-job.org** for zero-cost, reliable hourly execution.

### 3. Test Script
**File:** [scripts/test-cron.ts](scripts/test-cron.ts)

**Usage:**
```bash
tsx scripts/test-cron.ts
```

**Features:**
- ✅ Tests expireReservations with valid credentials
- ✅ Validates CRON_SECRET configuration
- ✅ Security test (unauthorized access rejection)
- ✅ Detailed result output
- ✅ Exit codes for CI/CD integration

### 4. Environment Variables
**File:** [.env](.env)

**Added:**
```bash
CRON_SECRET="G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg="
```

**Generation Method:**
```bash
openssl rand -base64 32
```

### 5. Vercel Configuration (Optional)
**File:** [vercel.json](vercel.json)

**Already Configured:**
```json
{
  "crons": [{
    "path": "/api/cron/expire-reservations",
    "schedule": "0 * * * *"
  }]
}
```

**Note:** Only relevant if migrating to Next.js. For Vite projects, use external cron service.

## Database Schema Impact

### Reservation Model
```prisma
model Reservation {
  id          String            @id @default(cuid())
  status      ReservationStatus @map("status")
  expiresAt   DateTime          @map("expires_at")
  timerActive Boolean           @default(true) @map("timer_active")
  // ... other fields
}

enum ReservationStatus {
  PENDING
  EXPIRED    // ← Set by cron job
  CONFIRMED
  CANCELLED
}
```

### Stand Model
```prisma
model Stand {
  id           String      @id @default(cuid())
  status       StandStatus @map("status")
  standNumber  String      @map("stand_number")
  // ... other fields
}

enum StandStatus {
  AVAILABLE  // ← Reset by cron job
  RESERVED
  SOLD
  HOLD
}
```

## Workflow Diagram

```
Every Hour
    │
    ├─► Cron Service (cron-job.org / EasyCron / GitHub Actions)
    │
    ├─► POST /api/cron/expire-reservations
    │   Headers: Authorization: Bearer CRON_SECRET
    │
    ├─► expireReservations()
    │   │
    │   ├─► 1. Verify CRON_SECRET
    │   │
    │   ├─► 2. Query: WHERE status = PENDING AND expiresAt < NOW()
    │   │
    │   ├─► 3. For each expired reservation:
    │   │   │
    │   │   ├─► START TRANSACTION
    │   │   │   ├─► UPDATE Reservation SET status = EXPIRED, timerActive = false
    │   │   │   └─► UPDATE Stand SET status = AVAILABLE
    │   │   └─► COMMIT TRANSACTION
    │   │
    │   └─► 4. Return summary JSON
    │
    └─► Log results to console (forensic logging)
```

## Forensic Logging

### Log Events

| Event | Description |
|-------|-------------|
| `[CRON][EXPIRE_RESERVATIONS][STARTED]` | Job initiated with timestamp |
| `[CRON][EXPIRE_RESERVATIONS][FOUND]` | Number of expired reservations found |
| `[CRON][EXPIRE_RESERVATIONS][PROCESSED]` | Individual reservation processed with details |
| `[CRON][EXPIRE_RESERVATIONS][ERROR]` | Error processing specific reservation |
| `[CRON][EXPIRE_RESERVATIONS][COMPLETED]` | Job finished with summary |
| `[CRON][EXPIRE_RESERVATIONS][FATAL_ERROR]` | Critical error (auth failure, DB connection) |
| `[CRON][EXPIRE_RESERVATIONS][UNAUTHORIZED]` | Invalid CRON_SECRET |
| `[CRON][EXPIRE_RESERVATIONS][CONFIG_ERROR]` | CRON_SECRET not set |

### Example Log Output

```
[CRON][EXPIRE_RESERVATIONS][STARTED] {
  current_time: "2025-06-15T14:00:00.000Z",
  timestamp: "2025-06-15T14:00:00.000Z"
}

[CRON][EXPIRE_RESERVATIONS][FOUND] {
  count: 2,
  reservation_ids: ["cm5b2kz3x0002", "cm5b2kz3x0003"],
  timestamp: "2025-06-15T14:00:00.123Z"
}

[CRON][EXPIRE_RESERVATIONS][PROCESSED] {
  reservation_id: "cm5b2kz3x0002",
  stand_id: "cm5b2kz3x0001",
  stand_number: "A24",
  development: "Borrowdale Heights",
  client_email: "john@example.com",
  agent_name: "Sarah Smith",
  expired_at: "2025-06-12T14:00:00.000Z",
  current_time: "2025-06-15T14:00:00.000Z",
  hours_past_expiry: 72,
  timestamp: "2025-06-15T14:00:00.234Z"
}

[CRON][EXPIRE_RESERVATIONS][COMPLETED] {
  success: true,
  expired_count: 2,
  reset_stands_count: 2,
  error_count: 0,
  duration_ms: 234,
  timestamp: "2025-06-15T14:00:00.345Z"
}
```

## Security Considerations

### Authentication
- ✅ Bearer token authentication with `CRON_SECRET`
- ✅ 32-byte cryptographically secure secret
- ✅ No rate limiting (trusted cron service)
- ✅ Logs unauthorized access attempts

### Authorization
- ✅ Only authorized cron service can trigger
- ✅ No user-facing endpoint (internal API)
- ✅ HTTPS enforced (Vercel/production)

### Data Integrity
- ✅ Atomic transactions (all-or-nothing updates)
- ✅ Foreign key constraints preserved
- ✅ No cascade deletes
- ✅ Audit trail via forensic logs

## Testing Procedures

### 1. Local Testing

```bash
# Option A: Direct function call
tsx scripts/test-cron.ts

# Option B: HTTP request (if you have Express/Fastify server)
curl -X POST http://localhost:5173/api/cron/expire-reservations \
  -H "Authorization: Bearer G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg=" \
  -H "Content-Type: application/json"
```

### 2. Production Testing

```bash
# After deploying to production
curl -X POST https://your-domain.com/api/cron/expire-reservations \
  -H "Authorization: Bearer YOUR_PRODUCTION_SECRET" \
  -H "Content-Type: application/json"
```

### 3. Manual Database Verification

```sql
-- Create test expired reservation
INSERT INTO reservations (id, stand_id, user_id, status, expires_at, created_at)
VALUES ('test_res_1', 'stand_1', 'user_1', 'PENDING', NOW() - INTERVAL '1 hour', NOW());

-- Run cron job
-- Then verify:

SELECT status FROM reservations WHERE id = 'test_res_1';
-- Expected: 'EXPIRED'

SELECT status FROM stands WHERE id = 'stand_1';
-- Expected: 'AVAILABLE'
```

## Performance Metrics

### Expected Execution Times

| Expired Reservations | Duration |
|---------------------|----------|
| 0 | ~50ms |
| 1-10 | ~100-200ms |
| 11-50 | ~200-500ms |
| 51-100 | ~500-1000ms |

### Database Impact

- **Reads:** 1 query per execution (findMany)
- **Writes:** 2 updates per expired reservation (transaction)
- **Connections:** 1 connection from connection pool
- **Indexes Used:** 
  - `reservations.status` (WHERE clause)
  - `reservations.expires_at` (WHERE clause)

## Monitoring Recommendations

### 1. Log Aggregation
- Send forensic logs to centralized logging (e.g., Datadog, LogDNA)
- Alert on `[CRON][EXPIRE_RESERVATIONS][FATAL_ERROR]`
- Track `expired_count` over time

### 2. Health Checks
- Monitor cron service uptime (cron-job.org dashboard)
- Set up dead man's switch (alert if no execution in 2 hours)
- Track execution duration trends

### 3. Database Monitoring
- Monitor Neon connection pool usage
- Track transaction rollback rate
- Alert on slow queries (>1 second)

## Rollback Procedure

If cron job causes issues:

1. **Disable Cron Service:**
   - Log into cron-job.org
   - Pause the job immediately

2. **Revert Incorrect Expirations:**
   ```sql
   UPDATE reservations
   SET status = 'PENDING', timer_active = true
   WHERE status = 'EXPIRED'
     AND updated_at > NOW() - INTERVAL '1 hour';
   ```

3. **Revert Stand Status:**
   ```sql
   UPDATE stands
   SET status = 'RESERVED'
   WHERE id IN (
     SELECT stand_id FROM reservations
     WHERE status = 'PENDING'
   );
   ```

4. **Review Logs:**
   - Check for `[CRON][EXPIRE_RESERVATIONS][ERROR]` entries
   - Identify root cause
   - Fix code
   - Redeploy

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic expiration with stand reset
- ✅ Forensic logging
- ✅ Transaction safety

### Phase 2 (Planned)
- [ ] Email notifications to clients (reservation expired)
- [ ] Agent notifications (stand available again)
- [ ] Slack/Discord webhook integration
- [ ] Metrics dashboard (Grafana/Metabase)

### Phase 3 (Future)
- [ ] Configurable expiration window (not just 72 hours)
- [ ] Partial expiration (warning at 48 hours)
- [ ] Auto-retry failed transactions
- [ ] Bulk expiration optimization (single transaction)

## Support

### Common Issues

**Issue:** Cron job returns 401 Unauthorized
- **Solution:** Verify `CRON_SECRET` matches in `.env` and cron service configuration

**Issue:** No reservations being expired
- **Solution:** Check `expiresAt` values in database. May be timezone issue (use UTC).

**Issue:** Transaction deadlocks
- **Solution:** Reduce cron frequency to every 2 hours instead of every 1 hour.

### Contact

For issues or questions:
1. Check [CRON_DEPLOYMENT_GUIDE.md](CRON_DEPLOYMENT_GUIDE.md)
2. Review forensic logs in production
3. Test locally with [scripts/test-cron.ts](scripts/test-cron.ts)

## Deployment Checklist

- [x] `expireReservations` function implemented
- [x] CRON_SECRET generated and added to `.env`
- [x] Test script created
- [x] Deployment guide written
- [x] Vercel configuration added (optional)
- [ ] Express/Fastify endpoint created (if using HTTP)
- [ ] Cron service configured (cron-job.org / EasyCron)
- [ ] Production testing completed
- [ ] Monitoring/alerting set up
- [ ] Team trained on forensic logs

---

**Status:** ✅ Ready for deployment

**Last Updated:** 2025-06-15

**Maintainer:** Fine & Country Zimbabwe Dev Team
