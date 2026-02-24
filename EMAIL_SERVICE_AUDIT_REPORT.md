# Email Service Functions - Audit Report

**Date:** January 2026  
**Status:** ⚠️ Issues Found - Requires Fixes

---

## Executive Summary

Audited all email service functions for consistency with the Resend Service Standardization document. Found **3 critical issues** and **2 minor inconsistencies** that need to be addressed.

---

## ✅ What's Working

### 1. Standardized Email Address
- ✅ All files use `noreply@fineandcountryerp.com` as default
- ✅ All use `process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL` pattern
- ✅ `lib/db.ts` `getEmailConfig()` returns standardized email

### 2. API Key Validation
- ✅ `lib/email-service.ts` - Validates at function call time (✅ Best practice)
- ✅ `app/actions/verify-payment.ts` - Validates at function call time (✅ Best practice)
- ✅ Both check for missing AND empty string

---

## ❌ Critical Issues

### Issue #1: Module-Level Client Initialization (CRITICAL)

**Files Affected:**
- `lib/resend.ts` (Line 15)
- `app/api/emails/send/route.ts` (Line 45)

**Problem:**
```typescript
// ❌ BAD: Initialized at module load time
const resend = getResendClient(); // Crashes if RESEND_API_KEY is missing
```

**Impact:**
- If `RESEND_API_KEY` is missing, the entire module fails to load
- Application startup will crash before any email function is called
- No graceful error handling - hard failure

**Fix Required:**
```typescript
// ✅ GOOD: Lazy initialization
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  return new Resend(apiKey);
}

// Remove: const resend = getResendClient();
// Use: const resend = getResendClient(); inside functions
```

**Priority:** 🔴 **CRITICAL** - Must fix before production

---

### Issue #2: Email Format Inconsistency

**Problem:**
Different files use different "from" formats:

| File | Format | Example |
|------|--------|---------|
| `lib/email-service.ts` | Email only | `noreply@fineandcountryerp.com` |
| `lib/resend.ts` | Email only | `noreply@fineandcountryerp.com` |
| `app/api/emails/send/route.ts` | Name + Email | `Fine & Country <noreply@fineandcountryerp.com>` |
| `app/actions/verify-payment.ts` | Name + Email | `Fine & Country Zimbabwe <noreply@fineandcountryerp.com>` |

**Impact:**
- Inconsistent sender display in email clients
- Some emails show just email, others show "Fine & Country" or "Fine & Country Zimbabwe"

**Recommendation:**
Standardize to one format. Recommended:
```typescript
from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`
```

**Priority:** 🟡 **MEDIUM** - Should fix for consistency

---

### Issue #3: Missing Empty String Validation

**Files Affected:**
- `lib/email-service.ts` - `validateResendConfig()` (Line 12-17)

**Problem:**
```typescript
function validateResendConfig(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {  // ❌ Only checks for falsy, not empty string
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  return apiKey;
}
```

**Impact:**
- If `RESEND_API_KEY=""` (empty string), validation passes but API calls will fail
- Inconsistent with other files that check `apiKey.trim() === ''`

**Fix Required:**
```typescript
function validateResendConfig(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {  // ✅ Check both
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  return apiKey;
}
```

**Priority:** 🟡 **MEDIUM** - Should fix for consistency

---

## 📋 Detailed File Audit

### ✅ `lib/email-service.ts`
- ✅ Standardized email: `DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com'`
- ✅ API validation: `validateResendConfig()` in all 3 functions
- ⚠️ Missing: Empty string check in `validateResendConfig()`
- ✅ Error handling: Throws errors properly
- ✅ Functions: `sendInvitationEmail()`, `resendInvitationEmail()`, `sendEmail()`

### ⚠️ `lib/resend.ts`
- ✅ Standardized email: `DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com'`
- ✅ API validation: `getResendClient()` checks for missing and empty
- ❌ **CRITICAL**: Module-level initialization `const resend = getResendClient()`
- ✅ Error handling: Throws errors properly
- ✅ Function: `sendInvitationEmail()`

### ⚠️ `app/api/emails/send/route.ts`
- ✅ Standardized email: `DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com'`
- ✅ API validation: `getResendClient()` checks for missing and empty
- ❌ **CRITICAL**: Module-level initialization `const resend = getResendClient()`
- ⚠️ Format: Uses `Fine & Country <email>` (inconsistent)
- ✅ Rate limiting: Implemented
- ✅ Error handling: Proper error responses

### ✅ `app/actions/verify-payment.ts`
- ✅ Standardized email: `FROM_EMAIL = process.env.AUTH_EMAIL_FROM || 'noreply@fineandcountryerp.com'`
- ✅ API validation: Checks for missing AND empty string (lines 61-78)
- ✅ Lazy initialization: Validates at function call time
- ⚠️ Format: Uses `Fine & Country Zimbabwe <email>` (inconsistent)
- ✅ Error handling: Comprehensive logging and error handling
- ✅ Function: `sendPurchaseConfirmationEmail()`

### ✅ `lib/db.ts`
- ✅ `getEmailConfig()` returns: `{ provider: 'resend', from: 'noreply@fineandcountryerp.com' }`
- ✅ Matches standardized email

---

## 🔧 Recommended Fixes

### Fix #1: Lazy Initialization in `lib/resend.ts`

**Current (Line 15):**
```typescript
const resend = getResendClient(); // ❌ Module-level
```

**Fixed:**
```typescript
// Remove module-level initialization
// Use inside functions:
export async function sendInvitationEmail(email: string, link: string) {
  try {
    const resend = getResendClient(); // ✅ Lazy initialization
    const message = await resend.emails.send({
      // ...
    });
    // ...
  }
}
```

### Fix #2: Lazy Initialization in `app/api/emails/send/route.ts`

**Current (Line 45):**
```typescript
const resend = getResendClient(); // ❌ Module-level
```

**Fixed:**
```typescript
// Remove module-level initialization
export async function POST(request: Request) {
  try {
    const resend = getResendClient(); // ✅ Lazy initialization
    // ...
  }
}
```

### Fix #3: Add Empty String Check in `lib/email-service.ts`

**Current (Line 12-17):**
```typescript
function validateResendConfig(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {  // ❌ Missing empty string check
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  return apiKey;
}
```

**Fixed:**
```typescript
function validateResendConfig(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {  // ✅ Check both
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  return apiKey;
}
```

### Fix #4: Standardize Email Format (Optional but Recommended)

**Recommendation:** Use consistent format across all files:
```typescript
from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`
```

**Files to update:**
- `lib/email-service.ts` (3 places)
- `lib/resend.ts` (1 place)
- `app/api/emails/send/route.ts` (already has format, just standardize name)
- `app/actions/verify-payment.ts` (already has format, keep as is)

---

## 📊 Compliance Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| Standardized email address | ✅ | All use `noreply@fineandcountryerp.com` |
| API key validation | ⚠️ | Missing empty string check in `email-service.ts` |
| Lazy initialization | ❌ | 2 files use module-level initialization |
| Error handling | ✅ | All throw errors properly |
| Consistent format | ⚠️ | Mixed formats (email only vs name+email) |

---

## 🎯 Priority Actions

1. **🔴 CRITICAL:** Fix module-level initialization in `lib/resend.ts` and `app/api/emails/send/route.ts`
2. **🟡 MEDIUM:** Add empty string validation in `lib/email-service.ts`
3. **🟡 MEDIUM:** Standardize email format across all files (optional)

---

## ✅ Testing Checklist

After fixes:
- [ ] Application starts without crashing if `RESEND_API_KEY` is missing
- [ ] All email functions validate API key (missing and empty string)
- [ ] Email format is consistent across all emails
- [ ] Error messages are clear and helpful
- [ ] No linter errors
- [ ] TypeScript compilation successful

---

**Report Generated:** January 2026  
**Next Review:** After fixes are implemented
