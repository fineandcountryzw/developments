# Reservation Terms & Submit Buttons Audit Report
**Date:** January 26, 2026  
**Status:** 🔴 Critical Issues Found

---

## Executive Summary

This audit identifies two critical issues:
1. **Reservation terms are hardcoded** - Deposit percentages and payment terms are not pulled from development-specific data
2. **Submit buttons are inconsistent** - Many submit buttons use non-gold colors (red, purple, blue) instead of the brand gold (`fcGold`)

---

## 🔴 Issue #1: Reservation Terms Not Development-Specific

### Problem
Reservation terms (deposit percentages, installment periods) are hardcoded instead of being pulled from each development's configuration.

### Current State

#### 1. Hardcoded Deposit Percentage
**File:** `components/ReservationFlowModal.tsx` (Line 617)
```tsx
<p>2.1. A minimum deposit of 10% (${(selectedStand.price_usd * 0.1).toLocaleString()} USD) must be paid within the 72-hour window.</p>
```
- ❌ Hardcoded to 10% regardless of development
- ❌ Should use `development.depositPercentage` from database

#### 2. API Defaults
**File:** `app/api/reservations/with-fees/route.ts` (Lines 28-29)
```tsx
depositPercent = 30,
installmentMonths = 24,
```
- ❌ Defaults to 30% deposit and 24 months
- ❌ Should fetch from `stand.development.depositPercentage` and `stand.development.installmentPeriods`

#### 3. Missing Development Data in Components
**Files:**
- `components/ReservationFlowModal.tsx` - Only receives `selectedStand` without development data
- `components/ReservationDrawer.tsx` - Same issue
- `components/ReservationModal.tsx` - Same issue

**Current Interface:**
```tsx
interface ReservationFlowModalProps {
  selectedStand: {
    id: string;
    number: string;
    price_usd: number;
    developmentName?: string; // Only name, no deposit/terms data
  };
}
```

### Database Schema (Correct)
**File:** `prisma/schema.prisma` (Lines 100-101)
```prisma
installmentPeriods Int[]            @default([12, 24, 48]) @map("installment_periods")
depositPercentage  Decimal          @default(30) @map("deposit_percentage") @db.Decimal(5, 2)
```
✅ Database has the correct fields

### Impact
- **Business Logic Error:** Different developments may have different deposit requirements (10%, 15%, 20%, 30%, etc.)
- **Legal Risk:** Terms displayed to users may not match actual contract terms
- **User Confusion:** Users see incorrect deposit amounts
- **Payment Processing:** Incorrect deposit calculations

---

## 🔴 Issue #2: Submit Buttons Not Gold

### Problem
Submit buttons throughout the application use various colors (red, purple, blue) instead of the brand gold color (`fcGold`).

### Current State

#### Non-Gold Submit Buttons Found:

1. **ReservationFlowModal.tsx**
   - Line 768: `bg-purple-600` (KYC step submit)
   - Line 782: `bg-red-600` (Acceptance step submit)

2. **app/request-access/page.tsx**
   - Line 223: `bg-blue-600` (Request access submit)

3. **Other Potential Issues:**
   - Various form submit buttons may not be using gold
   - Need comprehensive audit of all submit buttons

### Brand Standard
**File:** `components/ui/button.tsx` (Line 14)
```tsx
default: 'bg-fcGold text-white hover:bg-opacity-90',
```
✅ Gold is the default button variant

### Impact
- **Brand Inconsistency:** UI doesn't match brand guidelines
- **User Experience:** Inconsistent visual language
- **Accessibility:** May confuse users about primary actions

---

## 📋 Implementation Plan

### Phase 1: Fix Reservation Terms (Development-Specific)

#### Step 1.1: Update Component Interfaces
**Files to modify:**
- `components/ReservationFlowModal.tsx`
- `components/ReservationDrawer.tsx`
- `components/ReservationModal.tsx`

**Changes:**
```tsx
interface ReservationFlowModalProps {
  selectedStand: {
    id: string;
    number: string;
    price_usd: number;
    price_per_sqm?: number;
    area_sqm?: number;
    developmentName?: string;
    developmentId?: string; // ADD THIS
  };
  development?: { // ADD THIS OPTIONAL PROP
    id: string;
    name: string;
    depositPercentage: number;
    installmentPeriods: number[];
    payment_terms_url?: string;
    refund_policy_url?: string;
  };
}
```

#### Step 1.2: Fetch Development Data in Components
**Files:** All reservation components

**Strategy Options:**

**Option A: Pass development data from parent**
- Modify parent components to fetch and pass development data
- Pros: Explicit, type-safe
- Cons: Requires changes to multiple parent components

**Option B: Fetch development data inside reservation components**
- Use `developmentId` or `stand.developmentId` to fetch development
- Pros: Self-contained, less parent changes
- Cons: Additional API calls

**Recommended:** Option B (fetch inside components) for better encapsulation

**Implementation:**
```tsx
// In ReservationFlowModal.tsx
const [development, setDevelopment] = useState<Development | null>(null);

useEffect(() => {
  const fetchDevelopment = async () => {
    if (selectedStand.developmentId) {
      try {
        const response = await fetch(`/api/admin/developments?id=${selectedStand.developmentId}`);
        if (response.ok) {
          const data = await response.json();
          setDevelopment(data.data?.[0] || null);
        }
      } catch (error) {
        logger.error('Failed to fetch development', error);
      }
    }
  };
  fetchDevelopment();
}, [selectedStand.developmentId]);
```

#### Step 1.3: Update Terms Display
**File:** `components/ReservationFlowModal.tsx` (Line 617)

**Before:**
```tsx
<p>2.1. A minimum deposit of 10% (${(selectedStand.price_usd * 0.1).toLocaleString()} USD) must be paid within the 72-hour window.</p>
```

**After:**
```tsx
{(() => {
  const depositPercent = development?.depositPercentage || 30;
  const depositAmount = (selectedStand.price_usd * depositPercent / 100);
  return (
    <p>2.1. A minimum deposit of {depositPercent}% (${depositAmount.toLocaleString()} USD) must be paid within the 72-hour window.</p>
  );
})()}
```

#### Step 1.4: Update API Defaults
**File:** `app/api/reservations/with-fees/route.ts`

**Before:**
```tsx
depositPercent = 30,
installmentMonths = 24,
```

**After:**
```tsx
// Fetch from development if not provided
const depositPercent = body.depositPercent || Number(stand.development.depositPercentage) || 30;
const installmentMonths = body.installmentMonths || (stand.development.installmentPeriods as number[])?.[0] || 24;
```

#### Step 1.5: Update Stand Data Structure
**Files:** Components that create stand objects for reservation

**Ensure stand objects include:**
```tsx
{
  id: string;
  number: string;
  price_usd: number;
  developmentId: string; // CRITICAL: Must include this
  developmentName?: string;
}
```

**Files to check:**
- `components/LandingPage.tsx` (Line 517-524)
- `components/MobileInventory.tsx`
- `components/PlotSelectorMap.tsx`
- Any component that opens reservation modals

#### Step 1.6: Add Installment Periods Display
**File:** `components/ReservationFlowModal.tsx`

**Add to terms:**
```tsx
{development?.installmentPeriods && (
  <p className="font-semibold">3. PAYMENT TERMS</p>
  <p>3.1. Available installment periods: {development.installmentPeriods.join(', ')} months</p>
  <p>3.2. Default installment period: {development.installmentPeriods[0]} months</p>
)}
```

---

### Phase 2: Fix Submit Button Colors

#### Step 2.1: Audit All Submit Buttons
**Command:**
```bash
grep -r "type=\"submit\"" components/ app/ --include="*.tsx" --include="*.ts"
grep -r "bg-.*-600.*submit\|submit.*bg-.*-600" components/ app/ --include="*.tsx" --include="*.ts" -i
```

#### Step 2.2: Fix ReservationFlowModal Buttons
**File:** `components/ReservationFlowModal.tsx`

**Line 768 (KYC step):**
```tsx
// BEFORE
className={`... bg-purple-600 hover:bg-purple-700 ...`}

// AFTER
className={`... bg-fcGold hover:bg-fcGold/90 ...`}
```

**Line 782 (Acceptance step):**
```tsx
// BEFORE
className={`... bg-red-600 hover:bg-red-700 ...`}

// AFTER
className={`... bg-fcGold hover:bg-fcGold/90 ...`}
```

#### Step 2.3: Fix Request Access Page
**File:** `app/request-access/page.tsx` (Line 223)

```tsx
// BEFORE
className="... bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 ..."

// AFTER
className="... bg-gradient-to-r from-fcGold to-[#A69566] hover:from-[#A69566] hover:to-fcGold ..."
```

#### Step 2.4: Create Submit Button Component (Optional)
**File:** `components/ui/SubmitButton.tsx` (NEW)

```tsx
import { Button } from './button';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  children,
  loading = false,
  loadingText = 'Submitting...',
  disabled,
  className,
  ...props
}) => {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
};
```

**Usage:**
```tsx
<SubmitButton loading={isSubmitting}>
  Submit Request
</SubmitButton>
```

#### Step 2.5: Comprehensive Button Audit
**Files to check:**
- All form components
- All modal components
- All dashboard components
- All admin components

**Search patterns:**
- `type="submit"`
- `onSubmit`
- `handleSubmit`
- Button components with submit-like text

---

## 🧪 Testing Plan

### Test Case 1: Development-Specific Deposit
1. Create development with `depositPercentage = 15`
2. Reserve a stand from that development
3. Verify reservation terms show 15% deposit
4. Verify deposit amount calculation is correct

### Test Case 2: Development-Specific Installment Periods
1. Create development with `installmentPeriods = [12, 36, 60]`
2. Reserve a stand from that development
3. Verify terms show correct installment options

### Test Case 3: Default Fallback
1. Reserve stand from development without depositPercentage set
2. Verify default 30% is used
3. Verify default [12, 24, 48] months are used

### Test Case 4: Submit Button Colors
1. Navigate through all forms
2. Verify all submit buttons are gold (`bg-fcGold`)
3. Verify hover states work correctly

### Test Case 5: API Consistency
1. Create reservation via API with development-specific terms
2. Verify API uses development terms, not defaults
3. Verify reservation record has correct terms

---

## 📊 Files to Modify

### Critical (Must Fix)
1. `components/ReservationFlowModal.tsx` - Terms display + button colors
2. `app/api/reservations/with-fees/route.ts` - API defaults
3. `components/LandingPage.tsx` - Stand data structure
4. `app/request-access/page.tsx` - Submit button color

### High Priority
5. `components/ReservationDrawer.tsx` - Terms display
6. `components/ReservationModal.tsx` - Terms display
7. `components/MobileInventory.tsx` - Stand data structure

### Medium Priority
8. `components/PlotSelectorMap.tsx` - Stand data structure
9. All form components - Submit button audit

---

## ✅ Success Criteria

1. ✅ All reservation terms pull from development-specific data
2. ✅ Deposit percentages are correct per development
3. ✅ Installment periods are correct per development
4. ✅ All submit buttons use gold color (`bg-fcGold`)
5. ✅ Fallback defaults work correctly
6. ✅ API uses development terms, not hardcoded defaults
7. ✅ No console errors or warnings
8. ✅ All tests pass

---

## 🚀 Implementation Order

1. **Phase 1.1-1.2:** Update interfaces and fetch development data
2. **Phase 1.3:** Update terms display in ReservationFlowModal
3. **Phase 1.4:** Update API defaults
4. **Phase 1.5:** Update stand data structures in parent components
5. **Phase 2.1-2.3:** Fix submit button colors (critical ones first)
6. **Phase 2.4-2.5:** Comprehensive button audit and standardization
7. **Testing:** Run all test cases
8. **Documentation:** Update any relevant docs

---

## 📝 Notes

- Development data should be fetched once per reservation flow, not on every render
- Consider caching development data if multiple components need it
- Ensure backward compatibility with existing reservations
- Payment terms URLs should also come from development data
- Consider adding loading states while fetching development data

---

**Next Steps:** Begin implementation with Phase 1.1-1.2 (Update interfaces and fetch development data)
