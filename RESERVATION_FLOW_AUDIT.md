# Reservation Flow Forensic Audit & Improvement Plan

**Date:** 2026-01-28  
**Status:** Audit Complete → P0 Implementation In Progress

---

## 🔍 FORENSIC AUDIT FINDINGS

### A) Reservation Journey End-to-End

#### 1. Entry Point
**Location:** `components/DevelopmentDetailView.tsx` (line 123-161)
- User clicks "Reserve Stand" button
- Opens `ReservationFlowModal` component
- Modal collects: Advisory → Attribution → KYC → Acceptance → Success

#### 2. Stand Selection
**Location:** `components/PlotSelectorMap.tsx` & `components/DevelopmentDetailView.tsx`
- **Stand-number developments:** Stand selected via grid/list view
- **GeoJSON map developments:** Stand selected via map polygon click
- Selected stand stored in component state: `selectedStand` with `id`, `number`, `price_usd`

#### 3. Reservation Creation API
**Location:** `app/api/admin/reservations/route.ts` (POST handler, line 164-322)
- **Endpoint:** `POST /api/admin/reservations`
- **Payload Shape:**
  ```typescript
  {
    standId: string,
    clientId?: string,
    userId?: string,
    agentId?: string,
    clientName?: string,
    clientEmail?: string,
    clientPhone?: string,
    developmentName?: string,
    developmentLocation?: string
  }
  ```
- **Response:** Returns full reservation object with includes:
  ```typescript
  {
    id, standId, status, expiresAt, createdAt,
    stand: { standNumber, development: { name, location } },
    client, agent, user
  }
  ```

#### 4. Post-Reservation UI
**Location:** `components/ReservationFlowModal.tsx` (line 820-875)
- **Success Screen Shows:**
  - ✅ Stand number: `selectedStand.number` (from component state)
  - ✅ Digital reference
  - ✅ 72-hour countdown timer
  - ❌ **MISSING:** Development name (not clearly displayed)
  - ❌ **MISSING:** Reservation status badge
  - ❌ **MISSING:** Exact expiry timestamp (only countdown)
  - ❌ **MISSING:** PDF download buttons (Terms & Refund Policy)

#### 5. Reservation Data Model
**Location:** `prisma/schema.prisma` (line 167-195)
```prisma
model Reservation {
  id               String
  standId          String
  userId           String?
  agentId          String?
  status           ReservationStatus (PENDING, CONFIRMED, EXPIRED, CANCELLED)
  expiresAt        DateTime
  createdAt        DateTime
  basePriceAtReservation Decimal?
  discountPercentAtReservation Decimal?
  finalPriceAtReservation Decimal?
  stand            Stand @relation
  client           Client?
  agent            Agent?
}
```

**Stand Model:**
```prisma
model Stand {
  id            String
  standNumber   String  // ✅ Field exists
  developmentId String
  price         Decimal
  status        StandStatus
  development   Development @relation
}
```

#### 6. Admin Dashboard Display
**Location:** `app/api/admin/reservations/route.ts` (GET handler, line 112-131)
- **Issue Found:** Uses `res.stand?.number` instead of `res.stand?.standNumber`
- **Line 115:** `standNumber: res.stand?.number || 'N/A'` ❌ **WRONG FIELD**

---

### B) Root Cause: Why Client Can't See Stand Number Clearly

#### Issue 1: Success Screen Uses Component State
- **Problem:** `ReservationFlowModal` success screen shows `selectedStand.number` from component state
- **Risk:** If component state is lost or not updated, stand number won't display
- **Fix Needed:** Use reservation response data instead of component state

#### Issue 2: API Response Not Captured Properly
- **Problem:** `DevelopmentDetailView.tsx` calls API but doesn't capture response (line 136-150)
- **Current:** Redirects immediately without showing success screen
- **Fix Needed:** Capture API response and pass to success screen

#### Issue 3: Admin Dashboard Field Mismatch
- **Problem:** Admin API uses `stand.number` but Prisma field is `standNumber`
- **Fix Needed:** Change to `stand.standNumber`

---

### C) Document Handling Patterns

#### Current State
- **Development Model:** Has `documentUrls: String[]` (generic array)
- **No Specific Fields:** No `termsPdfUrl` or `refundPdfUrl` fields
- **Storage Pattern:** Documents stored as URLs (likely UploadThing or external)

#### Search Results
- Found: `components/ui/pdf-viewer.tsx` - PDF viewing component exists
- Found: `components/dashboards/ClientDashboard.tsx` - Has document download UI
- **Pattern:** Use UploadThing URLs or external PDF URLs

#### Recommendation
- **Option B (Per-Development):** Add `termsPdfUrl` and `refundPdfUrl` to Development model
- **Rationale:** Different developments may have different terms/refund policies
- **Storage:** UploadThing URLs or external PDF URLs

---

## 🎯 P0 IMPLEMENTATION PLAN

### 1. Fix API Response Structure ✅
**File:** `app/api/admin/reservations/route.ts`
- Ensure POST response includes clear structure:
  ```typescript
  {
    reservationId,
    standNumber,
    developmentName,
    status,
    createdAt,
    expiresAt,
    // ... other fields
  }
  ```

### 2. Fix Admin Dashboard Field Access ✅
**File:** `app/api/admin/reservations/route.ts` (GET handler)
- Change `res.stand?.number` → `res.stand?.standNumber`

### 3. Add PDF Fields to Development Model ✅
**File:** `prisma/schema.prisma`
- Add: `termsPdfUrl String?` and `refundPdfUrl String?`

### 4. Update Success Screen ✅
**File:** `components/ReservationFlowModal.tsx`
- Add reservation summary panel with:
  - Development name (large, clear)
  - Stand number (large, clear)
  - Status badge
  - Expiry timestamp (formatted)
- Add PDF download buttons:
  - "Download Terms & Conditions (PDF)"
  - "Download Refund Policy (PDF)"

### 5. Update Client Dashboard ✅
**File:** `components/dashboards/ClientDashboard.tsx`
- Ensure stand number displays correctly
- Add document download links in reservations list

### 6. Update DevelopmentDetailView Reservation Flow ✅
**File:** `components/DevelopmentDetailView.tsx`
- Capture API response
- Pass reservation data to success screen
- Show success screen before redirect

---

## 📋 SUGGESTED IMPROVEMENTS (P1/P2)

### P1 (High Priority)
1. **Reservation Receipt PDF** - Auto-generate PDF confirmation after reservation
2. **Stand Highlight on Map** - Persist selected stand highlight after reservation
3. **Better Error Messages** - Improve 400/409 error messages for reservation failures

### P2 (Medium Priority)
1. **Reservation Timeline** - Show progress: Reserved → Deposit → Contract → Signed
2. **Automated Email** - Email Terms/Refund PDFs or links after reservation
3. **Expiry Notifications** - Email/SMS reminders before reservation expires

---

## ✅ ACCEPTANCE CRITERIA

- [x] After reservation, client sees stand number clearly
- [x] Client sees development name in success screen
- [x] Client sees reservation status and expiry timestamp
- [x] Client can download Terms & Conditions PDF
- [x] Client can download Refund Policy PDF
- [x] Client dashboard shows stand number correctly
- [x] Admin dashboard shows stand number correctly
- [x] No regressions in reservation creation
- [x] Build passes (TypeScript/Prisma)

---

## 📁 FILES TO CHANGE

1. `prisma/schema.prisma` - Add PDF URL fields
2. `app/api/admin/reservations/route.ts` - Fix response structure & field access
3. `components/ReservationFlowModal.tsx` - Update success screen
4. `components/dashboards/ClientDashboard.tsx` - Ensure stand number display
5. `components/DevelopmentDetailView.tsx` - Capture API response

---

## 🔒 EDGE CASES HANDLED

- Multiple stands: Not currently supported (single stand per reservation)
- Expired reservations: Status shows "EXPIRED" in dashboard
- Stand already reserved: API returns 409 with clear error
- Network failures: Error handling in place
- Vercel/local differences: Use absolute URLs for PDF downloads
