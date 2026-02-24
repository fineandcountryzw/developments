# Installments Module - Data Flow & Calculation Analysis

**Date:** January 2026  
**Status:** ✅ Complete  
**Focus:** Deposit capture, balance calculation, and double-counting validation

---

## Executive Summary

The Installments Module uses **explicitly stored values** with **incremental updates** rather than runtime calculations. There is a **potential gap** where deposits paid via PaymentModule are not automatically linked to installment plans, which could lead to inconsistencies.

**Key Finding:** Installment plans are created with manual `totalAmount` input and calculate deposit/balance at creation time. Payments update stored balances incrementally.

---

## 1. Deposit Amount Capture

### 1.1 Where Deposit is Captured

#### Option A: PaymentModule (`/api/admin/payments` POST)
- **Location:** `app/api/admin/payments/route.ts`
- **Field:** `payment_type: 'Deposit'`
- **Storage:** `Payment` table with `payment_type = 'Deposit'`
- **Stand Link:** Via `standId` field
- **Issue:** ⚠️ **NOT automatically linked to InstallmentPlan**

#### Option B: InstallmentsModule (`/api/admin/installments/[id]` PATCH)
- **Location:** `app/api/admin/installments/[id]/route.ts` (line 80-137)
- **Action:** `PAY_DEPOSIT`
- **Storage:** Updates `InstallmentPlan.depositPaid = true`
- **Amount:** Uses `plan.depositAmount` (stored value)
- **Integration:** ✅ Creates Receipt, updates Stand status to SOLD

### 1.2 Deposit Calculation Logic

**In Installment Plan Creation:**
```typescript
// app/api/admin/installments/route.ts (line 120-123)
const depositPercentage = Number(development.depositPercentage) || 30;
const calculatedDeposit = depositAmount || (totalAmount * depositPercentage / 100);
const balanceAmount = totalAmount - calculatedDeposit;
const monthlyAmount = balanceAmount / periodMonths;
```

**Key Points:**
- Deposit can be **explicitly provided** (`depositAmount` in request body)
- OR **calculated** from `totalAmount * depositPercentage / 100`
- Uses development's `depositPercentage` (default 30%)
- **Stored in database** as `InstallmentPlan.depositAmount`

---

## 2. Remaining Balance Calculation

### 2.1 Initial Calculation (Plan Creation)

**Formula:**
```
balanceAmount = totalAmount - calculatedDeposit
monthlyAmount = balanceAmount / periodMonths
remainingBalance = totalAmount (initially, before any payments)
```

**Code Location:** `app/api/admin/installments/route.ts` (line 123-124, 141-145)

**Stored Values:**
- `totalAmount` - Total stand price (manually entered)
- `depositAmount` - Calculated or provided deposit
- `balanceAmount` - `totalAmount - depositAmount`
- `monthlyAmount` - `balanceAmount / periodMonths`
- `remainingBalance` - Initially set to `totalAmount`

### 2.2 Balance Updates (Payment Processing)

**Deposit Payment:**
```typescript
// app/api/admin/installments/[id]/route.ts (line 89-90)
totalPaid: { increment: plan.depositAmount },
remainingBalance: { decrement: plan.depositAmount }
```

**Installment Payment:**
```typescript
// app/api/admin/installments/[id]/route.ts (line 172-173)
totalPaid: { increment: amountToPay },
remainingBalance: { decrement: amountToPay }
```

**Key Insight:** Uses **incremental updates** (increment/decrement) rather than recalculating from scratch.

---

## 3. How Remaining Balance is Passed/Used

### 3.1 Plan Creation Flow

1. **Admin enters `planAmount`** in InstallmentsModule UI
   - Location: `components/InstallmentsModule.tsx` (line 91, 205, 713-714)
   - Default: Development's `base_price` (line 627)
   - User can manually edit

2. **Sent to API as `totalAmount`**
   - Location: `components/InstallmentsModule.tsx` (line 205)
   - API: `POST /api/admin/installments`

3. **API calculates:**
   - `depositAmount` = provided OR `totalAmount * depositPercentage / 100`
   - `balanceAmount` = `totalAmount - depositAmount`
   - `monthlyAmount` = `balanceAmount / periodMonths`
   - `remainingBalance` = `totalAmount` (initial)

4. **Stored in database:**
   - `InstallmentPlan.totalAmount`
   - `InstallmentPlan.depositAmount`
   - `InstallmentPlan.balanceAmount`
   - `InstallmentPlan.monthlyAmount`
   - `InstallmentPlan.remainingBalance`

### 3.2 Payment Processing Flow

**Deposit Payment:**
- Uses stored `plan.depositAmount` (not recalculated)
- Increments `totalPaid` by `depositAmount`
- Decrements `remainingBalance` by `depositAmount`

**Installment Payment:**
- Uses `amountToPay` from request (or `installment.amountDue`)
- Increments `totalPaid` by `amountToPay`
- Decrements `remainingBalance` by `amountToPay`

---

## 4. Explicit Storage vs Runtime Calculation

### 4.1 Installments are EXPLICITLY STORED

**Database Tables:**
1. **InstallmentPlan** - Stores plan metadata:
   - `totalAmount` (Decimal)
   - `depositAmount` (Decimal)
   - `balanceAmount` (Decimal)
   - `monthlyAmount` (Decimal)
   - `totalPaid` (Decimal) - Incrementally updated
   - `remainingBalance` (Decimal) - Incrementally updated

2. **Installment** - Stores individual installment records:
   - `installmentNo` (Int) - 1, 2, 3, etc.
   - `amountDue` (Decimal)
   - `amountPaid` (Decimal) - Incrementally updated
   - `dueDate` (DateTime)
   - `status` (String) - PENDING, PAID, OVERDUE, PARTIAL

**Creation:** All installments are created upfront when plan is created (line 154-170)

### 4.2 NOT Calculated at Runtime

- Installments are **NOT** calculated on-the-fly
- They are **pre-generated** and stored in database
- Payment processing **updates stored values** incrementally

---

## 5. Recalculation vs Upstream Values

### 5.1 Module Relies on Stored Values

**The Installments Module:**
- ✅ **Uses stored values** from database
- ❌ **Does NOT recalculate** from scratch
- ✅ **Incremental updates** via Prisma `increment`/`decrement`

**Example - Deposit Payment:**
```typescript
// Uses stored plan.depositAmount (not recalculated)
totalPaid: { increment: plan.depositAmount },
remainingBalance: { decrement: plan.depositAmount }
```

**Example - Installment Payment:**
```typescript
// Uses stored installment.amountDue or provided amountToPay
totalPaid: { increment: amountToPay },
remainingBalance: { decrement: amountToPay }
```

### 5.2 No Recalculation Logic

**Missing:**
- No validation that `totalPaid + remainingBalance = totalAmount`
- No recalculation from `Payment` table
- No sync with PaymentModule deposits

**Potential Issue:**
If a deposit is paid via PaymentModule (not InstallmentsModule), the InstallmentPlan is not updated.

---

## 6. Double-Counting Validation

### 6.1 Potential Double-Counting Scenarios

#### Scenario A: Deposit Paid Twice
**Risk:** ⚠️ **MEDIUM**
- Deposit paid via PaymentModule → Creates `Payment` record
- Deposit paid via InstallmentsModule → Updates `InstallmentPlan` + Creates `Receipt`
- **Result:** Deposit counted in both `Payment` table and `InstallmentPlan.totalPaid`

**Mitigation:** None - No validation prevents this

#### Scenario B: Installment Payment Double-Counting
**Risk:** ⚠️ **LOW**
- Installment payment via InstallmentsModule creates:
  1. Updates `Installment.amountPaid`
  2. Updates `InstallmentPlan.totalPaid`
  3. Creates `Receipt`
  4. **Does NOT create `Payment` record** (only Receipt)

**Mitigation:** Installment payments don't create Payment records, so no double-counting

#### Scenario C: Stand Price vs Total Amount Mismatch
**Risk:** ⚠️ **MEDIUM**
- Admin enters `planAmount` manually (may not match actual stand price)
- No validation against `Stand.price`
- **Result:** Installment plan may use incorrect total amount

**Mitigation:** None - No validation against Stand.price

### 6.2 Current Safeguards

**Existing:**
- ✅ Installment payments update only InstallmentPlan (not Payment table)
- ✅ Receipts are linked to Installments (not Payments)
- ✅ Incremental updates prevent calculation errors

**Missing:**
- ❌ No validation that deposit paid via PaymentModule updates InstallmentPlan
- ❌ No validation that `planAmount` matches `Stand.price`
- ❌ No reconciliation between Payment table and InstallmentPlan

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAN CREATION                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
        Admin enters planAmount (totalAmount)
                          │
                          ▼
        API calculates: depositAmount, balanceAmount, monthlyAmount
                          │
                          ▼
        Creates InstallmentPlan with stored values:
        - totalAmount (from input)
        - depositAmount (calculated or provided)
        - balanceAmount (totalAmount - depositAmount)
        - monthlyAmount (balanceAmount / periodMonths)
        - remainingBalance (initially = totalAmount)
                          │
                          ▼
        Creates Installment records (1..periodMonths)
                          │
                          ▼
        ┌─────────────────────────────────────────────────┐
        │              PAYMENT PROCESSING                 │
        └─────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                     │
        ▼                                     ▼
  PAY_DEPOSIT                          PAY_INSTALLMENT
        │                                     │
        ▼                                     ▼
  Uses plan.depositAmount          Uses installment.amountDue
        │                                     │
        ▼                                     ▼
  totalPaid += depositAmount      totalPaid += amountToPay
  remainingBalance -= depositAmount  remainingBalance -= amountToPay
        │                                     │
        └─────────────────┬─────────────────┘
                          │
                          ▼
        Creates Receipt record
        Updates Stand status (if deposit)
```

---

## 8. Critical Findings

### 8.1 Gap: PaymentModule → InstallmentsModule Integration

**Issue:**
- Deposits paid via PaymentModule are **NOT** automatically linked to InstallmentPlan
- InstallmentPlan remains unaware of PaymentModule deposits
- Could lead to:
  - Double-counting if deposit paid in both modules
  - Incorrect `remainingBalance` if deposit paid only in PaymentModule

**Recommendation:**
- Add validation to check for existing deposit payments when creating plan
- OR: Add webhook/listener to update InstallmentPlan when deposit paid via PaymentModule
- OR: Require all installment-related payments to go through InstallmentsModule

### 8.2 No Stand Price Validation

**Issue:**
- `planAmount` is manually entered (defaults to development `base_price`)
- No validation against actual `Stand.price`
- Could create plan with incorrect total amount

**Recommendation:**
- Fetch `Stand.price` when stand is selected
- Auto-populate `planAmount` from `Stand.price`
- Add validation: `planAmount === Stand.price`

### 8.3 Incremental Updates (No Recalculation)

**Current Approach:**
- Uses Prisma `increment`/`decrement` operations
- Relies on stored values
- No periodic reconciliation

**Risk:**
- If database corruption occurs, balances may be incorrect
- No way to detect inconsistencies

**Recommendation:**
- Add periodic reconciliation job
- Validate: `totalPaid + remainingBalance === totalAmount`
- Add audit log for balance changes

---

## 9. Validation Checklist

### ✅ What Works Correctly

1. **Plan Creation:**
   - ✅ Calculates deposit from totalAmount or uses provided value
   - ✅ Calculates balanceAmount correctly
   - ✅ Creates all installments upfront
   - ✅ Stores all values in database

2. **Payment Processing:**
   - ✅ Incremental updates prevent calculation errors
   - ✅ Updates both Installment and InstallmentPlan
   - ✅ Creates Receipt records
   - ✅ Updates Stand status (for deposits)

3. **No Runtime Calculation:**
   - ✅ All values stored in database
   - ✅ No performance impact from calculations
   - ✅ Consistent data across queries

### ⚠️ Potential Issues

1. **PaymentModule Integration:**
   - ⚠️ Deposits paid via PaymentModule not linked to InstallmentPlan
   - ⚠️ Could lead to double-counting or incorrect balances

2. **Stand Price Validation:**
   - ⚠️ No validation that planAmount matches Stand.price
   - ⚠️ Manual entry could introduce errors

3. **No Reconciliation:**
   - ⚠️ No periodic validation of balance consistency
   - ⚠️ No way to detect data corruption

---

## 10. Recommendations

### 10.1 Immediate Actions (Optional)

1. **Add Stand Price Validation:**
   - Fetch `Stand.price` when stand is selected in InstallmentsModule
   - Auto-populate `planAmount` from stand price
   - Add validation to ensure match

2. **Add PaymentModule Integration:**
   - Check for existing deposit payments when creating plan
   - Link existing payments to InstallmentPlan
   - OR: Require all installment payments via InstallmentsModule

### 10.2 Future Enhancements (Optional)

1. **Reconciliation Job:**
   - Periodic validation: `totalPaid + remainingBalance === totalAmount`
   - Alert on inconsistencies
   - Auto-correction where possible

2. **Unified Payment Processing:**
   - Single payment interface that handles both Payment and InstallmentPlan
   - Automatic linking based on payment_type and standId

---

## 11. Conclusion

The Installments Module uses **explicitly stored values** with **incremental updates**. This approach is **generally sound** but has **potential gaps**:

1. ✅ **Deposit calculation:** Works correctly (calculated or provided)
2. ✅ **Balance calculation:** Works correctly (totalAmount - depositAmount)
3. ✅ **Storage:** All values explicitly stored in database
4. ✅ **Updates:** Incremental updates prevent calculation errors
5. ⚠️ **Integration:** Gap with PaymentModule deposits
6. ⚠️ **Validation:** No Stand price validation
7. ⚠️ **Reconciliation:** No periodic validation

**Overall Assessment:** The module is **functionally correct** but could benefit from **better integration** with PaymentModule and **validation** against Stand prices.

---

**Analysis Complete** ✅
