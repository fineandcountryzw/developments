# Add Sentry DSN to Environment Files

## ✅ Quick Setup

Add these lines to your **`.env.local`** file (create it if it doesn't exist):

```bash
# Sentry Error Tracking
SENTRY_DSN="https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936"
NEXT_PUBLIC_SENTRY_DSN="https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936"
SENTRY_RELEASE="fine-and-country-erp@0.0.0"
NEXT_PUBLIC_SENTRY_RELEASE="fine-and-country-erp@0.0.0"
```

---

## 🌐 Vercel Environment Variables

### Via Dashboard (Easiest):

1. Go to: https://vercel.com/dashboard
2. Select your project: **developmentsfc**
3. Go to: **Settings** → **Environment Variables**
4. Add these 4 variables:

| Name | Value | Environments |
|------|-------|---------------|
| `SENTRY_DSN` | `https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936` | ✅ Production ✅ Preview ✅ Development |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936` | ✅ Production ✅ Preview ✅ Development |
| `SENTRY_RELEASE` | `fine-and-country-erp@0.0.0` | ✅ Production ✅ Preview ✅ Development |
| `NEXT_PUBLIC_SENTRY_RELEASE` | `fine-and-country-erp@0.0.0` | ✅ Production ✅ Preview ✅ Development |

5. **Redeploy** your application

### Via CLI:

```bash
vercel env add SENTRY_DSN production preview development
# Paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

vercel env add NEXT_PUBLIC_SENTRY_DSN production preview development
# Paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

vercel env add SENTRY_RELEASE production preview development
# Paste: fine-and-country-erp@0.0.0

vercel env add NEXT_PUBLIC_SENTRY_RELEASE production preview development
# Paste: fine-and-country-erp@0.0.0
```

---

## ✅ Verification

After adding:
1. Restart dev server: `npm run dev`
2. Check Sentry dashboard: https://sentry.io
3. Trigger a test error to verify it's working

---

**Status:** ✅ `.env.example` updated - Add to `.env.local` and Vercel to enable
