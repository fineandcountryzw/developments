# Fee Breakdown System - Comprehensive Audit Report

**Date**: February 2, 2026  
**Auditor**: GitHub Copilot  
**Status**: 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

The fee breakdown system has **critical inconsistencies** that create data integrity risks and financial calculation errors:

### 🚨 Critical Issues
1. **Reservation Missing Total Amount** - No `totalAmount` field stored during reservation creation
2. **Discount Calculation Mismatch** - Frontend vs Backend discount application differs
3. **No Fee Snapshot** - Historical fees not preserved when development settings change

### ⚠️ High Priority Issues
4. **Payment Allocation Gap** - No verification that payments match original fee breakdown
5. **VAT Calculation Ambiguity** - Unclear if VAT applies before or after discount
6. **Commission Calculation Drift** - Commission not stored at reservation time

---

## Detailed Findings

### 1. 🚨 CRITICAL: Reservation Missing Total Amount

**Location**: [app/api/agent/properties/[id]/reserve/route.ts](app/api/agent/properties/[id]/reserve/route.ts#L81-L89)

**Issue**: Reservation creation does NOT store fee breakdown or total amount:

```typescript
const reservation = await prisma.reservation.create({
  data: {
    standId: propertyId,
    clientId: clientId,
    agentId: user.id,
    status: reservationType,
    termsAcceptedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    // ❌ NO totalAmount
    // ❌ NO fee breakdown fields
    // ❌ NO deposit amount
    // ❌ NO VAT amount
  }
});
```

**Database Schema** ([prisma/schema.prisma](prisma/schema.prisma#L176-L203)):
```prisma
model Reservation {
  id               String            @id @default(cuid())
  standId          String
  basePriceAtReservation Decimal?   // ✅ Has base price
  discountPercentAtReservation Decimal? // ✅ Has discount
  finalPriceAtReservation Decimal?   // ✅ Has final price
  // ❌ MISSING: totalAmount (with all fees)
  // ❌ MISSING: vatAmount
  // ❌ MISSING: agreementOfSaleAmount
  // ❌ MISSING: endowmentAmount
  // ❌ MISSING: cessionAmount
  // ❌ MISSING: depositAmount
  // ❌ MISSING: feesSnapshot JSON
}
```

**Impact**:
- **Financial Reconciliation Impossible** - Cannot verify payments against original reservation total
- **Reporting Inaccurate** - Reports recalculate fees with current settings, not reservation-time settings
- **Audit Trail Broken** - No historical record of what client actually agreed to pay
- **Dispute Resolution Failure** - Cannot prove agreed amounts in case of client disputes

**Recommendation**:
```typescript
// ADD TO SCHEMA
model Reservation {
  // ... existing fields
  totalAmount      Decimal?   @map("total_amount") @db.Decimal(12, 2)
  depositAmount    Decimal?   @map("deposit_amount") @db.Decimal(12, 2)
  vatAmount        Decimal?   @map("vat_amount") @db.Decimal(12, 2)
  feesSnapshot     Json?      @map("fees_snapshot") // Full breakdown
}

// UPDATE RESERVATION CREATION
const fees = FeeCalculator.calculateStandFees(stand.price, development, stand);
const reservation = await prisma.reservation.create({
  data: {
    // ... existing fields
    basePriceAtReservation: fees.standPrice,
    discountPercentAtReservation: fees.discountPercent,
    finalPriceAtReservation: fees.netStandPriceAfterDiscount,
    totalAmount: fees.totalAmount,
    depositAmount: fees.depositAmount,
    vatAmount: fees.vatAmount,
    feesSnapshot: fees, // Full breakdown as JSON
  }
});
```

---

### 2. 🚨 CRITICAL: Discount Calculation Mismatch

**Issue**: Discount applied differently in different contexts.

#### Stand-Level Discount
**Schema** ([prisma/schema.prisma](prisma/schema.prisma)):
```prisma
model Stand {
  discountPercent  Decimal?  @db.Decimal(5, 2)
  discountActive   Boolean   @default(false)
}
```

#### Reservation Snapshot
```prisma
model Reservation {
  basePriceAtReservation       Decimal?
  discountPercentAtReservation Decimal?
  finalPriceAtReservation      Decimal?
}
```

**Problem**: What happens when:
1. Stand has 10% discount active at reservation time
2. Development admin disables discount after reservation
3. System recalculates fees for reporting?

**Current Behavior**:
```typescript
// lib/financials.ts - Discount calculation
const discountPercent = clampPercent(
  input.discount?.discountActive === false ? 0 : safeNumber(input.discount?.discountPercent, 0)
);
```

- ✅ Uses `discountActive` flag correctly
- ❌ But reservation doesn't snapshot this flag!
- ❌ Recalculation uses current Stand.discountActive, not reservation-time value

**Example Scenario**:
```
TIME 0: Client reserves stand
- Stand price: $100,000
- Discount: 10% (active)
- Net price: $90,000
- Total with fees: $105,000

TIME 1: Admin disables discount on stand

TIME 2: System generates client statement
- Recalculates with current settings
- Stand price: $100,000
- Discount: 0% (inactive)
- Net price: $100,000
- Total with fees: $115,000 ← WRONG! +$10,000
```

**Impact**: Financial statements show incorrect amounts, client disputes arise.

---

### 3. ⚠️ HIGH: VAT Calculation Ambiguity

**Location**: [lib/financials.ts](lib/financials.ts#L105-L143)

**Current Logic**:
```typescript
// Step 1: Calculate net price after discount
const netStandPriceAfterDiscount = basePrice - discountAmount;

// Step 2: Add fixed fees
const subTotalBeforeVAT = netStandPriceAfterDiscount + aosFee + endowmentFee + cessionFee + adminFee;

// Step 3: Apply VAT to subtotal
const vatAmount = vatEnabled ? (subTotalBeforeVAT * vatRatePercent) / 100 : 0;

// Step 4: Grand total
const grandTotal = subTotalBeforeVAT + vatAmount;
```

**Questions**:
1. ✅ Is VAT applied to discounted price? **YES** - VAT on net price + fees
2. ✅ Is VAT applied to fixed fees? **YES** - VAT includes AOS/Endowment/Cession
3. ❓ Is this Zimbabwe tax law compliant? **NEEDS VERIFICATION**
4. ❓ Should commission affect VAT? **Currently NO** - commission separate

**Potential Tax Issue**:
In some jurisdictions, discounts must be shown as line items and VAT applies to gross price minus discount. Current implementation is **functionally correct** but may need tax authority verification.

---

### 4. ⚠️ HIGH: Payment Allocation Gap

**Location**: [lib/feeCalculator.ts](lib/feeCalculator.ts#L215-L236)

**Payment Allocation Logic**:
```typescript
static allocatePayment(
  paymentAmount: number,
  feeBreakdown: FeeBreakdown
): PaymentAllocation {
  const total = feeBreakdown.totalAmount;

  // Proportional allocation
  const principalRatio = feeBreakdown.standPrice / total;
  const vatRatio = feeBreakdown.vatAmount / total;
  const agreementOfSaleRatio = feeBreakdown.agreementOfSaleAmount / total;
  // ...

  return {
    principal: paymentAmount * principalRatio,
    vat: paymentAmount * vatRatio,
    agreementOfSale: paymentAmount * agreementOfSaleRatio,
    // ...
  };
}
```

**Issue**: This function exists but is **NEVER CALLED** in payment processing!

**Search Results**: No usage found in:
- ❌ Payment creation endpoints
- ❌ Installment payment recording
- ❌ Receipt generation
- ❌ Financial reporting

**Impact**:
- Payments recorded as lump sums without fee component breakdown
- Cannot generate accurate tax reports (VAT collected per payment)
- Cannot track platform fee collection vs developer payout per payment
- Commission calculations may be inaccurate

**Recommendation**: Integrate into payment recording:
```typescript
// app/api/client/payments/route.ts (example)
const payment = await prisma.payment.create({
  data: {
    amount: paymentAmount,
    // ADD ALLOCATION FIELDS:
    principalAmount: allocation.principal,
    vatAmount: allocation.vat,
    aosAmount: allocation.agreementOfSale,
    endowmentAmount: allocation.endowment,
    cessionAmount: allocation.cession,
  }
});
```

---

### 5. ⚠️ MEDIUM: Commission Calculation Drift

**Location**: [lib/financials.ts](lib/financials.ts#L86-L99)

**Current Logic**:
```typescript
function calculateCommission(standNetPrice: number, commissionModel?: FeeConfig['commissionModel']): number {
  if (!commissionModel) {
    return round2((standNetPrice * 5) / 100); // Default 5%
  }
  if (commissionModel.type === 'fixed') {
    return round2(safeNumber(commissionModel.fixedAmount, 0));
  }
  if (commissionModel.type === 'percentage') {
    const pct = safeNumber(commissionModel.percentage, 5);
    return round2((standNetPrice * pct) / 100);
  }
  return 0;
}
```

**Issues**:
1. ❌ Commission NOT stored in Reservation model
2. ❌ If development changes commission model, historical commissions recalculate
3. ❌ Agent commission reports may show incorrect historical values

**Example Scenario**:
```
JANUARY: Agent sells stand for $100K, 5% commission = $5,000
FEBRUARY: Developer changes commission to 3% for that development
MARCH: Agent views commission report
  → System recalculates: 3% of $100K = $3,000 ← WRONG!
```

**Recommendation**: Add to Reservation:
```prisma
model Reservation {
  // ... existing fields
  commissionAmount Decimal? @map("commission_amount") @db.Decimal(12, 2)
  commissionType   String?  @map("commission_type") // 'fixed' | 'percentage'
}
```

---

### 6. ⚠️ MEDIUM: Fee Calculator Private Methods Unused

**Location**: [lib/feeCalculator.ts](lib/feeCalculator.ts#L140-L178)

**Dead Code**:
```typescript
private static calculateAgreementOfSale(standPrice: number, development: Development): number { }
private static calculateEndowment(standPrice: number, development: Development): number { }
private static calculateCession(standPrice: number, development: Development): number { }
```

**Issue**: These methods are **never called** - calculation now delegated to `lib/financials.ts`.

**Impact**:
- Code confusion - multiple calculation implementations
- Maintenance burden - need to update both locations
- Risk of divergence between implementations

**Recommendation**: Remove dead code or mark as deprecated.

---

### 7. ℹ️ LOW: Frontend Fee Display Inconsistency

**Location**: [components/StandFeeCalculator.tsx](components/StandFeeCalculator.tsx#L117-L145)

**Issue**: Fee items constructed with conditional spread operators:

```typescript
const feeItems: FeeItem[] = [
  { name: 'Stand Price', value: breakdown.standPrice },
  ...(breakdown.discountPercent && breakdown.discountPercent > 0 && (breakdown.discountAmount || 0) > 0
    ? [{ name: `Discount`, value: -(breakdown.discountAmount || 0), percentage: breakdown.discountPercent }]
    : []),
  ...(breakdown.feesEnabled.aosEnabled && breakdown.agreementOfSaleAmount > 0
    ? [{ name: 'Agreement of Sale Fee', value: breakdown.agreementOfSaleAmount }]
    : []),
  // ... more conditional fees
];
```

**Issue**: Complex boolean logic makes it hard to debug missing fees.

**Recommendation**: Simplify with explicit filtering:
```typescript
const feeItems: FeeItem[] = [
  { name: 'Stand Price', value: breakdown.standPrice, show: true },
  { name: 'Discount', value: -breakdown.discountAmount, percentage: breakdown.discountPercent, show: breakdown.discountAmount > 0 },
  { name: 'Agreement of Sale', value: breakdown.agreementOfSaleAmount, show: breakdown.feesEnabled.aosEnabled },
  // ...
].filter(item => item.show);
```

---

## Testing Gaps

### Missing Test Scenarios

1. **Fee Calculation Edge Cases**:
   - Stand price = $0
   - Discount = 100%
   - VAT rate = 0%
   - All fees disabled
   - Negative prices (error handling)

2. **Concurrency Issues**:
   - Development fee settings change during reservation flow
   - Stand discount toggled during checkout
   - Price change during reservation

3. **Rounding Errors**:
   - Total of payment allocations = original payment amount?
   - Installment plan total = grand total?
   - Commission + payout + fees = total?

4. **Historical Data Integrity**:
   - Reservation created → Development deleted → Can still retrieve fees?
   - Stand price changed → Old reservations still show original price?

---

## Data Integrity Risks

### High Risk Scenarios

1. **Reservation without fee snapshot**:
   ```sql
   -- Reservation created with no totalAmount
   SELECT * FROM reservations WHERE total_amount IS NULL;
   -- Result: ALL reservations (field doesn't exist)
   ```

2. **Payment exceeds reservation total**:
   ```sql
   -- No validation exists to check:
   SELECT r.id, 
          SUM(p.amount) as total_paid,
          r.final_price_at_reservation as reserved_price
   FROM reservations r
   JOIN payments p ON p.stand_id = r.stand_id
   GROUP BY r.id
   HAVING SUM(p.amount) > r.final_price_at_reservation;
   ```
   **Issue**: No `totalAmount` field means no way to validate overpayment!

3. **Discount changed after reservation**:
   ```sql
   -- Stand discount changed, but reservation snapshot doesn't include discountActive flag
   SELECT s.stand_number,
          s.discount_percent as current_discount,
          r.discount_percent_at_reservation as reserved_discount,
          s.discount_active as current_active_flag
   FROM stands s
   JOIN reservations r ON r.stand_id = s.id
   WHERE s.discount_active = false 
     AND r.discount_percent_at_reservation > 0;
   ```
   **Issue**: Can't tell if discount was active at reservation time!

---

## Recommendations Priority Matrix

| Priority | Issue | Effort | Impact | Timeline |
|----------|-------|--------|--------|----------|
| 🔴 **P0** | Add totalAmount to Reservation | High | Critical | Immediate |
| 🔴 **P0** | Store feesSnapshot in Reservation | Medium | Critical | Immediate |
| 🔴 **P0** | Fix discount active flag snapshot | Low | High | Immediate |
| 🟡 **P1** | Integrate payment allocation | High | High | 1 week |
| 🟡 **P1** | Store commission at reservation | Medium | High | 1 week |
| 🟡 **P1** | Add fee calculation validation tests | High | Medium | 2 weeks |
| 🟢 **P2** | Remove dead calculator methods | Low | Low | Sprint backlog |
| 🟢 **P2** | Simplify frontend fee display | Low | Low | Sprint backlog |

---

## Proposed Migration Plan

### Phase 1: Schema Enhancement (P0)
```prisma
model Reservation {
  // ... existing fields
  
  // ADD THESE FIELDS:
  totalAmount      Decimal?   @map("total_amount") @db.Decimal(12, 2)
  depositAmount    Decimal?   @map("deposit_amount") @db.Decimal(12, 2)
  vatAmount        Decimal?   @map("vat_amount") @db.Decimal(12, 2)
  subtotalAmount   Decimal?   @map("subtotal_amount") @db.Decimal(12, 2)
  
  // Fee component amounts
  aosAmount        Decimal?   @map("aos_amount") @db.Decimal(12, 2)
  endowmentAmount  Decimal?   @map("endowment_amount") @db.Decimal(12, 2)
  cessionAmount    Decimal?   @map("cession_amount") @db.Decimal(12, 2)
  adminFeeAmount   Decimal?   @map("admin_fee_amount") @db.Decimal(12, 2)
  
  // Commission tracking
  commissionAmount Decimal?   @map("commission_amount") @db.Decimal(12, 2)
  commissionType   String?    @map("commission_type")
  
  // Complete snapshot for audit
  feesSnapshot     Json?      @map("fees_snapshot")
  
  // Discount active flag snapshot
  discountActiveAtReservation Boolean? @map("discount_active_at_reservation")
}
```

### Phase 2: Update Reservation Creation (P0)
```typescript
// app/api/agent/properties/[id]/reserve/route.ts
// app/api/admin/reservations/route.ts (if exists)
// components/ReservationFlowModal.tsx

const fees = FeeCalculator.calculateStandFees(stand.price, development, stand);
const paymentTerms = FeeCalculator.calculatePaymentTerms(
  fees.totalAmount,
  development.depositPercentage,
  defaultInstallmentMonths
);

const reservation = await prisma.reservation.create({
  data: {
    // ... existing fields
    
    // Snapshot all fees
    basePriceAtReservation: fees.standPrice,
    discountPercentAtReservation: fees.discountPercent,
    discountActiveAtReservation: stand.discountActive,
    finalPriceAtReservation: fees.netStandPriceAfterDiscount,
    
    totalAmount: fees.totalAmount,
    depositAmount: paymentTerms.depositAmount,
    vatAmount: fees.vatAmount,
    subtotalAmount: fees.subtotal,
    
    aosAmount: fees.agreementOfSaleAmount,
    endowmentAmount: fees.endowmentAmount,
    cessionAmount: fees.cessionAmount,
    adminFeeAmount: fees.adminAmount,
    
    commissionAmount: fees.commissionAmount,
    commissionType: development.commissionModel?.type || 'percentage',
    
    feesSnapshot: fees, // Full JSON backup
  }
});
```

### Phase 3: Payment Allocation Integration (P1)
```typescript
// app/api/client/payments/route.ts
// Add allocation fields to Payment model

model Payment {
  // ... existing fields
  principalAmount  Decimal? @map("principal_amount") @db.Decimal(12, 2)
  vatAmount        Decimal? @map("vat_amount") @db.Decimal(12, 2)
  aosAmount        Decimal? @map("aos_amount") @db.Decimal(12, 2)
  endowmentAmount  Decimal? @map("endowment_amount") @db.Decimal(12, 2)
  cessionAmount    Decimal? @map("cession_amount") @db.Decimal(12, 2)
}

// In payment creation:
const reservation = await prisma.reservation.findFirst({
  where: { standId: payment.standId }
});
const fees = reservation.feesSnapshot as FeeBreakdown;
const allocation = FeeCalculator.allocatePayment(payment.amount, fees);

await prisma.payment.create({
  data: {
    amount: payment.amount,
    principalAmount: allocation.principal,
    vatAmount: allocation.vat,
    aosAmount: allocation.agreementOfSale,
    // ...
  }
});
```

### Phase 4: Validation & Testing (P1)
```typescript
// Add validation rules
async function validateReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      stand: true,
      payments: true,
    }
  });
  
  // Check 1: Total amount exists
  if (!reservation.totalAmount) {
    throw new Error('Reservation missing totalAmount');
  }
  
  // Check 2: Payments don't exceed total
  const totalPaid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid > reservation.totalAmount) {
    throw new Error(`Overpayment detected: ${totalPaid} > ${reservation.totalAmount}`);
  }
  
  // Check 3: Fee components sum to total
  const componentsSum = 
    reservation.finalPriceAtReservation +
    reservation.aosAmount +
    reservation.endowmentAmount +
    reservation.cessionAmount +
    reservation.adminFeeAmount +
    reservation.vatAmount;
    
  if (Math.abs(componentsSum - reservation.totalAmount) > 0.01) {
    throw new Error('Fee components don\'t sum to total');
  }
}
```

---

## Conclusion

The fee breakdown system has **critical data integrity gaps** that must be addressed immediately:

### Immediate Actions Required (This Sprint):
1. ✅ Add `totalAmount` and fee snapshot fields to Reservation model
2. ✅ Update all reservation creation endpoints to store complete fee breakdown
3. ✅ Add `discountActiveAtReservation` flag to prevent calculation drift

### Next Sprint:
4. ✅ Integrate payment allocation into payment recording
5. ✅ Add commission snapshot to reservations
6. ✅ Create validation tests for fee calculation edge cases

### Technical Debt:
7. 🔄 Remove unused calculator private methods
8. 🔄 Simplify frontend fee display logic
9. 🔄 Add comprehensive integration tests

**Risk Level**: 🔴 **HIGH** - Financial data integrity is at risk without these fixes.

**Estimated Effort**: 3-5 days for P0 items, 2 weeks for complete solution.

---

## Appendix: File References

### Core Calculation Files
- [lib/financials.ts](lib/financials.ts) - Single source of truth for totals
- [lib/feeCalculator.ts](lib/feeCalculator.ts) - Fee calculator service (delegates to financials.ts)

### API Endpoints
- [app/api/stands/[id]/fee-breakdown/route.ts](app/api/stands/[id]/fee-breakdown/route.ts) - Public fee calculator API
- [app/api/agent/properties/[id]/reserve/route.ts](app/api/agent/properties/[id]/reserve/route.ts) - Agent reservation creation

### UI Components
- [components/StandFeeCalculator.tsx](components/StandFeeCalculator.tsx) - Interactive fee calculator widget
- [components/ReservationFlowModal.tsx](components/ReservationFlowModal.tsx) - Reservation flow with fee calculation

### Database Schema
- [prisma/schema.prisma](prisma/schema.prisma#L176-L203) - Reservation model definition

---

**Report Generated**: February 2, 2026  
**Status**: ⚠️ Requires Immediate Attention
