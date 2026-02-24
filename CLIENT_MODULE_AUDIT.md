# Client Module Audit - Payments, Installments, Receipts & Statements

**Date:** January 2026  
**Status:** 🔍 Audit in Progress

---

## Current Architecture

### Data Flow

1. **Payments** → `/api/client/payments`
   - Returns all payments for logged-in client
   - Includes receipt links via `receipt.pdfUrl` or `/api/client/documents/${receipt.id}/download?type=receipt`
   - Links to installments via `payment.installmentId`

2. **Installments** → `/api/client/installments`
   - Returns `InstallmentPlan[]` with nested `installments[]`
   - Each installment can have a `receipt`
   - Tracks `remainingBalance`, `totalPaid`, `paidInstallments`

3. **Receipts** → `/api/client/receipts`
   - Returns all receipts for logged-in client
   - Links to `payment` and `installment` via foreign keys

4. **Statements** → `generateClientStatementPDF()`
   - Uses `payments[]` and `stands[]`
   - Generates PDF with transaction history

---

## Components Analysis

### 1. `components/dashboards/ClientDashboard.tsx`
- **Payments Tab**: Fetches from `/api/client/payments`
- **Issue**: May not show all payment types (deposit, installment, etc.)
- **Issue**: Receipt links may be missing

### 2. `components/EnhancedClientPortfolioView.tsx`
- **Issue**: `installmentsRemaining` hardcoded to `maxInstallments` (line 126)
- **Issue**: Doesn't fetch actual installment plans from API
- **Issue**: Payment calculations may not account for installment plans

### 3. `components/ClientStatement.tsx`
- **Issue**: Uses `getClientPayments()` and `getStandsByClient()` from `lib/db.ts` (mock functions)
- **Issue**: May not include installment plan data
- **Issue**: Receipt links may not be properly displayed

### 4. `services/pdfService.ts` - `generateClientStatementPDF()`
- **Issue**: Only uses `payments[]` and `stands[]`
- **Issue**: Doesn't include installment plan breakdown
- **Issue**: May not show receipt numbers properly

---

## Identified Issues

### Issue #1: Installments Remaining Calculation
**Location**: `components/EnhancedClientPortfolioView.tsx` (Line 126)
```typescript
const installmentsRemaining = developmentTerms.maxInstallments; // ❌ Hardcoded
```
**Problem**: Should calculate from actual `InstallmentPlan` data
**Impact**: Shows incorrect remaining installments

### Issue #2: Missing Installment Plan Data in Portfolio
**Location**: `components/EnhancedClientPortfolioView.tsx` (Line 89-156)
**Problem**: Fetches properties and payments separately, but doesn't fetch installment plans
**Impact**: Installment calculations are estimates, not actual plan data

### Issue #3: Statement Generation Missing Installments
**Location**: `services/pdfService.ts` - `generateClientStatementPDF()`
**Problem**: Only includes payments, not installment plan breakdown
**Impact**: Statements don't show installment schedule or remaining installments

### Issue #4: Receipt Links in Payments
**Location**: `app/api/client/payments/route.ts` (Line 64)
**Problem**: Receipt URL construction may fail if receipt doesn't exist
**Impact**: Missing receipt download links

### Issue #5: Client Dashboard Payments Display
**Location**: `components/dashboards/ClientDashboard.tsx` (Line 195-218)
**Problem**: Payment data transformation may lose receipt information
**Impact**: Receipt links not displayed in UI

---

## Data Relationships

```
Client
  ├── Payments (Payment[])
  │   ├── receipt (Receipt?) - One-to-one
  │   └── installment (Installment?) - One-to-one
  │
  ├── InstallmentPlans (InstallmentPlan[])
  │   └── installments (Installment[])
  │       └── receipt (Receipt?) - One-to-one
  │
  └── Stands (via Reservations)
      └── Payments linked via standId
```

**Key**: 
- Payment can link to Receipt (via `paymentId`)
- Payment can link to Installment (via `installmentId`)
- Installment can link to Receipt (via `installmentId`)
- InstallmentPlan tracks `remainingBalance` and `paidInstallments`

---

## Required Fixes

### Fix #1: Fetch Installment Plans in Portfolio View
- Add API call to `/api/client/installments` in `EnhancedClientPortfolioView`
- Use actual `remainingBalance` and `paidInstallments` from plans
- Calculate `installmentsRemaining` from plan data

### Fix #2: Include Installments in Statement
- Modify `generateClientStatementPDF()` to accept installment plans
- Add installment schedule section to PDF
- Show remaining installments count

### Fix #3: Ensure Receipt Links Work
- Verify receipt URL generation in `/api/client/payments`
- Add fallback for missing receipts
- Ensure receipt download endpoint exists

### Fix #4: Fix Installments Remaining Calculation
- Replace hardcoded value with actual calculation from `InstallmentPlan`
- Formula: `periodMonths - paidInstallments`

---

## Testing Checklist

- [ ] All payments display correctly
- [ ] Receipt links work for all payments
- [ ] Installment plans show correct remaining installments
- [ ] Statement PDF includes all payments
- [ ] Statement PDF includes installment schedule
- [ ] Statement PDF includes receipt numbers
- [ ] Monthly statement generation works (if exists)
- [ ] On-demand statement generation works

---

**Next Steps**: Review each component and apply surgical fixes
