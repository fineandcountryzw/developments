# Vercel Environment Variables Setup

## 🔧 Sentry Configuration

Add these environment variables to your Vercel project:

### Required Variables

1. **SENTRY_DSN** (Server-side)
   ```
   https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
   ```

2. **NEXT_PUBLIC_SENTRY_DSN** (Client-side)
   ```
   https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
   ```

3. **SENTRY_RELEASE** (Optional - for release tracking)
   ```
   fine-and-country-erp@0.0.0
   ```

4. **NEXT_PUBLIC_SENTRY_RELEASE** (Optional - for release tracking)
   ```
   fine-and-country-erp@0.0.0
   ```

## 📋 How to Add to Vercel

### Method 1: Via Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name:** `SENTRY_DSN`
   - **Value:** `https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**
4. Repeat for `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_RELEASE`, and `NEXT_PUBLIC_SENTRY_RELEASE`

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Add environment variables
vercel env add SENTRY_DSN
# Paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
# Select environments: Production, Preview, Development

vercel env add NEXT_PUBLIC_SENTRY_DSN
# Paste: https://a4275f2576ba2c2a3745acefb997377c@o135838.ingest.us.sentry.io/4510783211175936
# Select environments: Production, Preview, Development

vercel env add SENTRY_RELEASE
# Paste: fine-and-country-erp@0.0.0
# Select environments: Production, Preview, Development

vercel env add NEXT_PUBLIC_SENTRY_RELEASE
# Paste: fine-and-country-erp@0.0.0
# Select environments: Production, Preview, Development

# Pull environment variables to local .env.local
vercel env pull .env.local
```

## ✅ Verification

After adding the variables:

1. **Redeploy** your application (or wait for next deployment)
2. **Check Sentry Dashboard** - Errors should start appearing
3. **Test error tracking** - Trigger a test error and verify it appears in Sentry

## 🔍 Testing Sentry Integration

### Test Error Tracking

1. **Create a test error** in your app:
   ```typescript
   // In any API route or component
   throw new Error('Test Sentry integration');
   ```

2. **Check Sentry Dashboard** - Error should appear within seconds at:
   - https://sentry.io/organizations/YOUR_ORG/issues/

3. **Verify context** - Check that:
   - Error message is captured
   - Stack trace is included
   - Tags (module, action) are present
   - User context (if available) is included

## 📝 Environment Variable Checklist

- [ ] `SENTRY_DSN` added to Vercel (Production, Preview, Development)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` added to Vercel (Production, Preview, Development)
- [ ] `SENTRY_RELEASE` added to Vercel (optional)
- [ ] `NEXT_PUBLIC_SENTRY_RELEASE` added to Vercel (optional)
- [ ] Variables added to local `.env.local` file
- [ ] Application redeployed
- [ ] Sentry dashboard verified (errors appearing)

## 🚨 Important Notes

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Use different DSNs** for different environments if needed (optional)
3. **Release tracking** - Update `SENTRY_RELEASE` with each deployment version
4. **Source maps** - For better error tracking, configure Sentry source map upload (see SENTRY_SETUP.md)

## 🔗 Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Sentry Next.js Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)

---

**Status:** ✅ Ready to configure in Vercel
