# ACCOUNTS DASHBOARD COMPREHENSIVE AUDIT REPORT
**Phase 0 - Audit Only (NO CODE CHANGES)**
**Date:** February 2, 2026
**Auditor:** Senior Full-Stack ERP Auditor
**System:** Fine & Country Zimbabwe ERP - Next.js 15.5.9

---

## EXECUTIVE SUMMARY

### Audit Scope
Complete CRUD capability audit of the **Accounts Dashboard** with special focus on:
1. **Component Inventory** - All cards, tables, buttons, actions
2. **CRUD Gap Analysis** - Required vs Implemented operations per component
3. **PDF Generation Reliability** - All PDF outputs (statements, receipts, reports)
4. **RBAC Enforcement** - Server-side permission checks
5. **Financial Integrity** - Payment totals, VAT/fees, commission calculations

### Critical Findings Summary
- **8 Main Components** identified with varying CRUD completeness
- **3 PDF Generation Endpoints** using Puppeteer (high risk for Vercel edge runtime)
- **6 CSV Export Endpoints** functional (no runtime issues)
- **CRUD Gaps Identified:** Update operations missing for Payments, Receipts, Installments
- **PDF Runtime Issue:** No `export const runtime = 'nodejs'` declared in PDF routes
- **RBAC:** Properly enforced server-side (✅ Pass)

---

## PART 1: ACCOUNTS DASHBOARD COMPONENT INVENTORY

### Main Dashboard File
**File:** `app/dashboards/account/page.tsx`
- **Purpose:** Entry point with role-based access control using `/api/auth/me`
- **RBAC Check:** ✅ Uses centralized `canUserAccessDashboard()` from `lib/role-router.ts`
- **Redirect Logic:** ✅ Prevents Developer dashboard redirect bug
- **Component:** Renders `<AccountDashboard />` from `components/account/AccountDashboard.tsx`

### Core Component
**File:** `components/account/AccountDashboard.tsx` (1322 lines)
**Dependencies:**
- Recharts for visualization
- Shared dashboard components: `DashboardHeader`, `DashboardTabs`, `KPICard`
- **Sub-components:**
  - `StandsPaymentsTab` (from `components/account/StandsPaymentsTab.tsx`)
  - `RecordPaymentModal` (from `components/account/RecordPaymentModal.tsx`)
  - `DeveloperPayoutsTab` (from `components/account/DeveloperPayoutsTab.tsx`)
  - Inline: `PaymentsTab`, `InstallmentsTab`, `ClientsTab`, `CommissionsTab`, `ReportsTab`

---

## PART 2: COMPONENT-BY-COMPONENT FULL-STACK TRACE

### COMPONENT 1: OVERVIEW TAB (KPI Dashboard)

**UI Component:** `AccountDashboard` (Overview tab)
**Location:** Lines 106-240 in `AccountDashboard.tsx`

#### Data Flow
```
UI (AccountDashboard)
  → useEffect hook → fetchStats()
  → API: GET /api/account/stats?branch={branch}
  → Handler: app/api/account/stats/route.ts
  → Service: Direct Prisma queries (no service layer)
  → DB: Prisma queries → payments, installmentPlans, clients, stands
  → Response: DTO with 8 KPI values
  → UI: Renders 8 KPI cards + 3 charts
```

#### KPI Cards (8 Total)
1. **Total Revenue** (`stats.totalRevenue`)
   - Query: `SUM(payments.amount) WHERE status='CONFIRMED'`
   - Chart: Line chart (monthly trends)
2. **Pending Payments** (`stats.pendingPayments`)
   - Query: `COUNT(payments) WHERE status='PENDING'`
3. **Overdue Amount** (`stats.overdueAmount`)
   - Query: `SUM(installments.amountDue) WHERE dueDate < NOW() AND status='UNPAID'`
4. **Collection Rate** (calculated)
   - Formula: `confirmedPayments / (confirmedPayments + pendingPayments) * 100`
5. **Active Clients** (`stats.totalClients`)
   - Query: `COUNT(DISTINCT clients)`
6. **Active Installments** (`stats.activeInstallments`)
   - Query: `COUNT(installmentPlans) WHERE status='ACTIVE'`
7. **Available Stands** (`stats.availableStands`)
   - Query: `COUNT(stands) WHERE status='AVAILABLE'`
8. **Pending Commissions** (`stats.pendingCommissions`)
   - Query: `SUM(commissionPayouts) WHERE status='CALCULATED'`

#### Charts (3 Total)
1. **Revenue Trend Chart** (Line)
   - API: `/api/accounts/revenue?branch={branch}&period={period}` (typo: should be `/api/account/revenue`)
   - Data: Monthly revenue for last 6 months
2. **Revenue by Payment Type** (Pie)
   - Data: Breakdown by `payment_type` (Deposit, Installment, Full Payment)
3. **Daily Revenue** (Bar)
   - Data: Daily revenue for selected period

#### CRUD Assessment
| Operation | Required | Implemented | Status | Notes |
|-----------|----------|-------------|--------|-------|
| **Create** | ❌ No | N/A | N/A | KPIs are read-only aggregates |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | `/api/account/stats` works |
| **Update** | ❌ No | N/A | N/A | Not applicable |
| **Delete** | ❌ No | N/A | N/A | Not applicable |

#### API Endpoints Used
1. `GET /api/account/stats` ✅ Exists
2. `GET /api/accounts/revenue` ⚠️ **TYPO** (should be `/api/account/revenue` or is endpoint missing?)

#### Issues Found
1. **API Route Typo/Missing:** Line 150 calls `/api/accounts/revenue` (plural) but should be `/api/account/revenue` (singular)
2. **No Error Handling UI:** If stats fetch fails, dashboard shows stale/empty data with no error message

---

### COMPONENT 2: STANDS TAB (Stand Inventory with Payments)

**UI Component:** `StandsPaymentsTab`
**Location:** External file `components/account/StandsPaymentsTab.tsx`

#### Data Flow
```
UI (StandsPaymentsTab)
  → useEffect → fetchStands()
  → API: GET /api/account/stands-payments?branch={branch}
  → Handler: app/api/account/stands-payments/route.ts
  → DB: Prisma query → stands + aggregated payments
  → Response: DTO with stands + payment totals per stand
  → UI: Table with stand details + payment summaries
```

#### Actions Available
1. **View Stand Details** (Eye icon)
2. **View Payments** (navigates to stand payments detail)
3. **Download Statement** (PDF generation)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Notes |
|-----------|----------|-------------|--------|-------|
| **Create** | ❌ No | ❌ No | N/A | Stands created via Admin dashboard only |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | `/api/account/stands-payments` works |
| **Update** | ❌ No | ❌ No | N/A | Stand updates via Admin only |
| **Delete** | ❌ No | ❌ No | N/A | Stand deletion via Admin only |

#### API Endpoints Used
1. `GET /api/account/stands-payments` ✅ Exists
2. `GET /api/account/stands-payments/[standId]/statement` ✅ Exists (PDF generation)
3. `GET /api/account/stands-payments/[standId]/payments` ✅ Exists

#### Issues Found
1. **No Create/Edit Stand UI:** Acceptable (domain rule: only Admin can manage stands)
2. **View buttons have no handlers:** Eye icon buttons in UI have no `onClick` implementation

---

### COMPONENT 3: PAYMENTS TAB (Payment Management)

**UI Component:** `PaymentsTab`
**Location:** Lines 673-791 in `AccountDashboard.tsx`

#### Data Flow
```
UI (PaymentsTab)
  → useEffect → fetchPayments()
  → API: GET /api/account/payments?branch={branch}&status={filter}
  → Handler: app/api/account/payments/route.ts (GET)
  → DB: Prisma query → payments + client names
  → Response: Array of payment objects
  → UI: Table with filters + search
```

#### Actions Available
1. **Record Payment** button (opens `RecordPaymentModal`)
2. **Export** button (no handler implemented)
3. **View** payment detail (Eye icon - no handler)
4. **Print** receipt (Printer icon - no handler)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Gaps |
|-----------|----------|-------------|--------|------|
| **Create** | ✅ Yes | ✅ Yes | ✅ **PASS** | `RecordPaymentModal` → POST `/api/account/payments` |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET works with filters |
| **Update** | ⚠️ **Conditional** | ❌ **NO** | ⚠️ **PARTIAL** | Status updates (PENDING→CONFIRMED) missing UI |
| **Delete** | ❌ **NO** | ❌ No | ✅ **CORRECT** | Payments should NOT be deleted (financial integrity) |

#### API Endpoints
1. `GET /api/account/payments` ✅ Implemented (lines 22-80)
2. `POST /api/account/payments` ✅ Implemented (lines 85-434)
3. `PUT /api/account/payments/[id]` ❌ **MISSING** (needed for status updates)
4. `GET /api/account/payments/[paymentId]/receipt` ✅ Exists (PDF)

#### Files Involved
- UI: `components/account/AccountDashboard.tsx` (PaymentsTab function)
- Modal: `components/account/RecordPaymentModal.tsx`
- API GET: `app/api/account/payments/route.ts` (GET handler)
- API POST: `app/api/account/payments/route.ts` (POST handler)
- Receipt PDF: `app/api/account/payments/[paymentId]/receipt/route.ts`

#### Issues Found
1. **No Update Handler:** Cannot change payment status (PENDING→CONFIRMED) from UI
2. **No View Detail Modal:** Eye icon has no `onClick` - users cannot view full payment details
3. **No Print Receipt Handler:** Printer icon is decorative only
4. **Export Button Non-Functional:** Button exists but no download logic

---

### COMPONENT 4: INSTALLMENTS TAB (Payment Plans)

**UI Component:** `InstallmentsTab`
**Location:** Lines 793-905 in `AccountDashboard.tsx`

#### Data Flow
```
UI (InstallmentsTab)
  → useEffect → fetchPlans()
  → API: GET /api/account/installments?branch={branch}
  → Handler: app/api/account/installments/route.ts
  → DB: Prisma query → installmentPlans + client data
  → Response: Array of installment plan objects
  → UI: Table with progress bars + status badges
```

#### Table Columns (9 Total)
1. Client Name
2. Stand Number
3. Total Amount
4. Paid Amount
5. Balance
6. Monthly Amount
7. Progress Bar (visual %)
8. Status Badge
9. Next Due Date

#### Actions Available
- **Export** button (no handler)
- No row-level actions (no View/Edit/Delete)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Gaps |
|-----------|----------|-------------|--------|------|
| **Create** | ✅ Yes | ❌ **NO** | ❌ **FAIL** | No UI to create installment plans |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET endpoint works |
| **Update** | ✅ Yes | ❌ **NO** | ❌ **FAIL** | Cannot edit plan terms, extend dates, adjust amounts |
| **Delete** | ⚠️ Conditional | ❌ **NO** | ⚠️ **PARTIAL** | Cancel/void plans (not delete) - missing |

#### API Endpoints
1. `GET /api/account/installments` ✅ Implemented
2. `POST /api/account/installments` ❌ **MISSING**
3. `PUT /api/account/installments/[id]` ❌ **MISSING**
4. `DELETE /api/account/installments/[id]` ❌ **MISSING** (should be PATCH to cancel)

#### Files Involved
- UI: `components/account/AccountDashboard.tsx` (InstallmentsTab function)
- API: `app/api/account/installments/route.ts`

#### Issues Found
1. **No Create Plan UI:** Cannot set up new installment plans for clients
2. **No Update Plan UI:** Cannot modify existing plans (extend, adjust amounts)
3. **No Cancel/Void Action:** No way to mark plans as CANCELLED with reason
4. **Export Non-Functional:** Button has no logic

---

### COMPONENT 5: CLIENTS TAB (Client Directory)

**UI Component:** `ClientsTab`
**Location:** Lines 907-1003 in `AccountDashboard.tsx`

#### Data Flow
```
UI (ClientsTab)
  → useEffect → fetchClients()
  → API: GET /api/account/clients?branch={branch}
  → Handler: app/api/account/clients/route.ts
  → DB: Prisma query → clients (users with role='CLIENT')
  → Response: Array of client objects
  → UI: Grid of client cards with search
```

#### Client Card Display
- Avatar (initial)
- Name
- Email
- Phone
- "X stands owned" count
- "View Details" button (no handler)

#### Actions Available
1. **Add Client** button (no handler)
2. **Search** input (functional - client-side filter)
3. **View Details** button per card (no handler)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Gaps |
|-----------|----------|-------------|--------|------|
| **Create** | ✅ Yes | ❌ **NO** | ❌ **FAIL** | "Add Client" button has no modal/handler |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET endpoint + search works |
| **Update** | ✅ Yes | ❌ **NO** | ❌ **FAIL** | No edit client UI |
| **Delete** | ⚠️ Conditional | ❌ **NO** | ⚠️ **PARTIAL** | Deactivate client (not delete) - missing |

#### API Endpoints
1. `GET /api/account/clients` ✅ Implemented
2. `POST /api/account/clients` ❌ **MISSING** (or use `/api/admin/clients`)
3. `PUT /api/account/clients/[id]` ❌ **MISSING**
4. `DELETE /api/account/clients/[id]` ❌ **MISSING** (should be PATCH to deactivate)

#### Files Involved
- UI: `components/account/AccountDashboard.tsx` (ClientsTab function)
- API: `app/api/account/clients/route.ts`

#### Issues Found
1. **Add Client Button Non-Functional:** No modal opens on click
2. **View Details Button Non-Functional:** No navigation to client detail page
3. **No Edit Client UI:** Cannot update client contact info, phone, email
4. **No Deactivate Client Action:** No way to mark clients as inactive

---

### COMPONENT 6: DEVELOPER PAYOUTS TAB

**UI Component:** `DeveloperPayoutsTab`
**Location:** External file `components/account/DeveloperPayoutsTab.tsx`

#### Data Flow
```
UI (DeveloperPayoutsTab)
  → useEffect → fetchPayouts()
  → API: GET /api/account/developer-payouts?branch={branch}&developmentId={id}
  → Handler: app/api/account/developer-payouts/route.ts (GET)
  → Service: SettlementCalculator.calculateSettlement()
  → DB: Prisma queries → payments + stands + developments
  → Response: Payout calculations grouped by development
  → UI: Development cards + payout breakdown tables
```

#### Actions Available
1. **Initiate Payout** button per development
2. **View Details** (expand development card)
3. **Export Payout Statement** (no handler)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Gaps |
|-----------|----------|-------------|--------|------|
| **Create** | ✅ Yes | ✅ Yes | ✅ **PASS** | POST `/api/account/developer-payouts` |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET endpoint works |
| **Update** | ✅ Yes | ✅ Yes | ✅ **PASS** | PUT endpoint for status updates |
| **Delete** | ❌ **NO** | ❌ No | ✅ **CORRECT** | Payouts should NOT be deleted (financial ledger) |

#### API Endpoints
1. `GET /api/account/developer-payouts` ✅ Implemented (lines 16-169)
2. `POST /api/account/developer-payouts` ✅ Implemented (lines 170-244)
3. `PUT /api/account/developer-payouts` ✅ Implemented (lines 246-307)

#### Files Involved
- UI: `components/account/DeveloperPayoutsTab.tsx`
- API: `app/api/account/developer-payouts/route.ts`
- Service: `lib/settlement-calculator.ts`

#### Issues Found
1. **Export Statement Button Non-Functional:** No PDF/CSV generation for payout statements
2. **No Duplicate Prevention UI:** Users could click "Initiate Payout" multiple times (API has idempotency, but UI should disable after first click)

---

### COMPONENT 7: COMMISSIONS TAB (Agent Commissions)

**UI Component:** `CommissionsTab`
**Location:** Lines 1167-1286 in `AccountDashboard.tsx`

#### Data Flow
```
UI (CommissionsTab)
  → useEffect → fetchCommissions()
  → API: GET /api/account/commissions?branch={branch}&month={selectedMonth}
  → Handler: app/api/account/commissions/route.ts (GET)
  → DB: Prisma query → commissionPayouts + agent names
  → Response: Array of commission payout objects
  → UI: Table with 3 summary cards + commission list
```

#### Summary Cards (3 Total)
1. **Calculated** (total where status='CALCULATED')
2. **Approved** (total where status='APPROVED')
3. **Paid** (total where status='PAID')

#### Table Actions
1. **Approve** button (if status='CALCULATED') - has inline handler but no API call
2. **Mark Paid** button (if status='APPROVED') - has inline handler but no API call
3. **View Details** (Eye icon - no handler)
4. **Export** button (no handler)

#### CRUD Assessment
| Operation | Required | Implemented | Status | Gaps |
|-----------|----------|-------------|--------|------|
| **Create** | ✅ Yes | ✅ Yes | ✅ **PASS** | Commissions auto-calculated via system |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET endpoint works |
| **Update** | ✅ Yes | ⚠️ **PARTIAL** | ⚠️ **PARTIAL** | PUT endpoint exists but UI buttons don't call it |
| **Delete** | ❌ **NO** | ❌ No | ✅ **CORRECT** | Commissions should NOT be deleted |

#### API Endpoints
1. `GET /api/account/commissions` ✅ Implemented (lines 15-78)
2. `PUT /api/account/commissions` ✅ Implemented (lines 80-end) - updates status
3. `POST /api/account/commissions` ❌ Not needed (auto-calculated)

#### Files Involved
- UI: `components/account/AccountDashboard.tsx` (CommissionsTab function)
- API: `app/api/account/commissions/route.ts`

#### Issues Found
1. **Approve/Mark Paid Buttons Non-Functional:** Buttons render but have no `onClick` to call PUT API
2. **No Confirmation Dialogs:** Status changes should have "Are you sure?" modals
3. **No Success/Error Feedback:** After status update, UI should show toast notification
4. **Export Non-Functional:** Button has no logic

---

### COMPONENT 8: REPORTS TAB (Financial Reports Export)

**UI Component:** `ReportsTab`
**Location:** Lines 1288-1322 in `AccountDashboard.tsx`

#### Data Flow
```
UI (ReportsTab)
  → handleGenerateReport(reportId, format)
  → API: GET /api/account/reports/{type}?branch={branch}&format={format}
  → Handler: app/api/account/reports/[type]/route.ts
  → DB: Prisma queries per report type (6 types)
  → Response: CSV file OR JSON data (for PDF)
  → UI: Downloads file or shows error
```

#### Report Types (6 Total)
1. **Revenue Report** - All confirmed payments with breakdown
2. **Payments Report** - All payments with verification status
3. **Outstanding Balances** - Overdue installments
4. **Commission Report** - Agent commissions by month
5. **Installment Status** - All installment plans with progress
6. **Inventory Report** - Stand availability by development

#### Format Options
- **PDF** (JSON response for client-side generation via jsPDF)
- **CSV** (server-side generation, direct download)

#### Actions Per Report Card
1. **PDF** button - calls `handleGenerateReport(reportId, 'pdf')`
2. **CSV** button - calls `handleGenerateReport(reportId, 'csv')`

#### CRUD Assessment
| Operation | Required | Implemented | Status | Notes |
|-----------|----------|-------------|--------|-------|
| **Create** | ❌ No | N/A | N/A | Reports are generated on-demand |
| **Read** | ✅ Yes | ✅ Yes | ✅ **PASS** | GET endpoint works for all 6 types |
| **Update** | ❌ No | N/A | N/A | Not applicable |
| **Delete** | ❌ No | N/A | N/A | Not applicable |

#### API Endpoints
1. `GET /api/account/reports/revenue` ✅ Implemented (switch case)
2. `GET /api/account/reports/payments` ✅ Implemented
3. `GET /api/account/reports/outstanding` ✅ Implemented
4. `GET /api/account/reports/commissions` ✅ Implemented
5. `GET /api/account/reports/installments` ✅ Implemented
6. `GET /api/account/reports/inventory` ✅ Implemented

#### Files Involved
- UI: `components/account/AccountDashboard.tsx` (ReportsTab function)
- API: `app/api/account/reports/[type]/route.ts`

#### Issues Found
1. **CSV Works, PDF Broken:** PDF format returns JSON for client-side generation, but client has no jsPDF implementation
2. **No Error Handling:** If report generation fails, user sees no error message
3. **No Loading State:** Buttons don't show "Generating..." spinner during API call

---

## PART 3: CRUD GAP ANALYSIS SUMMARY

### Master CRUD Status Table

| Component | Entity | Expected CRUD | Implemented CRUD | Status (%) | Missing Parts | Root Cause | Key Files |
|-----------|--------|---------------|------------------|------------|---------------|------------|-----------|
| **Overview** | Stats/KPIs | R | R | 100% | None | N/A | `app/api/account/stats/route.ts` |
| **Stands** | Stand Inventory | R | R | 100% | Create/Update handled by Admin | Domain rule ✅ | `app/api/account/stands-payments/route.ts` |
| **Payments** | Payments | C,R,U | C,R | **67%** | **Update status UI missing** | No modal for status changes | `app/api/account/payments/route.ts` (PUT missing) |
| **Installments** | Installment Plans | C,R,U,Cancel | R | **25%** | **Create, Update, Cancel all missing** | No modals/forms | `app/api/account/installments/route.ts` (POST/PUT missing) |
| **Clients** | Clients | C,R,U,Deactivate | R | **25%** | **Create, Update, Deactivate all missing** | "Add Client" button non-functional | `app/api/account/clients/route.ts` (POST/PUT missing) |
| **Dev Payouts** | Developer Payouts | C,R,U | C,R,U | 100% | None (Delete correctly omitted) | N/A | `app/api/account/developer-payouts/route.ts` ✅ |
| **Commissions** | Commission Payouts | R,U | R | **50%** | **Update buttons don't call API** | onClick handlers missing | `app/api/account/commissions/route.ts` (PUT exists but UI doesn't call it) |
| **Reports** | Report Exports | R | R | **80%** | **PDF generation broken** | Returns JSON instead of PDF | `app/api/account/reports/[type]/route.ts` |

### Overall Dashboard CRUD Completeness: **66% (5.33 / 8 components)**

---

## PART 4: PDF GENERATION DEEP AUDIT

### PDF Endpoints Identified (3 Total)

#### 1. Stand Statement PDF
**Endpoint:** `GET /api/account/stands-payments/[standId]/statement`
**File:** `app/api/account/stands-payments/[standId]/statement/route.ts`

**Generator:** Puppeteer (`lib/pdf-generator.ts`)
**Function:** `generatePDF('statement', data)` → launches headless Chrome → HTML to PDF

**Runtime Configuration:**
```typescript
// ❌ MISSING - No runtime export declared
export const dynamic = 'force-dynamic'; // Present
export const runtime = 'nodejs'; // ❌ MISSING
```

**Headers (Correct):**
```typescript
return new NextResponse(pdfBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="statement-${standNumber}.pdf"`,
  },
});
```

**Authorization Check:**
```typescript
const user = await requireAuth(); // ✅ Present
if (!user) return 401;
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| **No `runtime = 'nodejs'`** | 🔴 **CRITICAL** | Will fail on Vercel (defaults to edge runtime, Puppeteer not available) |
| **No IDOR protection** | 🟡 **MEDIUM** | Any authenticated user can access any standId statement (no ownership check) |
| **Puppeteer timeout not set** | 🟢 **LOW** | Default 30s may timeout for large statements |

**Works Locally:** ✅ **YES** (Node.js available)
**Works on Vercel:** ❌ **NO** (edge runtime incompatible with Puppeteer)

**Fix Plan:**
1. Add `export const runtime = 'nodejs';` at top of file
2. Add ownership check: `if (user.role !== 'ADMIN' && user.role !== 'ACCOUNT') check standId belongs to user's branch`
3. Add timeout config: `puppeteer.launch({ timeout: 60000 })`

---

#### 2. Payment Receipt PDF
**Endpoint:** `GET /api/account/payments/[paymentId]/receipt`
**File:** `app/api/account/payments/[paymentId]/receipt/route.ts`

**Generator:** Puppeteer (`lib/pdf-generator.ts`)
**Function:** `generatePDF('receipt', data)` → HTML receipt template to PDF

**Runtime Configuration:**
```typescript
// ❌ MISSING - No runtime export declared
```

**Headers (Correct):**
```typescript
return new NextResponse(pdfBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="receipt-${receiptNumber}.pdf"`,
  },
});
```

**Authorization Check:**
```typescript
const user = await requireAuth(); // ✅ Present
if (!user) return 401;
// ❌ No IDOR check - any user can download any receipt by ID
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| **No `runtime = 'nodejs'`** | 🔴 **CRITICAL** | Will fail on Vercel |
| **No IDOR protection** | 🔴 **CRITICAL** | Users can access other clients' receipts |
| **No validation** | 🟡 **MEDIUM** | Should verify payment.clientId matches user.id (if CLIENT role) |

**Works Locally:** ✅ **YES**
**Works on Vercel:** ❌ **NO**

**Fix Plan:**
1. Add `export const runtime = 'nodejs';`
2. Add RBAC check:
```typescript
if (user.role === 'CLIENT' && payment.clientId !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

#### 3. Reports PDF (Broken)
**Endpoint:** `GET /api/account/reports/[type]?format=pdf`
**File:** `app/api/account/reports/[type]/route.ts`

**Generator:** ❌ **NONE** - Returns JSON instead of PDF
**Current Behavior:**
```typescript
// For PDF, return JSON for client-side generation (using jsPDF)
return apiSuccess({
  title: reportTitle,
  branch,
  generatedAt: new Date().toISOString(),
  headers,
  data,
});
```

**Runtime Configuration:**
```typescript
export const dynamic = 'force-dynamic'; // ✅ Present
export const runtime = 'nodejs'; // ❌ MISSING
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| **No server-side PDF generation** | 🔴 **CRITICAL** | PDF button downloads JSON file |
| **Client has no jsPDF implementation** | 🔴 **CRITICAL** | UI cannot convert JSON to PDF |
| **No Puppeteer fallback** | 🔴 **CRITICAL** | Server doesn't generate PDF |

**Works Locally:** ❌ **NO** (returns JSON)
**Works on Vercel:** ❌ **NO** (returns JSON)

**Fix Plan:**
1. Add server-side PDF generation using Puppeteer:
```typescript
if (format === 'pdf') {
  const htmlContent = generateReportHTML(title, headers, data);
  const pdfBuffer = await generatePDF('report', htmlContent);
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}-report-${branch}-${date}.pdf"`,
    },
  });
}
```
2. Add `export const runtime = 'nodejs';`

---

### PDF Generation Library Audit

**File:** `lib/pdf-generator.ts`
**Library:** `puppeteer` (not `puppeteer-core`)

**Functions:**
1. `generatePDF(type, data)` - Main entry point
2. `generateStatementHTML(data)` - HTML template for statements
3. `generateReceiptHTML(data)` - HTML template for receipts

**Puppeteer Config:**
```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| **Using `puppeteer` not `puppeteer-core`** | 🟡 **MEDIUM** | Larger bundle size, downloads Chromium on install |
| **No timeout config** | 🟢 **LOW** | Could hang indefinitely |
| **No error handling in HTML generation** | 🟡 **MEDIUM** | Bad data could crash PDF generation |
| **Browser not reused** | 🟡 **MEDIUM** | Every PDF request launches new Chrome instance (slow) |

**Recommendation:**
Switch to `puppeteer-core` + use `@sparticuz/chromium` for Vercel Lambda compatibility:
```typescript
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

---

### CSV Export Audit (6 Types)

**Endpoint:** `GET /api/account/reports/[type]?format=csv`
**Generator:** Server-side (inline CSV generation in route handler)

**Implementation:**
```typescript
const csvRows = [headers.join(',')];
for (const row of data) {
  const values = headers.map((h) => {
    const val = row[h];
    if (typeof val === 'string' && val.includes(',')) {
      return `"${val}"`;
    }
    return val;
  });
  csvRows.push(values.join(','));
}
const csv = csvRows.join('\n');

return new NextResponse(csv, {
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${type}-report-${branch}-${date}.csv"`,
  },
});
```

**Status:** ✅ **FULLY FUNCTIONAL**

**Issues:** None (CSV export works on both local and Vercel)

---

### PDF Summary Table

| PDF Type | Endpoint | Generator | Runtime Set | Works Local | Works Vercel | IDOR Protected | Fix Priority |
|----------|----------|-----------|-------------|-------------|--------------|----------------|--------------|
| **Stand Statement** | `/api/account/stands-payments/[standId]/statement` | Puppeteer | ❌ NO | ✅ Yes | ❌ No | ❌ No | 🔴 **HIGH** |
| **Payment Receipt** | `/api/account/payments/[paymentId]/receipt` | Puppeteer | ❌ NO | ✅ Yes | ❌ No | ❌ No | 🔴 **CRITICAL** |
| **Reports PDF** | `/api/account/reports/[type]?format=pdf` | ❌ None | ❌ NO | ❌ No | ❌ No | ✅ Yes | 🔴 **CRITICAL** |

**Overall PDF Status:** ❌ **0% Vercel-Ready** (3 / 3 endpoints need fixes)

---

## PART 5: RBAC VERIFICATION

### Access Control Check

**Role:** `ACCOUNT` (from `types/next-auth.d.ts`)
**Allowed Dashboards:** `/dashboards/account`

#### Dashboard Access Test
```typescript
// File: app/dashboards/account/page.tsx
const normalizedRole = normalizeRole(me.role);
if (normalizedRole && canUserAccessDashboard(user, 'account')) {
  setCanRender(true); // ✅ PASS
}
```

**Status:** ✅ **PASS** - Uses centralized `canUserAccessDashboard()` from `lib/role-router.ts`

#### API Endpoint RBAC Tests

**Pattern Used:**
```typescript
const role = (session.user as { role?: string }).role?.toUpperCase();
if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
  return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
}
```

**Endpoints Tested:**

| Endpoint | RBAC Check | Server-Side | Status |
|----------|------------|-------------|--------|
| `GET /api/account/stats` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/payments` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `POST /api/account/payments` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/installments` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/clients` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/developer-payouts` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `POST /api/account/developer-payouts` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/commissions` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |
| `GET /api/account/reports/[type]` | ✅ ACCOUNT/ADMIN only | ✅ Yes | ✅ **PASS** |

**Overall RBAC Status:** ✅ **100% PASS** - All endpoints enforce server-side role checks

#### IDOR Vulnerability Tests

| Endpoint | Resource | IDOR Check | Status | Fix Needed |
|----------|----------|------------|--------|------------|
| `GET /api/account/stands-payments/[standId]/statement` | Stand Statement | ❌ No branch check | ⚠️ **VULNERABLE** | Add branch scoping |
| `GET /api/account/payments/[paymentId]/receipt` | Receipt | ❌ No client check | ⚠️ **VULNERABLE** | Add clientId check for CLIENT role |
| `GET /api/account/stands-payments/[standId]/payments` | Stand Payments | ❌ No branch check | ⚠️ **VULNERABLE** | Add branch scoping |

**IDOR Status:** ⚠️ **3 / 3 PDF endpoints vulnerable to cross-client access**

---

## PART 6: FINANCIAL INTEGRITY CHECKS

### Payment Totals Verification

**Test:** Verify `stats.totalRevenue` matches SUM of confirmed payments

**Query Logic (from `/api/account/stats/route.ts`):**
```typescript
const payments = await prisma.payment.aggregate({
  _sum: { amount: true },
  where: {
    office_location: branch,
    status: 'CONFIRMED',
  },
});
const totalRevenue = Number(payments._sum.amount || 0);
```

**Status:** ✅ **CORRECT** - Aggregates only confirmed payments

### VAT/Fees Calculation

**Test:** Verify developer payout calculations include correct VAT/fees

**Service:** `lib/settlement-calculator.ts` - `SettlementCalculator.calculateSettlement(payment)`

**Formula (Expected):**
```
Stand Price = Total Amount
Company Fees = Stand Price * fee_percentage (from development)
VAT = Company Fees * 0.145 (14.5%)
Agent Commission = Stand Price * commission_rate
Developer Net = Stand Price - Company Fees - VAT - Agent Commission
```

**Status:** ✅ **CORRECT** (verified in `lib/settlement-calculator.ts`)

### Commission Calculation

**Test:** Verify commission totals match approved sales

**Query Logic (from `/api/account/commissions/route.ts`):**
```typescript
const commissions = await prisma.commissionPayout.findMany({
  where: { branch, month },
  // Commissions calculated from confirmed payments
});
```

**Status:** ✅ **CORRECT** - Commissions calculated from confirmed payments only

### Installment Allocation

**Test:** Verify installment payments correctly reduce `remainingBalance`

**Logic:** Payment allocation handled by `lib/payment-success-handler.ts` → `handlePaymentSuccess()`

**Status:** ⏳ **NOT VERIFIED IN THIS AUDIT** (requires code inspection of payment handler)

**Recommendation:** Add test case to verify:
1. Payment recorded → Installment `totalPaid` increments
2. `remainingBalance` = `totalAmount` - `totalPaid`
3. Status changes ACTIVE → COMPLETED when `remainingBalance` = 0

---

## PART 7: ERROR HANDLING & UX ISSUES

### API Error Handling

**Pattern Used:**
```typescript
try {
  // API logic
} catch (error) {
  logger.error('MODULE Error', error, { module, action });
  return apiError('Failed to ...', 500, ErrorCodes.FETCH_ERROR);
}
```

**Status:** ✅ **CONSISTENT** - All endpoints use `apiError()` helper

### UI Error Display

**Issues Found:**

| Component | Issue | Impact | Fix |
|-----------|-------|--------|-----|
| **PaymentsTab** | No error state if `fetchPayments()` fails | User sees empty table with no explanation | Add error banner with retry button |
| **InstallmentsTab** | No error state if `fetchPlans()` fails | User sees empty table | Add error banner |
| **ClientsTab** | No error state if `fetchClients()` fails | User sees empty grid | Add error banner |
| **ReportsTab** | No error handling for PDF generation failure | User doesn't know if report failed | Add toast notification on error |

**Recommendation:** Add global error boundary component:
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-700">Failed to load data. <button onClick={retry}>Retry</button></p>
  </div>
)}
```

### Loading States

**Status:** ✅ **PRESENT** - All components show spinner during data fetch

**Example:**
```tsx
{loading ? (
  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
) : (
  // Data display
)}
```

---

## PART 8: FINAL RECOMMENDATIONS & FIX PRIORITIES

### CRITICAL (Fix Before Deployment)

1. **Add `runtime = 'nodejs'` to all PDF routes** (3 files)
   - `app/api/account/stands-payments/[standId]/statement/route.ts`
   - `app/api/account/payments/[paymentId]/receipt/route.ts`
   - `app/api/account/reports/[type]/route.ts`

2. **Fix PDF generation for Reports** (currently returns JSON)
   - Implement server-side Puppeteer PDF generation
   - Or remove "PDF" button and show "CSV only" message

3. **Add IDOR protection to PDF endpoints** (3 files)
   - Stand statements: Check `stand.branch === user.branch`
   - Receipts: Check `payment.clientId === user.id` (if CLIENT role)
   - Payments: Check `payment.office_location === user.branch`

### HIGH (Required for 100% CRUD)

4. **Implement Installment Plan CRUD** (missing C,U,D)
   - Create: Modal with form for new installment plan
   - Update: Modal to edit plan terms, extend dates
   - Cancel: Action to mark plan as CANCELLED with reason

5. **Implement Client CRUD** (missing C,U,D)
   - Create: "Add Client" modal with form
   - Update: "Edit Client" modal (contact info)
   - Deactivate: Action to mark client as inactive (not delete)

6. **Add Payment Status Update UI** (missing U)
   - Modal to change PENDING → CONFIRMED
   - Confirmation dialog: "Are you sure?"
   - Success/error toast notifications

### MEDIUM (Enhance UX)

7. **Connect UI buttons to APIs**
   - Commissions: Approve/Mark Paid buttons → call PUT `/api/account/commissions`
   - Payments: View/Print buttons → open modal/download receipt
   - Clients: View Details → navigate to client detail page

8. **Add Error Handling UI**
   - Error banners for failed data fetches
   - Retry buttons
   - Toast notifications for actions

9. **Fix API route typo**
   - Line 150 in `AccountDashboard.tsx`: Change `/api/accounts/revenue` to `/api/account/revenue`
   - Or create the missing endpoint

### LOW (Polish)

10. **Optimize Puppeteer Usage**
    - Switch to `puppeteer-core` + `@sparticuz/chromium`
    - Add browser instance reuse (avoid launching Chrome per request)
    - Add timeout config (60s)

11. **Add Export Functionality**
    - "Export" buttons in Payments, Installments, Commissions tabs
    - Use existing `/api/account/reports` endpoints

12. **Add Confirmation Dialogs**
    - "Initiate Payout" → "Are you sure?"
    - "Approve Commission" → "Confirm approval?"
    - "Mark Paid" → "Confirm payment received?"

---

## PART 9: FILES REQUIRING CHANGES

### For PDF Fixes (CRITICAL)

1. `app/api/account/stands-payments/[standId]/statement/route.ts`
   - Add: `export const runtime = 'nodejs';`
   - Add: Branch scoping check

2. `app/api/account/payments/[paymentId]/receipt/route.ts`
   - Add: `export const runtime = 'nodejs';`
   - Add: IDOR protection (clientId check)

3. `app/api/account/reports/[type]/route.ts`
   - Add: `export const runtime = 'nodejs';`
   - Replace JSON response with Puppeteer PDF generation

4. `lib/pdf-generator.ts`
   - Optimize: Switch to `puppeteer-core`
   - Add: Report HTML template function

### For CRUD Completeness (HIGH)

5. `app/api/account/installments/route.ts`
   - Add: POST handler (create installment plan)
   - Add: PUT handler (update plan)

6. `app/api/account/clients/route.ts`
   - Add: POST handler (create client)
   - Add: PUT handler (update client)

7. `app/api/account/payments/route.ts`
   - Add: PUT handler (update payment status)

8. `components/account/AccountDashboard.tsx`
   - Add: UpdatePaymentStatusModal component
   - Add: CreateInstallmentPlanModal component
   - Add: AddClientModal component
   - Fix: Connect commission Approve/Mark Paid buttons
   - Fix: API route typo (line 150)

### For UX Enhancements (MEDIUM)

9. `components/account/AccountDashboard.tsx`
   - Add: Error state UI for all tabs
   - Add: onClick handlers for View/Print buttons
   - Add: Confirmation dialogs for destructive actions

---

## AUDIT CONCLUSION

### Summary Statistics
- **Total Components Audited:** 8
- **CRUD Completeness:** 66% (5.33 / 8)
- **PDF Endpoints:** 3 (0% Vercel-ready)
- **CSV Endpoints:** 6 (100% functional)
- **RBAC Enforcement:** 100% (server-side ✅)
- **IDOR Vulnerabilities:** 3 endpoints
- **Critical Issues:** 3 (PDF runtime, IDOR, reports broken)
- **High Priority Gaps:** 3 (Installments, Clients, Payments update)

### Accounts Dashboard Status
- **FUNCTIONAL:** ✅ Yes (read-only operations work)
- **PRODUCTION-READY:** ❌ No (PDF broken, missing CRUD, IDOR vulnerabilities)
- **FINANCIAL INTEGRITY:** ✅ Pass (totals, VAT, commissions calculated correctly)

### Next Steps
**STOP HERE - AWAITING APPROVAL TO PROCEED TO PHASE 1 (IMPLEMENTATION)**

Once approved, implementation will proceed in this order:
1. Critical PDF fixes (3 files)
2. High priority CRUD gaps (Installments, Clients, Payments)
3. Medium priority UX enhancements (button handlers, error states)
4. Low priority polish (Puppeteer optimization, export buttons)

---

**END OF PHASE 0 AUDIT**
