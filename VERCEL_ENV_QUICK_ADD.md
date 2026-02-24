# Vercel Environment Variables - Quick Add Guide

## 🚀 Sentry DSN Configuration

Add these **4 environment variables** to your Vercel project:

### Step-by-Step Instructions

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select project: **developmentsfc**

2. **Navigate to Environment Variables**
   - Click **Settings** → **Environment Variables**

3. **Add Each Variable** (Click "Add New" for each):

   **Variable 1:**
   ```
   Name: SENTRY_DSN
   Value: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
   Environments: ☑ Production ☑ Preview ☑ Development
   ```

   **Variable 2:**
   ```
   Name: NEXT_PUBLIC_SENTRY_DSN
   Value: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
   Environments: ☑ Production ☑ Preview ☑ Development
   ```

   **Variable 3:**
   ```
   Name: SENTRY_RELEASE
   Value: fine-and-country-erp@0.0.0
   Environments: ☑ Production ☑ Preview ☑ Development
   ```

   **Variable 4:**
   ```
   Name: NEXT_PUBLIC_SENTRY_RELEASE
   Value: fine-and-country-erp@0.0.0
   Environments: ☑ Production ☑ Preview ☑ Development
   ```

4. **Redeploy Application**
   - Go to **Deployments** tab
   - Click **Redeploy** on latest deployment
   - Or push a new commit to trigger deployment

---

## ✅ Quick Copy-Paste Values

**SENTRY_DSN:**
```
https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
```

**NEXT_PUBLIC_SENTRY_DSN:**
```
https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
```

**SENTRY_RELEASE:**
```
fine-and-country-erp@0.0.0
```

**NEXT_PUBLIC_SENTRY_RELEASE:**
```
fine-and-country-erp@0.0.0
```

---

## ✅ Verification

After adding and redeploying:

1. **Check Sentry Dashboard**
   - Visit: https://sentry.io
   - Errors should start appearing automatically

2. **Test Error Tracking**
   - Trigger a test error in your app
   - Check Sentry dashboard within seconds

---

**Status:** ✅ Added to `.env.local` - Add to Vercel to enable in production
