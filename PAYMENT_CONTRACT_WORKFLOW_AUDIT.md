# 🔍 PAYMENT → CONTRACT WORKFLOW - FORENSIC AUDIT REPORT

**Date:** 2026-01-23  
**Objective:** Identify why payments don't automatically create contracts and mark stands as SOLD  
**Status:** ✅ **AUDIT COMPLETE**

---

## EXECUTIVE SUMMARY

**Root Cause:** Payment success handlers exist but **do not create contracts**. Stand status is updated to SOLD for deposit payments, but contract creation is **completely missing** from the payment workflow.

**Impact:** 
- ✅ Stands are marked SOLD (partial success)
- ❌ Contracts are never created automatically
- ❌ No email notifications sent
- ❌ Financial fields not calculated/stored
- ❌ Dashboards may show inconsistent data

---

## STEP A: CURRENT IMPLEMENTATION ANALYSIS

### 1. Payment Creation/Update Endpoints

#### **File:** `app/api/admin/payments/route.ts`

**POST Handler (Lines 87-390):**
- ✅ Creates payment record
- ✅ Updates stand to SOLD for deposit payments (lines 171-179)
- ✅ Updates stand to RESERVED for non-deposit payments (lines 243-252)
- ❌ **NO CONTRACT CREATION**
- ❌ **NO EMAIL NOTIFICATION FOR CONTRACT**

**PUT Handler (Lines 392-441):**
- ✅ Updates payment record
- ❌ **NO STATUS TRANSITION HANDLING**
- ❌ **NO CONTRACT CREATION**
- ❌ **NO STAND UPDATE ON STATUS CHANGE**

**Key Finding:**
```typescript
// Line 142: Payment created with status from request (defaults to 'PENDING')
status: data.status || 'PENDING',

// Line 171-179: Stand updated to SOLD for deposit payments
if (isDepositPayment) {
  await prisma.stand.update({
    where: { id: payment.standId },
    data: { status: 'SOLD', reserved_by: data.clientId }
  });
}
// ❌ NO CONTRACT CREATION HERE
```

---

### 2. Payment Status Update Logic

#### **File:** `app/actions/verify-payment.ts`

**Function:** `verifyPayment()` (Lines 363-606)

**Current Flow:**
1. ✅ Validates reservation exists
2. ✅ Validates reservation status is PENDING
3. ✅ Updates reservation to CONFIRMED (line 489-496)
4. ✅ Updates stand to SOLD (line 500-506)
5. ✅ Sends purchase confirmation email (line 526-534)
6. ❌ **NO CONTRACT CREATION**
7. ❌ **NO PAYMENT STATUS UPDATE TO CONFIRMED**

**Key Finding:**
```typescript
// Line 487-507: Transaction updates reservation + stand
const [updatedReservation, updatedStand] = await prisma.$transaction([
  prisma.reservation.update({
    where: { id: input.reservationId },
    data: { status: 'CONFIRMED', ... }
  }),
  prisma.stand.update({
    where: { id: reservation.standId },
    data: { status: 'SOLD', ... }
  }),
]);
// ❌ NO CONTRACT CREATION IN TRANSACTION
// ❌ NO PAYMENT STATUS UPDATE
```

**Problem:** This function works on **Reservations**, not **Payments**. It doesn't handle direct payment success.

---

### 3. Contract Creation Logic

#### **File:** `app/api/admin/contracts/route.ts`

**POST Handler (Lines 49-162):**
- ✅ Creates contract from template
- ✅ Requires manual clientId, templateId, standId
- ❌ **NOT TRIGGERED BY PAYMENT SUCCESS**
- ❌ **NO AUTOMATIC CREATION**

**Key Finding:**
```typescript
// Line 128-138: Contract creation requires explicit API call
const contract = await prisma.generatedContract.create({
  data: {
    clientId: data.clientId,
    templateId: data.templateId,
    standId: data.standId,
    templateName: template.name,
    content: content,
    status: 'DRAFT',
    branch: data.branch || user.branch || 'Harare'
  }
});
// ❌ This is manual, not automatic
```

---

### 4. Stand Availability Logic

#### **File:** `app/api/admin/payments/route.ts` (Lines 158-270)

**Current Behavior:**
- ✅ Deposit payments → Stand set to SOLD
- ✅ Non-deposit payments → Stand set to RESERVED (if AVAILABLE)
- ❌ **NO VALIDATION IF STAND ALREADY SOLD**
- ❌ **NO RACE CONDITION PROTECTION**

**Key Finding:**
```typescript
// Line 166-179: Stand update without locking
const stand = await prisma.stand.findUnique({
  where: { id: payment.standId }
});

if (stand) {
  if (isDepositPayment) {
    await prisma.stand.update({
      where: { id: payment.standId },
      data: { status: 'SOLD', reserved_by: data.clientId }
    });
  }
}
// ❌ No row-level locking
// ❌ No check if stand already SOLD by another client
```

---

## ROOT CAUSE ANALYSIS

### Why Contracts Are Not Created:

1. **No Payment Success Handler:**
   - Payment creation doesn't check if status is CONFIRMED/SUCCESS
   - Payment updates don't trigger contract creation on status transition
   - No dedicated function to handle payment success workflow

2. **Missing Integration Points:**
   - `POST /api/admin/payments` creates payment but doesn't create contract
   - `PUT /api/admin/payments` updates payment but doesn't check status transitions
   - `verifyPayment()` works on reservations, not payments

3. **No Contract-Payment Link:**
   - `GeneratedContract` model has no `paymentId` field
   - Cannot track which payment triggered contract creation
   - No way to prevent duplicate contracts

4. **Missing Financial Calculations:**
   - Contract creation doesn't calculate:
     - Stand size (from Stand.sizeSqm)
     - Remaining balance (total_price - total_paid)
     - Installment terms (from InstallmentPlan if exists)
     - Installment value (remaining_balance / terms)

5. **No Email Notification:**
   - No email sent to client + developer after contract creation
   - No email template for contract creation

---

## WHERE PAYMENT SUCCESS IS DETERMINED

### Current Status Values:
- **Payment Model:** `status: 'PENDING' | 'CONFIRMED' | 'FAILED'`
- **Note:** Uses `CONFIRMED`, not `SUCCESS`

### Status Transition Points:

1. **Payment Creation (`POST /api/admin/payments`):**
   - Default: `status: 'PENDING'`
   - Can be set to `'CONFIRMED'` in request body
   - **No handler for CONFIRMED status**

2. **Payment Update (`PUT /api/admin/payments`):**
   - Can update status to `'CONFIRMED'`
   - **No handler for status transition**

3. **Payment Verification (`verifyPayment()`):**
   - Updates Reservation to CONFIRMED
   - Updates Stand to SOLD
   - **Does NOT update Payment status**
   - **Does NOT create contract**

4. **Payment with Allocation (`POST /api/payments/with-allocation`):**
   - Creates payment with `status: 'CONFIRMED'` (line 91)
   - **No contract creation**

---

## WHERE STANDS ARE UPDATED

### Current Update Points:

1. **`POST /api/admin/payments` (Lines 171-179):**
   - Deposit payments → Stand set to SOLD
   - ✅ Works but no contract creation

2. **`app/actions/verify-payment.ts` (Lines 500-506):**
   - Reservation verification → Stand set to SOLD
   - ✅ Works but no contract creation

3. **`app/api/admin/installments/[id]/route.ts` (Lines 132-139):**
   - Deposit paid via installment → Stand set to SOLD
   - ✅ Works but no contract creation

**Problem:** All three paths update stand but **none create contracts**.

---

## WHERE CONTRACTS ARE CREATED

### Current Creation Points:

1. **`POST /api/admin/contracts` (Manual):**
   - Requires explicit API call with clientId, templateId, standId
   - ✅ Works but **not automatic**
   - ❌ Not triggered by payment success

2. **`lib/contract-generator.ts` (Manual):**
   - Helper function for contract generation
   - ✅ Works but **not automatic**
   - ❌ Not triggered by payment success

**Problem:** Contract creation is **100% manual**. No automatic creation exists.

---

## WHY CONTRACTS/STANDS ARE NOT SYNCING

### Root Causes:

1. **Missing Payment Success Handler:**
   - No function `handlePaymentSuccess(paymentId)` exists
   - No automatic contract creation on payment CONFIRMED
   - No integration between payment and contract systems

2. **No Status Transition Detection:**
   - Payment updates don't detect PENDING → CONFIRMED transition
   - No hook/trigger for status changes

3. **Missing Contract Fields:**
   - `GeneratedContract` lacks:
     - `paymentId` (cannot link to payment)
     - `standSize` (financial field)
     - `totalPrice` (financial field)
     - `depositPaid` (financial field)
     - `remainingBalance` (financial field)
     - `installmentTerms` (financial field)
     - `installmentValue` (financial field)
     - `developerId` or developer info

4. **No Idempotency:**
   - No check if contract already exists for payment
   - No unique constraint on paymentId
   - Risk of duplicate contracts

5. **No Email Integration:**
   - No email sent after contract creation
   - No template for contract creation notification

---

## DASHBOARD QUERY ANALYSIS

### Stand Availability Queries:

1. **Landing Page:**
   - Need to check: `components/LandingPage.tsx`
   - Likely filters: `status: 'AVAILABLE'`

2. **Admin Stand Listings:**
   - Need to check: `app/api/admin/stands/route.ts`
   - Likely filters: `status: { in: ['AVAILABLE', 'RESERVED'] }`

3. **Client Dashboard:**
   - Need to check: `components/ClientPortfolio.tsx`
   - Likely filters: `reserved_by: clientId`

4. **Agent Dashboard:**
   - Need to check: `components/AgentDashboard.tsx`
   - Likely filters: Stands with agent's reservations

**Potential Issues:**
- Caching may show stale data
- No cache invalidation after payment success
- Queries may not exclude SOLD stands properly

---

## SUMMARY OF FINDINGS

### ✅ What Works:
1. Stand status updated to SOLD for deposit payments
2. Payment records created successfully
3. Contract creation API exists (manual)

### ❌ What's Missing:
1. **Automatic contract creation on payment success**
2. **Payment status transition handling (PENDING → CONFIRMED)**
3. **Contract financial fields (stand size, balance, installments)**
4. **Email notification after contract creation**
5. **Idempotency checks (prevent duplicate contracts)**
6. **Row-level locking (prevent race conditions)**
7. **Payment-Contract link (paymentId field)**
8. **Developer information in contracts**

---

## NEXT STEPS

1. **Create `handlePaymentSuccess()` function** with:
   - Transactional stand update (with locking)
   - Contract creation with all financial fields
   - Idempotency checks
   - Email notification

2. **Wire into payment flows:**
   - `POST /api/admin/payments` (when status = CONFIRMED)
   - `PUT /api/admin/payments` (when status transitions to CONFIRMED)
   - `POST /api/payments/with-allocation` (already creates CONFIRMED)

3. **Update schema if needed:**
   - Add `paymentId` to `GeneratedContract` (optional, for tracking)
   - Add financial fields to contract (if not in template variables)

4. **Add email template:**
   - `CONTRACT_CREATED_ON_PAYMENT` template
   - Send to client + developer

5. **Update dashboards:**
   - Ensure queries exclude SOLD stands
   - Add cache invalidation

---

**Status:** ✅ **AUDIT COMPLETE - READY FOR IMPLEMENTATION**
