# ERP Dashboard Audit Report

**Audit Date:** February 8, 2026  
**Auditor:** GitHub Copilot  
**Status:** Completed with Fixes Applied

---

## Executive Summary

This audit examined all dashboards (Admin, Manager, Developer, Accounts) to verify data visibility, KPI consistency, and financial calculation accuracy. The audit identified several critical issues and implemented fixes.

### Key Findings

| Issue | Severity | Status |
|-------|----------|--------|
| Manager sees all developments (no scoping) | 🔴 Critical | ✅ Fixed |
| Manager uses admin endpoint for developments | 🔴 Critical | ✅ Fixed |
| Manager stands-financial has no visibility scoping | 🔴 Critical | ✅ Fixed |
| No central visibility service | 🟡 Medium | ✅ Fixed |
| Admin developments endpoint has no auth | 🟡 Medium | ⚠️ Noted |
| Development.status is String (not enum) | 🟢 Low | ⚠️ Noted |

---

## Dashboard Audit Details

### A) Admin Dashboard

**Route:** `/dashboards/admin`  
**Component:** `App.tsx` with role='Admin'

**Data Sources:**
| Data | Endpoint | Scoping |
|------|----------|---------|
| Developments | `/api/admin/developments` | None (all) |
| Stands | `/api/admin/stands` | Optional branch filter |
| Stands Financial | `/api/admin/stands-financial` | None (all) |
| Payments | `/api/admin/payments` | Optional branch filter |
| Receipts | `/api/admin/receipts` | Role-based |

**Expected Behavior:** ✅ Shows all developments, all stands, full KPIs  
**Actual Behavior:** ✅ Correct  

**Issue Found:**
- [app/api/admin/developments/route.ts](app/api/admin/developments/route.ts#L644): No auth check (comments say "Public endpoint")
- **Recommendation:** Add auth for production or document as intentional public API

---

### B) Manager Dashboard

**Route:** `/dashboards/manager`  
**Component:** `ManagerDashboard.tsx`

**Data Sources (Before Fix):**
| Data | Endpoint | Issue |
|------|----------|-------|
| Developments | `/api/admin/developments` | 🔴 Wrong endpoint! |
| Stands | `/api/manager/stands` | ⚠️ Branch-only scoping |
| Stands Financial | `/api/manager/stands-financial` | 🔴 No scoping! |

**Expected Behavior:** Shows only developments within manager's branch scope  
**Actual Behavior (Before):** Showed ALL developments like admin  

**Root Cause Analysis:**
1. No `/api/manager/developments` endpoint existed
2. Manager dashboard called `/api/admin/developments` directly
3. Manager stands endpoints had TODO comments about missing `managerId`
4. No central visibility service was used

**Fixes Applied:**

1. **Created central visibility service** at [lib/services/visibility-service.ts](lib/services/visibility-service.ts)
   - `getVisibleDevelopmentIds(user)` - Returns development IDs based on role
   - `getVisibleStandIds(user)` - Returns stand IDs based on role
   - Role-based scoping: ADMIN=all, MANAGER=branch, DEVELOPER=owned

2. **Created manager developments endpoint** at [app/api/manager/developments/route.ts](app/api/manager/developments/route.ts)
   - Uses visibility service for branch scoping
   - Returns developments, stats, and debug info

3. **Updated ManagerDashboard** at [components/dashboards/ManagerDashboard.tsx](components/dashboards/ManagerDashboard.tsx#L367)
   - Changed from `/api/admin/developments` to `/api/manager/developments`

4. **Updated manager stands endpoint** at [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts)
   - Now uses visibility service for scoping

5. **Updated manager stands-financial endpoint** at [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts)
   - Now uses visibility service for scoping

---

### C) Developer Dashboard

**Route:** `/dashboards/developer`  
**Component:** `DeveloperDashboard.tsx`

**Data Sources:**
| Data | Endpoint | Scoping |
|------|----------|---------|
| Developments | `/api/developer/developments` | ✅ `developerEmail` |
| Stands | `/api/developer/stands` | ✅ Via development ownership |
| Stands Financial | `/api/developer/stands-financial` | ✅ Via development ownership |
| Payments | `/api/developer/payments` | ✅ Via development ownership |

**Expected Behavior:** Shows only developer's own developments  
**Actual Behavior:** ✅ Correct  

**Key Query:** [app/api/developer/developments/route.ts](app/api/developer/developments/route.ts#L47)
```sql
WHERE UPPER(d.status) = 'ACTIVE' AND d.developer_email = $1
```

---

### D) Accounts Dashboard

**Route:** `/dashboards/account`  
**Component:** Uses various modules (ReceiptsModule, InstallmentsModule, etc.)

**Data Sources:**
| Data | Endpoint | Scoping |
|------|----------|---------|
| Revenue | `/api/accounts/revenue` | Branch filter |
| Financial data | Uses shared financial service | ✅ Consistent |

**Expected Behavior:** Shows financial data for reconciliation  
**Actual Behavior:** ✅ Correct - Uses central `stands-financial-service`  

---

## Visibility Service Design

The new central visibility service implements role-based access control:

```typescript
// Role-based visibility rules
switch (role) {
  case 'ADMIN':
    // All developments (optionally filtered by branch/status)
    scope = 'all';
    break;

  case 'MANAGER':
    // Branch-scoped developments
    where = { branch: user.branch };
    scope = 'branch';
    break;

  case 'DEVELOPER':
    // Only developments they own
    where = { developerEmail: user.email };
    scope = 'owned';
    break;

  case 'ACCOUNT':
    // All (for financial visibility) - optionally branch-scoped
    scope = 'all' | 'branch';
    break;

  case 'CLIENT':
    // Only developments where they have reservations
    scope = 'associated';
    break;
}
```

**Usage:**
```typescript
import { getVisibleDevelopmentIds, VisibilityUser } from '@/lib/services/visibility-service';

const visibility = await getVisibleDevelopmentIds(user, {
  branch: 'Harare',
  status: 'Active',
  includeDebug: true
});

// visibility.developmentIds - Array of accessible development IDs
// visibility.scope - 'all' | 'branch' | 'owned' | 'associated'
// visibility.debug - Debug info (in dev mode)
```

---

## Finance Consistency

### Existing Central Service
The codebase already has a robust financial service at [lib/services/stands-financial-service.ts](lib/services/stands-financial-service.ts).

**Functions:**
- `calculateStandFinancials(standId)` - Single stand calculation
- `getStandsWithFinancials(options)` - Batch query with filtering
- `getStandsStatistics(options)` - Dashboard KPI aggregation
- `getStandPayments(standId)` - Payment history

**Consistency:** All dashboards now use this service through the visibility-scoped endpoints.

---

## Regression Tests Added

Created test file: [\_\_tests\_\_/visibility-service.test.ts](__tests__/visibility-service.test.ts)

**Test Coverage:**
- ✅ ADMIN sees all developments
- ✅ MANAGER sees only branch-scoped developments
- ✅ DEVELOPER sees only owned developments
- ✅ ACCOUNT sees all developments for financial visibility
- ✅ CLIENT sees only associated developments
- ✅ Unknown role gets no developments
- ✅ Debug info included when requested
- ✅ Stand visibility follows development visibility
- ✅ canUserAccessDevelopment works correctly
- ✅ canUserAccessStand works correctly

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| [lib/services/visibility-service.ts](lib/services/visibility-service.ts) | Central visibility service |
| [app/api/manager/developments/route.ts](app/api/manager/developments/route.ts) | Manager developments endpoint |
| [\_\_tests\_\_/visibility-service.test.ts](__tests__/visibility-service.test.ts) | Regression tests |

### Modified
| File | Change |
|------|--------|
| [components/dashboards/ManagerDashboard.tsx](components/dashboards/ManagerDashboard.tsx) | Use manager developments endpoint |
| [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts) | Use visibility service |
| [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts) | Use visibility service |

---

## Remaining Recommendations

### Priority 1: Schema Enhancement (Optional)
Add `managerId` field to Development model for explicit manager assignment:
```prisma
model Development {
  managerId       String?          @map("manager_id")
  manager         User?            @relation("ManagedDevelopments", fields: [managerId], references: [id])
  @@index([managerId])
}
```

Update visibility service to use `managerId` when available, falling back to branch scoping.

### Priority 2: Admin Auth
Add authentication to `/api/admin/developments` GET endpoint if not intentionally public.

### Priority 3: Status Enum
Consider migrating `Development.status` from String to enum for type safety:
```prisma
enum DevelopmentStatus {
  ACTIVE
  INACTIVE
  ONBOARDING
  ARCHIVED
}
```

### Priority 4: Revenue Service
Extract duplicate revenue logic from manager and accounts endpoints to shared service.

---

## Verification Steps

1. **Manager Dashboard Test:**
   - Log in as MANAGER user with branch='Harare'
   - Navigate to `/dashboards/manager`
   - Verify only Harare developments appear
   - Check stands are scoped to those developments

2. **Developer Dashboard Test:**
   - Log in as DEVELOPER user
   - Navigate to `/dashboards/developer`
   - Verify only developments with matching `developerEmail` appear

3. **Admin Dashboard Test:**
   - Log in as ADMIN user
   - Navigate to `/dashboards/admin`
   - Verify all developments appear regardless of branch

4. **Debug Mode:**
   - Add `?debug=true` to any manager endpoint
   - Check response includes `debug` object with scope info

---

## Conclusion

The audit identified and fixed the critical issue where Manager dashboard had no proper development scoping. The fix centralizes visibility logic in a single service that can be reused across all endpoints, ensuring consistency and reducing the risk of future scoping bugs.

The financial calculation service was already well-designed and is now properly integrated with the visibility service through the updated manager endpoints.
