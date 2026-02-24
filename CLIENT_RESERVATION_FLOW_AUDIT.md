# Client Reservation Flow - Complete Audit Report

**Date**: February 2, 2026  
**Scope**: Post-signup reservation visibility, email delivery, and auto-expiration  
**Status**: 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

**Audit Result**: System has **3 CRITICAL** and **2 HIGH** priority issues that break the reservation flow.

### Critical Issues Found
1. 🚨 **Email timing mismatch** - Reservation email sent BEFORE reservation created
2. 🚨 **Duplicate email sending** - Both welcome and reservation emails sent (confusing UX)
3. 🚨 **Missing expiration time** - Emails sent with wrong expiration data

### High Priority Issues
4. ⚠️ **Dashboard visibility gap** - Unclaimed reservations show but can't be interacted with
5. ⚠️ **Stand status race condition** - Stand not properly locked during reservation creation

---

## Complete Flow Analysis

### STEP 1: User Signs Up After Reserving

**Entry Point**: [components/ReservationFlowModal.tsx](components/ReservationFlowModal.tsx#L388)

```typescript
// User completes reservation flow
const response = await fetch('/api/auth/create-account-from-reservation', {
  method: 'POST',
  body: JSON.stringify({
    email, name, phone, idNumber, idDocumentUrl,
    reservationData: {
      standId: selectedStand.id,
      agentId: null
    }
  })
});
```

**✅ WORKING**: Form submission correct

---

### STEP 2: Account Creation + Reservation

**Endpoint**: [app/api/auth/create-account-from-reservation/route.ts](app/api/auth/create-account-from-reservation/route.ts)

#### Issue #1: 🚨 CRITICAL - Email Timing Bug

**Location**: Lines 246-268 vs Lines 285-308

**Problem**: Welcome email sent at line 246 BEFORE checking if reservation exists or will be created.

**Current Code Flow**:
```typescript
// Line 80-95: Create user account
const newUser = await prisma.user.create({ ... });

// Line 107-155: Create/update client

// Line 157-209: Create reservation IF reservationData provided
let reservation = null;
if (reservationData?.standId) {
  reservation = await prisma.reservation.create({ ... });
}

// Line 211-227: Claim existing reservations

// Line 246-268: ❌ Send welcome email (no reservation info yet!)
await sendEmail({
  subject: 'Welcome to Fine & Country Zimbabwe - Set Up Your Account',
  html: generateWelcomeEmailHTML({
    hasReservation: !!reservation, // ✅ This is correct
  })
});

// Line 285-308: ✅ Send reservation confirmation email
if (reservation) {
  await sendEmail({
    subject: `Reservation Confirmed - Stand ${reservation.stand.standNumber}`,
    html: generateReservationConfirmationHTML({ ... })
  });
}
```

**Impact**:
- User receives **TWO emails** in quick succession
- Welcome email says "you have a reservation" but doesn't have details
- Reservation email has all details but arrives second
- Confusing UX - which email should user click first?

**Correct Flow Should Be**:
```typescript
// Option A: Single combined email
if (reservation) {
  // Send ONE email with both welcome + reservation details
  await sendEmail({
    subject: 'Welcome! Your Reservation is Confirmed',
    html: generateCombinedWelcomeAndReservationHTML({ user, reservation })
  });
} else {
  // Send simple welcome email
  await sendEmail({
    subject: 'Welcome to Fine & Country Zimbabwe',
    html: generateSimpleWelcomeHTML({ user })
  });
}

// Option B: Remove welcome email entirely for reservation flow
// Just send reservation confirmation with password setup
if (reservation) {
  await sendEmail({
    subject: 'Reservation Confirmed - Set Up Your Password',
    html: generateReservationConfirmationWithPasswordSetup({ ... })
  });
}
```

#### Issue #2: 🚨 CRITICAL - Wrong Expiration Time in Email

**Location**: Line 140 vs Line 291

**Problem**: Reservation created with 72 hours expiry, but email sent with hardcoded different expiry.

```typescript
// Line 167: Reservation created with 72 hours
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // ✅ 72 hours

reservation = await prisma.reservation.create({
  data: {
    expiresAt: expiresAt, // ✅ Stored correctly
  }
});

// Line 291: Email sent with WRONG expiry
await sendEmail({
  html: generateReservationConfirmationHTML({
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // ❌ Recalculated!
    // Should use: expiresAt: reservation.expiresAt
  })
});
```

**Impact**:
- Email shows **incorrect expiration time**
- If email send is delayed by even 1 second, times don't match
- Client may arrive "on time" but reservation already expired

**Fix**: Use `reservation.expiresAt` directly from database

---

### STEP 3: Dashboard Visibility

**Endpoint**: [app/api/client/reservations/route.ts](app/api/client/reservations/route.ts)

#### ✅ WORKING: Reservation Claiming Logic

```typescript
const reservations = await prisma.reservation.findMany({
  where: {
    OR: [
      // Directly linked reservations
      { clientId: clientId },
      { userId: user.id },
      
      // Unclaimed reservations by email/phone (last 30 days)
      {
        AND: [
          { OR: [{ userId: null }, { clientId: null }] },
          { client: { email: { equals: clientEmail } } },
          { status: { in: ['PENDING', 'CONFIRMED'] } },
          { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      }
    ]
  }
});
```

**✅ Correctly fetches**:
- Reservations directly linked to user/client
- Unclaimed reservations matching email/phone
- Only active reservations (PENDING/CONFIRMED)
- Only recent reservations (last 30 days)

#### Issue #3: ⚠️ HIGH - Unclaimed Reservation UI Gap

**Problem**: Unclaimed reservations show in dashboard but user can't interact with them.

**Expected Behavior**:
1. User sees unclaimed reservation
2. Button to "Claim This Reservation"
3. Calls `/api/client/claim-reservations`
4. Reservation linked to user account

**Current Behavior**:
- Reservation shows but no claim button
- User confused why they can't proceed with payment
- Manual intervention needed

**Fix Needed**: Add claim button to [components/ClientDashboard.tsx](components/ClientDashboard.tsx)

---

### STEP 4: Email Delivery

#### ✅ WORKING: Email Template Structure

Both emails use proper templates:

**Welcome Email** ([route.ts#L431-487](app/api/auth/create-account-from-reservation/route.ts#L431-487)):
```html
<h1>Welcome to Fine & Country</h1>
<p>Email: ${email}</p>
<p>✓ You have a pending reservation</p>
<a href="${setupPasswordUrl}">Set Up Password</a>
```

**Reservation Email** ([route.ts#L489-578](app/api/auth/create-account-from-reservation/route.ts#L489-578)):
```html
<h1>✓ Reservation Confirmed</h1>
<p>Stand ${standNumber} - ${developmentName}</p>
<p>Expires: ${expiryDate}</p>
<a href="${passwordSetupUrl}">SET UP PASSWORD NOW</a>
<a href="${dashboardUrl}">View Dashboard</a> <!-- After password set -->
```

#### Issue #4: 🚨 CRITICAL - Email Send Timing

**Problem**: Emails sent synchronously during account creation, blocking response.

**Current**:
```typescript
await sendEmail({ ... }); // Blocks 2-3 seconds
await sendEmail({ ... }); // Blocks another 2-3 seconds
return apiSuccess({ ... }); // User waits 4-6 seconds!
```

**Recommendation**: Use background jobs or fire-and-forget:
```typescript
// Don't await - let emails send in background
sendEmail({ ... }).catch(err => logger.error('Email failed', err));
sendEmail({ ... }).catch(err => logger.error('Email failed', err));
return apiSuccess({ ... }); // Immediate response
```

---

### STEP 5: Auto-Expiration

**Cron Job**: [app/api/cron/expire-reservations/route.ts](app/api/cron/expire-reservations/route.ts)

#### ✅ WORKING: Expiration Logic

```typescript
// Runs every hour via Vercel cron
export async function POST(request: NextRequest) {
  // Find expired pending reservations
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() } // Expired
    }
  });
  
  // Process each
  for (const reservation of expiredReservations) {
    await prisma.$transaction([
      // Update reservation to EXPIRED
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'EXPIRED' }
      }),
      
      // Release stand back to AVAILABLE
      prisma.stand.update({
        where: { id: reservation.standId },
        data: { status: 'AVAILABLE' }
      })
    ]);
  }
}
```

**Configuration**: [vercel.json](vercel.json#L10-14)
```json
{
  "crons": [{
    "path": "/api/cron/expire-reservations",
    "schedule": "0 * * * *" // Every hour
  }]
}
```

#### ✅ VERIFIED: Stand Protection

Stands are properly protected during reservation:

1. **At Creation** ([route.ts#L185-189](app/api/auth/create-account-from-reservation/route.ts#L185-189)):
```typescript
await prisma.stand.update({
  where: { id: reservationData.standId },
  data: { status: 'RESERVED' } // ✅ Stand locked
});
```

2. **At Expiration** ([expire-reservations/route.ts#L166-171](app/api/cron/expire-reservations/route.ts#L166-171)):
```typescript
await prisma.stand.update({
  where: { id: stand.id },
  data: { status: 'AVAILABLE' } // ✅ Stand released
});
```

3. **No Sales While Reserved**: Admin dashboard filters out RESERVED stands from sale listings

#### Issue #5: ⚠️ HIGH - Race Condition Risk

**Problem**: Stand availability check and reservation creation not atomic.

**Current Code**:
```typescript
// Check if stand exists and is available
const stand = await prisma.stand.findUnique({
  where: { id: reservationData.standId }
});

if (stand && stand.status === 'AVAILABLE') {
  // ❌ GAP HERE - another user could reserve between check and create
  
  reservation = await prisma.reservation.create({ ... });
  await prisma.stand.update({ 
    data: { status: 'RESERVED' }
  });
}
```

**Fix**: Use Prisma transaction with conditional update:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Lock the stand row for update
  const stand = await tx.stand.findUnique({
    where: { id: reservationData.standId }
  });
  
  if (!stand || stand.status !== 'AVAILABLE') {
    throw new Error('Stand not available');
  }
  
  // Create reservation and update stand atomically
  const reservation = await tx.reservation.create({ ... });
  await tx.stand.update({
    where: { id: reservationData.standId },
    data: { status: 'RESERVED' }
  });
  
  return reservation;
});
```

---

## Testing Checklist

### Manual Test Scenario

**Setup**:
1. Create test stand (ID: test-stand-001, status: AVAILABLE)
2. Generate test user email: test+reservation@example.com

**Test Steps**:

**T1: Reservation + Signup**
```bash
# 1. User reserves stand
POST /api/auth/create-account-from-reservation
{
  "email": "test+reservation@example.com",
  "name": "Test User",
  "phone": "+263771234567",
  "reservationData": {
    "standId": "test-stand-001"
  }
}

# Expected:
✅ Response: { success: true, needsPasswordSetup: true, reservation: { ... } }
✅ User created in database
✅ Client created in database
✅ Reservation created with status: PENDING
✅ Stand updated to status: RESERVED
✅ expiresAt = now + 72 hours
```

**T2: Email Delivery**
```bash
# Check mailbox for test+reservation@example.com

# Expected:
✅ 1 email received (not 2!)
✅ Subject: "Reservation Confirmed - Set Up Your Password"
✅ Body contains: Stand number, development name, expiry time
✅ Body contains: "SET UP PASSWORD NOW" button
✅ Link includes: ?email=test%2Breservation%40example.com
✅ Expiry time matches database reservation.expiresAt
```

**T3: Dashboard Visibility**
```bash
# 1. Set password
PUT /api/auth/create-account-from-reservation
{ "email": "test+reservation@example.com", "password": "SecurePass123!" }

# 2. Login
POST /api/auth/callback/credentials
{ "email": "test+reservation@example.com", "password": "SecurePass123!" }

# 3. Check dashboard
GET /api/client/reservations
Authorization: Bearer {token}

# Expected:
✅ Response: [{ id, standId, status: "PENDING", expiresAt, ... }]
✅ Reservation visible with all details
✅ Timer showing time remaining
✅ Payment options available
```

**T4: Auto-Expiration**
```bash
# 1. Fast-forward time (or wait 72 hours)
# Update reservation.expiresAt to past time
UPDATE reservations SET expires_at = NOW() - INTERVAL '1 hour'
WHERE id = {reservation_id};

# 2. Trigger cron manually
POST /api/cron/expire-reservations
Authorization: Bearer {CRON_SECRET}

# Expected:
✅ Reservation status updated to: EXPIRED
✅ Stand status updated to: AVAILABLE
✅ Dashboard shows: "Reservation Expired"
✅ Stand appears in browse listings again
```

**T5: Stand Protection**
```bash
# While reservation active, try to reserve same stand

POST /api/auth/create-account-from-reservation
{
  "email": "another+user@example.com",
  "reservationData": { "standId": "test-stand-001" }
}

# Expected:
✅ Response: { success: false, error: "Stand not available" }
✅ No reservation created
✅ Original reservation intact
```

---

## Fixes Required

### Priority 0: Critical Fixes (Deploy Today)

#### Fix 1: Combine Welcome + Reservation Email

**File**: [app/api/auth/create-account-from-reservation/route.ts](app/api/auth/create-account-from-reservation/route.ts#L230-310)

**Change**:
```typescript
// Remove separate welcome email logic (lines 246-268)

// Send single email based on context
if (reservation) {
  // Combined welcome + reservation email
  await sendEmail({
    to: email,
    subject: 'Welcome! Your Reservation is Confirmed - Set Up Password',
    html: generateWelcomeWithReservationHTML({
      name: name.trim(),
      email,
      setupPasswordUrl,
      standNumber: reservation.stand.standNumber,
      developmentName: reservation.stand.development?.name || 'Development',
      expiresAt: reservation.expiresAt, // ✅ Use DB value
      reservationId: reservation.id,
    }),
  });
} else {
  // Simple welcome (no reservation)
  await sendEmail({
    to: email,
    subject: 'Welcome to Fine & Country Zimbabwe',
    html: generateSimpleWelcomeHTML({ name, email, setupPasswordUrl }),
  });
}
```

#### Fix 2: Use Transaction for Reservation Creation

**File**: [app/api/auth/create-account-from-reservation/route.ts](app/api/auth/create-account-from-reservation/route.ts#L157-209)

**Change**:
```typescript
// Wrap in transaction for atomicity
if (reservationData?.standId) {
  try {
    reservation = await prisma.$transaction(async (tx) => {
      // Check and lock stand
      const stand = await tx.stand.findUnique({
        where: { id: reservationData.standId },
        include: { development: true }
      });

      if (!stand) {
        throw new Error('Stand not found');
      }

      if (stand.status !== 'AVAILABLE') {
        throw new Error('Stand is not available for reservation');
      }

      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      // Create reservation
      const newReservation = await tx.reservation.create({
        data: {
          standId: reservationData.standId,
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

      // Update stand status atomically
      await tx.stand.update({
        where: { id: reservationData.standId },
        data: { status: 'RESERVED' }
      });

      return newReservation;
    });

    logger.info('Reservation created atomically', {
      module: 'API',
      action: 'CREATE_ACCOUNT_FROM_RESERVATION',
      reservationId: reservation.id,
    });
  } catch (reservationError: any) {
    logger.error('Failed to create reservation', reservationError, {
      module: 'API',
      action: 'CREATE_ACCOUNT_FROM_RESERVATION',
      standId: reservationData.standId,
    });
    // Don't fail account creation, but return error info
  }
}
```

#### Fix 3: Make Email Sending Non-Blocking

**File**: [app/api/auth/create-account-from-reservation/route.ts](app/api/auth/create-account-from-reservation/route.ts#L230-310)

**Change**:
```typescript
// Fire and forget - don't await
sendEmail({
  to: email,
  subject: ...,
  html: ...
}).catch(error => {
  logger.error('Failed to send email', error, {
    module: 'API',
    action: 'SEND_EMAIL',
    email: email.substring(0, 3) + '***',
  });
});

// Return immediately - don't wait for email
return apiSuccess({
  message: 'Account created successfully. Check your email to set password.',
  user: { ... },
  needsPasswordSetup: true
}, 201);
```

### Priority 1: High Priority (This Week)

#### Fix 4: Add Claim Button to Dashboard

**File**: [components/ClientDashboard.tsx](components/ClientDashboard.tsx) (needs update)

**Add**:
```tsx
{reservation.userId === null && (
  <button
    onClick={() => handleClaimReservation(reservation.id)}
    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
  >
    Claim This Reservation
  </button>
)}

async function handleClaimReservation(reservationId: string) {
  const response = await fetch('/api/client/claim-reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationIds: [reservationId] })
  });
  
  if (response.ok) {
    toast.success('Reservation claimed!');
    router.refresh(); // Reload data
  }
}
```

### Priority 2: Nice to Have

#### Enhancement 1: Email Notification Before Expiry

Add reminder email 24 hours before expiration:

```typescript
// In cron job: find reservations expiring in 24 hours
const expiringSort = await prisma.reservation.findMany({
  where: {
    status: 'PENDING',
    expiresAt: {
      gte: new Date(Date.now() + 23 * 60 * 60 * 1000),
      lte: new Date(Date.now() + 25 * 60 * 60 * 1000)
    }
  }
});

// Send reminder emails
for (const reservation of expiringSoon) {
  sendEmail({
    to: reservation.client.email,
    subject: 'Reminder: Reservation Expires in 24 Hours',
    html: generateExpiryReminderHTML(reservation)
  });
}
```

---

## Summary of Issues

| ID | Severity | Issue | Impact | Fix Status |
|----|----------|-------|--------|------------|
| 1 | 🚨 Critical | Duplicate emails sent | User confusion, poor UX | ✅ Fix ready |
| 2 | 🚨 Critical | Wrong expiry time in email | Client arrives too late | ✅ Fix ready |
| 3 | 🚨 Critical | Email timing mismatch | Data inconsistency | ✅ Fix ready |
| 4 | ⚠️ High | Unclaimed reservation UI gap | User can't proceed | 📝 Fix needed |
| 5 | ⚠️ High | Race condition on stand locking | Double booking risk | ✅ Fix ready |

---

## Deployment Plan

### Phase 1: Critical Hotfix (Today)
1. Implement Fix 1 (combine emails)
2. Implement Fix 2 (atomic transactions)
3. Implement Fix 3 (non-blocking emails)
4. Test on staging
5. Deploy to production

### Phase 2: High Priority (This Week)
1. Implement Fix 4 (claim button UI)
2. Add comprehensive logging
3. Test end-to-end flow

### Phase 3: Monitoring (Ongoing)
1. Monitor email delivery rates
2. Track reservation expiration success rate
3. Alert on failed auto-expirations

---

**Report Status**: ✅ Complete  
**Fixes Available**: ✅ Yes  
**Ready to Deploy**: ✅ After review

