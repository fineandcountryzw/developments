# Payment Verification Quick Reference

## 🎯 One-Liner
Agent clicks "Verify" → Updates DB (Reservation CONFIRMED + Stand SOLD) → Sends branded email to client

---

## 📋 Quick Setup

### Environment Variables
```bash
# Add to .env
RESEND_API_KEY="re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E"
AUTH_EMAIL_FROM="portal@fineandcountry.co.zw"
```

### Import & Use
```typescript
import { verifyPayment } from '@/app/actions/verify-payment';

const result = await verifyPayment({ reservationId: 'cm5b2kz3x0002' });

if (result.success) {
  console.log('✅ Verified! Email sent to:', result.data.clientEmail);
} else {
  console.error('❌ Error:', result.error);
}
```

---

## 🔐 Security

**Who Can Verify?**
- ✅ ADMIN role
- ✅ AGENT role
- ❌ CLIENT role (forbidden)

**Validation Checks:**
- Reservation must be PENDING (not CONFIRMED/EXPIRED/CANCELLED)
- Proof of payment must exist (popUrl not null)
- User must be authenticated

---

## 📧 Email Template

**Subject:** `Purchase Confirmed - Stand A24, Borrowdale Heights`

**Includes:**
- ✅ Fine & Country branding (gold #85754E, slate #0A1629)
- ✅ Property details (development, stand, price, date)
- ✅ Proof of payment link
- ✅ Next steps (4-step process)
- ✅ HTML + plain text versions

**Sample:**
```
Dear John Doe,

Congratulations! Your payment has been verified and your property 
purchase is now confirmed.

PROPERTY DETAILS
Development: Borrowdale Heights
Stand Number: A24
Purchase Price: $50,000.00
Verified On: Saturday, 28 December 2024 at 14:30

[View Payment Proof Button]

WHAT HAPPENS NEXT?
1. Legal team prepares sale agreement
2. Email with signing instructions (3-5 days)
3. Title transfer initiated
4. Notification when registered
```

---

## 🗄️ Database Changes

**Reservation Table:**
- `status`: `PENDING` → `CONFIRMED`
- `timer_active`: `true` → `false`
- `updated_at`: Current timestamp

**Stand Table:**
- `status`: `RESERVED` → `SOLD`
- `updated_at`: Current timestamp

**Transaction Safety:**
- Both updates succeed or both fail
- No partial state possible

---

## 🎨 UI Integration

**PropertyLeadsTable.tsx:**
```tsx
// View Attachment button
<button onClick={() => handleViewAttachment(...)}>
  View
</button>

// Verify Payment button
<button onClick={() => handleVerifyPayment(reservationId)}>
  Verify
</button>
```

**States:**
- Default: Green "Verify" button
- Loading: "Verifying..." with spinner
- Success: Toast notification + table refresh
- Error: Error toast with message

**Toast Examples:**
```
✅ Payment verified! Confirmation email sent to client@example.com
❌ No proof of payment attached to this reservation
❌ You do not have permission to verify payments
```

---

## 🔍 Forensic Logs

**Key Events:**
```
[VERIFY_PAYMENT][STARTED] { reservation_id, timestamp }
[VERIFY_PAYMENT][AUTH_SUCCESS] { agent_id, agent_email, role }
[VERIFY_PAYMENT][DB_UPDATED] { reservation_status, stand_status, duration_ms }
[VERIFY_PAYMENT][EMAIL_SENT] { email_id, recipient }
[VERIFY_PAYMENT][SUCCESS] { email_sent: true/false, duration_ms }
```

**Search Commands:**
```bash
# All verifications today
grep "VERIFY_PAYMENT.*SUCCESS" production.log | grep "2025-12-28"

# Failed email deliveries
grep "EMAIL_FAILED\|EMAIL_WARNING" production.log

# Specific reservation
grep "cm5b2kz3x0002" production.log | grep "VERIFY_PAYMENT"
```

---

## 🧪 Testing Checklist

- [ ] Create test reservation with popUrl
- [ ] Log in as AGENT
- [ ] Click "View" to verify proof
- [ ] Click "Verify" button
- [ ] Confirm success toast appears
- [ ] Check client email inbox
- [ ] Verify database updates (Reservation CONFIRMED, Stand SOLD)
- [ ] Test error: Try verifying again (should fail)
- [ ] Test error: Log in as CLIENT (should fail)

---

## 🚨 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Failed to verify payment" | Auth/DB error | Check user role, check logs |
| Email not received | Resend config | Verify RESEND_API_KEY |
| "No proof of payment" | Client hasn't uploaded | Ask client to upload |
| Button disabled forever | Network timeout | Refresh page |
| "Already confirmed" | Double-click | Refresh table |

---

## 📊 Monitoring

**Database Queries:**
```sql
-- Verifications today
SELECT COUNT(*) FROM reservations 
WHERE status = 'CONFIRMED' 
AND updated_at::date = CURRENT_DATE;

-- Ready for verification
SELECT COUNT(*) FROM reservations 
WHERE status = 'PENDING' 
AND pop_url IS NOT NULL;
```

**Resend Dashboard:**
- https://resend.com/dashboard
- Check delivery status
- Monitor daily quota (100 emails/day free tier)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [app/actions/verify-payment.ts](app/actions/verify-payment.ts) | Server action |
| [components/PropertyLeadsTable.tsx](components/PropertyLeadsTable.tsx) | UI integration |
| [.env](.env) | Resend API key |
| [PAYMENT_VERIFICATION_GUIDE.md](PAYMENT_VERIFICATION_GUIDE.md) | Full docs |

---

## 🎓 Usage Example

```typescript
// In your component
import { verifyPayment } from '@/app/actions/verify-payment';

async function handleVerify(reservationId: string) {
  // Show loading state
  setLoading(true);
  
  try {
    const result = await verifyPayment({ reservationId });
    
    if (result.success) {
      // Show success toast
      setToast({
        message: `Payment verified! Email sent to ${result.data.clientEmail}`,
        type: 'success',
      });
      
      // Refresh data
      await refetchReservations();
    } else {
      // Show error toast
      setToast({
        message: result.error,
        type: 'error',
      });
    }
  } catch (error) {
    setToast({
      message: 'An unexpected error occurred',
      type: 'error',
    });
  } finally {
    setLoading(false);
  }
}
```

---

**Status:** ✅ Production Ready  
**Last Updated:** December 28, 2025  
**Version:** 1.0.0
