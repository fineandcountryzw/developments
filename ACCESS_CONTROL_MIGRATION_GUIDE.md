# 🔄 ACCESS CONTROL MODULE - MIGRATION GUIDE

**Date:** 2026-01-23  
**Status:** ✅ **MIGRATION IN PROGRESS**

---

## 🎯 MIGRATION STATUS

### Phase 1: High-Traffic Routes ✅

**Routes Migrated:**
- ✅ `app/api/admin/reservations/route.ts`
- ✅ `app/api/admin/clients/route.ts`
- ✅ `app/api/admin/payments/route.ts`

**Remaining Routes:** ~50+ routes to migrate

---

## 📋 MIGRATION STEPS

### Step 1: Update Import

**Before:**
```typescript
import { requireAdmin } from '@/lib/adminAuth';
import { requireManager } from '@/lib/managerAuth';
import { getCurrentUser } from '@/lib/auth';
```

**After:**
```typescript
import { 
  requireAdmin, 
  requireManager, 
  requireAgent,
  getAuthenticatedUser,
  requirePermission 
} from '@/lib/access-control';
```

### Step 2: Verify Function Signatures

**All functions have same signatures:**
```typescript
// Same as before - no changes needed!
const authResult = await requireAdmin();
if (authResult.error) return authResult.error;
const user = authResult.user;
```

### Step 3: Test Route

- ✅ Test authentication
- ✅ Test authorization
- ✅ Verify cache is working (check logs)
- ✅ Monitor performance

---

## 🔧 NEW FEATURES AVAILABLE

### 1. Fine-Grained Permissions

**Grant Permission:**
```typescript
import { grantPermission } from '@/lib/permission-manager';

await grantPermission({
  userId: 'user123',
  resource: '/api/admin/reservations',
  action: 'WRITE',
  branch: 'Harare',
  grantedBy: 'admin456',
  expiresAt: new Date('2026-12-31') // Optional
});
```

**Revoke Permission:**
```typescript
import { revokePermission } from '@/lib/permission-manager';

await revokePermission({
  userId: 'user123',
  resource: '/api/admin/reservations',
  action: 'WRITE',
  branch: 'Harare'
});
```

**Use in Route:**
```typescript
import { requirePermission } from '@/lib/access-control';

const authResult = await requirePermission('/api/admin/reservations', 'WRITE', branch);
if (authResult.error) return authResult.error;
const user = authResult.user;
```

### 2. Permission Management API

**Endpoints:**
- `GET /api/admin/permissions?userId=xxx` - Get user permissions
- `POST /api/admin/permissions` - Grant permission(s)
- `DELETE /api/admin/permissions?userId=xxx&resource=xxx&action=xxx` - Revoke permission
- `POST /api/admin/permissions/cleanup` - Clean expired permissions

**Example: Grant Permission**
```bash
curl -X POST /api/admin/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "resource": "/api/admin/reservations",
    "action": "WRITE",
    "branch": "Harare"
  }'
```

**Example: Bulk Grant**
```bash
curl -X POST /api/admin/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "multiple": [
      {
        "userId": "user123",
        "resource": "/api/admin/reservations",
        "action": "READ"
      },
      {
        "userId": "user123",
        "resource": "/api/admin/payments",
        "action": "WRITE"
      }
    ]
  }'
```

### 3. Performance Metrics

**Get Metrics:**
```bash
curl /api/admin/access-control-metrics
```

**Response:**
```json
{
  "sessionCache": {
    "hitRate": 85.5,
    "hits": 855,
    "misses": 145,
    "total": 1000
  },
  "permissionCache": {
    "hitRate": 92.3,
    "hits": 923,
    "misses": 77,
    "total": 1000
  },
  "queries": {
    "reduction": 50.2,
    "saved": 502,
    "before": 1000,
    "after": 498
  },
  "performance": {
    "improvement": 70.5,
    "avgTimeBefore": "250ms",
    "avgTimeAfter": "74ms",
    "requestCount": 1000
  }
}
```

**Reset Metrics:**
```bash
curl -X POST /api/admin/access-control-metrics/reset
```

---

## 📊 MONITORING

### Automatic Logging

Metrics are automatically logged every 5 minutes:
```
[ACCESS_CONTROL] Performance Metrics
  sessionCache: { hitRate: "85.5%", hits: 855, misses: 145 }
  permissionCache: { hitRate: "92.3%", hits: 923, misses: 77 }
  queries: { reduction: "50.2%", saved: 502 }
  performance: { improvement: "70.5%", avgTimeAfter: "74ms" }
```

### Manual Monitoring

**Check metrics in code:**
```typescript
import { accessControlMetrics } from '@/lib/access-control-metrics';

const metrics = accessControlMetrics.getMetrics();
console.log('Cache hit rate:', metrics.sessionCache.hitRate);
console.log('Query reduction:', metrics.queries.reduction);
```

---

## 🚀 MIGRATION PRIORITY

### High Priority (Migrate First)
1. ✅ `/api/admin/reservations` - High traffic
2. ✅ `/api/admin/clients` - High traffic
3. ✅ `/api/admin/payments` - High traffic
4. `/api/admin/deals` - High traffic
5. `/api/admin/developments` - High traffic

### Medium Priority
6. `/api/admin/stands`
7. `/api/admin/commissions`
8. `/api/admin/installments`
9. `/api/admin/receipts`

### Low Priority
10. `/api/admin/kanban`
11. `/api/admin/pipeline-rules`
12. `/api/admin/automations`
13. Other admin routes

---

## ✅ VERIFICATION CHECKLIST

After migrating each route:

- [ ] Import updated to `@/lib/access-control`
- [ ] Route tested - authentication works
- [ ] Route tested - authorization works
- [ ] Cache hit rate > 80% (check metrics)
- [ ] No errors in logs
- [ ] Performance improved (check metrics)

---

## 📝 FILES CREATED

### New Services
- ✅ `lib/permission-manager.ts` - Permission management utilities
- ✅ `lib/access-control-metrics.ts` - Performance metrics tracking

### New APIs
- ✅ `app/api/admin/permissions/route.ts` - Permission management API
- ✅ `app/api/admin/access-control-metrics/route.ts` - Metrics API

---

## 🎯 NEXT STEPS

1. **Continue Migration**
   - Migrate remaining high-priority routes
   - Test thoroughly
   - Monitor metrics

2. **Use Fine-Grained Permissions**
   - Grant permissions via API
   - Use `requirePermission()` in critical routes
   - Set up permission templates

3. **Monitor Performance**
   - Check metrics dashboard
   - Optimize cache TTL if needed
   - Track improvements

---

**Status:** ✅ **MIGRATION IN PROGRESS**

The access control module is ready for production use. Migrate routes gradually and monitor performance.
