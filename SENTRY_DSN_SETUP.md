# Sentry DSN Setup Instructions

## ✅ Sentry DSN Configured

Your Sentry DSN has been added to `.env.example`. Now you need to add it to:

1. **Local `.env.local` file** (for development)
2. **Vercel Environment Variables** (for production)

---

## 🔧 Step 1: Add to Local `.env.local`

Add these lines to your `.env.local` file:

```bash
# Sentry Error Tracking
SENTRY_DSN="https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936"
NEXT_PUBLIC_SENTRY_DSN="https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936"
SENTRY_RELEASE="fine-and-country-erp@0.0.0"
NEXT_PUBLIC_SENTRY_RELEASE="fine-and-country-erp@0.0.0"
```

**Note:** `.env.local` is gitignored, so it won't be committed to the repository.

---

## 🌐 Step 2: Add to Vercel Environment Variables

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

   **Variable 1:**
   - **Name:** `SENTRY_DSN`
   - **Value:** `https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936`
   - **Environments:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

   **Variable 2:**
   - **Name:** `NEXT_PUBLIC_SENTRY_DSN`
   - **Value:** `https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936`
   - **Environments:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

   **Variable 3 (Optional):**
   - **Name:** `SENTRY_RELEASE`
   - **Value:** `fine-and-country-erp@0.0.0`
   - **Environments:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

   **Variable 4 (Optional):**
   - **Name:** `NEXT_PUBLIC_SENTRY_RELEASE`
   - **Value:** `fine-and-country-erp@0.0.0`
   - **Environments:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

5. **Redeploy** your application for changes to take effect

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link project (if not already linked)
vercel link

# Add environment variables
vercel env add SENTRY_DSN production preview development
# When prompted, paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

vercel env add NEXT_PUBLIC_SENTRY_DSN production preview development
# When prompted, paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

vercel env add SENTRY_RELEASE production preview development
# When prompted, paste: fine-and-country-erp@0.0.0

vercel env add NEXT_PUBLIC_SENTRY_RELEASE production preview development
# When prompted, paste: fine-and-country-erp@0.0.0

# Pull environment variables to local .env.local
vercel env pull .env.local
```

---

## ✅ Verification Steps

After adding the variables:

1. **Restart your dev server** (if running locally)
   ```bash
   npm run dev
   ```

2. **Redeploy on Vercel** (for production)
   - Push a commit, or
   - Go to Vercel Dashboard → Deployments → Redeploy

3. **Test Sentry Integration**
   - Trigger a test error in your app
   - Check [Sentry Dashboard](https://sentry.io) - error should appear within seconds

4. **Verify in Sentry Dashboard**
   - Go to: https://sentry.io/organizations/YOUR_ORG/issues/
   - You should see test errors appearing
   - Check that error context (module, action, stack trace) is captured

---

## 📋 Quick Copy-Paste for Vercel

Copy these exact values:

```
SENTRY_DSN=https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

NEXT_PUBLIC_SENTRY_DSN=https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936

SENTRY_RELEASE=fine-and-country-erp@0.0.0

NEXT_PUBLIC_SENTRY_RELEASE=fine-and-country-erp@0.0.0
```

---

## 🎯 What This Enables

Once configured, Sentry will automatically:
- ✅ Capture all errors from API routes
- ✅ Capture React component errors
- ✅ Track performance metrics
- ✅ Provide error context and stack traces
- ✅ Send alerts for critical errors

---

**Status:** ✅ DSN added to `.env.example` - Add to Vercel and `.env.local` to enable
