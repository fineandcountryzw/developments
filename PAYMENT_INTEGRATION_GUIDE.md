# 💳 Payment Integration Guide

**Paynow API + Proof of Payment (POP) System**

This guide documents the complete payment infrastructure for Fine & Country Zimbabwe ERP, supporting both instant Paynow payments and manual verification workflows.

---

## 🎯 Overview

The payment system provides **two paths** for clients to complete their reservation:

1. **Paynow (Instant)** - Automated verification, timer stops immediately
2. **Manual POP Upload** - Bank transfer/RTGS/Cash, timer pauses during admin verification

---

## 🏗️ Architecture

### Components Created

| Component | Purpose | Location |
|-----------|---------|----------|
| `PaymentDashboard.tsx` | Main payment interface with method selection | `/components/` |
| `PaymentProgressTracker.tsx` | Visual journey tracker (Reserved → Paid → Verified → AOS) | `/components/` |
| `ProofOfPaymentUploader.tsx` | Secure file upload for manual payments | `/components/` |
| `ReservationTimer.tsx` | Enhanced timer with pause/resume states | `/components/` |

### Services Created

| Service | Purpose | Location |
|---------|---------|----------|
| `paynowService.ts` | Paynow API integration & callback handlers | `/services/` |
| `notificationService.ts` | Admin notifications for payment verification | `/services/` |

### Database Schema

| Migration | Purpose | Location |
|-----------|---------|----------|
| `004_payment_integration.sql` | Adds payment columns, notifications table, storage policies | `/supabase/migrations/` |

---

## 🔄 Payment Flow

### Option 1: Paynow (Instant Verification)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client clicks "Pay via Paynow"                           │
│    └─> PaymentDashboard generates reference: STAND_103_... │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. System calls initiatePaynowPayment()                     │
│    └─> POST to Paynow API with amount, email, reference    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Paynow returns payment_url                               │
│    └─> Client redirected to Paynow gateway (new window)    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Client completes payment (EcoCash, Visa, OneMoney, etc.) │
│    └─> Paynow sends callback to /api/paynow/callback       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. handlePaynowCallback() updates Supabase:                 │
│    - status = 'Paid'                                        │
│    - payment_method = 'Paynow'                              │
│    - paid_at = NOW()                                        │
│    - timer_paused = TRUE                                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Admin receives notification                              │
│    └─> "Paynow payment received, ready for AOS"            │
└─────────────────────────────────────────────────────────────┘
```

### Option 2: Manual POP Upload

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client selects payment method (Bank/RTGS/Cash)          │
│    └─> Displays relevant bank details for branch           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Client completes payment at bank/agent                   │
│    └─> Receives receipt (PDF/JPG)                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Client uploads proof via ProofOfPaymentUploader         │
│    └─> File saved to: payment-proofs/{branch_id}/{...}     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. System updates Supabase:                                 │
│    - status = 'Payment Pending Verification'                │
│    - payment_uploaded_at = NOW()                            │
│    - payment_proof_url = storage_path                       │
│    - timer_paused = TRUE ⏸️                                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Admin receives notification                              │
│    └─> "Payment verification needed - Stand 103"           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Admin verifies funds in bank account                     │
│    └─> Clicks "Verify Payment" in AdminDashboard           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. System updates Supabase:                                 │
│    - status = 'Payment Verified'                            │
│    - payment_verified_at = NOW()                            │
│    - paid_at = NOW()                                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Client notified via email: "Payment verified, AOS next" │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual States

### Timer States (Color-Coded)

| State | Color | Background | Display | Condition |
|-------|-------|------------|---------|-----------|
| **Active** | Green `#10B981` | `#ECFDF5` | "23h 45m 12s" | `> 24h remaining` |
| **Expiring Soon** | Amber `#F59E0B` | `#FFFBEB` | "12h 30m 05s" | `< 24h remaining` |
| **Payment Urgent** | Red `#DC2626` | `#FEF2F2` | "3h 15m 42s" | `< 6h remaining` |
| **Timer Paused** | Amber `#F59E0B` | `#FFFBEB` | "TIMER PAUSED" | `timer_paused = TRUE` |
| **Payment Verified** | Green `#10B981` | `#ECFDF5` | "PAID ✓" | `status = 'payment_verified'` |
| **Expired** | Red `#DC2626` | `#FEF2F2` | "EXPIRED" | `NOW() > expires_at` |

### Progress Tracker Stages

```
┌────────────┐     ┌────────────────┐     ┌──────────────┐     ┌────────────┐
│ Reserved   │ ──> │ Payment        │ ──> │ Payment      │ ──> │ AOS Issued │
│ 🕒         │     │ Uploaded 📄    │     │ Verified ✅  │     │ 🛡️         │
└────────────┘     └────────────────┘     └──────────────┘     └────────────┘
```

---

## 📊 Database Schema

### `reservations` Table (New Columns)

```sql
-- Payment tracking
status VARCHAR(50)                  -- 'reserved', 'payment_uploaded', 'payment_verified', 'aos_issued', 'expired'
payment_method VARCHAR(50)          -- 'Paynow', 'bank_transfer', 'rtgs', 'cash'
payment_reference VARCHAR(255)      -- Paynow reference or transaction ID
payment_amount DECIMAL(12,2)        -- Actual amount paid
paid_at TIMESTAMPTZ                 -- When payment was confirmed
payment_uploaded_at TIMESTAMPTZ     -- When POP was uploaded (manual only)
payment_verified_at TIMESTAMPTZ     -- When admin verified payment
payment_proof_url TEXT              -- Supabase Storage URL to receipt
timer_paused BOOLEAN                -- TRUE = paused, FALSE = active
aos_issued_at TIMESTAMPTZ           -- When AOS document was issued
```

### `notifications` Table (New)

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(100),              -- 'payment_verification_needed', 'paynow_payment_received', etc.
    title VARCHAR(255),
    message TEXT,
    data JSONB,                     -- { reservation_id, stand_number, amount, ... }
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 Supabase Storage

### Bucket: `payment-proofs`

**Structure:**
```
payment-proofs/
├── harare/
│   ├── stand_103_POP_1704067200000.pdf
│   ├── stand_105_POP_1704070800000.jpg
│   └── ...
└── bulawayo/
    ├── stand_201_POP_1704074400000.pdf
    └── ...
```

**Policies (RLS Enabled):**

1. **Client Upload** - Clients can upload to their own folder
2. **Client Read** - Clients can view their own proofs
3. **Admin Read** - Admins can view all proofs

---

## 🔧 Environment Variables

Add to `.env`:

```bash
# Paynow API Credentials
VITE_PAYNOW_INTEGRATION_ID=your_integration_id_here
VITE_PAYNOW_INTEGRATION_KEY=your_integration_key_here

# Paynow Sandbox (for testing)
VITE_PAYNOW_SANDBOX=true

# Paynow Return URLs
VITE_PAYNOW_RETURN_URL=https://yourdomain.com/payment/callback
VITE_PAYNOW_RESULT_URL=https://yourdomain.com/api/paynow/callback
```

---

## 🚀 Integration Steps

### Step 1: Run Database Migration

```bash
cd /Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp
supabase db push
```

### Step 2: Create Storage Bucket

**Supabase Dashboard:**
1. Go to Storage → Create Bucket
2. Name: `payment-proofs`
3. Public: **NO** (private bucket)
4. Enable RLS: **YES**

### Step 3: Configure Paynow

**Sandbox Testing:**
1. Register at [Paynow Developer Portal](https://developers.paynow.co.zw)
2. Create integration → Get ID & Key
3. Add to `.env` file
4. Set `VITE_PAYNOW_SANDBOX=true`

**Production:**
1. Request production credentials from Paynow
2. Update `.env` with production keys
3. Set `VITE_PAYNOW_SANDBOX=false`

### Step 4: Deploy Callback Handler

Create Supabase Edge Function:

```bash
supabase functions new paynow-callback
```

**File:** `supabase/functions/paynow-callback/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const formData = await req.formData();
  const reference = formData.get('reference');
  const status = formData.get('status');
  
  if (status === 'Paid') {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabase
      .from('reservations')
      .update({
        status: 'Paid',
        payment_method: 'Paynow',
        paid_at: new Date().toISOString(),
        timer_paused: true
      })
      .eq('payment_reference', reference);
  }
  
  return new Response('OK', { status: 200 });
});
```

Deploy:
```bash
supabase functions deploy paynow-callback
```

### Step 5: Add PaymentDashboard to Client Portal

**In `ClientDashboard.tsx`:**

```typescript
import { PaymentDashboard } from './PaymentDashboard';

// Inside component:
{reservation && (
  <PaymentDashboard
    reservationId={reservation.id}
    standId={reservation.stand_id}
    standNumber={reservation.stand_number}
    developmentName={reservation.development_name}
    branchId={userProfile.branch_id}
    amount={reservation.amount}
    pricePerSqm={reservation.price_per_sqm}
    standSize={reservation.stand_size}
    clientName={userProfile.full_name}
    clientEmail={userProfile.email}
    expiresAt={reservation.expires_at}
    currentStage={reservation.status}
    timerPaused={reservation.timer_paused}
  />
)}
```

---

## 🧪 Testing Checklist

### Paynow Flow

- [ ] Generate payment reference (format: `STAND_103_1704067200_A1B2C3`)
- [ ] Redirect to Paynow payment page
- [ ] Complete test payment in sandbox
- [ ] Verify callback updates Supabase
- [ ] Confirm timer pauses after payment
- [ ] Check admin notification appears

### Manual POP Flow

- [ ] Select payment method (Bank Transfer/RTGS/Cash)
- [ ] Upload PDF receipt (max 5MB)
- [ ] Verify file saved to correct bucket path
- [ ] Confirm timer pauses immediately
- [ ] Check status = "Payment Pending Verification"
- [ ] Verify admin notification triggered
- [ ] Admin verifies payment → status updates
- [ ] Client receives confirmation email

### Timer Behavior

- [ ] Active timer shows green (> 24h)
- [ ] Timer turns amber (< 24h)
- [ ] Timer turns red (< 6h)
- [ ] Timer pauses on POP upload
- [ ] Timer shows "PAUSED" badge
- [ ] Timer shows "PAID ✓" when verified
- [ ] Expired reservations show red warning

### Progress Tracker

- [ ] Stage 1: Reserved (active)
- [ ] Stage 2: Payment Uploaded (after POP)
- [ ] Stage 3: Payment Verified (admin confirms)
- [ ] Stage 4: AOS Issued (final stage)
- [ ] Mobile view displays vertical list
- [ ] Desktop view displays horizontal bar

---

## 🐛 Troubleshooting

### Issue: Paynow Payment Not Updating

**Symptoms:** Payment succeeds on Paynow but reservation status doesn't change

**Solution:**
1. Check Edge Function logs: `supabase functions logs paynow-callback`
2. Verify callback URL is correct in Paynow dashboard
3. Ensure `payment_reference` matches database record
4. Check CORS policy allows Paynow domain

### Issue: POP Upload Fails

**Symptoms:** File upload returns 403 or 401 error

**Solution:**
1. Verify storage bucket exists: `payment-proofs`
2. Check RLS policies are enabled
3. Ensure user is authenticated
4. Confirm file size < 5MB
5. Check file type is PDF/JPG/PNG

### Issue: Timer Not Pausing

**Symptoms:** Timer continues after POP upload

**Solution:**
1. Check `timer_paused` column updated: `SELECT timer_paused FROM reservations WHERE id = ...`
2. Verify `ReservationTimer` component receives `timerPaused` prop
3. Ensure `useReservationTimer` hook checks paused state
4. Check forensic logs: `[FORENSIC][POP_UPLOAD_SUCCESS]`

### Issue: Admin Not Receiving Notifications

**Symptoms:** No notifications appear after payment events

**Solution:**
1. Verify admin users exist with correct `branch_id`
2. Check `notifications` table: `SELECT * FROM notifications ORDER BY created_at DESC`
3. Ensure `triggerAdminNotification()` is called
4. Check user role = 'admin'
5. Verify NotificationBell component is mounted

---

## 📈 Performance Optimizations

### Database Indexes

```sql
-- Fast status queries
CREATE INDEX idx_reservations_status ON reservations(status);

-- Fast branch filtering
CREATE INDEX idx_reservations_branch ON reservations(branch_id);

-- Fast user notifications
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

### Caching Strategy

**Timer Data:**
- Cache `expires_at` in localStorage for offline display
- Invalidate on payment success
- Refetch every 60 seconds for accuracy

**Notification Count:**
- Cache unread count for 30 seconds
- Use Supabase realtime subscriptions for updates

---

## 🔮 Future Enhancements

### Phase 2 Features

- [ ] **Installment Plans** - Split payments over 3/6/12 months
- [ ] **EcoCash Direct** - Integrate EcoCash API for USSD payments
- [ ] **Crypto Payments** - Accept Bitcoin/USDC via BitPesa
- [ ] **Payment Reminders** - SMS/Email at 48h, 24h, 6h remaining
- [ ] **Partial Payments** - Accept deposits, track balance owing
- [ ] **Refund System** - Process refunds for cancelled reservations

### Admin Tools

- [ ] **Bulk Verification** - Verify multiple payments at once
- [ ] **Payment Analytics** - Dashboard showing conversion rates
- [ ] **Fraud Detection** - Flag suspicious payment patterns
- [ ] **Receipt Generator** - Auto-generate branded receipts

---

## 📞 Support

**Technical Issues:**
- Check forensic logs: `console.log('[FORENSIC]')`
- Review Supabase logs: Dashboard → Logs
- Test in sandbox mode first

**Paynow Support:**
- Email: support@paynow.co.zw
- Docs: https://developers.paynow.co.zw/docs

**System Admins:**
- Harare: admin@fineandcountry.co.zw
- Bulawayo: bulawayo@fineandcountry.co.zw

---

## ✅ Deployment Checklist

**Pre-Production:**
- [x] Database migration applied
- [x] Storage bucket created with RLS
- [ ] Paynow sandbox credentials configured
- [ ] Edge Function deployed
- [ ] Bank details updated for both branches
- [ ] Test Paynow payment flow
- [ ] Test POP upload flow
- [ ] Verify timer pause/resume
- [ ] Test admin notifications
- [ ] Mobile responsive testing

**Production:**
- [ ] Switch to Paynow production credentials
- [ ] Update callback URLs to production domain
- [ ] Configure email notifications
- [ ] Train admins on verification workflow
- [ ] Monitor first 10 transactions
- [ ] Set up error alerting (Sentry)
- [ ] Document bank reconciliation process

---

**Last Updated:** December 28, 2025  
**Version:** 2.7.0  
**Author:** Fine & Country Zimbabwe Dev Team
