# ERP API Endpoint Audit Report

**Generated:** February 8, 2026  
**Scope:** Role-based API endpoints mapping, data scoping analysis, and duplicated logic identification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [API Endpoints by Role](#api-endpoints-by-role)
3. [Major Endpoint Deep Dive](#major-endpoint-deep-dive)
4. [Data Scoping Analysis](#data-scoping-analysis)
5. [Shared Services](#shared-services)
6. [Duplicated Logic](#duplicated-logic)
7. [TODO Comments & Missing Scoping](#todo-comments--missing-scoping)
8. [Recommendations](#recommendations)

---

## Executive Summary

### Key Findings

| Category | Count | Status |
|----------|-------|--------|
| Admin API Endpoints | 84+ | ✅ Mostly secure |
| Manager API Endpoints | 21 | ⚠️ Missing development scoping |
| Developer API Endpoints | 16 | ✅ Properly scoped by developerEmail |
| Accounts API Endpoints | 1 | ✅ Branch-scoped |
| Client API Endpoints | 5+ | ✅ Scoped by clientId |
| Agent API Endpoints | 7+ | ⚠️ Some need review |

### Critical Issues

1. **🔴 Manager Development Scoping Missing** - Manager endpoints lack `managerId` field on developments
2. **🟡 Duplicate Auth Libraries** - Both `lib/access-control.ts` and `lib/adminAuth.ts` exist
3. **🟡 `getDataFilter()` Security Concern** - Potential IDOR vector in dashboard permissions

---

## API Endpoints by Role

### `/api/admin/*` (84+ endpoints)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/admin/developments` | [app/api/admin/developments/route.ts](app/api/admin/developments/route.ts) | `requireAdmin` | None (full access) |
| `POST /api/admin/developments` | [app/api/admin/developments/route.ts](app/api/admin/developments/route.ts) | `requireAdmin` | None |
| `GET /api/admin/stands` | [app/api/admin/stands/route.ts](app/api/admin/stands/route.ts) | `requireRole(['ADMIN', 'MANAGER', 'ACCOUNT', 'DEVELOPER'])` | Optional branch filter |
| `GET /api/admin/stands-financial` | [app/api/admin/stands-financial/route.ts](app/api/admin/stands-financial/route.ts) | `requireRole(['ADMIN'])` | None (all developments) |
| `GET /api/admin/payments` | [app/api/admin/payments/route.ts](app/api/admin/payments/route.ts) | `requireAgent` | Optional branch/officeLocation filter |
| `POST /api/admin/payments` | [app/api/admin/payments/route.ts](app/api/admin/payments/route.ts) | `requireAdmin` | None |
| `GET /api/admin/receipts` | [app/api/admin/receipts/route.ts](app/api/admin/receipts/route.ts) | `requireAgent` | Role-based (AGENT sees their clients, CLIENT sees own) |
| `GET /api/admin/installments` | [app/api/admin/installments/route.ts](app/api/admin/installments/route.ts) | `ADMIN/MANAGER/ACCOUNT` check | Optional developmentId/branch filter |
| `GET /api/admin/contracts` | [app/api/admin/contracts/route.ts](app/api/admin/contracts/route.ts) | `requireAdmin` | Uses `buildContractScopeWhere()` |
| `GET /api/admin/clients` | app/api/admin/clients/route.ts | `requireAdmin` | Branch filter |
| `GET /api/admin/users` | app/api/admin/users/route.ts | `requireAdmin` | None |

### `/api/manager/*` (21 endpoints)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/manager/stands` | [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts) | `requireRole(['MANAGER'])` | ⚠️ **Branch only** (TODO: add managerId) |
| `GET /api/manager/stands-financial` | [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts) | `requireRole(['MANAGER'])` | ⚠️ **No scoping** (sees all like admin) |
| `GET /api/manager/stands/[standId]/payments` | [app/api/manager/stands/[standId]/payments/route.ts](app/api/manager/stands/%5BstandId%5D/payments/route.ts) | `requireRole(['MANAGER'])` | ⚠️ **TODO: add authorization check** |
| `GET /api/manager/contracts` | [app/api/manager/contracts/route.ts](app/api/manager/contracts/route.ts) | `requireManager` | Uses `buildContractScopeWhere()` - branch-scoped |
| `GET /api/manager/revenue` | [app/api/manager/revenue/route.ts](app/api/manager/revenue/route.ts) | `requireManager` | Branch filter via `officeLocation` |
| `GET /api/manager/team` | app/api/manager/team/route.ts | `requireManager` | Branch-scoped |
| `GET /api/manager/targets` | app/api/manager/targets/route.ts | `requireManager` | Branch-scoped |
| `GET /api/manager/payouts` | app/api/manager/payouts/route.ts | `requireManager` | Branch-scoped |
| `GET /api/manager/approvals/pending` | app/api/manager/approvals/pending/route.ts | `requireManager` | Branch-scoped |

### `/api/developer/*` (16 endpoints)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/developer/developments` | [app/api/developer/developments/route.ts](app/api/developer/developments/route.ts) | `session.user.email` | ✅ `WHERE developer_email = $1` |
| `GET /api/developer/stands` | [app/api/developer/stands/route.ts](app/api/developer/stands/route.ts) | `session.user.email` | ✅ `development.developerEmail = userEmail` |
| `PUT /api/developer/stands` | [app/api/developer/stands/route.ts](app/api/developer/stands/route.ts) | `session.user.email` | ✅ Ownership check before update |
| `GET /api/developer/stands-financial` | [app/api/developer/stands-financial/route.ts](app/api/developer/stands-financial/route.ts) | `requireRole(['DEVELOPER'])` | ✅ `developerEmail: authResult.user.email` |
| `GET /api/developer/payments` | [app/api/developer/payments/route.ts](app/api/developer/payments/route.ts) | `session.user.email` | ✅ `WHERE developer_email = $userEmail` |
| `POST /api/developer/payments` | [app/api/developer/payments/route.ts](app/api/developer/payments/route.ts) | `session.user.email` | ✅ Ownership verified before insert |
| `GET /api/developer/receipts` | [app/api/developer/receipts/route.ts](app/api/developer/receipts/route.ts) | `session.user.email` | ✅ `developmentName: { in: developmentNames }` |
| `GET /api/developer/installments` | [app/api/developer/installments/route.ts](app/api/developer/installments/route.ts) | `session.user.email` | ✅ `developmentId: { in: developmentIds }` |
| `GET /api/developer/contracts` | [app/api/developer/contracts/route.ts](app/api/developer/contracts/route.ts) | `session.user.email` | ✅ `buildContractScopeWhere()` with DEVELOPER role |
| `GET /api/developer/buyers` | app/api/developer/buyers/route.ts | `session.user.email` | ✅ `developerEmail: session.user.email` |
| `GET /api/developer/chart-data` | app/api/developer/chart-data/route.ts | `session.user.email` | ✅ `developer_email` scoped |
| `GET /api/developer/statement` | app/api/developer/statement/route.ts | `session.user.email` | ✅ `developer_email` scoped |

### `/api/accounts/*` (1 endpoint)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/accounts/revenue` | [app/api/accounts/revenue/route.ts](app/api/accounts/revenue/route.ts) | `ACCOUNT/ADMIN` role check | Branch filter via `office_location` |

### `/api/client/*` (5+ endpoints)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/client/payments` | [app/api/client/payments/route.ts](app/api/client/payments/route.ts) | `session.user` | ✅ `clientId: client.id` (from email lookup) |
| `GET /api/client/installments` | [app/api/client/installments/route.ts](app/api/client/installments/route.ts) | `session.user.email` | ✅ `clientId: client.id` |
| `GET /api/client/receipts` | [app/api/client/receipts/route.ts](app/api/client/receipts/route.ts) | `session.user.email` | ✅ `clientId: client.id` |

### `/api/agent/*` (7+ endpoints)

| Endpoint | File | Auth | Scoping |
|----------|------|------|---------|
| `GET /api/agent/deals` | [app/api/agent/deals/route.ts](app/api/agent/deals/route.ts) | `requireAgent` | ✅ `ownerId: user.id` |
| `GET /api/agent/clients` | [app/api/agent/clients/route.ts](app/api/agent/clients/route.ts) | `requireAgent` | ⚠️ Uses `getDataFilter()` - see concern |
| `GET /api/agent/leads` | app/api/agent/leads/route.ts | `requireAgent` | ✅ `userId` filter |
| `GET /api/agent/commissions` | app/api/agent/commissions/route.ts | `requireAgent` | ⚠️ Needs audit |

---

## Major Endpoint Deep Dive

### Developments

| Role | Endpoint | File | Scoping Method |
|------|----------|------|----------------|
| ADMIN | `GET /api/admin/developments` | [app/api/admin/developments/route.ts](app/api/admin/developments/route.ts) | None - sees all |
| DEVELOPER | `GET /api/developer/developments` | [app/api/developer/developments/route.ts](app/api/developer/developments/route.ts) | ✅ `WHERE developer_email = session.user.email` |
| MANAGER | ❌ | N/A | ⚠️ No dedicated endpoint - TODO: add managerId |

### Stands

| Role | Endpoint | File | Scoping Method |
|------|----------|------|----------------|
| ADMIN | `GET /api/admin/stands` | [app/api/admin/stands/route.ts](app/api/admin/stands/route.ts) | Optional branch filter |
| ADMIN | `GET /api/admin/stands-financial` | [app/api/admin/stands-financial/route.ts](app/api/admin/stands-financial/route.ts) | Uses `getStandsWithFinancials()` - no scope |
| MANAGER | `GET /api/manager/stands` | [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts) | ⚠️ Branch filter only (TODO: managerId) |
| MANAGER | `GET /api/manager/stands-financial` | [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts) | ⚠️ **NO SCOPING** - sees all like admin |
| DEVELOPER | `GET /api/developer/stands` | [app/api/developer/stands/route.ts](app/api/developer/stands/route.ts) | ✅ `development.developerEmail = userEmail` |
| DEVELOPER | `GET /api/developer/stands-financial` | [app/api/developer/stands-financial/route.ts](app/api/developer/stands-financial/route.ts) | ✅ `developerEmail: user.email` → `developmentIds` |

### Payments

| Role | Endpoint | File | Scoping Method |
|------|----------|------|----------------|
| ADMIN | `GET /api/admin/payments` | [app/api/admin/payments/route.ts](app/api/admin/payments/route.ts) | Optional `officeLocation` filter |
| DEVELOPER | `GET /api/developer/payments` | [app/api/developer/payments/route.ts](app/api/developer/payments/route.ts) | ✅ `WHERE developer_email = userEmail` |
| CLIENT | `GET /api/client/payments` | [app/api/client/payments/route.ts](app/api/client/payments/route.ts) | ✅ `clientId: client.id` |

### Installments

| Role | Endpoint | File | Scoping Method |
|------|----------|------|----------------|
| ADMIN | `GET /api/admin/installments` | [app/api/admin/installments/route.ts](app/api/admin/installments/route.ts) | Optional filters (branch, developmentId) |
| DEVELOPER | `GET /api/developer/installments` | [app/api/developer/installments/route.ts](app/api/developer/installments/route.ts) | ✅ `developmentId: { in: developmentIds }` |
| CLIENT | `GET /api/client/installments` | [app/api/client/installments/route.ts](app/api/client/installments/route.ts) | ✅ `clientId: client.id` |

### Receipts

| Role | Endpoint | File | Scoping Method |
|------|----------|------|----------------|
| ADMIN | `GET /api/admin/receipts` | [app/api/admin/receipts/route.ts](app/api/admin/receipts/route.ts) | Role-based: AGENT→their clients, CLIENT→own |
| DEVELOPER | `GET /api/developer/receipts` | [app/api/developer/receipts/route.ts](app/api/developer/receipts/route.ts) | ✅ `developmentName: { in: developmentNames }` |
| CLIENT | `GET /api/client/receipts` | [app/api/client/receipts/route.ts](app/api/client/receipts/route.ts) | ✅ `clientId: client.id` |

---

## Data Scoping Analysis

### By Development Ownership (developerEmail)

**Implementation:** ✅ Properly implemented for DEVELOPER role

```typescript
// Pattern used consistently in /api/developer/* endpoints
const developments = await prisma.development.findMany({
  where: { developerEmail: session.user.email },
  select: { id: true }
});
const developmentIds = developments.map(d => d.id);
// Then filter related records by developmentIds
```

**Files using this pattern:**
- [app/api/developer/developments/route.ts](app/api/developer/developments/route.ts#L32-L48)
- [app/api/developer/stands/route.ts](app/api/developer/stands/route.ts#L25-L28)
- [app/api/developer/stands-financial/route.ts](app/api/developer/stands-financial/route.ts#L35-L40)
- [app/api/developer/receipts/route.ts](app/api/developer/receipts/route.ts#L24-L28)
- [app/api/developer/installments/route.ts](app/api/developer/installments/route.ts#L23-L31)

### By Branch (office_location / branch)

**Implementation:** Used for MANAGER and ACCOUNT roles

```typescript
// Pattern used in manager endpoints
const branchFilter = branch === 'all' ? {} : { officeLocation: branch };
// OR
const branchFilter = branch === 'all' ? {} : { office_location: branch };
```

**Files using this pattern:**
- [app/api/manager/revenue/route.ts](app/api/manager/revenue/route.ts#L67)
- [app/api/accounts/revenue/route.ts](app/api/accounts/revenue/route.ts#L82)
- [app/api/admin/payments/route.ts](app/api/admin/payments/route.ts#L37-L39)

### By Client ID (clientId)

**Implementation:** ✅ Properly implemented for CLIENT role

```typescript
// Pattern used in /api/client/* endpoints
const client = await prisma.client.findFirst({
  where: { email: session.user.email }
});
// Then filter by client.id
```

### By Agent ID (agentId / ownerId)

**Implementation:** ✅ Properly implemented for AGENT role

```typescript
// Pattern used in /api/agent/deals
const deals = await prisma.deal.findMany({
  where: { ownerId: user.id }
});
```

---

## Shared Services

### 1. Stands Financial Service ✅

**File:** [lib/services/stands-financial-service.ts](lib/services/stands-financial-service.ts)

**Purpose:** Centralized financial calculations for stands across all dashboards

**Functions:**
- `calculateStandFinancials(standId)` - Single stand calculation
- `getStandsWithFinancials(options)` - Batch query with filtering
- `getStandsStatistics(options)` - Dashboard KPI aggregation
- `getStandPayments(standId)` - Payment history for a stand

**Options Interface:**
```typescript
interface StandsQueryOptions {
  developmentIds?: string[];  // For developer/manager scope
  branch?: string;            // For branch filtering
  status?: string;            // Payment status filter
  search?: string;            // Search filter
  clientId?: string;          // For client portal
}
```

**Used By:**
- [app/api/admin/stands-financial/route.ts](app/api/admin/stands-financial/route.ts) - No scope (all)
- [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts) - ⚠️ No scope (all)
- [app/api/developer/stands-financial/route.ts](app/api/developer/stands-financial/route.ts) - ✅ developmentIds scope
- [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts) - ⚠️ Branch only
- [lib/services/backup-csv-generator.ts](lib/services/backup-csv-generator.ts)

### 2. Contract Access Control ✅

**File:** [lib/contract-access-control.ts](lib/contract-access-control.ts)

**Purpose:** Centralized access control for contracts visibility

**Functions:**
- `buildContractScopeWhere(user, filters)` - Build Prisma WHERE clause by role

**Visibility Rules:**
- ADMIN: All contracts
- MANAGER: Branch-scoped
- DEVELOPER: Via Stand → Development ownership
- AGENT: Via Client.agentId
- CLIENT: Own contracts only

**Used By:**
- [app/api/admin/contracts/route.ts](app/api/admin/contracts/route.ts)
- [app/api/manager/contracts/route.ts](app/api/manager/contracts/route.ts)
- [app/api/developer/contracts/route.ts](app/api/developer/contracts/route.ts)

### 3. Unified Access Control

**File:** [lib/access-control.ts](lib/access-control.ts) (547 lines)

**Purpose:** Single source of truth for authentication and authorization

**Functions:**
- `getAuthenticatedUser()` - Get user with caching
- `requireAuth()` - Require authentication
- `requireRole(allowedRoles)` - Require specific role(s)
- `requireAdmin()`, `requireManager()`, `requireAgent()` - Role shortcuts
- `hasRole()`, `hasAnyRole()`, `isAdmin()` - Role checks
- `checkPermission()` - Fine-grained permission check

### 4. Dashboard Permissions ⚠️

**File:** [lib/dashboard-permissions.ts](lib/dashboard-permissions.ts)

**Purpose:** Role-based access control for dashboard data

**Functions:**
- `getDataFilter(userRole, userId, userBranch)` - Returns filter object by role
- `canAccessDashboard(userRole, dashboardType)` - Dashboard access check

**⚠️ Security Concern:** The `getDataFilter()` function may allow IDOR if not carefully validated.

---

## Duplicated Logic

### 1. Auth Libraries (Duplicate)

**Problem:** Two auth libraries exist with similar functionality

| Library | File | Used By |
|---------|------|---------|
| `lib/access-control.ts` | Primary, modern | Most new endpoints |
| `lib/adminAuth.ts` | Legacy | Some admin endpoints |

**Impact:** Inconsistent auth patterns across codebase

**Recommendation:** Consolidate to `lib/access-control.ts`

### 2. Revenue Query Logic (Duplicate)

**Problem:** Near-identical revenue calculation code in:
- [app/api/manager/revenue/route.ts](app/api/manager/revenue/route.ts#L36-L95)
- [app/api/accounts/revenue/route.ts](app/api/accounts/revenue/route.ts#L40-L85)

Both endpoints calculate:
- Weekly/monthly/quarterly revenue
- Date ranges (startOfWeek, startOfMonth, etc.)
- Branch filtering

**Recommendation:** Extract to shared service `lib/services/revenue-service.ts`

### 3. Stand Payment Query Logic (Duplicate)

**Problem:** Similar payment queries for stands in:
- [app/api/admin/stands/[standId]/payments/route.ts](app/api/admin/stands/%5BstandId%5D/payments/route.ts)
- [app/api/manager/stands/[standId]/payments/route.ts](app/api/manager/stands/%5BstandId%5D/payments/route.ts)
- [app/api/developer/stands/[standId]/payments/route.ts](app/api/developer/stands/%5BstandId%5D/payments/route.ts)
- [app/api/manager/stands-financial/[standId]/payments/route.ts](app/api/manager/stands-financial/%5BstandId%5D/payments/route.ts)
- [app/api/developer/stands-financial/[standId]/payments/route.ts](app/api/developer/stands-financial/%5BstandId%5D/payments/route.ts)

All use `getStandPayments()` from financial service ✅ (Good!)

**Note:** Already consolidated via `stands-financial-service.ts`

### 4. Branch Filter Logic (Scattered)

**Problem:** Branch filtering implemented differently across endpoints:

```typescript
// Pattern 1 (offices)
const branchFilter = branch === 'all' ? {} : { officeLocation: branch };

// Pattern 2 (offices - snake_case)
const branchFilter = branch === 'all' ? {} : { office_location: branch };

// Pattern 3 (developments)
where.development = { branch: branch };

// Pattern 4 (direct)
where.branch = branch;
```

**Recommendation:** Standardize on single pattern

---

## TODO Comments & Missing Scoping

### Critical TODOs

| File | Line | TODO | Impact |
|------|------|------|--------|
| [app/api/manager/stands/route.ts](app/api/manager/stands/route.ts#L34) | 34 | `// TODO: Add managerId to Development schema` | 🔴 Manager sees all developments |
| [app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts#L35) | 35 | `// TODO: Add managerId field to Development schema for proper scoping` | 🔴 Manager sees all stands |
| [app/api/manager/stands-financial/[standId]/payments/route.ts](app/api/manager/stands-financial/%5BstandId%5D/payments/route.ts#L40) | 40 | `// TODO: Add authorization check when managerId is added to Development schema` | 🔴 No ownership check |
| [app/api/manager/stands/[standId]/payments/route.ts](app/api/manager/stands/%5BstandId%5D/payments/route.ts#L40) | 40 | `// TODO: Add authorization check when managerId is added to Development schema` | 🔴 No ownership check |

### Missing Scoping Issues

1. **Manager Stands Financial** ([app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts))
   - Currently: No scoping (sees all like admin)
   - Should: Filter by `managerId` → developments → stands
   
2. **Manager Stands** ([app/api/manager/stands/route.ts](app/api/manager/stands/route.ts))
   - Currently: Only branch filter
   - Should: Filter by `managerId` → developments

3. **Admin Payments** ([app/api/admin/payments/route.ts](app/api/admin/payments/route.ts))
   - Allows `requireAgent` (broader than expected for "admin" route)

---

## Recommendations

### Priority 1: Schema Change (Required for Manager Scoping)

Add `managerId` field to Development model:

```prisma
model Development {
  // ... existing fields
  managerId       String?          @map("manager_id")
  manager         User?            @relation("ManagedDevelopments", fields: [managerId], references: [id])
  
  @@index([managerId])
}
```

### Priority 2: Fix Manager Endpoints

After schema change, update:

1. **[app/api/manager/stands/route.ts](app/api/manager/stands/route.ts)**
```typescript
const managerDevelopments = await prisma.development.findMany({
  where: { 
    managerId: authResult.user.id,  // ← ADD THIS
    branch: branch || undefined 
  },
  select: { id: true },
});
```

2. **[app/api/manager/stands-financial/route.ts](app/api/manager/stands-financial/route.ts)**
```typescript
const managerDevelopments = await prisma.development.findMany({
  where: { managerId: authResult.user.id },
  select: { id: true },
});
const developmentIds = managerDevelopments.map(d => d.id);

const stands = await getStandsWithFinancials({
  developmentIds,  // ← ADD THIS
  branch: branch || undefined,
  // ...
});
```

### Priority 3: Consolidate Auth Libraries

Migrate all uses of `lib/adminAuth.ts` to `lib/access-control.ts`:

**Files to update:**
- [app/api/admin/developments/route.ts](app/api/admin/developments/route.ts#L3)
- [app/api/admin/receipts/route.ts](app/api/admin/receipts/route.ts#L2)
- [app/api/admin/installments/route.ts](app/api/admin/installments/route.ts#L2)
- [app/api/admin/contracts/route.ts](app/api/admin/contracts/route.ts#L2)

### Priority 4: Audit getDataFilter()

Review [lib/dashboard-permissions.ts](lib/dashboard-permissions.ts) to ensure:
- Agents cannot specify other agent's ID
- Managers cannot override branch restrictions
- Input validation on all parameters

### Priority 5: Extract Revenue Service

Create `lib/services/revenue-service.ts`:

```typescript
export interface RevenueQueryOptions {
  branch?: string;
  timezone?: string;
}

export async function getRevenueAnalytics(options: RevenueQueryOptions) {
  // Consolidate logic from:
  // - app/api/manager/revenue/route.ts
  // - app/api/accounts/revenue/route.ts
}
```

---

## Appendix: File Paths Quick Reference

### Auth & Permissions
- [lib/access-control.ts](lib/access-control.ts) - Primary auth service
- [lib/adminAuth.ts](lib/adminAuth.ts) - Legacy auth (to consolidate)
- [lib/dashboard-permissions.ts](lib/dashboard-permissions.ts) - Dashboard RBAC
- [lib/contract-access-control.ts](lib/contract-access-control.ts) - Contract visibility

### Shared Services
- [lib/services/stands-financial-service.ts](lib/services/stands-financial-service.ts) - Financial calculations

### API Directories
- `app/api/admin/` - 84+ endpoints
- `app/api/manager/` - 21 endpoints
- `app/api/developer/` - 16 endpoints
- `app/api/accounts/` - 1 endpoint
- `app/api/client/` - 5+ endpoints
- `app/api/agent/` - 7+ endpoints
