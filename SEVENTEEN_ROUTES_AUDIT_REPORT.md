# Audit Report: 17 New API Routes (Agent, Client, Manager)

**Scope:** 17 new API routes across Agent (4), Client (4), and Manager (8 + `managerAuth`) dashboards.  
**Criteria:** No breaking changes, TypeScript strict, build (72 pages), auth patterns, DB structure, activity logging, production readiness.

---

## 1. Build & TypeScript

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass |
| `npm run build` | ✅ Pass |
| 72 static pages | ✅ Generated |
| New routes in build | ✅ All 17 present |

**Notes:** Viewport metadata warnings (e.g. `/_not-found`, `/login`, `/dashboards/*`) are pre-existing and unrelated to these routes.

---

## 2. Routes Audited

### Agent (4)

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/agent/clients` | GET, POST | `requireAgent` | POST: `address` in body not persisted (Client has no `address`). |
| `/api/agent/clients/[id]` | GET, PUT, DELETE | `requireAgent` | Branch + ownership checks; `national_id` used correctly. |
| `/api/agent/deals/[id]/notes` | GET, POST | `requireAgent` | Notes in Activity; deal = stand; ownership verified. |
| `/api/agent/leads` | GET, POST | `requireAgent` | Leads in Activity with `type: 'USER_CREATED'`. |
| `/api/agent/leads/[id]` | GET, PUT, DELETE | `requireAgent` | Ownership and validation OK. |

### Client (4)

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/client/profile` | GET, PUT | `getServerSession` | Branch hardcoded `'Harare'`. |
| `/api/client/payments/upload` | GET, POST | `getServerSession` | `proofUrl` only in Activity metadata; `Payment` has no `proofUrl`. |
| `/api/client/documents` | GET | `getServerSession` | Filter by `type`; Harare hardcoded. |
| `/api/client/documents/[id]/download` | GET | `getServerSession` | Ownership and `type` validation OK. |

### Manager (8)

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/manager/approvals/pending` | GET | `requireManager` | Payment + Reservation pending; branch filter OK. |
| `/api/manager/approvals/[id]/approve` | POST | `requireManager` | **Reservation: no branch check.** Payment has branch check. |
| `/api/manager/approvals/[id]/reject` | POST | `requireManager` | **No branch check for payment or reservation.** |
| `/api/manager/team` | GET | `requireManager` | **Uses `agentId: member.id` (User.id); schema: `Reservation.agentId` → `Agent.id`.** |
| `/api/manager/team/[id]/performance` | GET | `requireManager` | **Same `agentId` vs `Agent.id` mismatch; `activities` correctly use `userId`.** |
| `/api/manager/reports/daily` | GET | `requireManager` | Branch-scoped; schema-aligned. |

**Auth:** Manager routes use `@/lib/managerAuth` `requireManager` (MANAGER or ADMIN). Agent use `@/lib/adminAuth` `requireAgent`. Client use `getServerSession` + `authOptions` directly.

---

## 3. Issues

### High

1. **Manager approvals – missing branch checks**
   - **approve:** Payment: `office_location !== user.branch` enforced; **Reservation: no check.** A non-ADMIN manager can approve reservations for stands in other branches.
   - **reject:** No branch check for payment or reservation. Cross-branch rejections possible.
   - **Recommendation:** For reservation in approve/reject: ensure `reservation.stand.branch === user.branch` (or `user.role === 'ADMIN'`). For payment in reject: reuse the same pattern as approve (`office_location` vs `user.branch`).

2. **Manager team & performance – `agentId` vs `Agent.id`**
   - `Reservation.agentId` references `Agent.id`. There is no `User` ↔ `Agent` relation in the schema.
   - `manager/team` and `manager/team/[id]/performance` use `User.id` (role AGENT) as `agentId` in `reservation` and `stand` queries. If `Agent.id` ≠ `User.id`, these counts will be wrong (often 0).
   - **Recommendation:** Confirm intended model: (a) add `Agent.userId` and use `Agent.id` in these routes, or (b) migrate `Reservation.agentId` to reference `User` and use `User.id` consistently. Align `Commission.agentId` with the chosen model.

### Medium

3. **Client `address`**
   - `POST /api/agent/clients` accepts `address`; `Client` has no `address`. Value is ignored.
   - **Recommendation:** Remove from API or add `address` to `Client` (and migration) if required.

4. **Payment proof URL**
   - `POST /api/client/payments/upload` receives `proofUrl` but only stores it in `Activity.metadata`. `Payment` has no `proofUrl`. Verification would rely on Activity.
   - **Recommendation:** If staff must see proof from the Payment record, add `proofUrl` (or similar) to `Payment` and persist it; otherwise document that proof is in Activity only.

5. **Client branch hardcoding**
   - `/api/client/profile`, `/api/client/payments/upload`, `/api/client/documents` (and related) use `branch: 'Harare'` for client lookup. Multi-branch clients will not work.
   - **Recommendation:** Derive branch from session, client–user mapping, or a well-defined rule and pass it into these routes.

### Low

6. **Redundant `requireManager`**
   - `@/lib/adminAuth` has `requireManager`; Manager routes use `@/lib/managerAuth`. Two implementations for the same role check.
   - **Recommendation:** Use one (e.g. `adminAuth.requireManager`) for consistency and easier maintenance.

7. **`managerAuth`**
   - Unused `NextRequest` import. `user` from session is typed `any`. Minor cleanup possible.

---

## 4. Positive Findings

- **Auth:** All routes enforce login; Agent/Manager use role checks; Manager approval and team scope by branch where implemented.
- **Activity logging:** Agent (client create, deal notes, leads), Client (payment upload), Manager (approve/reject) write to `Activity` with useful `type` and `metadata`.
- **Schema alignment:** Agent clients CRUD, deal notes, leads; Client profile, documents; Manager pending, daily reports use correct models and fields (except `agentId`/`Agent` and items above).
- **Errors:** try/catch and `NextResponse.json` with appropriate status codes.
- **Params:** `params` correctly awaited in Next 15 (`params: Promise<{ id: string }>`).

---

## 5. Summary

| Area | Status | Notes |
|------|--------|-------|
| TypeScript strict | ✅ | `tsc --noEmit` passes |
| Build / 72 pages | ✅ | Build succeeds; all new routes included |
| Breaking changes | ✅ | None observed |
| Auth patterns | ✅ | Consistent per dashboard; consider unifying `requireManager` |
| DB / schema | ⚠️ | `agentId`/Agent vs User; `address`; `proofUrl`; branch hardcoding |
| Activity logging | ✅ | Present where expected |
| Production readiness | ⚠️ | Blocked by: (1) Manager approval branch checks, (2) Manager team/performance Agent–User mapping |

**Recommendation:**  
- **Must fix before production:** Manager approval branch checks (approve for reservations, reject for both); resolve `Reservation.agentId` vs `User.id` (and `Agent` relationship) for Manager team and performance.  
- **Should fix:** Client `address` handling or removal; Payment `proofUrl` strategy; client branch for Client routes.  
- **Nice to have:** Single `requireManager`; `managerAuth` and `adminAuth` cleanup.

---

*Generated after full review of the 17 new routes, Prisma schema, `managerAuth`, and build/tsc runs.*
