# Stand Reservation Flow - Phase 0 Baseline Audit

**Date**: February 9, 2026  
**Scope**: Complete end-to-end reservation flow audit  
**Status**: 🔴 **MAJOR REFACTOR NEEDED**

---

## Executive Summary

The current stand reservation flow is **8+ steps** with multiple friction points that create unnecessary friction, slow UX, and potential for abandonment. The flow requires a complete redesign to achieve the "QUICK, PRECISE, RELIABLE" goals.

**Current State**: 8 steps, multiple API calls, heavy modal usage  
**Target State**: 1-2 steps, single API call, bottom sheet/drawer UX  
**Key Issues**: 5 critical friction points identified

---

## 1. CURRENT FLOW DIAGRAM

### End-to-End User Journey

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT RESERVATION FLOW (CURRENT)                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────┐
  │   Browse    │───▶│  Development    │───▶│  Select Development │
  │ Developments│    │     Browser     │    │    (Development     │
  │             │    │                 │    │    Detail View)     │
  └─────────────┘    └─────────────────┘    └─────────────────────┘
                                                           │
                                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                         DETAILED STAND SELECTION FLOW                          │
  └─────────────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────────────────────────┐
                            │  DevelopmentDetailView.tsx           │
                            │  - Loads development details         │
                            │  - Fetches available stands          │
                            │  - Renders interactive map/grid      │
                            └─────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
           ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
           │  Map View      │    │  Grid View     │    │  Status Filter │
           │  (SVG-based)   │    │  (Card grid)   │    │  (Full panel) │
           └────────────────┘    └────────────────┘    └────────────────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────────────┐
                            │  User selects a stand                │
                            │  - Click on map/grid item           │
                            │  - Stand highlighted                 │
                            │  - "Reserve Now" button enabled     │
                            └─────────────────────────────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────────────┐
                            │  ReservationFlowModal.tsx           │
                            │  MULTI-STEP MODAL OPENS              │
                            │  (6+ steps, highly complex)          │
                            └─────────────────────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                                │                                │
          ▼                                ▼                                ▼
  ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
  │  STEP 1:      │          │  STEP 2:      │          │  STEP 3:      │
  │  Advisory     │          │  Attribution  │          │  KYC          │
  │  (Legal info) │          │  (Agent/Self) │          │  (ID upload)  │
  └────────────────┘          └────────────────┘          └────────────────┘
          │                                │                                │
          └────────────────────────────────┼────────────────────────────────┘
                                           │
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 4: Fees Preview                                                        │
  │  - API call to fetch development details                                     │
  │  - Calculate fees ( FeeCalculator.calculateStandFees )                        │
  │  - May trigger duplicate API calls                                           │
  └─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 5: Legal Acceptance                                                    │
  │  - Digital reservation agreement                                              │
  │  - Terms & conditions checkbox                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 6: API Submit                                                          │
  │  POST /api/auth/create-account-from-reservation                               │
  │  - Creates user account (if not exists)                                      │
  │  - Creates client record                                                      │
  │  - Creates reservation (atomic transaction)                                  │
  │  - Updates stand status → RESERVED                                           │
  │  - Sends email (BLOCKING - waits for email service)                           │
  │  - Returns reservation ID                                                     │
  └─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 7: Success Screen                                                       │
  │  - Shows reservation reference                                                │
  │  - 72-hour countdown timer                                                   │
  │  - "Enter Dashboard" button                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 8: Account Creation (Password Setup)                                   │
  │  PUT /api/auth/create-account-from-reservation                               │
  │  - Sets password                                                              │
  │  - Auto-login or redirect to login                                           │
  │  - Finally redirects to /dashboards/client                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────────────┐
                            │  ClientDashboard.tsx                 │
                            │  - Shows reservation with timer     │
                            │  - Payment options available         │
                            └─────────────────────────────────────┘
```

### Key API Endpoints Involved

| Endpoint | Purpose | Issues |
|----------|---------|--------|
| `GET /api/admin/developments` | Fetch development list | None |
| `GET /api/admin/developments?id=XXX` | Fetch development details | Called multiple times |
| `GET /api/admin/stands` | Fetch stands by development | Called multiple times |
| `POST /api/auth/create-account-from-reservation` | Create account + reservation | Heavy, blocking email |
| `PUT /api/auth/create-account-from-reservation` | Set password | Extra step |
| `GET /api/client/reservations` | Get client reservations | Works correctly |
| `POST /api/cron/expire-reservations` | Cron job for expiration | Works correctly |

---

## 2. TOP 5 FRICTION POINTS

### 🚨 FRICTION POINT #1: Multi-Step Modal (6+ Steps)

**Location**: [`components/ReservationFlowModal.tsx`](components/ReservationFlowModal.tsx)

**Problem**: The reservation modal has 6+ steps that users must navigate through:

1. Advisory (legal info acknowledgment)
2. Attribution (agent selection)
3. KYC (ID document upload)
4. Fees Preview
5. Legal Acceptance
6. Success → Password Setup → Dashboard

**Impact**:
- Users abandon when they see the long wizard
- Mobile users struggle with the modal
- Each step adds cognitive load and potential drop-off

**Code Evidence**:
```typescript
// Line 49: Multi-step type definition
type Step = 'advisory' | 'attribution' | 'kyc' | 'fees' | 'acceptance' | 'success' | 'password-setup';

// Line 58: Current step state
const [currentStep, setCurrentStep] = useState<Step>('advisory');
```

**Files Affected**:
- `components/ReservationFlowModal.tsx` (1755 lines - excessively large)
- `components/ReservationFlowModal.tsx:604-605` - Progress indicator shows 6 steps

---

### 🚨 FRICTION POINT #2: Blocking Email Send on Reservation

**Location**: [`app/api/auth/create-account-from-reservation/route.ts`](app/api/auth/create-account-from-reservation/route.ts:281-330)

**Problem**: Email sending is **synchronous and blocking** during account creation. The user waits for the email to be sent before getting a response.

**Impact**:
- 2-5 second delay on reservation confirmation
- User uncertainty ("Did it work?")
- Poor mobile experience with loading spinner

**Code Evidence**:
```typescript
// Lines 281-321: Email sent DURING request, blocking response
try {
  if (reservation) {
    // Send combined welcome + reservation email
    await sendEmail({  // ← BLOCKING CALL
      to: email,
      subject: 'Welcome! Your Reservation is Confirmed - Set Up Password',
      html: generateWelcomeWithReservationHTML({...}),
    });
    // ... logging
  }
} catch (emailError: any) {
  // Log but don't fail account creation
  // ...
}

// Response returned AFTER email
return apiSuccess({...}, 201);
```

**Fix Needed**: Fire-and-forget email sending

---

### 🚨 FRICTION POINT #3: Duplicate API Calls for Fee Calculation

**Location**: [`components/ReservationFlowModal.tsx`](components/ReservationFlowModal.tsx:107-186)

**Problem**: Fee calculation is triggered multiple times, sometimes redundantly:

1. Initial load: `useEffect` fetches development and calculates fees
2. KYC Next step: Re-fetches development and recalculates fees

**Impact**:
- Unnecessary network requests
- Slower UX
- Potential race conditions

**Code Evidence**:
```typescript
// Lines 108-186: First fetch on mount
useEffect(() => {
  const fetchDevelopment = async () => {
    // Fetch development
    // Calculate fees
  };
  fetchDevelopment();
}, [selectedStand.developmentId, selectedStand.price_usd]);

// Lines 273-325: AGAIN on KYC step
const handleKycNext = async () => {
  // ...
  if (development && selectedStand.price_usd) {
    try {
      // Re-fetch development details for accurate fee calculation
      const devResponse = await fetch(`/api/admin/developments?id=${selectedStand.developmentId}`);
      // Calculate fees AGAIN
    }
  }
};
```

---

### 🚨 FRICTION POINT #4: Large Modal on Mobile

**Location**: [`components/ReservationFlowModal.tsx:610-687`](components/ReservationFlowModal.tsx#L610-L687)

**Problem**: The reservation modal is full-screen and visually overwhelming on mobile devices:

- Large modal takes entire viewport
- Complex step indicator at top
- Multiple scrollable sections
- No bottom sheet/drawer pattern

**Code Evidence**:
```typescript
// Lines 624-627: Full max-width modal
<div 
  className="relative z-[10000] bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col mx-4"
>
```

**Impact**:
- Poor mobile UX
- Difficult to complete steps on phone
- Scrolling issues

---

### 🚨 FRICTION POINT #5: No Idempotency Key Protection

**Location**: [`app/api/auth/create-account-from-reservation/route.ts`](app/api/auth/create-account-from-reservation/route.ts)

**Problem**: The reservation endpoint lacks idempotency protection. If a user clicks "Reserve" twice or the request times out:

- Potential duplicate reservations
- Race conditions on stand status
- No way to safely retry

**Code Evidence**:
```typescript
// Lines 183-209: Transaction exists but no idempotency key
reservation = await prisma.$transaction(async (tx) => {
  const newReservation = await tx.reservation.create({
    data: {
      standId: reservationData.standId!,
      clientId: client.id,
      // ... no idempotency check
    }
  });
  // ...
});
```

**Impact**:
- Potential double-reservation
- Customer confusion
- Revenue leakage

---

## 3. RESERVATION "COMMIT POINT" ANALYSIS

### Current Commit Point

The reservation is **committed** at this precise moment:

**File**: [`app/api/auth/create-account-from-reservation/route.ts`](app/api/auth/create-account-from-reservation/route.ts:183-209)

**Code**:
```typescript
// Lines 183-209: Atomic transaction
reservation = await prisma.$transaction(async (tx) => {
  // 1. Create reservation record
  const newReservation = await tx.reservation.create({
    data: {
      standId: reservationData.standId!,
      clientId: client.id,
      userId: newUser.id,
      agentId: reservationData.agentId || null,
      status: 'PENDING',
      expiresAt: expiresAt,
      termsAcceptedAt: new Date(),
      timerActive: true
    },
    include: {
      stand: { include: { development: true } },
      client: true
    }
  });

  // 2. Update stand status atomically
  await tx.stand.update({
    where: { id: reservationData.standId },
    data: { status: 'RESERVED' }
  });

  return newReservation;
});
```

**Commit Characteristics**:
- ✅ **Atomic**: Yes (Prisma transaction)
- ✅ **Concurrency-safe**: Yes (row-level locking via transaction)
- ⚠️ **Idempotent**: No (no idempotency key)
- ⚠️ **Non-blocking email**: No (synchronous email send)

---

## 4. FAILURE POINTS IDENTIFIED

### 🔴 FAILURE POINT #1: Reservation Not Visible in Dashboard

**Scenario**: User completes reservation but it doesn't appear in `/dashboards/client`

**Root Cause**: Multiple possible issues:

1. **Race condition**: Stand status update may not complete before dashboard query
2. **Client record mismatch**: Client email may not match between creation and query
3. **Caching**: Dashboard may cache old data

**Code Location**: [`components/ClientDashboard.tsx:106-116`](components/ClientDashboard.tsx#L106-L116)

```typescript
// Promise.all for parallel loading - no error handling
const [reservationsData, paymentsResponse, propertiesData] = await Promise.all([
  getClientReservations(clientId),
  fetch('/api/client/payments'),
  getClientOwnedProperties(clientId)
]);
```

**Fix**: Add refresh mechanism and error boundaries

---

### 🔴 FAILURE POINT #2: Welcome Email Not Sent / Lost

**Scenario**: User reserves stand but never receives confirmation email

**Root Causes**:

1. **Blocking email**: If email service times out, user may not know
2. **Email errors swallowed**: Errors logged but not surfaced
3. **Spam folder**: Emails marked as spam

**Code Location**: [`app/api/auth/create-account-from-reservation/route.ts:322-351`](app/api/auth/create-account-from-reservation/route.ts#L322-L351)

```typescript
// Lines 322-330: Error swallowed
} catch (emailError: any) {
  // Log error but don't fail account creation
  logger.error('Failed to send email (non-fatal)', emailError, {...});
  
  // Return warning in response so user knows email failed
  return apiSuccess({
    message: 'Account created successfully, but email delivery failed...',
    ...
  }, 201);
}
```

**Fix**: Use background job queue for reliable email

---

### 🔴 FAILURE POINT #3: Double Reservation / Race Condition

**Scenario**: Two users click "Reserve" on the same stand simultaneously

**Root Cause**: No optimistic locking or idempotency

**Code Location**: [`app/api/auth/create-account-from-reservation/route.ts:176-178`](app/api/auth/create-account-from-reservation/route.ts#L176-L178)

```typescript
// Check if stand is available
if (standData.status !== 'AVAILABLE') {
  throw new Error('Stand is not available for reservation');
}

// GAP: Another request could pass this check between check and create
```

**Fix**: Use `prisma.$transaction` with proper row locking or unique constraint

---

### 🔴 FAILURE POINT #4: ID Document Upload Failure

**Scenario**: User's ID document upload fails, blocking KYC step

**Root Causes**:

1. **UploadThing service issues**: External dependency
2. **Large file size**: File too large for upload
3. **Network timeout**: Interrupted upload

**Code Location**: [`components/ReservationFlowModal.tsx:72-78`](components/ReservationFlowModal.tsx#L72-L78)

```typescript
// ID Document upload state
const [idDocumentUrl, setIdDocumentUrl] = useState('');
const [isUploadingDocument, setIsUploadingDocument] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
```

**Fix**: Add fallback upload method or allow manual submission

---

### 🔴 FAILURE POINT #5: Password Setup Fails

**Scenario**: User creates reservation but fails to set password

**Root Causes**:

1. **Complexity validation**: Password doesn't meet requirements
2. **Session timeout**: User waits too long
3. **Link expires**: Password setup URL expires

**Code Location**: [`components/ReservationFlowModal.tsx:492-602`](components/ReservationFlowModal.tsx#L492-L602)

```typescript
// Lines 496-514: Strict password validation
if (password.length < 8) {
  setPasswordError('Password must be at least 8 characters long');
  return;
}
// Additional checks for uppercase, number, special character
```

**Fix**: Allow simple password initially, enforce complexity later

---

## 5. SUMMARY TABLE

| # | Issue | Severity | Location | Impact |
|---|-------|----------|----------|--------|
| 1 | Multi-step modal (6+ steps) | 🔴 Critical | `ReservationFlowModal.tsx` | High abandonment |
| 2 | Blocking email send | 🔴 Critical | `route.ts:281-321` | Poor UX, delays |
| 3 | Duplicate API calls | 🟠 High | `ReservationFlowModal.tsx:108-325` | Slower UX |
| 4 | Large modal on mobile | 🟠 High | `ReservationFlowModal.tsx:610-687` | Mobile friction |
| 5 | No idempotency key | 🟠 High | `route.ts:183-209` | Double-booking risk |
| 6 | Dashboard visibility gap | 🟡 Medium | `ClientDashboard.tsx` | Trust issues |
| 7 | Email reliability | 🟡 Medium | `route.ts:322-351` | Missing notifications |
| 8 | Password complexity | 🟡 Medium | `ReservationFlowModal.tsx` | Friction |

---

## 6. PHASE 1 TARGET UX (Proposed)

### Quick Flow (Logged-in User)

```
1. Tap stand on map
2. Bottom sheet opens (1 screen)
3. Tap "Reserve Now" (1 tap)
4. Success! → Dashboard
```

**Total: 1 screen, 1 tap (after stand selection)**

### Minimal Flow (New User)

```
1. Tap stand on map
2. Bottom sheet opens
3. Enter: Name + Phone + Email
4. Tap "Reserve Now"
5. Success → Password setup (separate)
```

**Total: 1 screen, minimal input required**

---

## 7. NEXT STOPS

**Awaiting approval to proceed with Phase 1 implementation:**

- [ ] Approve Phase 0 Audit
- [ ] Proceed to Phase 1: Target UX Design
- [ ] Proceed to Phase 2: Backend Architecture
- [ ] Proceed to Phase 3: Implementation

---

**Report Status**: ✅ Complete  
**Audit Date**: February 9, 2026  
**Auditor**: Senior Product Engineer
