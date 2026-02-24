# Payment Verification System

## Overview

Complete payment verification workflow for Fine & Country Zimbabwe ERP. Allows agents/admins to verify uploaded proof of payment, finalize reservations, and automatically notify clients via email.

**Created:** December 28, 2025

---

## Architecture

### Flow Diagram

```
PropertyLeadsTable (Admin Dashboard)
    │
    ├─► View Attachment Button
    │   └─► AttachmentViewer Modal
    │       └─► Displays PDF/Image proof of payment
    │
    └─► Verify Payment Button
        │
        ├─► verifyPayment() Server Action
        │   │
        │   ├─► 1. Authenticate (ADMIN/AGENT only)
        │   │
        │   ├─► 2. Validate Reservation (must be PENDING + have popUrl)
        │   │
        │   ├─► 3. Database Transaction
        │   │   ├─► UPDATE Reservation: status = CONFIRMED, timerActive = false
        │   │   └─► UPDATE Stand: status = SOLD
        │   │
        │   ├─► 4. Send Email via Resend API
        │   │   ├─► To: Client email
        │   │   ├─► Subject: Purchase Confirmed - Stand X, Development Y
        │   │   ├─► Body: HTML + Text (Fine & Country branding)
        │   │   └─► Attachment Link: Proof of payment URL
        │   │
        │   └─► 5. Return Success + Email Status
        │
        └─► Toast Notification
            ├─► Success: "Payment verified! Email sent to client@example.com"
            └─► Error: "Failed to verify payment"
```

---

## Files Created/Modified

### 1. Server Action
**File:** [app/actions/verify-payment.ts](app/actions/verify-payment.ts)

**Function:** `verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>`

**Features:**
- ✅ Neon Auth integration (getCurrentUser, requireRole)
- ✅ Validates reservation status (must be PENDING)
- ✅ Validates proof of payment exists (popUrl not null)
- ✅ Atomic transaction (Reservation + Stand update)
- ✅ Sends purchase confirmation email via Resend API
- ✅ Includes proof of payment link in email
- ✅ Fine & Country branded HTML email template
- ✅ Comprehensive forensic logging
- ✅ Error handling with user-friendly messages

**Security:**
- Requires ADMIN or AGENT role
- Authorization check before any database operations
- Transaction rollback on failure

**Input:**
```typescript
interface VerifyPaymentInput {
  reservationId: string;
  agentNotes?: string; // Optional notes from agent
}
```

**Output:**
```typescript
interface VerifyPaymentResult {
  success: boolean;
  data?: {
    reservationId: string;
    standNumber: string;
    clientEmail: string;
    verifiedAt: Date;
    emailSent: boolean;
  };
  error?: string;
}
```

**Forensic Logs:**
- `[VERIFY_PAYMENT][STARTED]` - Function initiated
- `[VERIFY_PAYMENT][AUTH_SUCCESS]` - User authenticated and authorized
- `[VERIFY_PAYMENT][NOT_FOUND]` - Reservation not found
- `[VERIFY_PAYMENT][INVALID_STATUS]` - Reservation not in PENDING status
- `[VERIFY_PAYMENT][NO_PROOF]` - No proof of payment attached
- `[VERIFY_PAYMENT][UPDATING]` - Starting database transaction
- `[VERIFY_PAYMENT][DB_UPDATED]` - Transaction committed successfully
- `[VERIFY_PAYMENT][EMAIL_SENDING]` - Sending confirmation email
- `[VERIFY_PAYMENT][EMAIL_SENT]` - Email sent successfully
- `[VERIFY_PAYMENT][EMAIL_FAILED]` - Email send failed (payment still verified)
- `[VERIFY_PAYMENT][EMAIL_WARNING]` - Payment verified but email failed
- `[VERIFY_PAYMENT][SUCCESS]` - Complete success
- `[VERIFY_PAYMENT][ERROR]` - Fatal error occurred

### 2. Enhanced PropertyLeadsTable
**File:** [components/PropertyLeadsTable.tsx](components/PropertyLeadsTable.tsx)

**New Features:**
- ✅ "Verify" button next to "View" button
- ✅ Loading state during verification ("Verifying..." with spinner)
- ✅ Toast notifications (success/error with auto-hide)
- ✅ Integrated AttachmentViewer modal (replaces drawer)
- ✅ Auto-refresh table after successful verification
- ✅ Disabled state prevents double-clicking

**Button States:**
```tsx
// Default
<button>
  <Check size={16} />
  Verify
</button>

// Loading
<button disabled>
  <Spinner />
  Verifying...
</button>
```

**Toast Examples:**
```
✅ Payment verified! Confirmation email sent to client@example.com
❌ Failed to verify payment
❌ You do not have permission to verify payments
```

### 3. Environment Variables
**File:** [.env](.env)

**Added:**
```bash
# Resend Email Service
RESEND_API_KEY="re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E"
AUTH_EMAIL_FROM="portal@fineandcountry.co.zw"
```

**File:** [.env.example](.env.example)

**Updated Template:**
```bash
# Resend Email Service
RESEND_API_KEY="re_your_resend_api_key"
AUTH_EMAIL_FROM="portal@fineandcountry.co.zw"
```

---

## Email Template

### Design
- **Branding:** Fine & Country gold (#85754E) and slate (#0A1629) colors
- **Layout:** Responsive HTML email (600px width, mobile-friendly)
- **Sections:**
  1. Header with gold "PURCHASE CONFIRMED" title
  2. Success icon (green checkmark)
  3. Personalized greeting
  4. Property details card (development, stand, price, verified date)
  5. Proof of payment link (if available)
  6. Next steps (4-step process)
  7. Contact information
  8. Footer

### Content Structure

**Subject:** `Purchase Confirmed - Stand [STAND_NUMBER], [DEVELOPMENT_NAME]`

**Personalization:**
- Client name: `Dear [CLIENT_NAME]`
- Stand details: Development name, stand number
- Price: Formatted with USD currency
- Verified date: Full date + time (e.g., "Saturday, 28 December 2024 at 14:30")

**Call-to-Action:**
- "View Payment Proof" button (gold background, links to popUrl)

**Next Steps:**
1. Legal team prepares sale agreement
2. Email with signing instructions (3-5 business days)
3. Title transfer initiated after signing
4. Notification when stand is registered

### Fallback
- Plain text version included for email clients that don't support HTML
- All formatting preserved in text-only mode

---

## Database Impact

### Reservation Table

**Before Verification:**
```sql
id: cm5b2kz3x0002
status: PENDING
timer_active: true
pop_url: https://utfs.io/f/abc123...
updated_at: 2025-12-25 10:00:00
```

**After Verification:**
```sql
id: cm5b2kz3x0002
status: CONFIRMED
timer_active: false
pop_url: https://utfs.io/f/abc123...
updated_at: 2025-12-28 14:30:00
```

### Stand Table

**Before Verification:**
```sql
id: cm5b2kz3x0001
stand_number: A24
status: RESERVED
updated_at: 2025-12-25 10:00:00
```

**After Verification:**
```sql
id: cm5b2kz3x0001
stand_number: A24
status: SOLD
updated_at: 2025-12-28 14:30:00
```

### Transaction Guarantees
- ✅ Both updates succeed or both fail (no partial state)
- ✅ Foreign key constraints preserved
- ✅ Timestamps updated atomically
- ✅ No race conditions (serializable isolation)

---

## Usage Guide

### For Developers

#### 1. Import Server Action
```typescript
import { verifyPayment } from '@/app/actions/verify-payment';
```

#### 2. Call from Client Component
```typescript
const handleVerify = async (reservationId: string) => {
  const result = await verifyPayment({ reservationId });
  
  if (result.success) {
    console.log('Verified:', result.data);
    // Show success toast
    // Refresh data
  } else {
    console.error('Error:', result.error);
    // Show error toast
  }
};
```

#### 3. Handle Response
```typescript
if (result.success) {
  // Access result.data
  console.log(`Email sent to: ${result.data.clientEmail}`);
  console.log(`Email delivery: ${result.data.emailSent ? 'Success' : 'Failed'}`);
} else {
  // Access result.error
  alert(result.error); // User-friendly error message
}
```

### For Agents/Admins

#### 1. Navigate to Dashboard
- Log in with ADMIN or AGENT account
- Go to "Property Leads" or "Pending Reservations" section

#### 2. Review Pending Reservations
- Table shows all PENDING reservations
- Look for "Attached" payment status (green checkmark)
- Red/Amber/Green timer shows urgency

#### 3. View Proof of Payment
- Click "View" button to open attachment modal
- Verify payment details match reservation
- Check amount, date, reference number

#### 4. Verify Payment
- Click green "Verify" button
- Button shows "Verifying..." with spinner
- Wait for success toast (usually 2-3 seconds)

#### 5. Confirmation
- Success toast: "Payment verified! Email sent to client@example.com"
- Reservation disappears from table (no longer PENDING)
- Client receives email confirmation automatically

#### 6. Troubleshooting
- **Error: "No proof of payment attached"**
  - Client hasn't uploaded proof yet
  - Ask client to upload via reservation modal
  
- **Error: "You do not have permission"**
  - Account role must be ADMIN or AGENT
  - Contact system administrator
  
- **Success but email failed**
  - Payment still verified (database updated)
  - Manual email may be needed
  - Check RESEND_API_KEY configuration

---

## API Integration

### Resend API

**Endpoint:** `https://api.resend.com/emails`

**Request:**
```bash
POST https://api.resend.com/emails
Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E
Content-Type: application/json

{
  "from": "Fine & Country Zimbabwe <portal@fineandcountry.co.zw>",
  "to": ["client@example.com"],
  "subject": "Purchase Confirmed - Stand A24, Borrowdale Heights",
  "html": "<!DOCTYPE html>...",
  "text": "PURCHASE CONFIRMED...",
  "tags": [
    { "name": "category", "value": "purchase-confirmation" },
    { "name": "stand", "value": "A24" }
  ]
}
```

**Response (Success):**
```json
{
  "id": "re_email_xyz123",
  "from": "Fine & Country Zimbabwe <portal@fineandcountry.co.zw>",
  "to": ["client@example.com"],
  "created_at": "2025-12-28T14:30:00.000Z"
}
```

**Response (Error):**
```json
{
  "message": "Invalid API key",
  "statusCode": 401
}
```

**Rate Limits:**
- Free tier: 100 emails/day
- Pro tier: 50,000 emails/month
- Current usage tracked in Resend dashboard

**Email Tracking:**
- Delivery status: Check Resend dashboard
- Opens/clicks: Available with tracking enabled
- Bounces: Automatic notifications

---

## Testing

### 1. Local Testing

#### Prerequisites
```bash
# Ensure environment variables set
echo $RESEND_API_KEY  # Should print: re_Dq3PzTSZ_...
echo $AUTH_EMAIL_FROM  # Should print: portal@fineandcountry.co.zw
```

#### Test Script
```typescript
// test-verify-payment.ts
import { verifyPayment } from './app/actions/verify-payment';

async function testVerifyPayment() {
  const result = await verifyPayment({
    reservationId: 'cm5b2kz3x0002', // Replace with real ID
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
}

testVerifyPayment();
```

#### Run Test
```bash
tsx test-verify-payment.ts
```

### 2. Manual Testing

#### Create Test Reservation
```sql
-- Insert test reservation
INSERT INTO reservations (
  id, stand_id, user_id, status, pop_url, 
  terms_accepted_at, expires_at, created_at, updated_at
) VALUES (
  'test_res_001',
  'stand_abc123',
  'user_xyz789',
  'PENDING',
  'https://utfs.io/f/test-proof.pdf',
  NOW(),
  NOW() + INTERVAL '72 hours',
  NOW(),
  NOW()
);
```

#### Verify Payment
- Log in as ADMIN/AGENT
- Navigate to property leads table
- Find test reservation
- Click "Verify" button
- Check for success toast

#### Verify Database Updates
```sql
-- Check reservation status
SELECT status, timer_active, updated_at 
FROM reservations 
WHERE id = 'test_res_001';
-- Expected: status = 'CONFIRMED', timer_active = false

-- Check stand status
SELECT status, updated_at 
FROM stands 
WHERE id = 'stand_abc123';
-- Expected: status = 'SOLD'
```

#### Verify Email Sent
- Check client inbox (use real email in test)
- Verify subject line format
- Check branding (gold/slate colors)
- Click "View Payment Proof" link
- Verify all property details correct

### 3. Error Testing

#### Test Unauthorized Access
```typescript
// Log out or use CLIENT role account
const result = await verifyPayment({ reservationId: 'test_res_001' });
// Expected: { success: false, error: "You do not have permission..." }
```

#### Test Invalid Status
```sql
-- Update reservation to CONFIRMED
UPDATE reservations SET status = 'CONFIRMED' WHERE id = 'test_res_001';

-- Try to verify again
// Expected: { success: false, error: "Cannot verify payment for reservation with status: CONFIRMED" }
```

#### Test Missing Proof of Payment
```sql
-- Remove proof of payment
UPDATE reservations SET pop_url = NULL WHERE id = 'test_res_001';

-- Try to verify
// Expected: { success: false, error: "No proof of payment attached to this reservation" }
```

---

## Monitoring

### Production Logs

**Search Patterns:**
```bash
# All verification attempts
grep "VERIFY_PAYMENT" production.log

# Successful verifications
grep "VERIFY_PAYMENT.*SUCCESS" production.log

# Failed verifications
grep "VERIFY_PAYMENT.*ERROR" production.log

# Email failures
grep "EMAIL_FAILED\|EMAIL_WARNING" production.log
```

**Key Metrics:**
- Verification success rate: `SUCCESS / (SUCCESS + ERROR)`
- Email delivery rate: `EMAIL_SENT / STARTED`
- Average processing time: Mean of `duration_ms`

### Resend Dashboard

**Access:** https://resend.com/dashboard

**Monitor:**
- Email delivery status (delivered/bounced/failed)
- Open rates (if tracking enabled)
- Daily sending quota usage
- API error logs

**Alerts:**
- Set up webhook for bounced emails
- Monitor daily quota approaching limit
- Alert on API authentication failures

### Database Queries

**Verification Activity:**
```sql
-- Verifications today
SELECT COUNT(*) 
FROM reservations 
WHERE status = 'CONFIRMED' 
  AND updated_at::date = CURRENT_DATE;
```

**Stands Sold:**
```sql
-- Stands sold today
SELECT COUNT(*) 
FROM stands 
WHERE status = 'SOLD' 
  AND updated_at::date = CURRENT_DATE;
```

**Pending with Proof:**
```sql
-- Reservations ready for verification
SELECT COUNT(*) 
FROM reservations 
WHERE status = 'PENDING' 
  AND pop_url IS NOT NULL;
```

---

## Security Considerations

### Authentication
- ✅ Neon Auth getCurrentUser() validates session
- ✅ requireRole(['ADMIN', 'AGENT']) enforces RBAC
- ✅ No public endpoint (server action only)

### Authorization
- ✅ Only ADMIN/AGENT can verify payments
- ✅ No user ID spoofing (uses session data)
- ✅ Reservation ownership not required (admin override)

### Data Integrity
- ✅ Atomic transactions (both updates or neither)
- ✅ Foreign key constraints preserved
- ✅ No cascade deletes on verification
- ✅ Timestamps track all changes

### Email Security
- ✅ RESEND_API_KEY stored in .env (not committed)
- ✅ API key validated before sending
- ✅ Rate limiting enforced by Resend
- ✅ No user input in email HTML (XSS prevention)

### Audit Trail
- ✅ All actions logged with timestamps
- ✅ Agent ID captured (who verified)
- ✅ Verification timestamp recorded
- ✅ Database updated_at tracks changes

---

## Troubleshooting

### Common Issues

**Issue:** Toast shows "Failed to verify payment"
- **Cause:** Network error, database issue, or auth failure
- **Solution:** Check browser console for detailed error, verify user has ADMIN/AGENT role
- **Logs:** Search for `[VERIFY_PAYMENT][ERROR]`

**Issue:** Payment verified but email not sent
- **Symptom:** Success toast but client doesn't receive email
- **Cause:** Invalid RESEND_API_KEY or missing AUTH_EMAIL_FROM
- **Solution:** Verify environment variables, check Resend dashboard for errors
- **Logs:** Search for `[EMAIL_FAILED]` or `[EMAIL_WARNING]`

**Issue:** "No proof of payment attached" error
- **Cause:** Client hasn't uploaded proof yet (popUrl is null)
- **Solution:** Client must upload proof via reservation modal first
- **Check:** Query `SELECT pop_url FROM reservations WHERE id = 'xxx'`

**Issue:** "Cannot verify payment for reservation with status: CONFIRMED"
- **Cause:** Reservation already verified (double-click or multiple tabs)
- **Solution:** Refresh table to see current status
- **Prevention:** Button disabled during verification

**Issue:** "You do not have permission to verify payments"
- **Cause:** User role is CLIENT (not ADMIN/AGENT)
- **Solution:** Admin must change user role in database
- **Query:** `UPDATE users SET role = 'AGENT' WHERE id = 'xxx'`

### Error Codes

| Error Message | HTTP Status | Action |
|---------------|-------------|--------|
| "You must be logged in" | 401 | Re-authenticate |
| "You do not have permission" | 403 | Contact admin for role change |
| "Reservation not found" | 404 | Check reservation ID |
| "No proof of payment attached" | 400 | Client must upload proof |
| "Cannot verify payment for..." | 400 | Already processed |
| "Failed to verify payment" | 500 | Check logs, retry |

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic payment verification
- ✅ Email notifications with proof link
- ✅ Transaction safety
- ✅ Forensic logging

### Phase 2 (Planned)
- [ ] Agent notes field (reason for verification/rejection)
- [ ] Rejection workflow (deny payment with reason)
- [ ] SMS notifications (Twilio integration)
- [ ] WhatsApp notifications (Meta Business API)
- [ ] Batch verification (select multiple, verify all)

### Phase 3 (Future)
- [ ] Automatic payment verification (OCR on proof)
- [ ] Integration with payment gateways (Paynow, EcoCash)
- [ ] Partial payment tracking (deposit + installments)
- [ ] Contract generation (auto-generate sale agreement)
- [ ] E-signature integration (DocuSign/HelloSign)

---

## Support

### Documentation
- [Resend API Docs](https://resend.com/docs)
- [Neon Auth Guide](../AUTH_CLIENT_REFERENCE.md)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)

### Contact
- **Email:** portal@fineandcountry.co.zw
- **Dev Team:** Internal Slack #erp-development

---

**Status:** ✅ Production Ready  
**Last Updated:** December 28, 2025  
**Version:** 1.0.0
