# Environment Setup Guide

## .env.local File

Your `.env.local` file is located at:
```
/Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp/.env.local
```

Currently configured with database credentials. Keep this file **secure** and **never commit to Git**.

---

## Current Environment Variables

### ✅ Already Set
```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1.us-east-1.aws.neon.tech/neondb?sslmode=require

# Prisma
PRISMA_CLIENT_ENGINE_TYPE=dataproxy

# UploadThing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=p95t08lhll

# Gemini (optional)
GEMINI_API_KEY=PLACEHOLDER_API_KEY
VITE_GEMINI_API_KEY=PLACEHOLDER_API_KEY
```

### ⚠️ Needs Update
```env
# Neon Auth (UPDATE WITH ACTUAL URL)
VITE_NEON_AUTH_URL=https://your-neon-auth-url.com
NEON_AUTH_API_KEY=your_neon_auth_key_here
```

---

## Production Environment Setup

### For Vercel Deployment

```env
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...

# Neon Auth
VITE_NEON_AUTH_URL=https://your-production-auth-url.com
NEON_AUTH_API_KEY=your_production_key

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

**Steps:**
1. Go to Vercel Dashboard
2. Project → Settings → Environment Variables
3. Add each variable
4. Re-deploy

### For Railway Deployment

1. Go to Railway Dashboard
2. Your Project → Variables
3. Add each from .env.local
4. Deploy will automatically rebuild

### For Render Deployment

1. Go to Render Dashboard
2. Your Service → Environment
3. Add each from .env.local
4. Re-deploy

---

## Environment Variables Explained

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `DATABASE_URL` | Database connection (pooled) | ✅ | postgresql://... |
| `DATABASE_URL_UNPOOLED` | Database connection (direct) | ✅ | postgresql://... |
| `PRISMA_CLIENT_ENGINE_TYPE` | Prisma engine for serverless | ✅ | dataproxy |
| `VITE_NEON_AUTH_URL` | Neon Auth endpoint | ✅ | https://... |
| `NEON_AUTH_API_KEY` | Auth API key | ✅ | your_key |
| `NEXT_PUBLIC_APP_URL` | Frontend URL (public) | ⚠️ Optional | https://yourdomain.com |
| `NODE_ENV` | Environment mode | ⚠️ Optional | production |
| `UPLOADTHING_SECRET` | File upload service | ⚠️ Optional | sk_live_... |
| `UPLOADTHING_APP_ID` | File upload app ID | ⚠️ Optional | abc123 |
| `GEMINI_API_KEY` | Google Gemini API | ⚠️ Optional | your_key |

---

## Finding Your Values

### Database Connection Strings

1. **Go to Neon Console:** https://console.neon.tech
2. **Select Project**
3. **Connection String**
4. **Copy:** Database URL
5. **Create two URLs:**
   - `DATABASE_URL` = Use pooler (faster for APIs)
   - `DATABASE_URL_UNPOOLED` = Direct connection (for migrations)

### Neon Auth URL

1. **Go to Neon Console**
2. **Project → Auth**
3. **Copy Auth Endpoint**
4. Format: `https://your-project.neonauth.us-east-1.aws.neon.tech`

---

## Local Development Setup

Your `.env.local` is already configured for local development.

**To use:**
1. Keep the current values
2. Never share this file
3. Never commit to Git
4. Add to `.gitignore` (already done)

**Test connection:**
```bash
npx prisma studio
# Should open database GUI
```

---

## Switching Environments

### Switch to Local Development
```bash
# Use .env.local (default)
npm run dev
```

### Switch to Production
```bash
# Create .env.production.local
# Copy all variables
# Change DATABASE_URL to production DB
# Then:
npm run build
npm start
```

---

## Secrets Management Best Practices

### ✅ DO
- Keep `.env.local` in `.gitignore`
- Use different values for each environment
- Rotate API keys regularly
- Store secrets in platform's vault (Vercel, Railway, etc.)
- Use environment-specific files

### ❌ DON'T
- Commit `.env.local` to Git
- Share credentials in chat/email
- Use same key for multiple environments
- Expose keys in browser console
- Hardcode credentials in code

---

## Adding New Environment Variables

### Step 1: Add to `.env.local`
```env
MY_NEW_VARIABLE=value_here
```

### Step 2: Use in Code (Server-side)
```typescript
const myVar = process.env.MY_NEW_VARIABLE;
```

### Step 3: Use in Code (Client-side)
```typescript
// Must start with NEXT_PUBLIC_
const myVar = process.env.NEXT_PUBLIC_MY_VARIABLE;
```

### Step 4: Restart Dev Server
```bash
# Press Ctrl+C to stop
# Then start again
npm run dev
```

---

## Environment Variable Debugging

### Check if Variable is Loaded
```bash
# In .env.local
echo "TEST_VAR=hello" >> .env.local

# In your code
console.log(process.env.TEST_VAR);  // Should print "hello"
```

### Check All Loaded Variables (Dev)
```bash
# In any page or API route
console.log(process.env);  // Shows all variables
```

### Test in Production
```bash
# Create .env.production.local
# Add variables
npm run build  # Uses .env.production.local
npm start      # Uses production env vars
```

---

## Common Issues

### Issue: Database Connection Fails in Production
**Solution:**
1. Verify `DATABASE_URL` is for production database
2. Check IP whitelist in Neon (if applicable)
3. Test with: `psql "$DATABASE_URL"`
4. Check pooler vs direct connection URL

### Issue: Auth Not Working
**Solution:**
1. Verify `VITE_NEON_AUTH_URL` is correct
2. Check `NEON_AUTH_API_KEY` is set
3. Test: Check browser console for error
4. Verify email configuration in Neon Auth

### Issue: Variables Not Loading
**Solution:**
1. Restart dev server: `npm run dev`
2. Check `.env.local` exists
3. Check variable names exactly
4. For public vars, must start with `NEXT_PUBLIC_`

### Issue: Works Locally, Fails in Production
**Solution:**
1. Compare `.env.local` with production env vars
2. Check production database is different
3. Check `NEXT_PUBLIC_APP_URL` is set correctly
4. Verify all required variables are set

---

## Using Environment Variables in Code

### Server-side (API routes)
```typescript
// app/api/admin/example/route.ts
const dbUrl = process.env.DATABASE_URL;

export async function GET() {
  const result = await fetch(dbUrl);
  return Response.json({ result });
}
```

### Client-side (React components)
```typescript
// Must use NEXT_PUBLIC_ prefix
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export default function Component() {
  return <div>App URL: {appUrl}</div>;
}
```

### Both sides
```typescript
// Can use on server AND client
const publicVar = process.env.NEXT_PUBLIC_MY_VAR;
```

---

## .env Files Order

Next.js loads environment variables in this order:

1. **`.env.local`** - Local overrides (highest priority, not committed)
2. **`.env.production.local`** - Production overrides
3. **`.env.development.local`** - Development overrides
4. **`.env`** - Defaults (can be committed)

---

## Security Checklist

Before deploying, verify:

- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets in code files
- [ ] All `NEXT_PUBLIC_` vars are safe to expose
- [ ] Production env vars are different from local
- [ ] Database IP whitelist is configured
- [ ] API keys are rotated regularly
- [ ] No hardcoded passwords in source
- [ ] Environment variables documented
- [ ] Team has .env.local template
- [ ] Secrets stored in platform vault

---

## Quick Reference

### View Current Env Vars
```bash
cat .env.local
```

### Test Env Var in Code
```bash
# Add to any route
console.log(process.env.MY_VAR);
npm run dev
# Check browser console
```

### Switch Environment
```bash
# Local
npm run dev

# Production
NODE_ENV=production npm start
```

### Add New Var
```bash
# 1. Add to .env.local
echo "NEW_VAR=value" >> .env.local

# 2. Restart server
npm run dev

# 3. Use in code
process.env.NEW_VAR
```

---

## File Locations

```
fine-&-country-zimbabwe-erp/
├── .env.local                    ← Your secrets (local dev)
├── .env.production.local         ← Production secrets (create if needed)
├── .env.example                  ← Template (can be committed)
├── .gitignore                    ← Excludes .env.local
└── ...
```

---

## Summary

✅ **Local Development:** Already configured in `.env.local`  
✅ **Database:** Connected and working  
✅ **Auth:** Ready for setup  
⚠️ **Production:** Update env vars before deploying  

**Next:** Update `VITE_NEON_AUTH_URL` and `NEON_AUTH_API_KEY` to actual values from Neon.

