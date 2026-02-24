# Resend Email Service Audit - January 22, 2026
## Critical Email Delivery Issues Investigation

---

## ✅ RESOLVED - January 22, 2026

**Issue:** Some users were not receiving emails from the system.

**Root Cause:** Invalid Resend API key and domain mismatch between sender addresses.

**Resolution Applied:**
- ✅ Updated to valid API key: `re_SmZp7NPX_3vKFeQk373dAL17FNfcz77L1`
- ✅ Standardized to `noreply@fineandcountryerp.com` (verified domain)
- ✅ Removed `.co.zw` domain references
- ✅ Verified domain status: `fineandcountryerp.com` is VERIFIED ✅
- ✅ Test email sent successfully (ID: b3081404-a3d5-4ef6-951f-0e74c8f526f9)

**Status:** Email service is now operational and delivering successfully.

---

## 🚨 Executive Summary

**Issue:** Some users were not receiving emails from the system.

**Root Cause Identified:** **INVALID API KEY** and **DOMAIN MISMATCH** between configured sender address and verified Resend domain.

**Impact:** High - Email delivery failures affected user invitations, payment confirmations, and automated notifications.

---

## 🔍 Critical Issues Found

### Issue #1: Domain Mismatch (CRITICAL) ❌

**Problem:** Multiple sender domains in use, not all verified in Resend

**Current Configuration:**
- **Environment Variable:** `AUTH_EMAIL_FROM="portal@fineandcountry.co.zw"`
- **Fallback in Code:** `DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com'`

**Files Affected:**
- [lib/email-service.ts](lib/email-service.ts) - Line 7: Uses `noreply@fineandcountryerp.com` as default
- [lib/resend.ts](lib/resend.ts) - Line 4: Uses `noreply@fineandcountryerp.com` as default  
- [app/api/emails/send/route.ts](app/api/emails/send/route.ts) - Line 5: Uses `noreply@fineandcountryerp.com` as default
- [.env.production](.env.production) - Line 66: Sets `portal@fineandcountry.co.zw`

**Why This Causes Failures:**
1. **Resend requires verified domains** - Unverified domains = bounced emails
2. **Two different domains in use:**
   - `fineandcountry.co.zw` (configured in env)
   - `fineandcountryerp.com` (hardcoded fallback)
3. **If env var is not loaded, fallback domain is used** - may not be verified

**Resend API Response for Unverified Domain:**
```json
{
  "statusCode": "invalid_from_address",
  "message": "The from address domain is not verified"
}
```

---

### Issue #2: Missing Error Visibility 🔍

**Problem:** Email send failures are caught but not reported to admins or users

**Evidence from Code:**

#### [app/api/admin/users/invite/route.ts](app/api/admin/users/invite/route.ts#L165-L170)
```typescript
try {
  await sendInvitationEmail({...});
  console.log('[USER-MGMT][FORENSIC] Invitation email sent:', { email: inviteEmail });
} catch (emailError: any) {
  console.error('[USER-MGMT][FORENSIC] Email send failed:', { 
    email: inviteEmail, 
    error: emailError?.message 
  });
  // Don't fail - invitation was created successfully ❌
}
```

**Issue:** Invitation is marked as successful even when email fails to send. User never receives the link.

#### [lib/email-service.ts](lib/email-service.ts#L55-L75)
```typescript
if (!response.ok) {
  const error = await response.json();
  console.error('[EMAIL] Resend API error:', error);
  throw new Error(`Email service error: ${error.message}`);
}
```

**Issue:** Error is logged to console but:
- Not saved to database
- Not shown to admin user
- No retry mechanism

---

### Issue #3: No Retry Mechanism ⚠️

**Problem:** Failed emails are not retried

**Current Flow:**
```
Email Send Attempt → Fails → Error Logged → End ❌
```

**Should Be:**
```
Email Send Attempt → Fails → Retry (3x with backoff) → Log to DB → Alert Admin
```

**Files Without Retry:**
- [lib/email-service.ts](lib/email-service.ts) - `sendInvitationEmail()`, `sendEmail()`
- [app/api/emails/send/route.ts](app/api/emails/send/route.ts) - `POST()` handler
- [lib/resend.ts](lib/resend.ts) - `sendInvitationEmail()`

---

### Issue #4: Insufficient Logging 📋

**Problem:** Can't track which emails failed or why

**Missing Information:**
- Email delivery status not saved to database
- No email audit trail table
- No way to see failed emails in admin dashboard
- Console logs disappear on restart

**Recommendation:** Create `EmailLog` table:
```prisma
model EmailLog {
  id          String   @id @default(cuid())
  to          String
  from        String
  subject     String
  status      String   // SENT, FAILED, BOUNCED, DELIVERED
  resendId    String?  // Resend email ID
  error       String?
  attempts    Int      @default(1)
  sentAt      DateTime @default(now())
  deliveredAt DateTime?
}
```

---

## 📊 Email Flow Analysis

### Current Invitation Email Flow

```
Admin invites user
    ↓
POST /api/admin/users/invite
    ↓
Invitation record created in DB ✅
    ↓
sendInvitationEmail() called
    ↓
fetch('https://api.resend.com/emails') with:
  - from: portal@fineandcountry.co.zw ← May not be verified ❌
  - Authorization: Bearer re_Dq3PzTSZ... ← API key valid ✅
    ↓
Resend API validates domain
    ↓
IF domain NOT verified:
  - Returns 400 error
  - Email NOT sent ❌
  - Error logged to console (invisible to admin)
  - Invitation shows as "PENDING" (user never gets email)
    ↓
User never receives invitation link 😞
```

---

## 🔧 Immediate Action Items

### 1. Verify Domain in Resend Dashboard (CRITICAL)

**Steps:**
1. Log in to [Resend Dashboard](https://resend.com/domains)
2. Check if **BOTH** domains are verified:
   - `fineandcountry.co.zw`
   - `fineandcountryerp.com`
3. If not verified, add DNS records:
   ```
   TXT _resend.fineandcountry.co.zw [value from Resend]
   DKIM resend._domainkey.fineandcountry.co.zw [value from Resend]
   ```

**Test Domain Verification:**
```bash
curl -X GET https://api.resend.com/domains \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E"
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "fineandcountry.co.zw",
      "status": "verified",
      "region": "us-east-1"
    }
  ]
}
```

---

### 2. Standardize Sender Address

**Current Inconsistency:**
- Code default: `noreply@fineandcountryerp.com`
- Env variable: `portal@fineandcountry.co.zw`

**Recommendation:** Choose ONE verified domain and update all files

**Option A:** Use `fineandcountry.co.zw` (current env)
```typescript
// lib/email-service.ts
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountry.co.zw';

// lib/resend.ts  
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountry.co.zw';

// app/api/emails/send/route.ts
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountry.co.zw';
```

**Option B:** Use `fineandcountryerp.com` (current fallback)
```bash
# .env.production
AUTH_EMAIL_FROM="noreply@fineandcountryerp.com"
```

---

### 3. Add Email Failure Tracking

**Create Migration:**
```sql
CREATE TABLE "EmailLog" (
  "id" TEXT PRIMARY KEY,
  "to" TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resendId" TEXT,
  "error" TEXT,
  "attempts" INTEGER DEFAULT 1,
  "sentAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP
);

CREATE INDEX "EmailLog_to_idx" ON "EmailLog"("to");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
```

**Update `lib/email-service.ts`:**
```typescript
export async function sendEmail(params: SendEmailParams) {
  // ... existing code ...
  
  try {
    const result = await response.json();
    
    // Log success to DB
    await prisma.emailLog.create({
      data: {
        to: Array.isArray(to) ? to[0] : to,
        from: emailPayload.from,
        subject,
        status: 'SENT',
        resendId: result.id,
        sentAt: new Date()
      }
    });
    
    return { id: result.id, success: true };
    
  } catch (error: any) {
    // Log failure to DB
    await prisma.emailLog.create({
      data: {
        to: Array.isArray(to) ? to[0] : to,
        from: emailPayload.from,
        subject,
        status: 'FAILED',
        error: error.message,
        sentAt: new Date()
      }
    });
    
    throw error;
  }
}
```

---

### 4. Implement Retry Logic

**Add to `lib/email-service.ts`:**
```typescript
async function sendEmailWithRetry(
  params: SendEmailParams, 
  maxRetries = 3
): Promise<{ id: string; success: boolean }> {
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[EMAIL] Attempt ${attempt}/${maxRetries} for:`, params.to);
      
      const result = await sendEmail(params);
      
      console.log(`[EMAIL] Success on attempt ${attempt}`);
      return result;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[EMAIL] Attempt ${attempt} failed:`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  
  throw new Error(`Email failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

---

### 5. Surface Errors to Admin UI

**Update invitation API to return email status:**
```typescript
// app/api/admin/users/invite/route.ts

try {
  await sendInvitationEmail({...});
  results.successful.push({
    ...invitation,
    emailSent: true ✅
  });
} catch (emailError: any) {
  results.successful.push({
    ...invitation,
    emailSent: false,
    emailError: emailError.message ⚠️
  });
  
  // Still mark invitation as created
  // But warn admin
}
```

**Show warning in UI:**
```tsx
{invitation.emailSent === false && (
  <div className="text-yellow-600 text-sm">
    ⚠️ Invitation created but email failed to send.
    Reason: {invitation.emailError}
  </div>
)}
```

---

## 🧪 Testing & Verification

### Test 1: Domain Verification Status

**Run this command to check domain status:**
```bash
curl -X GET https://api.resend.com/domains \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E"
```

**Expected:** Both domains show `"status": "verified"`

---

### Test 2: Send Test Email

**Create test endpoint:**
```typescript
// app/api/test-email/route.ts
import { sendEmail } from '@/lib/email-service';

export async function POST(request: Request) {
  const { to } = await request.json();
  
  try {
    const result = await sendEmail({
      to,
      subject: 'Test Email from Fine & Country',
      html: '<h1>This is a test email</h1><p>If you received this, email service is working!</p>'
    });
    
    return Response.json({ success: true, id: result.id });
  } catch (error: any) {
    return Response.json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
```

**Test:**
```bash
curl -X POST https://www.fineandcountryerp.com/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

---

### Test 3: Check Recent Email Failures

**Query Resend API for recent emails:**
```bash
curl -X GET "https://api.resend.com/emails?limit=10" \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E"
```

**Look for:**
- `"last_event": "bounced"` - Hard bounce (bad address or domain)
- `"last_event": "complained"` - Marked as spam
- Status codes in errors

---

## 📋 Configuration Checklist

- [ ] Verify `fineandcountry.co.zw` domain in Resend dashboard
- [ ] Verify `fineandcountryerp.com` domain in Resend dashboard (or remove)
- [ ] Standardize `DEFAULT_FROM_EMAIL` across all files
- [ ] Confirm `AUTH_EMAIL_FROM` matches verified domain
- [ ] Add DNS records for domain verification
- [ ] Test sending email to multiple addresses
- [ ] Create `EmailLog` table for audit trail
- [ ] Implement retry logic in `sendEmail()`
- [ ] Add email status to invitation response
- [ ] Create admin dashboard for failed emails
- [ ] Set up webhook for Resend delivery events

---

## 🎯 Quick Wins (Do Today)

### 1. Check Domain Verification (5 min)
```bash
curl -X GET https://api.resend.com/domains \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E" | jq
```

### 2. Send Test Email (2 min)
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "portal@fineandcountry.co.zw",
    "to": ["your-email@gmail.com"],
    "subject": "Test Email",
    "html": "<p>Testing email delivery</p>"
  }'
```

### 3. Check Recent Failures (3 min)
```bash
curl -X GET "https://api.resend.com/emails?limit=20" \
  -H "Authorization: Bearer re_Dq3PzTSZ_NB9C8RVygMgWL6ouiKt4Cz7E" | jq '.data[] | select(.last_event != "delivered")'
```

---

## 📞 Next Steps

1. **Immediate:** Run domain verification check (see Quick Wins #1)
2. **Today:** Add DNS records if domain not verified
3. **This Week:** Implement email logging table
4. **This Week:** Add retry logic to email service
5. **Next Week:** Create admin dashboard for email monitoring

---

## 🔗 Related Files

- [lib/email-service.ts](lib/email-service.ts) - Main email service
- [lib/resend.ts](lib/resend.ts) - Alternative Resend implementation
- [app/api/emails/send/route.ts](app/api/emails/send/route.ts) - Email API endpoint
- [app/api/admin/users/invite/route.ts](app/api/admin/users/invite/route.ts) - User invitation endpoint
- [.env.production](.env.production) - Environment configuration

---

## 📚 Documentation References

- [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend API Reference](https://resend.com/docs/api-reference/emails/send-email)
- [Previous Audit: RESEND_SERVICE_AUDIT.md](RESEND_SERVICE_AUDIT.md)
- [Previous Fixes: RESEND_SERVICE_FIXES_COMPLETE.md](RESEND_SERVICE_FIXES_COMPLETE.md)

---

**Audit Completed:** January 22, 2026  
**Priority:** CRITICAL - Email delivery affects core user flows  
**Estimated Fix Time:** 2-3 hours for immediate issues, 1 week for complete solution
