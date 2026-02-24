# 🚀 ACCESS CONTROL - QUICK START GUIDE

**Date:** 2026-01-23  
**Status:** ✅ **READY TO USE**

---

## 🎯 QUICK REFERENCE

### 1. Using Access Control in Routes

**Basic Auth:**
```typescript
import { requireAdmin } from '@/lib/access-control';

const authResult = await requireAdmin();
if (authResult.error) return authResult.error;
const user = authResult.user;
```

**With Rate Limiting:**
```typescript
const authResult = await requireAdmin(request, { limit: 20, windowMs: 60000 });
```

**Fine-Grained Permissions:**
```typescript
import { requirePermission } from '@/lib/access-control';

const authResult = await requirePermission('/api/admin/reservations', 'WRITE', branch);
if (authResult.error) return authResult.error;
const user = authResult.user;
```

---

### 2. Granting Permissions

**Via API:**
```bash
POST /api/admin/permissions
{
  "userId": "user123",
  "resource": "/api/admin/reservations",
  "action": "WRITE",
  "branch": "Harare"
}
```

**Via Code:**
```typescript
import { grantPermission } from '@/lib/permission-manager';

await grantPermission({
  userId: 'user123',
  resource: '/api/admin/reservations',
  action: 'WRITE',
  branch: 'Harare',
  grantedBy: admin.id
});
```

---

### 3. Monitoring Performance

**Get Metrics:**
```bash
GET /api/admin/access-control-metrics
```

**Check Logs:**
```
[ACCESS_CONTROL] Performance Metrics
  sessionCache: { hitRate: "85.5%" }
  permissionCache: { hitRate: "92.3%" }
  queries: { reduction: "50.2%" }
  performance: { improvement: "70.5%" }
```

---

## ✅ MIGRATION CHECKLIST

- [ ] Update import: `from '@/lib/adminAuth'` → `from '@/lib/access-control'`
- [ ] Test route - authentication works
- [ ] Test route - authorization works
- [ ] Check metrics - cache hit rate > 80%
- [ ] Verify performance improvement

---

**Status:** ✅ **READY TO USE**
