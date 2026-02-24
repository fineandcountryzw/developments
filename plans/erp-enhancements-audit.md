# ERP Enhancements Audit & Implementation Plan

## Executive Summary

This document provides a comprehensive audit of the current codebase state and a detailed implementation plan for the three requested ERP enhancements:
1. Accounts can record payments (same as Admin)
2. Accounts can issue payouts to developers
3. Remove "Inventory" from dashboard nav, keep "Stands"

---

## Audit Findings

### 1. Admin Payment Recording Flow

#### Components
- **Primary Component**: [`components/PaymentModule.tsx`](components/PaymentModule.tsx:1)
  - Handles payment recording UI with client selection, stand selection, amount, method
  - Supports payment types: Deposit, Installment, Agreement of Sale Fee, Endowment Fees, VAT Fees
  - Validates stand requirement, amount, receipt number, cash receiver name
  - Auto-generates receipts after payment recording

#### API Endpoints
- **Main Endpoint**: [`app/api/admin/payments/route.ts`](app/api/admin/payments/route.ts:1)
  - `GET`: Lists payments with filtering (branch, status, clientId, developmentId)
  - `POST`: Creates new payment with full validation
    - Uses [`requireAdmin()`](lib/access-control.ts:304) for authentication
    - Validates via [`paymentSchema`](lib/validation/schemas.ts:178)
    - Calculates fee breakdown via [`SettlementCalculator`](app/api/admin/payments/route.ts:148)
    - Updates stand status (SOLD for deposits, RESERVED for non-deposits)
    - Syncs with InstallmentPlan if deposit matches
    - Logs activity to audit trail
    - Triggers [`handlePaymentSuccess()`](app/api/admin/payments/route.ts:340) for confirmed payments

#### Validation Schema
- [`paymentSchema`](lib/validation/schemas.ts:178) in [`lib/validation/schemas.ts`](lib/validation/schemas.ts:1):
  - clientId, clientName (required)
  - amount (positive number)
  - standId or standNumber (required)
  - payment_type: Deposit | Installment | Agreement of Sale Fee | Endowment Fees | VAT Fees
  - payment_method: Cash | Bank
  - office_location: Harare | Bulawayo
  - reference, manual_receipt_no (required)
  - Optional: status, verification_status, received_by_name, confirmedAt

#### Access Control
- [`requireAdmin()`](lib/access-control.ts:304) in [`lib/access-control.ts`](lib/access-control.ts:1)
- Currently restricts POST to ADMIN only
- GET allows AGENT+ via [`requireAgent()`](lib/access-control.ts:354)

---

### 2. Accounts Dashboard Current State

#### Main Dashboard
- **File**: [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:1)
- **Tabs Available**:
  - `overview`: KPI cards, revenue charts, quick actions
  - `stands`: Uses [`StandsPaymentsTab`](components/account/StandsPaymentsTab.tsx:1)
  - `payments`: Placeholder only ("Payment management interface")
  - `installments`: Placeholder only
  - `clients`: Placeholder only
  - `inventory`: Placeholder only
  - `commissions`: Placeholder only
  - `reports`: Placeholder only

#### Stands & Payments Tab
- **File**: [`components/account/StandsPaymentsTab.tsx`](components/account/StandsPaymentsTab.tsx:1)
- **Features**:
  - View stands with payment status
  - Search/filter by status
  - View payment history per stand
  - Download statements
  - Download receipts
- **APIs Used**:
  - `GET /api/account/stands-payments` - List stands with payment data
  - `GET /api/account/stands-payments/:id/payments` - Payment history
  - `GET /api/account/stands-payments/:id/statement` - Download statement
  - `GET /api/account/payments/:id/receipt` - Download receipt

#### Existing Account APIs
- [`app/api/account/payments/route.ts`](app/api/account/payments/route.ts:1) - GET only, lists payments
- [`app/api/account/stands-payments/route.ts`](app/api/account/stands-payments/route.ts:1) - GET only
- [`app/api/account/stands/payments/route.ts`](app/api/account/stands/payments/route.ts:1) - GET only
- [`app/api/account/stats/route.ts`](app/api/account/stats/route.ts:1) - Dashboard stats
- [`app/api/account/commissions/route.ts`](app/api/account/commissions/route.ts:1) - Commission data

#### Current RBAC
- Account APIs check for `['ACCOUNT', 'ADMIN']` roles
- No POST endpoint for recording payments exists for Accounts

---

### 3. Existing Payout Functionality

#### Developer Payouts (Admin Only)
- **File**: [`app/api/developer/payments/route.ts`](app/api/developer/payments/route.ts:1)
- **Features**:
  - `POST`: Records payments made TO developers
  - `GET`: Fetches payment history for logged-in developer
  - Stores data in `developer_payments` table
  - Fields: developmentId, amount, paymentDate, paymentMethod, referenceNumber, periodStart/End, saleIds, notes

#### Manager Payout Reports
- **File**: [`app/api/manager/payouts/route.ts`](app/api/manager/payouts/route.ts:1)
- Commission analytics for Manager Dashboard

#### Commission Payouts
- **File**: [`app/api/account/commissions/route.ts`](app/api/account/commissions/route.ts:1)
- Uses `CommissionPayout` Prisma model
- GET only for commission data

#### Key Finding
- **No existing UI for Accounts to issue payouts to developers**
- Developer payments API exists but is scoped to developers viewing their own payments
- Admin can generate developer reports via [`app/api/admin/developer-reports/generate/route.ts`](app/api/admin/developer-reports/generate/route.ts:1)

---

### 4. Navigation Structure (Inventory vs Stands)

#### Sidebar Component
- **File**: [`components/Sidebar.tsx`](components/Sidebar.tsx:1)
- **Current Admin/Account Menu** (lines 86-132):
```typescript
menuItems = [
  { id: 'developments', label: 'Developments', icon: Layers },
  { id: 'inventory', label: 'Inventory', icon: MapIcon },  // TO BE REMOVED
  { id: 'portfolio', label: 'Clients', icon: Users },
];

menuSections = [
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'installments', label: 'Installments', icon: CalendarDays },
      { id: 'receipts', label: 'Receipts', icon: Receipt },
      { id: 'recon', label: 'Reconciliation', icon: PieChart },
    ],
  },
  // ... admin and system sections
];
```

#### Account Dashboard Tabs
- **File**: [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:162)
- Lines 162-171 show both `stands` and `inventory` tabs exist

---

## Implementation Plan

### TASK 1: Accounts Can Record Payments (Same as Admin)

#### Files to Change

1. **Add POST endpoint for Account payments**
   - **File**: [`app/api/account/payments/route.ts`](app/api/account/payments/route.ts:1)
   - **Action**: Add POST handler that mirrors [`app/api/admin/payments/route.ts`](app/api/admin/payments/route.ts:104) logic
   - **RBAC**: Use `requireAccountant()` or extend to allow ACCOUNT role

2. **Update Access Control (if needed)**
   - **File**: [`lib/access-control.ts`](lib/access-control.ts:1)
   - **Action**: Verify [`requireAccountant()`](lib/access-control.ts:370) allows ACCOUNT role (it does: checks `isAccountant(user) || isManager(user)`)
   - **Note**: May need new helper `requireAdminOrAccountant()` for payment creation

3. **Create Payment Recording Component for Accounts**
   - **Option A**: Reuse [`PaymentModule.tsx`](components/PaymentModule.tsx:1) (embeddedMode already exists)
   - **Option B**: Create new [`components/account/RecordPaymentModal.tsx`](components/account/RecordPaymentModal.tsx:1)
   - **Recommendation**: Create wrapper that uses PaymentModule with `embeddedMode=true`

4. **Update Account Dashboard Payments Tab**
   - **File**: [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:409)
   - **Action**: Replace placeholder (lines 409-414) with actual payment recording interface
   - **Add**: "Record Payment" button that opens modal with PaymentModule

5. **Update StandsPaymentsTab to allow recording payments**
   - **File**: [`components/account/StandsPaymentsTab.tsx`](components/account/StandsPaymentsTab.tsx:1)
   - **Action**: Add "Record Payment" button per stand row

#### RBAC Changes Required

```typescript
// In lib/access-control.ts - add new helper:
export async function requireAdminOrAccountant(): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  const user = authResult.user;
  if (!isAdmin(user) && !isAccountant(user) && !isManager(user)) {
    return {
      error: apiError('Admin or Accountant access required', 403, 'ADMIN_OR_ACCOUNTANT_REQUIRED'),
    };
  }

  return authResult;
}
```

#### Minimal Code Changes

```typescript
// app/api/account/payments/route.ts - Add POST:
export async function POST(request: NextRequest) {
  // Use requireAdminOrAccountant instead of requireAdmin
  const authResult = await requireAdminOrAccountant(request, { limit: 20, windowMs: 60000 });
  if (authResult.error) return authResult.error;
  
  // Rest of logic identical to /api/admin/payments POST
  // ... validation, fee calculation, prisma create, etc.
}
```

---

### TASK 2: Accounts Can Issue Payouts to Developers

#### Files to Change

1. **Create Account Developer Payouts API**
   - **New File**: [`app/api/account/developer-payouts/route.ts`](app/api/account/developer-payouts/route.ts:1)
   - **Methods**:
     - `GET`: List all developer payouts with filtering
     - `POST`: Create new payout to developer
   - **Reuse Logic**: From [`app/api/developer/payments/route.ts`](app/api/developer/payments/route.ts:1) but for all developers

2. **Create Developer Payouts Component**
   - **New File**: [`components/account/DeveloperPayoutsTab.tsx`](components/account/DeveloperPayoutsTab.tsx:1)
   - **Features**:
     - List all developers with pending payouts
     - Show payout history
     - Form to record new payout (amount, method, reference, period)
     - Calculate pending amounts per development

3. **Add Developer Payouts Tab to Account Dashboard**
   - **File**: [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:162)
   - **Action**: Add new tab `developer-payouts` to tabs array

4. **Update Sidebar (Optional)**
   - **File**: [`components/Sidebar.tsx`](components/Sidebar.tsx:99)
   - **Action**: Add "Developer Payouts" to Finance section

#### Database Schema

Existing `developer_payments` table (from [`app/api/developer/payments/route.ts`](app/api/developer/payments/route.ts:84)):
- id, development_id, developer_email, amount, payment_date
- payment_method, reference_number, period_start, period_end
- month_year, sale_ids, notes, created_at

#### RBAC

- Use same `requireAdminOrAccountant()` helper
- Ensure only ACCOUNT/ADMIN can create payouts
- Developers can only view their own payouts (existing restriction)

---

### TASK 3: Remove "Inventory" from Dashboard Nav, Keep "Stands"

#### Files to Change

1. **Remove Inventory from Sidebar**
   - **File**: [`components/Sidebar.tsx`](components/Sidebar.tsx:91)
   - **Line 91**: Remove `{ id: 'inventory', label: 'Inventory', icon: MapIcon },`

2. **Remove Inventory Tab from Account Dashboard**
   - **File**: [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:168)
   - **Line 168**: Remove `{ id: 'inventory', label: 'Inventory', icon: Package },`
   - **Lines 430-435**: Remove inventory tab content placeholder

3. **Keep Stands Tab**
   - Already exists at line 164: `{ id: 'stands', label: 'Stands', icon: Home }`
   - Already implemented via [`StandsPaymentsTab`](components/account/StandsPaymentsTab.tsx:1)

#### No RBAC Changes Required
- This is purely UI/UX simplification

---

## Risks Assessment

### Financial Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Duplicate payment recording | High | Use same validation logic as Admin; check for existing receipts |
| Incorrect fee calculations | High | Reuse [`SettlementCalculator`](app/api/admin/payments/route.ts:12) exactly |
| Unauthorized payouts | High | Strict RBAC; requireAdminOrAccountant() for all mutations |
| Data inconsistency | Medium | Use same Prisma transactions as Admin flow |
| Missing audit trail | Medium | Ensure all actions logged to ActivityLog |

### Permission Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accounts bypassing restrictions | High | Server-side enforcement only; never trust client |
| Cross-branch data access | Medium | Enforce branch filtering in all queries |
| Developer seeing other payouts | Medium | Keep existing email-scoped queries for developer view |

### Implementation Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing Admin flow | High | Copy logic, don't modify Admin endpoints |
| Missing validation | Medium | Use same Zod schemas |
| UI inconsistencies | Low | Use shared components from `components/dashboards/shared` |

---

## Implementation Checklist

### Phase 1: Payment Recording for Accounts
- [ ] Add `requireAdminOrAccountant()` to [`lib/access-control.ts`](lib/access-control.ts:1)
- [ ] Add POST handler to [`app/api/account/payments/route.ts`](app/api/account/payments/route.ts:1)
- [ ] Create [`components/account/RecordPaymentModal.tsx`](components/account/RecordPaymentModal.tsx:1)
- [ ] Update Payments tab in [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:409)
- [ ] Add "Record Payment" buttons to [`StandsPaymentsTab.tsx`](components/account/StandsPaymentsTab.tsx:1)

### Phase 2: Developer Payouts
- [ ] Create [`app/api/account/developer-payouts/route.ts`](app/api/account/developer-payouts/route.ts:1)
- [ ] Create [`components/account/DeveloperPayoutsTab.tsx`](components/account/DeveloperPayoutsTab.tsx:1)
- [ ] Add tab to [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:162)
- [ ] Optionally add to Sidebar Finance section

### Phase 3: Navigation Cleanup
- [ ] Remove Inventory from [`components/Sidebar.tsx`](components/Sidebar.tsx:91)
- [ ] Remove Inventory tab from [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:168)

---

## Files Summary

### New Files
1. [`components/account/RecordPaymentModal.tsx`](components/account/RecordPaymentModal.tsx:1) - Payment recording UI
2. [`components/account/DeveloperPayoutsTab.tsx`](components/account/DeveloperPayoutsTab.tsx:1) - Developer payouts UI
3. [`app/api/account/developer-payouts/route.ts`](app/api/account/developer-payouts/route.ts:1) - Developer payouts API

### Modified Files
1. [`lib/access-control.ts`](lib/access-control.ts:1) - Add `requireAdminOrAccountant()`
2. [`app/api/account/payments/route.ts`](app/api/account/payments/route.ts:1) - Add POST handler
3. [`components/account/AccountDashboard.tsx`](components/account/AccountDashboard.tsx:1) - Add payment recording, developer payouts tabs; remove inventory
4. [`components/account/StandsPaymentsTab.tsx`](components/account/StandsPaymentsTab.tsx:1) - Add record payment buttons
5. [`components/Sidebar.tsx`](components/Sidebar.tsx:1) - Remove Inventory menu item

---

## Safety Notes

1. **Server-side enforcement only**: All RBAC checks must happen in API routes, never in client components
2. **Reuse existing logic**: Copy from Admin endpoints rather than creating new logic paths
3. **Maintain audit trail**: All financial actions must log to ActivityLog
4. **Fee calculations**: Use [`SettlementCalculator`](lib/settlement-calculator.ts:1) to ensure consistency
5. **Stand status updates**: Follow same business rules as Admin (SOLD for deposits, etc.)
6. **Receipt generation**: Auto-generate receipts same as Admin flow
7. **Rate limiting**: Apply same rate limits as Admin (20 req/min for payments)
