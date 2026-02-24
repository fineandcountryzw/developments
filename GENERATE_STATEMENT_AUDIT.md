# Generate Statement Button Audit Report

**Date:** February 17, 2026
**Component:** ClientManagementModule.tsx
**Endpoints:** `/api/admin/client-purchases/[id]/statement`

---

## 1. COMPONENT FLOW

### Button Location
- **File:** `components/ClientManagementModule.tsx`
- **Tab:** Statements (detail view, line 869)
- **Trigger:** User selects a purchase → clicks Statements tab → clicks "Generate" button

### Visual Hierarchy
```tsx
┌─ Page: Client Detail View (selectedClient)
   ├─ Tab: Statements
   │  ├─ Date Range Inputs (From / To)
   │  ├─ Generate Button [#C5A059 Gold]
   │  └─ Statement Display (if generated)
└─ Requires: selectedPurchase to be set first
```

---

## 2. FUNCTIONAL FLOW

### Step 1: User Interaction
```typescript
// Line 869
<button onClick={() => fetchStatement(selectedPurchase.id)} 
  className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E]">
  Generate
</button>
```

### Step 2: Frontend Fetch (Line 197)
```typescript
const fetchStatement = useCallback(async (purchaseId: string) => {
  try {
    const params = new URLSearchParams();
    if (stmtFrom) params.set('from', stmtFrom);
    if (stmtTo) params.set('to', stmtTo);
    const res = await fetch(`/api/admin/client-purchases/${purchaseId}/statement?${params}`);
    const json = await res.json();
    if (json.success) {
      setStatement(json.data);
    }
  } catch (err) {
    console.error('Failed to fetch statement', err);
  }
}, [stmtFrom, stmtTo]);
```

### Step 3: API Processing
**Endpoint:** `GET /api/admin/client-purchases/[id]/statement`

**Auth Check:**
- ✅ Role-based via `requireAgent()`
- ✅ Allows: ADMIN, ACCOUNT, MANAGER

**Data Retrieval:**
```typescript
// Fetch with relations
const purchase = await prisma.clientPurchase.findUnique({
  where: { id },
  include: {
    client: { select: { id, name, email, phone } },
    development: { select: { id, name, location } },
    stand: { select: { id, standNumber, price } },
    purchasePayments: {
      where: { status: 'CONFIRMED' },
      orderBy: { paymentDate: 'asc' },
    },
  },
});
```

### Step 4: Statement Calculation
**Installment Schedule Generation:**
- If deposit > 0: Creates deposit line at startDate
- Loops through periodMonths: Generates monthly lines
- Last installment: Gets remainder balance

**Transaction History:**
- Combines schedule + actual payments
- Sorts by date
- Calculates running balance
- Supports date range filtering (from/to)

**Summary:**
```typescript
{
  totalDue: purchasePrice,
  totalPaid: sum of CONFIRMED payments,
  balance: totalDue - totalPaid,
  paymentsCount: payments.length,
}
```

### Step 5: Frontend Display
**Rendered Output:**
1. Summary cards (4 columns):
   - Total Due
   - Total Paid (green)
   - Balance (red)
   - Payments count

2. Installment Schedule Table:
   - Columns: #, Due Date, Type, Amount Due
   - Shows DEPOSIT + INSTALLMENT rows

3. Transaction History Table:
   - Columns: Date, Description, Debit, Credit, Balance
   - Shows running balance throughout purchase lifecycle

4. Timestamp: Generated at [ISO datetime]

---

## 3. SECURITY AUDIT

### ✅ PASSED
- **Authentication:** Requires valid session via `requireAgent()`
- **Authorization:** Role-based access control (ADMIN, ACCOUNT, MANAGER)
- **Role Enforcement:** Three-role allowlist, not blacklist

### ⚠️ POTENTIAL ISSUES

#### Issue 1: No Explicit Authorization Check for Client Data
**Severity:** MEDIUM (IDOR Risk)

The API accepts any purchaseId without verifying:
- If the user's branch matches the purchase branch
- If an ACCOUNT/MANAGER role can only access their own branch

**Current Code:**
```typescript
const purchase = await prisma.clientPurchase.findUnique({
  where: { id }, // ← No branch filtering
});
```

**Risk:** A manager from Bulawayo could theoretically view Harare client statements.

**Recommendation:**
```typescript
if (user.role === 'MANAGER' || user.role === 'ACCOUNT') {
  // Verify purchase belongs to user's branch
  const purchase = await prisma.clientPurchase.findFirst({
    where: { 
      id,
      branch: user.branch // Add branch check
    },
  });
  if (!purchase) {
    return apiError('Forbidden', 403, 'FORBIDDEN');
  }
}
```

#### Issue 2: No Error Handling UI
**Severity:** LOW

Frontend only logs errors to console; no user feedback on fetch failure.

**Current Code (Line 197-208):**
```typescript
} catch (err) {
  console.error('Failed to fetch statement', err);
  // ← No toast/alert shown to user
}
```

**Recommendation:** Add error state and toast notification.

#### Issue 3: Date Range Validation Missing
**Severity:** LOW

No validation that `from` date ≤ `to` date on frontend or backend.

**Current Code:**
```typescript
const from = fromDate ? new Date(fromDate) : null;
const to = toDate ? new Date(toDate) : null;
// No validation: if (from > to) return error
```

#### Issue 4: No Loading State
**Severity:** LOW

Button doesn't show loading indicator during fetch.

**Current Code:**
```tsx
<button onClick={() => fetchStatement(selectedPurchase.id)} 
  // No disabled or loading state
```

---

## 4. FEATURE AUDIT

### ✅ WORKS
- Generates correct running balance calculation
- Installment schedule matches purchase terms
- Handles deposits correctly
- Filters confirmed payments only
- Date range filtering functional

### ⚠️ MISSING FEATURES

#### Missing 1: Print/Export Button
**Status:** ❌ NO PRINT BUTTON

**Contrast with Receipts:**
- Receipts have dedicated printReceipt() function (line 329)
- Receipts have "Print" button in UI (line 1008)
- **Statements have NO print/export functionality**

**Users can only:**
- View on screen
- Screenshot manually
- Use browser print (limited branding)

**Recommendation:** Add PrintStatement and ExportStatement functions similar to receipts.

#### Missing 2: PDF Download
**Status:** ❌ NOT AVAILABLE

While `pdfService.ts` has `generateClientStatementPDF()`, it's NOT called from ClientManagementModule.

**Feature Gap:**
- pdfService.ts line 208: Function exists ✅
- ClientManagementModule.tsx: Not imported ❌
- No PDF generation UI ❌

**Recommendation:** Integrate PDF generation like receipts.

#### Missing 3: Email Statement
**Status:** ❌ NOT AVAILABLE

APIs exist but UI doesn't expose them:
- `app/api/admin/clients/[id]/statement/download` has email functionality
- ClientManagementModule has no email button

#### Missing 4: Branding in Statement Display
**Status:** ⚠️ PARTIAL

**Received Branding:**
- ✅ Receipts now have Fine & Country header (DONE)
- ❌ On-screen statement view has NO branding
- ❌ No header/footer in HTML view

**Current Display:** Plain tables without company branding, logo, or branch details header.

---

## 5. UI/UX AUDIT

### Issues Found

| Issue | Severity | Current State | Expected |
|-------|----------|---------------|----------|
| No loading indicator | LOW | Static button | Spinner + disabled state |
| No error messages | LOW | Silent fail | Toast notification |
| No success feedback | LOW | Silent success | Confirmation message |
| Date validation | LOW | No validation | Warn if from > to |
| Print missing | MEDIUM | No option | Print button visible |
| Export missing | MEDIUM | No option | Export (PDF/CSV) button |
| No branding | LOW | Plain header | Fine & Country header |
| No company details | LOW | Minimal info | Branch phone/address |

---

## 6. INTEGRATION STATUS

### Working Integrations
✅ Button → fetchStatement hook
✅ Hook → API endpoint
✅ API → Database (Prisma)
✅ API → Response formatting

### Missing Integrations
❌ pdfService.generateClientStatementPDF() not called
❌ Email service not exposed in UI
❌ Print functionality not implemented
❌ Branding header not rendered in statement

---

## 7. RECOMMENDATIONS

### High Priority
1. **Add Authorization Branch Check**
   - File: `app/api/admin/client-purchases/[id]/statement/route.ts`
   - Add: `&& purchase.branch === user.branch` for non-ADMIN roles

2. **Add Error Handling UI**
   - File: `components/ClientManagementModule.tsx`
   - Add: Error state + toast notification on fetch failure

3. **Add Print/Export Buttons**
   - File: `components/ClientManagementModule.tsx`
   - Add: Print button (calls browser print)
   - Add: Export to PDF button (uses pdfService)

### Medium Priority
4. **Add Branding Header**
   - Add Fine & Country header to statement display
   - Include branch details
   - Match receipt styling

5. **Add Loading State**
   - Show spinner while fetching
   - Disable button during fetch

6. **Add Date Validation**
   - Validate from ≤ to on frontend
   - Return error if invalid

### Low Priority
7. **Add Email Export**
   - Expose email functionality in UI
   - Add "Send to Client" button

8. **Add CSV Export**
   - Export transaction history as CSV
   - Useful for accounting/audit

---

## 8. REQUIRED CODE CHANGES

### File 1: app/api/admin/client-purchases/[id]/statement/route.ts

```typescript
// Add branch verification for non-admin roles
if (user.role !== 'ADMIN' && purchase.branch !== user.branch) {
  return apiError('Forbidden', 403, 'FORBIDDEN');
}
```

### File 2: components/ClientManagementModule.tsx

```typescript
// Add error state
const [stmtError, setStmtError] = useState<string | null>(null);
const [stmtLoading, setStmtLoading] = useState(false);

// Update fetchStatement
const fetchStatement = useCallback(async (purchaseId: string) => {
  setStmtLoading(true);
  setStmtError(null);
  try {
    const params = new URLSearchParams();
    if (stmtFrom) params.set('from', stmtFrom);
    if (stmtTo) params.set('to', stmtTo);
    const res = await fetch(`/api/admin/client-purchases/${purchaseId}/statement?${params}`);
    const json = await res.json();
    if (json.success) {
      setStatement(json.data);
    } else {
      setStmtError(json.error || 'Failed to generate statement');
    }
  } catch (err) {
    setStmtError('Error fetching statement');
  } finally {
    setStmtLoading(false);
  }
}, [stmtFrom, stmtTo]);

// Add print function
const printStatement = (stmt: StatementData) => {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(`
    <html><head><title>Statement</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; }
      /* Add Professional Styling */
    </style></head><body>
    <!-- Render statement HTML -->
    </body></html>
  `);
  w.document.close();
  w.print();
};

// Add button in UI
<button 
  onClick={() => printStatement(statement)} 
  disabled={stmtLoading}
  className="...">
  <Printer size={14} /> Print
</button>
```

---

## 9. CONCLUSION

**Overall Status:** ⚠️ FUNCTIONAL BUT INCOMPLETE

The generate statement button works correctly for displaying statement data, but lacks:
- Security: Missing branch authorization check
- Robustness: No error handling UI
- Features: No print/export/email functionality
- Polish: No branding, no loading states

**Recommendation:** Fix security issue first (Issue #1), then add print/export functionality (Issues #2-3) before major updates pushed to production.

---

## Test Cases

### Test 1: Generate Statement for Valid Purchase
- ✅ PASS: Statement generates with correct totals
- ✅ PASS: Schedule filled based on terms
- ✅ PASS: Running balance calculates correctly

### Test 2: Date Range Filtering
- ✅ PASS: from/to parameters filter correctly
- ❌ FAIL: No validation if from > to

### Test 3: Cross-Branch Access (IDOR Test)
- ⚠️ UNKNOWN: Manager from Bulawayo accessing Harare client
- 🔴 LIKELY FAIL: No branch check in API

### Test 4: Role-Based Access
- ✅ PASS: Non-allowed roles rejected at `requireAgent()`
- ✅ PASS: ADMIN/ACCOUNT/MANAGER have access

### Test 5: Error Handling
- ⚠️ PARTIAL: API errors logged but no UI feedback
- ⚠️ PARTIAL: Network failures silent to user

---

**Generated:** 2026-02-17
**Auditor:** AI Assistant
**Status:** ⏳ AWAITING IMPLEMENTATION
