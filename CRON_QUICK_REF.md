# Cron Job Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get Your CRON_SECRET
```bash
grep CRON_SECRET .env
# Output: CRON_SECRET="G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg="
```

### 2. Sign Up at cron-job.org
- Visit: https://cron-job.org
- Create free account (no credit card required)

### 3. Create New Cron Job
```
Title: Expire Reservations - Fine & Country Zimbabwe
URL: https://your-domain.com/api/cron/expire-reservations
Schedule: Every 1 hour
Request Method: POST
Headers: 
  Authorization: Bearer G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg=
```

### 4. Test Locally (Optional)
```bash
tsx scripts/test-cron.ts
```

✅ **Done!** Your reservations will now auto-expire every hour.

---

## 📋 Configuration Reference

### Environment Variables
```bash
# Required
CRON_SECRET="G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg="

# Already configured
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_NEON_AUTH_URL="https://..."
```

### Schedule Options

| Schedule | cron-job.org | Cron Expression |
|----------|--------------|-----------------|
| Every hour | "Every 1 hour" | `0 * * * *` |
| Every 30 min | "Every 30 minutes" | `*/30 * * * *` |
| Every 6 hours | "Every 6 hours" | `0 */6 * * *` |
| Daily at 2am | "Daily at 02:00" | `0 2 * * *` |

**Recommendation:** Every 1 hour (balances freshness with DB load)

---

## 🔍 Monitoring

### View Logs (cron-job.org Dashboard)
1. Log into cron-job.org
2. Click on your cron job
3. View "Execution History"
4. Check HTTP status codes (200 = success)

### Expected Response (Success)
```json
{
  "success": true,
  "expired_count": 2,
  "reset_stands_count": 2,
  "duration_ms": 234
}
```

### Expected Response (No Work)
```json
{
  "success": true,
  "expired_count": 0,
  "message": "No expired reservations found",
  "duration_ms": 87
}
```

---

## 🚨 Troubleshooting

### Issue: 401 Unauthorized
```bash
# Check CRON_SECRET in .env
cat .env | grep CRON_SECRET

# Verify cron service header format:
Authorization: Bearer YOUR_SECRET
# (NOT "Bearer: YOUR_SECRET")
```

### Issue: 500 Internal Server Error
```bash
# Check database connection
npx prisma db pull

# Test locally
tsx scripts/test-cron.ts
```

### Issue: Cron job not running
- Check cron-job.org execution history
- Verify schedule is active (not paused)
- Check URL is correct (https://, not http://)
- Verify your domain is reachable

---

## 🧪 Testing Commands

### Test Locally
```bash
tsx scripts/test-cron.ts
```

### Test Production Endpoint
```bash
curl -X POST https://your-domain.com/api/cron/expire-reservations \
  -H "Authorization: Bearer G3tQGNiYVccDtSvoWYM4th+pgIsiEL8h3igsbv4YQeg=" \
  -H "Content-Type: application/json"
```

### Check Health
```bash
curl https://your-domain.com/api/cron/expire-reservations
# Should return 404 (no GET handler) - this is expected
```

---

## 📊 What Gets Updated

### Reservations Table
- **Before:** `status = 'PENDING'`, `timer_active = true`
- **After:** `status = 'EXPIRED'`, `timer_active = false`

### Stands Table  
- **Before:** `status = 'RESERVED'`
- **After:** `status = 'AVAILABLE'`

### Criteria
Only reservations where `expires_at < NOW()` are processed.

---

## 📞 Quick Support

**File Issues:**
- Check forensic logs: `console.log` in production
- Review [CRON_IMPLEMENTATION_SUMMARY.md](CRON_IMPLEMENTATION_SUMMARY.md)
- Test locally: `tsx scripts/test-cron.ts`

**Common Solutions:**
- 401 → Fix CRON_SECRET in cron service
- 500 → Check database connection
- No expirations → Verify `expires_at` is in past (UTC)

---

## 🎯 Key Files

| File | Purpose |
|------|---------|
| [app/api/cron/expire-reservations/route.ts](app/api/cron/expire-reservations/route.ts) | Main function |
| [scripts/test-cron.ts](scripts/test-cron.ts) | Test script |
| [.env](.env) | CRON_SECRET config |
| [CRON_DEPLOYMENT_GUIDE.md](CRON_DEPLOYMENT_GUIDE.md) | Full guide |
| [CRON_IMPLEMENTATION_SUMMARY.md](CRON_IMPLEMENTATION_SUMMARY.md) | Technical details |

---

## 🔐 Security Notes

✅ CRON_SECRET is 32 bytes (256 bits)  
✅ Bearer token authentication  
✅ HTTPS enforced in production  
✅ No user-facing endpoint  
✅ Atomic database transactions  
✅ Forensic logging enabled  

⚠️ **Never commit `.env` to version control**  
⚠️ **Rotate CRON_SECRET if compromised**  
⚠️ **Use HTTPS, never HTTP**  

---

**Last Updated:** 2025-06-15  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
