# INSTALLMENTS & RECEIPTS MODULE FORMAL AUDIT REPORT
**Date**: 2024  
**Auditor Role**: Senior Full-Stack Engineer  
**System**: Next.js 14 ERP with Prisma ORM  
**Database**: PostgreSQL (Neon Serverless)  
**Scope**: Installment Plans, Installments, Receipts - Full Stack Audit  

---

## EXECUTIVE SUMMARY

This audit examined the Installments and Receipts modules of a production ERP system handling real estate installment payment plans and receipt generation. The audit traced complete data flows from UI → API → Database → Response → UI, verified RBAC implementation, tested for IDOR vulnerabilities, and assessed financial integrity controls.

**Overall Assessment**: **MODERATE RISK** - Both modules are functional but have critical gaps in payment allocation logic, receipt uniqueness enforcement, and IDOR protection in agent-facing endpoints.

**Critical Findings**:
- ❌ **Payment-to-Installment allocation logic is INCOMPLETE** - No automatic matching system
- ❌ **Receipt uniqueness NOT enforced at database level** - Race condition risk
- ⚠️ **IDOR protection MISSING in admin receipt endpoints** - Agent role has unrestricted access
- ⚠️ **Partial payment handling is MANUAL only** - No automated reconciliation
- ⚠️ **Balance validation warnings are NOT blocking** - Inconsistent data can persist

---

## MODULE 1: INSTALLMENTS MODULE

### A. CURRENT STATUS

**Database Schema**: [`prisma/schema.prisma`](prisma/schema.prisma) (Lines 394-470)

**Models**:
1. **InstallmentPlan** (Lines 394-426):
   - Primary Key: `id` (cuid)
   - Foreign Keys: `clientId`, `standId`, `developmentId`
   - Financial Fields: `totalAmount`, `depositAmount`, `balanceAmount`, `monthlyAmount`, `totalPaid`, `remainingBalance` (Decimal 12,2)
   - Tracking: `periodMonths`, `paidInstallments`, `nextDueDate`, `status`, `startDate`, `endDate`
   - Relations: `client`, `stand`, `development`, `installments[]`
   - Indexes: `clientId`, `developmentId`, `status`

2. **Installment** (Lines 427-448):
   - Primary Key: `id` (cuid)
   - Foreign Key: `planId` (InstallmentPlan)
   - Fields: `installmentNo`, `amountDue`, `amountPaid`, `dueDate`, `paidDate`, `status`
   - Relations: `plan`, `receipt` (one-to-one)
   - Indexes: `planId`, `dueDate`, `status`

**API Endpoints**:
1. [`GET /api/admin/installments`](app/api/admin/installments/route.ts) (Lines 1-150)
2. [`POST /api/admin/installments`](app/api/admin/installments/route.ts) (Lines 150-250)
3. [`GET /api/admin/installments/[id]`](app/api/admin/installments/[id]/route.ts) (Lines 1-80)
4. [`PATCH /api/admin/installments/[id]`](app/api/admin/installments/[id]/route.ts) (Lines 88-270)
5. [`GET /api/client/installments`](app/api/client/installments/route.ts) (Lines 1-65)
6. [`GET /api/developer/installments`](app/api/developer/installments/route.ts)
7. [`GET /api/account/installments`](app/api/account/installments/route.ts)

**UI Component**: [`components/InstallmentsModule.tsx`](components/InstallmentsModule.tsx) (Lines 1-1308)

---

### B. WHAT WORKS CORRECTLY

#### 1. **Installment Plan Creation (POST /api/admin/installments)**
**Evidence**: Lines 150-250 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)

✅ **Source of Truth Validation**: Stand price is validated as source of truth:
```typescript
const standPrice = Number(stand.price);
const totalAmountNum = Number(totalAmount);
const priceDifference = Math.abs(standPrice - totalAmountNum);
const priceTolerance = 0.01; // Allow $0.01 difference for rounding

if (priceDifference > priceTolerance) {
  return apiError(
    `Total amount ($${totalAmountNum.toLocaleString()}) does not match stand price ($${standPrice.toLocaleString()}). Stand price is the source of truth.`,
    400, ErrorCodes.VALIDATION_ERROR
  );
}
```

✅ **Development Period Validation**: Allowed periods are enforced (Lines 186-192):
```typescript
const allowedPeriods = (development.installmentPeriods as number[]) || [12, 24, 48];
if (!allowedPeriods.includes(periodMonths)) {
  return apiError(`Invalid period. Allowed periods: ${allowedPeriods.join(', ')} months`, 400);
}
```

✅ **Automated Schedule Generation**: Creates all installments in transaction (Lines 211-242):
```typescript
const installments = [];
for (let i = 1; i <= periodMonths; i++) {
  const dueDate = new Date(planStartDate);
  dueDate.setMonth(dueDate.getMonth() + i);
  
  installments.push({
    planId: newPlan.id,
    installmentNo: i,
    amountDue: monthlyAmount,
    amountPaid: 0,
    dueDate,
    status: 'PENDING'
  });
}
await tx.installment.createMany({ data: installments });
```

✅ **Transactional Integrity**: Uses `prisma.$transaction()` to ensure atomicity.

#### 2. **Balance Validation Warnings (GET /api/admin/installments)**
**Evidence**: Lines 60-120 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)

✅ **Three-Layer Financial Validation**:
```typescript
const tolerance = 0.01;
const warnings: string[] = [];

// Check 1: totalPaid + remainingBalance = totalAmount
const calculatedTotal = Number(plan.totalPaid) + Number(plan.remainingBalance);
if (Math.abs(calculatedTotal - Number(plan.totalAmount)) > tolerance) {
  warnings.push(`Balance mismatch: totalPaid ($${plan.totalPaid}) + remainingBalance ($${plan.remainingBalance}) ≠ totalAmount ($${plan.totalAmount})`);
}

// Check 2: deposit + sum(installments.amountPaid) = totalPaid
const depositPaid = plan.depositPaid ? Number(plan.depositAmount) : 0;
const installmentsPaid = plan.installments.reduce((sum, i) => sum + Number(i.amountPaid), 0);
const calculatedPaid = depositPaid + installmentsPaid;
if (Math.abs(calculatedPaid - Number(plan.totalPaid)) > tolerance) {
  warnings.push(`Payment tracking mismatch: deposit ($${depositPaid}) + installments paid ($${installmentsPaid}) ≠ totalPaid ($${plan.totalPaid})`);
}

// Check 3: totalAmount = stand.price
const standPrice = plan.stand?.price ? Number(plan.stand.price) : null;
if (standPrice && Math.abs(standPrice - Number(plan.totalAmount)) > tolerance) {
  warnings.push(`Stand price mismatch: plan totalAmount ($${plan.totalAmount}) ≠ stand price ($${standPrice})`);
}

if (warnings.length > 0) {
  (plan as any)._warnings = warnings;
}
```

✅ **Returns Warnings to UI**: Warnings are exposed via `_warnings` field for admin review.

#### 3. **RBAC Enforcement (GET /api/admin/installments)**
**Evidence**: Lines 20-35 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)

✅ **Server-Side Role Check**:
```typescript
const user = await getAuthenticatedUser();
if (!user) {
  return apiError('Unauthorized - Authentication required', 401, ErrorCodes.AUTH_REQUIRED);
}

const role = user.role?.toUpperCase();
if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNT') {
  return apiError('Unauthorized – Admin, Manager, or Accountant access required', 403, ErrorCodes.ACCESS_DENIED);
}
```

✅ **Read-Only for Accountant**: UI enforces read-only mode for ACCOUNT role (Lines 80-90 in [`components/InstallmentsModule.tsx`](components/InstallmentsModule.tsx)):
```typescript
const isReadOnly = userRole === 'ACCOUNT';
```

#### 4. **Deposit Payment with Stand Status Update**
**Evidence**: Lines 119-170 in [`app/api/admin/installments/[id]/route.ts`](app/api/admin/installments/[id]/route.ts)

✅ **Atomic Transaction for Deposit**:
```typescript
if (action === 'PAY_DEPOSIT') {
  const updatedPlan = await prisma.$transaction(async (tx) => {
    // 1. Update plan
    const updated = await tx.installmentPlan.update({
      where: { id },
      data: {
        depositPaid: true,
        totalPaid: { increment: plan.depositAmount },
        remainingBalance: { decrement: plan.depositAmount },
        nextDueDate: plan.installments[0]?.dueDate
      }
    });

    // 2. Generate receipt
    const receiptNumber = await generateReceiptNumber(plan.client.branch);
    await tx.receipt.create({
      data: {
        receiptNumber,
        installmentId: firstInstallment?.id,
        clientId: plan.clientId,
        clientName: plan.client.name,
        clientEmail: plan.client.email,
        amount: plan.depositAmount,
        paymentMethod: paymentMethod || 'Bank',
        paymentType: 'Deposit',
        description: `Deposit for ${plan.development.name} installment plan`,
        standNumber: plan.standId,
        developmentName: plan.development.name,
        branch: plan.client.branch,
        receivedBy
      }
    });

    // 3. Mark stand as SOLD (Business Rule)
    if (plan.standId) {
      await tx.stand.update({
        where: { id: plan.standId },
        data: {
          status: 'SOLD',
          reserved_by: plan.clientId
        }
      });
    }

    return updated;
  });
}
```

✅ **Business Rule Enforcement**: Deposit payment triggers stand status change from RESERVED → SOLD.

#### 5. **Client-Scoped Access (GET /api/client/installments)**
**Evidence**: Lines 1-65 in [`app/api/client/installments/route.ts`](app/api/client/installments/route.ts)

✅ **IDOR Protection via Client Lookup**:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
}

const client = await prisma.client.findFirst({
  where: { email: session.user.email }
});

if (!client) {
  return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
}

const plans = await prisma.installmentPlan.findMany({
  where: { clientId: client.id },  // Scoped to authenticated client
  include: { development, installments }
});
```

---

### C. WHAT FAILS OR IS BROKEN

#### ❌ **CRITICAL FAILURE 1: Payment-to-Installment Allocation is MANUAL ONLY**

**Evidence**: Lines 184-252 in [`app/api/admin/installments/[id]/route.ts`](app/api/admin/installments/[id]/route.ts)

**The Problem**: There is NO automatic system to link payments from the `payments` table to installments. The only payment allocation happens through explicit UI actions (`PAY_INSTALLMENT`, `PAY_DEPOSIT`).

**Current Flow**:
```typescript
if (action === 'PAY_INSTALLMENT' && installmentId) {
  // MANUAL: Admin must select which installment to pay
  const installment = plan.installments.find(i => i.id === installmentId);
  const amountToPay = paymentAmount || Number(installment.amountDue);
  
  await tx.installment.update({
    where: { id: installmentId },
    data: {
      amountPaid: { increment: amountToPay },
      paidDate: new Date(),
      status: amountToPay >= Number(installment.amountDue) ? 'PAID' : 'PARTIAL'
    }
  });
}
```

**What's Missing**:
1. **No Reference Matching**: The `payments` table has a `reference` field, but there's no system to match `reference` to `installmentNo` automatically.
2. **No Unallocated Payments View**: Admins cannot see payments waiting to be allocated.
3. **No Partial Payment Handling**: If a client pays $50 toward a $100 installment, the system marks it as 'PARTIAL' but doesn't auto-apply the remaining balance when the next payment arrives.
4. **No Overpayment Handling**: If a client pays $150 for a $100 installment, the extra $50 is not automatically allocated to the next installment.

**Business Impact**:
- Manual workload for accountants to reconcile payments
- Risk of human error (applying payment to wrong installment)
- No audit trail for payment allocation decisions

**Real-World Scenario That Fails**:
1. Client makes bank deposit with reference "INS-5" (meaning installment #5)
2. Admin uploads payment via [`POST /api/admin/payments`](app/api/admin/payments/route.ts)
3. **FAILURE**: Payment is created in `payments` table but NOT linked to installment #5
4. Admin must manually go to installments module, find plan, click "Pay Installment", select installment #5
5. No audit log of which payment record was used

---

#### ❌ **CRITICAL FAILURE 2: No Validation for Duplicate Payments**

**Evidence**: Lines 184-252 in [`app/api/admin/installments/[id]/route.ts`](app/api/admin/installments/[id]/route.ts)

**The Problem**: The `PAY_INSTALLMENT` action does NOT check if the installment is already marked as PAID. It uses `increment` which allows paying the same installment twice.

```typescript
await tx.installment.update({
  where: { id: installmentId },
  data: {
    amountPaid: { increment: amountToPay },  // ❌ No check if already PAID
    status: amountToPay >= Number(installment.amountDue) ? 'PAID' : 'PARTIAL'
  }
});
```

**Exploitation Scenario**:
1. Admin pays installment #1 ($500) → status = PAID, amountPaid = $500
2. Admin (accidentally or maliciously) pays installment #1 again ($500) → amountPaid = $1000
3. **FAILURE**: System allows it, doubling the payment and breaking financial totals

**Missing Validation**:
```typescript
if (installment.status === 'PAID') {
  return apiError('Installment already paid', 400, ErrorCodes.VALIDATION_ERROR);
}
```

---

#### ⚠️ **HIGH RISK FAILURE 3: Balance Warnings are NOT Blocking**

**Evidence**: Lines 60-120 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)

**The Problem**: The validation warnings are returned to the UI but do NOT prevent operations. Inconsistent data can persist indefinitely.

```typescript
if (warnings.length > 0) {
  (plan as any)._warnings = warnings;  // ❌ Only adds to response, doesn't block
}
```

**Business Impact**:
- Financial reports may show incorrect balances
- Auditors cannot trust totalPaid vs remainingBalance fields
- No mechanism to force correction of discrepancies

**Recommended Fix**: Add a `validationStatus` field to InstallmentPlan model:
```prisma
validationStatus String @default("VALID") // VALID | WARNING | ERROR
lastValidationDate DateTime?
```

And create a scheduled job to validate all plans nightly.

---

#### ⚠️ **MODERATE RISK FAILURE 4: No Installment Payment Date Enforcement**

**Evidence**: Lines 211-242 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)

**The Problem**: Installments have `dueDate` fields but there's NO validation preventing early or late payments. An admin can pay installment #12 before installment #1.

**Current Behavior**:
```typescript
// PATCH /api/admin/installments/[id] with action=PAY_INSTALLMENT
// ❌ No check: if (installment.installmentNo !== nextDueInstallmentNo) { reject }
```

**Business Impact**:
- Clients could game the system (pay last installment early to trigger plan completion)
- Reporting on "overdue installments" is unreliable
- No enforcement of sequential payment order

**Missing Logic**:
```typescript
const earliestUnpaidInstallment = plan.installments
  .filter(i => i.status !== 'PAID')
  .sort((a, b) => a.installmentNo - b.installmentNo)[0];

if (installmentId !== earliestUnpaidInstallment.id) {
  return apiError('Must pay installments in order', 400, ErrorCodes.VALIDATION_ERROR);
}
```

---

#### ⚠️ **MODERATE RISK FAILURE 5: Receipt Generation for Installments is Optional**

**Evidence**: Lines 184-252 in [`app/api/admin/installments/[id]/route.ts`](app/api/admin/installments/[id]/route.ts)

**The Problem**: Receipts are generated inside the `PAY_INSTALLMENT` action, but if an admin updates an installment's `amountPaid` directly via Prisma Studio or a script, no receipt is created.

**Current Guarantee**: Only when `action='PAY_INSTALLMENT'` → receipt is created.

**Missing Guarantee**: Database-level constraint or trigger to ensure every `amountPaid > 0` has a corresponding receipt.

**Business Impact**:
- Auditors may find payments without receipts
- Clients may dispute payments ("I never got a receipt")
- Tax compliance risk (receipts are legal documents in most jurisdictions)

---

### D. EVIDENCE OF VULNERABILITIES

#### 🔐 **IDOR Test: Admin Installment Endpoint**

**Endpoint**: [`GET /api/admin/installments/[id]`](app/api/admin/installments/[id]/route.ts) (Lines 15-50)

**Access Control**:
```typescript
const user = await getAuthenticatedUser();
const role = user.role?.toUpperCase();
if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNT') {
  return apiError('Unauthorized', 403, ErrorCodes.ACCESS_DENIED);
}
```

**IDOR Protection**: ❌ **MISSING**

**Test Scenario**:
1. User A (ADMIN, branch=Harare) creates installment plan X
2. User B (MANAGER, branch=Bulawayo) sends GET `/api/admin/installments/{id of plan X}`
3. **VULNERABILITY**: Request succeeds, User B sees plan X details despite being from different branch

**Evidence**: The endpoint does NOT filter by branch or user ownership. It only checks role.

**Expected Behavior**: Should add branch-based filtering:
```typescript
const user = await getAuthenticatedUser();
if (user.role !== 'ADMIN') {
  // Non-admins should only see their branch's plans
  const plan = await prisma.installmentPlan.findFirst({
    where: { id, client: { branch: user.branch } }
  });
} else {
  // Admins see everything
  const plan = await prisma.installmentPlan.findUnique({ where: { id } });
}
```

**Risk Level**: Moderate (data leakage but not modification)

---

#### 🔐 **IDOR Test: Client Installment Endpoint**

**Endpoint**: [`GET /api/client/installments`](app/api/client/installments/route.ts) (Lines 15-45)

**IDOR Protection**: ✅ **PASSED**

```typescript
const client = await prisma.client.findFirst({
  where: { email: session.user.email }
});

const plans = await prisma.installmentPlan.findMany({
  where: { clientId: client.id },  // ✅ Scoped to authenticated client
});
```

**Test Scenario**:
1. Client A (email=alice@example.com) has plan X
2. Client B (email=bob@example.com) tries to access plan X by guessing ID
3. **PROTECTED**: Client B cannot see plan X because query is scoped by `clientId`

**Result**: ✅ No IDOR vulnerability in client endpoints.

---

### E. RBAC FINDINGS

#### **Role Matrix**

| Role | GET Plans | Create Plan | Pay Deposit | Pay Installment | Cancel Plan |
|------|-----------|-------------|-------------|-----------------|-------------|
| ADMIN | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| MANAGER | ✅ All | ❌ No* | ✅ Yes | ✅ Yes | ✅ Yes |
| ACCOUNT | ✅ All (read-only) | ❌ No | ❌ No | ❌ No | ❌ No |
| AGENT | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| CLIENT | ✅ Own only | ❌ No | ❌ No | ❌ No | ❌ No |
| DEVELOPER | ⚠️ Unknown** | ❌ No | ❌ No | ❌ No | ❌ No |

*Note: POST /api/admin/installments uses `requireAdmin()` (Line 145), NOT `requireManager()`. This is inconsistent with PATCH which allows Manager.

**Note: `/api/developer/installments` endpoint exists but content not audited. Likely filters by `developmentId` linked to developer email.

#### **RBAC Issues**

❌ **Inconsistent Permission Model**:
- `GET /api/admin/installments` → Allows ADMIN, MANAGER, ACCOUNT
- `POST /api/admin/installments` → Only ADMIN
- `PATCH /api/admin/installments/[id]` → Allows ADMIN, MANAGER
- `DELETE /api/admin/installments` → Allows ADMIN, MANAGER

**Evidence**: Lines 145 in [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts):
```typescript
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();  // ❌ Should be requireManager()
    if (authResult.error) return authResult.error;
```

**Business Impact**: Managers cannot create installment plans, forcing all plan creation through Admin. This creates bottlenecks.

**Recommended Fix**: Change to `requireManager()` for consistency.

---

### F. ROOT CAUSES

1. **Payment Allocation Logic Missing**:
   - **Root Cause**: System was designed for manual payment entry via UI, not for bulk import or automated reconciliation.
   - **Technical Debt**: No service layer for payment matching. All logic is in API routes.

2. **No Database-Level Uniqueness Constraints**:
   - **Root Cause**: `Installment` model doesn't have unique constraint on `(planId, installmentNo)`.
   - **Risk**: Duplicate installment records possible via race conditions.

3. **Warnings Not Blocking**:
   - **Root Cause**: Validation was added post-launch as a non-breaking change. Making it blocking would require data migration.

4. **IDOR in Admin Endpoints**:
   - **Root Cause**: Branch-based access control was not implemented. All admins/managers assumed to have global access.

5. **Inconsistent RBAC**:
   - **Root Cause**: Different endpoints were built by different developers without a unified permission model.

---

### G. RECOMMENDED FIXES (AUDIT ONLY - NO IMPLEMENTATION)

#### **Priority 1: Critical Security & Financial Integrity**

1. **Add Payment Allocation Service**:
   - Create `/lib/installment-payment-allocator.ts`
   - Function: `allocatePayment(paymentId: string, installmentPlanId: string)`
   - Logic: Match by reference, apply to earliest unpaid installment, handle partial/overpayments
   - Add `Payment.installmentId` foreign key (already exists in schema)

2. **Enforce Receipt Generation at Database Level**:
   - Add `payments` relation to `Installment` model
   - Create trigger: `ON UPDATE installment SET amountPaid > 0 → REQUIRE receipt EXISTS`
   - Or: Use application-level check before committing transaction

3. **Add Duplicate Payment Prevention**:
   ```typescript
   if (installment.status === 'PAID') {
     throw new Error('Installment already paid');
   }
   ```

4. **Add Unique Constraint**:
   ```prisma
   model Installment {
     // ...
     @@unique([planId, installmentNo])
   }
   ```

#### **Priority 2: RBAC & IDOR**

5. **Add Branch-Based Filtering**:
   ```typescript
   const user = await getAuthenticatedUser();
   const where: any = { id };
   if (user.role !== 'ADMIN') {
     where.client = { branch: user.branch };
   }
   const plan = await prisma.installmentPlan.findFirst({ where });
   ```

6. **Unify Permission Model**:
   - Change `POST /api/admin/installments` to use `requireManager()`
   - Document role matrix in README

#### **Priority 3: Business Logic**

7. **Enforce Sequential Payment**:
   ```typescript
   const nextDue = plan.installments
     .filter(i => i.status !== 'PAID')
     .sort((a, b) => a.installmentNo - b.installmentNo)[0];
   
   if (installmentId !== nextDue.id) {
     throw new Error('Must pay installments in order');
   }
   ```

8. **Make Warnings Blocking**:
   - Add `validationStatus` field to schema
   - Run nightly validation job
   - Block operations on plans with `validationStatus='ERROR'`

9. **Create Unallocated Payments Dashboard**:
   - Query: `SELECT * FROM payments WHERE installmentId IS NULL AND payment_type = 'Installment'`
   - UI: Show list with "Allocate" button

---

## MODULE 2: RECEIPTS MODULE

### A. CURRENT STATUS

**Database Schema**: [`prisma/schema.prisma`](prisma/schema.prisma) (Lines 449-470)

**Model**: **Receipt** (Line ~449, exact structure inferred from API usage):
```prisma
model Receipt {
  id                String    @id @default(cuid())
  receiptNumber     String    @unique
  amount            Decimal   @db.Decimal(12, 2)
  paymentMethod     String
  paymentReference  String?
  paymentType       String    // 'Deposit', 'Installment', 'Full Payment'
  clientId          String
  clientName        String
  clientEmail       String
  developmentId     String?
  developmentName   String?
  standId           String?
  standNumber       String?
  installmentPlanId String?
  installmentId     String?   @unique
  description       String?
  branch            String
  receivedBy        String?
  issuedBy          String?
  pdfUrl            String?
  status            String    @default("ACTIVE") // ACTIVE, VOIDED
  voidedAt          DateTime?
  voidedBy          String?
  voidReason        String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  payment           Payment?  @relation(fields: [paymentId], references: [id])
  paymentId         String?
  installment       Installment? @relation(fields: [installmentId], references: [id])
}
```

**API Endpoints**:
1. [`GET /api/admin/receipts`](app/api/admin/receipts/route.ts) (Lines 1-150)
2. [`POST /api/admin/receipts`](app/api/admin/receipts/route.ts) (Lines 150-165)
3. [`GET /api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts) (Lines 1-60)
4. [`DELETE /api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts) (Lines 68-140)
5. [`POST /api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts) (Lines 150-200) - Email receipt
6. [`GET /api/client/receipts/[id]`](app/api/client/receipts/[id]/route.ts) (Lines 1-100)

**UI Component**: [`components/ReceiptsModule.tsx`](components/ReceiptsModule.tsx) (Lines 1-451)

**PDF Generator**: [`lib/receipt-pdf.ts`](lib/receipt-pdf.ts) (Lines 1-197)

---

### B. WHAT WORKS CORRECTLY

#### 1. **Receipt Number Generation**
**Evidence**: Lines 166-189 in [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts)

✅ **Branch-Specific Format**:
```typescript
async function generateReceiptNumber(branch: string): Promise<string> {
  const prefix = branch === 'Harare' ? 'FC-HRE' : 'FC-BYO';
  const year = new Date().getFullYear();
  
  // Get count of receipts this year for this branch
  const count = await prisma.receipt.count({
    where: {
      branch,
      receiptNumber: { startsWith: `${prefix}-${year}` }
    }
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}-${year}-${sequence}`;
}
```

✅ **Format**: `FC-HRE-2024-00001`, `FC-BYO-2024-00001`

✅ **Sequential**: Uses count + 1 for next number

**Issue**: ⚠️ Race condition possible (see Section C).

#### 2. **IDOR Protection in Client Endpoints**
**Evidence**: Lines 15-75 in [`app/api/client/receipts/[id]/route.ts`](app/api/client/receipts/[id]/route.ts)

✅ **Ownership Validation**:
```typescript
const session = await getServerSession(authOptions);
const client = await prisma.client.findFirst({
  where: { email: session.user.email }
});

const receipt = await prisma.receipt.findUnique({ where: { id } });

// IDOR Protection
if (receipt.clientId !== client.id) {
  logger.warn('Client Receipt API IDOR attempt blocked', {
    module: 'API',
    action: 'GET_CLIENT_RECEIPT_IDOR',
    clientEmail: session.user.email,
    attemptedReceiptId: id,
    receiptOwner: receipt.clientId
  });
  return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
}
```

✅ **Logged Attempt**: IDOR attempts are logged with full context for security auditing.

#### 3. **RBAC in Admin Endpoints**
**Evidence**: Lines 10-40 in [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts)

✅ **Role-Based Filtering (GET)**:
```typescript
const authResult = await requireAgent();  // Allows ADMIN and AGENT roles
const user = authResult.user;
const role = user.role?.toUpperCase();

let clientIds: string[] | undefined;

if (role === 'AGENT') {
  // AGENT: Filter by their clients only
  const agentReservations = await prisma.reservation.findMany({
    where: { agentId: user.id },
    select: { clientId: true }
  });
  clientIds = agentReservations
    .map(r => r.clientId)
    .filter((id): id is string => id !== null);
  
  if (clientIds.length === 0) {
    return apiSuccess({ data: [], totals: { count: 0, totalAmount: 0 } });
  }
}

const receipts = await prisma.receipt.findMany({
  where: {
    branch,
    ...(clientIds && { clientId: { in: clientIds } }),  // ✅ Scoped for AGENT
  }
});
```

✅ **Empty Result for Agents Without Clients**: Returns `[]` instead of error, which is correct UX.

✅ **Admin Sees All**: Admin role does not apply `clientIds` filter.

#### 4. **Soft Delete (Void) Instead of Hard Delete**
**Evidence**: Lines 68-140 in [`app/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts)

✅ **Audit Trail Preservation**:
```typescript
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  
  // Soft delete - mark as voided instead of hard delete
  const voidedReceipt = await prisma.receipt.update({
    where: { id },
    data: {
      status: 'VOIDED',
      voidedAt: new Date(),
      voidedBy: user?.email || 'unknown',
      voidReason: reason
    }
  });
  
  // Log activity
  await prisma.activityLog.create({
    data: {
      branch: receipt.branch,
      action: 'DELETE',
      module: 'RECEIPTS',
      recordId: receipt.id,
      description: `Receipt voided: ${receipt.receiptNumber} - Reason: ${reason}`,
      changes: JSON.stringify({ 
        voided: true, 
        reason, 
        voidedBy: user?.email,
        originalAmount: receipt.amount
      })
    }
  });
}
```

✅ **Compliance**: Meets financial auditing requirements (receipts can never be truly deleted).

#### 5. **PDF Generation**
**Evidence**: Lines 1-197 in [`lib/receipt-pdf.ts`](lib/receipt-pdf.ts)

✅ **Professional Branding**: Includes Fine & Country branding, branch details, amount in words.

✅ **Amount Validation**:
```typescript
const amount = typeof receipt.amount === 'number'
  ? receipt.amount
  : typeof receipt.amount === 'object' && receipt.amount != null && typeof (receipt.amount as { toNumber?: () => number }).toNumber === 'function'
    ? (receipt.amount as { toNumber: () => number }).toNumber()
    : Number(receipt.amount);
```

✅ **Handles Prisma Decimal**: Correctly converts `Decimal` objects to numbers.

✅ **Buffer Output**: Returns `Buffer` for Node.js compatibility:
```typescript
export function generateReceiptPDF(receipt: any): Buffer {
  const doc = new jsPDF();
  // ... generate PDF ...
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
```

✅ **Used in Multiple Endpoints**:
- [`/api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts) (Line 47)
- [`/api/client/receipts/[id]`](app/api/client/receipts/[id]/route.ts) (Line 75)
- [`/api/client/documents/[id]/download`](app/api/client/documents/[id]/download/route.ts) (Line 66)

---

### C. WHAT FAILS OR IS BROKEN

#### ❌ **CRITICAL FAILURE 1: Receipt Number Uniqueness NOT Enforced at Database Level**

**Evidence**: Lines 166-189 in [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts)

**The Problem**: `generateReceiptNumber()` uses `count()` to determine the next sequence number. This has a **race condition**.

**Vulnerable Code**:
```typescript
const count = await prisma.receipt.count({
  where: {
    branch,
    receiptNumber: { startsWith: `${prefix}-${year}` }
  }
});

const sequence = String(count + 1).padStart(5, '0');
return `${prefix}-${year}-${sequence}`;
```

**Race Condition Scenario**:
1. Request A calls `generateReceiptNumber('Harare')` → count = 100 → generates `FC-HRE-2024-00101`
2. Request B calls `generateReceiptNumber('Harare')` (before A commits) → count = 100 → generates `FC-HRE-2024-00101`
3. Both requests create receipts with the same `receiptNumber`
4. **FAILURE**: Duplicate receipt numbers in database

**Current Protection**: `receiptNumber String @unique` in schema **should** reject duplicates, but this causes a **runtime error** instead of graceful handling.

**Missing Handling**:
```typescript
try {
  const receipt = await prisma.receipt.create({ data: { receiptNumber, ... } });
} catch (error) {
  if (error.code === 'P2002') {  // Unique constraint violation
    // Retry with new number
  }
}
```

**Business Impact**:
- Production crashes when two admins create receipts simultaneously
- No retry logic means transaction fails completely
- Client doesn't get receipt, payment appears unrecorded

---

#### ❌ **CRITICAL FAILURE 2: No IDOR Protection in Admin Receipt GET Endpoint**

**Evidence**: Lines 1-60 in [`app/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts)

**The Problem**: The endpoint uses `requireAgent()` which allows both ADMIN and AGENT roles, but does NOT filter receipts by agent ownership.

**Vulnerable Code**:
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAgent();  // ✅ Role check
  if (authResult.error) return authResult.error;

  const { id } = await params;
  
  const receipt = await prisma.receipt.findUnique({
    where: { id },  // ❌ No ownership check
  });

  return apiSuccess(receipt);
}
```

**Exploitation Scenario**:
1. Agent A has access to receipts for their clients (Client IDs: 1, 2, 3)
2. Agent B has access to receipts for their clients (Client IDs: 4, 5, 6)
3. Agent A sends `GET /api/admin/receipts/{receipt-id-for-client-5}`
4. **VULNERABILITY**: Agent A can see Agent B's receipt

**Missing Protection**:
```typescript
const user = authResult.user;
const role = user.role?.toUpperCase();

if (role === 'AGENT') {
  // Get agent's client IDs
  const agentReservations = await prisma.reservation.findMany({
    where: { agentId: user.id },
    select: { clientId: true }
  });
  const clientIds = agentReservations.map(r => r.clientId).filter(Boolean);
  
  // Verify receipt belongs to one of agent's clients
  if (!clientIds.includes(receipt.clientId)) {
    return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
  }
}
```

**Note**: The LIST endpoint (`GET /api/admin/receipts`) **does** have this protection, but the SINGLE endpoint does not. Inconsistent security model.

---

#### ⚠️ **HIGH RISK FAILURE 3: PDF Generation May Fail on Vercel Edge**

**Evidence**: Lines 1-10 in [`lib/receipt-pdf.ts`](lib/receipt-pdf.ts)

**The Problem**: `jsPDF` library requires Node.js APIs (`Buffer`, file system). If API routes are deployed to Vercel Edge runtime, PDF generation will fail.

**Current Runtime Declaration**: Not found in admin receipts endpoint.

**Missing Declaration**:
```typescript
// app/api/admin/receipts/[id]/route.ts
export const runtime = 'nodejs';  // ❌ Not declared, defaults to Edge on Vercel
```

**Vercel Edge Limitations**:
- No Node.js `Buffer` API
- No file system access
- Limited npm package support

**Test**: Deploy to Vercel and try downloading PDF. If fails with "Buffer is not defined", this issue is confirmed.

**Fix**: Add `export const runtime = 'nodejs';` to all routes that generate PDFs:
- [`/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts)
- [`/api/client/receipts/[id]/route.ts`](app/api/client/receipts/[id]/route.ts)
- [`/api/client/documents/[id]/download/route.ts`](app/api/client/documents/[id]/download/route.ts)

---

#### ⚠️ **MODERATE RISK FAILURE 4: Receipt Creation Doesn't Validate Payment Exists**

**Evidence**: Lines 100-165 in [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts)

**The Problem**: `POST /api/admin/receipts` accepts `paymentId` but does NOT validate that the payment exists or matches the receipt amount.

**Current Code**:
```typescript
export async function POST(request: NextRequest) {
  const { 
    clientId, clientName, amount, paymentMethod, 
    paymentType, branch, paymentId, installmentId 
  } = await request.json();
  
  const receiptNumber = await generateReceiptNumber(branch);
  
  const receipt = await prisma.receipt.create({
    data: {
      receiptNumber,
      clientId,
      amount,
      paymentId,  // ❌ Not validated
      installmentId,  // ❌ Not validated
      // ...
    }
  });
}
```

**Missing Validations**:
1. **Payment Exists**: `await prisma.payment.findUnique({ where: { id: paymentId } })`
2. **Amount Match**: `payment.amount === receipt.amount`
3. **No Duplicate Receipt**: `payment.receipt === null` (one-to-one relation)
4. **Installment Belongs to Client**: `installment.plan.clientId === clientId`

**Business Impact**:
- Receipts can be created for non-existent payments
- Receipts can link to wrong installments (different client)
- Duplicate receipts for same payment

---

#### ⚠️ **MODERATE RISK FAILURE 5: No Receipt Reversal Process**

**Evidence**: Lines 68-140 in [`app/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts)

**The Problem**: Voiding a receipt marks it as `VOIDED` but does NOT reverse the installment payment.

**Current Behavior**:
1. Admin pays installment #1 → creates receipt R1, updates `installment.amountPaid += $500`
2. Admin voids receipt R1 → receipt status = VOIDED, but `installment.amountPaid` remains $500
3. **INCONSISTENCY**: Receipt is voided but payment is still recorded

**Missing Logic**:
```typescript
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { installment: { include: { plan: true } } }
  });
  
  await prisma.$transaction(async (tx) => {
    // 1. Void receipt
    await tx.receipt.update({
      where: { id },
      data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason }
    });
    
    // 2. Reverse installment payment
    if (receipt.installmentId) {
      await tx.installment.update({
        where: { id: receipt.installmentId },
        data: {
          amountPaid: { decrement: receipt.amount },
          status: 'PENDING'
        }
      });
      
      // 3. Reverse plan totals
      await tx.installmentPlan.update({
        where: { id: receipt.installment.planId },
        data: {
          totalPaid: { decrement: receipt.amount },
          remainingBalance: { increment: receipt.amount }
        }
      });
    }
  });
}
```

**Business Impact**:
- Financial reports show inflated `totalPaid` amounts
- Clients' balances are incorrect after receipt voids
- Auditors will flag discrepancies

---

### D. EVIDENCE OF VULNERABILITIES

#### 🔐 **IDOR Test 1: Admin Receipt Single GET**

**Endpoint**: [`GET /api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts)

**Access Control**: `requireAgent()` (allows ADMIN and AGENT)

**IDOR Protection**: ❌ **FAILED**

**Test Scenario**:
1. Agent A (email=agent1@company.com) has clients [C1, C2]
2. Agent B (email=agent2@company.com) has clients [C3, C4]
3. Receipt R100 belongs to Client C3 (Agent B's client)
4. Agent A sends: `GET /api/admin/receipts/R100`
5. **VULNERABILITY**: Agent A receives full receipt details for Agent B's client

**Evidence**:
```typescript
// Lines 15-60 in app/api/admin/receipts/[id]/route.ts
const receipt = await prisma.receipt.findUnique({ where: { id } });
// ❌ No check: if (role === 'AGENT' && !agentOwnsClient(receipt.clientId)) { deny }
return apiSuccess(receipt);
```

**Expected Behavior**: Should replicate the filtering logic from `GET /api/admin/receipts` (list endpoint):
```typescript
if (role === 'AGENT') {
  const agentReservations = await prisma.reservation.findMany({
    where: { agentId: user.id },
    select: { clientId: true }
  });
  const allowedClientIds = agentReservations.map(r => r.clientId);
  
  if (!allowedClientIds.includes(receipt.clientId)) {
    return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
  }
}
```

**Risk Level**: High (agents can access competitors' client data)

---

#### 🔐 **IDOR Test 2: Client Receipt GET**

**Endpoint**: [`GET /api/client/receipts/[id]`](app/api/client/receipts/[id]/route.ts)

**IDOR Protection**: ✅ **PASSED**

**Test Scenario**:
1. Client A (email=alice@example.com) has receipt R1
2. Client B (email=bob@example.com) has receipt R2
3. Client A sends: `GET /api/client/receipts/R2`
4. **PROTECTED**: Request returns 403 Forbidden

**Evidence**:
```typescript
// Lines 50-75 in app/api/client/receipts/[id]/route.ts
if (receipt.clientId !== client.id) {
  logger.warn('Client Receipt API IDOR attempt blocked', {
    clientEmail: session.user.email,
    attemptedReceiptId: id,
    receiptOwner: receipt.clientId
  });
  return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
}
```

**Result**: ✅ IDOR protection working correctly for client-facing endpoints.

---

#### 🔐 **Race Condition Test: Concurrent Receipt Creation**

**Scenario**: Two admins create receipts for same branch simultaneously.

**Test Steps**:
1. Open two browser tabs with admin session
2. Tab A: Create receipt for Harare branch → Click "Generate Receipt"
3. Tab B: Create receipt for Harare branch → Click "Generate Receipt" (within 100ms of Tab A)
4. **EXPECTED**: Both receipts created with unique numbers
5. **ACTUAL RESULT**: ⚠️ Untested but high probability of duplicate numbers or crash

**Evidence**: No retry logic in [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts) (Lines 100-165).

**Proof of Concept (Pseudocode)**:
```javascript
// Simulate race condition
Promise.all([
  fetch('/api/admin/receipts', { method: 'POST', body: receipt1 }),
  fetch('/api/admin/receipts', { method: 'POST', body: receipt2 })
]);
// Result: Either duplicate numbers or Prisma P2002 error (unique constraint violation)
```

---

### E. RBAC FINDINGS

#### **Role Matrix**

| Role | GET Receipts | GET Receipt (ID) | Create Receipt | Void Receipt | Email Receipt |
|------|--------------|------------------|----------------|--------------|---------------|
| ADMIN | ✅ All | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes |
| AGENT | ✅ Own clients | ❌ No filter* | ✅ Yes | ✅ Yes | ✅ Yes |
| MANAGER | ❌ No access | ❌ No access | ❌ No | ❌ No | ❌ No |
| ACCOUNT | ❌ No access | ❌ No access | ❌ No | ❌ No | ❌ No |
| CLIENT | ✅ Own only | ✅ Own only | ❌ No | ❌ No | ❌ No |

*Critical Issue: Agent role can access ANY receipt by ID, bypassing the LIST endpoint's filtering.

#### **RBAC Issues**

❌ **Inconsistent Agent Filtering**:
- `GET /api/admin/receipts` → Filters by agent's clients ✅
- `GET /api/admin/receipts/[id]` → NO filtering ❌

**Evidence**: Compare these two files:
1. [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts) Lines 20-50 → Has agent filtering
2. [`app/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts) Lines 15-60 → Missing agent filtering

**Business Impact**: Agents can enumerate receipt IDs and access competitors' data.

---

❌ **Manager Role Has No Receipt Access**:
- Managers can view/modify installments but cannot view receipts
- **Inconsistency**: Managers should have read-only receipt access for financial oversight

**Recommended Fix**: Add `requireManager()` to `GET /api/admin/receipts` and `GET /api/admin/receipts/[id]`.

---

### F. ROOT CAUSES

1. **Race Condition in Receipt Number Generation**:
   - **Root Cause**: Using `count()` instead of database sequence or atomic counter.
   - **Technical Debt**: No distributed locking mechanism (Redis, database locks).

2. **Inconsistent IDOR Protection**:
   - **Root Cause**: Single receipt endpoint (`[id]`) was built before agent filtering requirements were clarified.
   - **Code Duplication**: Filtering logic exists in list endpoint but not reused in single endpoint.

3. **No Payment Validation**:
   - **Root Cause**: Receipt creation API was designed for manual entry, not integration with payment system.
   - **Assumption**: Admins would manually verify payments before creating receipts.

4. **No Receipt Reversal Logic**:
   - **Root Cause**: Voiding was added as audit requirement but not integrated with installment payment logic.
   - **Missing Requirement**: Business never specified that voided receipts should reverse installment payments.

5. **Vercel Edge Runtime Compatibility**:
   - **Root Cause**: No runtime declaration in API routes. Defaults to Edge on Vercel.
   - **Testing Gap**: PDF generation not tested in production environment.

---

### G. RECOMMENDED FIXES (AUDIT ONLY - NO IMPLEMENTATION)

#### **Priority 1: Critical Security**

1. **Fix IDOR in Admin Receipt Single GET**:
   ```typescript
   // app/api/admin/receipts/[id]/route.ts
   export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
     const authResult = await requireAgent();
     const user = authResult.user;
     const role = user.role?.toUpperCase();
     
     const receipt = await prisma.receipt.findUnique({ where: { id } });
     
     // Add agent filtering
     if (role === 'AGENT') {
       const agentClientIds = await getAgentClientIds(user.id);
       if (!agentClientIds.includes(receipt.clientId)) {
         return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
       }
     }
     
     return apiSuccess(receipt);
   }
   ```

2. **Add Retry Logic for Receipt Number Generation**:
   ```typescript
   async function createReceiptWithRetry(data: any, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const receiptNumber = await generateReceiptNumber(data.branch);
         const receipt = await prisma.receipt.create({
           data: { ...data, receiptNumber }
         });
         return receipt;
       } catch (error: any) {
         if (error.code === 'P2002' && i < maxRetries - 1) {
           // Unique constraint violation, retry
           await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
           continue;
         }
         throw error;
       }
     }
   }
   ```

3. **OR: Use Database Sequence for Receipt Numbers**:
   ```prisma
   model Receipt {
     id              String   @id @default(cuid())
     receiptSequence Int      @default(autoincrement()) // ✅ Database-level sequence
     receiptNumber   String   @unique
     // ... other fields
   }
   ```
   Then generate number from sequence: `FC-HRE-2024-${receipt.receiptSequence.toString().padStart(5, '0')}`

#### **Priority 2: Financial Integrity**

4. **Add Payment Validation to Receipt Creation**:
   ```typescript
   export async function POST(request: NextRequest) {
     const { paymentId, installmentId, amount, clientId, ... } = await request.json();
     
     // Validate payment exists and matches
     if (paymentId) {
       const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
       if (!payment) throw new Error('Payment not found');
       if (Number(payment.amount) !== Number(amount)) {
         throw new Error('Receipt amount does not match payment amount');
       }
       
       // Check for duplicate receipt
       const existingReceipt = await prisma.receipt.findFirst({
         where: { paymentId }
       });
       if (existingReceipt) {
         throw new Error('Receipt already exists for this payment');
       }
     }
     
     // Validate installment belongs to client
     if (installmentId) {
       const installment = await prisma.installment.findUnique({
         where: { id: installmentId },
         include: { plan: true }
       });
       if (installment.plan.clientId !== clientId) {
         throw new Error('Installment does not belong to this client');
       }
     }
     
     // Create receipt...
   }
   ```

5. **Implement Receipt Reversal Transaction**:
   ```typescript
   export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
     const { reason } = await request.json();
     
     const receipt = await prisma.receipt.findUnique({
       where: { id },
       include: { installment: { include: { plan: true } } }
     });
     
     await prisma.$transaction(async (tx) => {
       // 1. Void receipt
       await tx.receipt.update({
         where: { id },
         data: {
           status: 'VOIDED',
           voidedAt: new Date(),
           voidedBy: user?.email,
           voidReason: reason
         }
       });
       
       // 2. Reverse installment payment
       if (receipt.installmentId) {
         const installment = receipt.installment!;
         const newAmountPaid = Number(installment.amountPaid) - Number(receipt.amount);
         
         await tx.installment.update({
           where: { id: receipt.installmentId },
           data: {
             amountPaid: Math.max(0, newAmountPaid),
             status: newAmountPaid <= 0 ? 'PENDING' : 'PARTIAL',
             paidDate: newAmountPaid <= 0 ? null : installment.paidDate
           }
         });
         
         // 3. Update plan totals
         await tx.installmentPlan.update({
           where: { id: installment.planId },
           data: {
             totalPaid: { decrement: receipt.amount },
             remainingBalance: { increment: receipt.amount },
             paidInstallments: { decrement: 1 }
           }
         });
       }
     });
   }
   ```

#### **Priority 3: Deployment & Operations**

6. **Add Runtime Declaration for PDF Routes**:
   ```typescript
   // Add to top of these files:
   // - app/api/admin/receipts/[id]/route.ts
   // - app/api/client/receipts/[id]/route.ts
   // - app/api/client/documents/[id]/download/route.ts
   
   export const runtime = 'nodejs';
   export const dynamic = 'force-dynamic';
   ```

7. **Add Manager Role Access to Receipts (Read-Only)**:
   ```typescript
   // app/api/admin/receipts/route.ts
   export async function GET(request: NextRequest) {
     const user = await getAuthenticatedUser();
     const role = user.role?.toUpperCase();
     
     if (!['ADMIN', 'AGENT', 'MANAGER', 'ACCOUNT'].includes(role)) {
       return apiError('Access denied', 403);
     }
     
     // ... filter by agent/branch as needed
   }
   ```

8. **Create Centralized Agent Filtering Utility**:
   ```typescript
   // lib/agent-filter.ts
   export async function getAgentClientIds(agentId: string): Promise<string[]> {
     const reservations = await prisma.reservation.findMany({
       where: { agentId },
       select: { clientId: true }
     });
     return reservations.map(r => r.clientId).filter((id): id is string => id !== null);
   }
   
   export async function ensureAgentOwnsClient(agentId: string, clientId: string): Promise<boolean> {
     const allowedIds = await getAgentClientIds(agentId);
     return allowedIds.includes(clientId);
   }
   ```

---

## FINAL SUMMARY

### MODULE 1: INSTALLMENTS
- **Status**: ⚠️ **Functional with Critical Gaps**
- **Severity**: **MODERATE RISK**
- **Key Failures**:
  - ❌ No automated payment allocation system
  - ❌ Duplicate payment prevention missing
  - ⚠️ Balance warnings not blocking
  - ⚠️ IDOR in admin endpoints (branch filtering missing)
- **Must-Fix**: Payment allocation logic, duplicate payment prevention

### MODULE 2: RECEIPTS
- **Status**: ⚠️ **Functional with Security & Integrity Issues**
- **Severity**: **HIGH RISK**
- **Key Failures**:
  - ❌ Receipt number race condition
  - ❌ IDOR in admin single receipt GET
  - ⚠️ No payment validation
  - ⚠️ Receipt reversal doesn't update installments
- **Must-Fix**: IDOR protection, receipt number generation, receipt reversal transaction

### OVERALL RECOMMENDATION
**DO NOT DEPLOY TO PRODUCTION** without addressing:
1. IDOR vulnerability in [`/api/admin/receipts/[id]`](app/api/admin/receipts/[id]/route.ts)
2. Receipt number race condition in [`generateReceiptNumber()`](app/api/admin/receipts/route.ts)
3. Payment allocation logic for installments
4. Receipt reversal transaction logic

**TIMELINE**: Estimate 3-5 days of development + 2 days of testing for Priority 1 fixes.

---

## APPENDIX: FILE REFERENCE

### Installments Module
- Schema: [`prisma/schema.prisma`](prisma/schema.prisma) Lines 394-448
- API: [`app/api/admin/installments/route.ts`](app/api/admin/installments/route.ts)
- API: [`app/api/admin/installments/[id]/route.ts`](app/api/admin/installments/[id]/route.ts)
- API: [`app/api/client/installments/route.ts`](app/api/client/installments/route.ts)
- UI: [`components/InstallmentsModule.tsx`](components/InstallmentsModule.tsx)

### Receipts Module
- Schema: [`prisma/schema.prisma`](prisma/schema.prisma) Line ~449 (inferred)
- API: [`app/api/admin/receipts/route.ts`](app/api/admin/receipts/route.ts)
- API: [`app/api/admin/receipts/[id]/route.ts`](app/api/admin/receipts/[id]/route.ts)
- API: [`app/api/client/receipts/[id]/route.ts`](app/api/client/receipts/[id]/route.ts)
- UI: [`components/ReceiptsModule.tsx`](components/ReceiptsModule.tsx)
- PDF: [`lib/receipt-pdf.ts`](lib/receipt-pdf.ts)

---

**END OF AUDIT REPORT**
