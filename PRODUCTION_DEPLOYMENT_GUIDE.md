# Production Deployment Guide - Admin Access Fix

**Date:** January 4, 2026  
**Priority:** CRITICAL  
**Estimated Time:** 15 minutes

---

## 🚨 Pre-Deployment Checklist

Before deploying these fixes to production:

- [ ] All changes committed to git
- [ ] Environment variables verified in Vercel
- [ ] Database schema verified in Neon
- [ ] Backup of current production database taken
- [ ] Vercel deployment protection disabled (if enabled)

---

## 📦 Files Changed

### Core Authentication
- ✅ `lib/neonAuth.ts` - Standardized role validation
- ✅ `lib/api-client.ts` - No changes needed (already correct)

### API Endpoints
- ✅ `app/api/admin/users/invite/route.ts` - Enhanced logging & role check
- ✅ `app/api/admin/settings/route.ts` - Normalized role validation
- ✅ `app/api/admin/developments/route.ts` - Already correct (no changes)

### Documentation
- ✅ `FORENSIC_AUDIT_FIX_COMPLETE.md` - Complete audit report
- ✅ `test-admin-api.sh` - API testing script
- ✅ `PRODUCTION_DEPLOYMENT_GUIDE.md` - This file

---

## 🚀 Deployment Steps

### Step 1: Verify Local Changes

```bash
# Ensure you're in the project directory
cd /Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp

# Check git status
git status

# Review changes
git diff lib/neonAuth.ts
git diff app/api/admin/users/invite/route.ts
git diff app/api/admin/settings/route.ts
```

---

### Step 2: Commit Changes

```bash
# Stage all changes
git add lib/neonAuth.ts
git add app/api/admin/users/invite/route.ts
git add app/api/admin/settings/route.ts
git add FORENSIC_AUDIT_FIX_COMPLETE.md
git add test-admin-api.sh
git add PRODUCTION_DEPLOYMENT_GUIDE.md

# Commit with descriptive message
git commit -m "fix: standardize admin role validation and enhance forensic logging

- Fix role case mismatch (Admin vs ADMIN) in authentication
- Add comprehensive forensic logging for production debugging
- Enhance user invitation endpoint with better error messages
- Normalize role checks in settings/logo upload endpoint
- Add API testing script and complete audit documentation

Fixes: Admin access issues on Vercel deployment
Resolves: Unauthorized errors for logo uploads and user invitations"

# Push to main branch
git push origin main
```

---

### Step 3: Deploy to Vercel

**Option A: Automatic Deployment (Recommended)**
- Vercel will automatically deploy when you push to main branch
- Monitor deployment at: https://vercel.com/your-org/your-project/deployments

**Option B: Manual Deployment**
```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Or deploy to preview first
vercel
```

---

### Step 4: Verify Environment Variables

Go to Vercel Dashboard → Project → Settings → Environment Variables

**Required Variables:**
```env
# Database (CRITICAL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Authentication (CRITICAL)
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-key-minimum-32-characters
NEON_AUTH_URL=https://your-neon-auth-endpoint

# Email Service (for invitations)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app

# Node Environment
NODE_ENV=production
```

**Verify each variable:**
- [ ] DATABASE_URL connects to correct Neon database
- [ ] NEXTAUTH_SECRET is at least 32 characters
- [ ] NEXTAUTH_URL matches your production domain
- [ ] RESEND_API_KEY is valid and active
- [ ] NEXT_PUBLIC_BASE_URL has no trailing slash

---

### Step 5: Database Schema Verification

**Connect to Neon Database:**
1. Go to: https://console.neon.tech
2. Select your project
3. Click "SQL Editor"

**Run this verification script:**
```sql
-- 1. Verify company_settings table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'company_settings';

-- Expected: One row with table_name = 'company_settings'

-- 2. If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS "company_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "branch" TEXT NOT NULL UNIQUE,
  "logo_url" TEXT,
  "company_name" TEXT DEFAULT 'Fine & Country Zimbabwe',
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Verify User table has role column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'role';

-- Expected: One row with role column

-- 4. Check admin users exist
SELECT id, email, role, "isActive" 
FROM "User" 
WHERE role = 'ADMIN' OR role = 'Admin';

-- Expected: At least one admin user
-- If none exist, create one:
-- UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-admin@email.com';
```

---

### Step 6: Test Deployment

**Wait for deployment to complete:**
- Go to Vercel Dashboard → Deployments
- Wait for "Ready" status (usually 2-3 minutes)
- Click on the deployment URL

**Test admin access:**

1. **Login as Admin**
   - Navigate to: https://your-app.vercel.app/login
   - Login with admin credentials
   - Verify role is displayed correctly

2. **Test User Invitations**
   ```bash
   # Open browser console (F12)
   # Navigate to User Management → Invite User
   # Fill form and submit
   # Check console for logs:
   
   # Expected:
   # [USER-MGMT][FORENSIC] POST /api/admin/users/invite called
   # [USER-MGMT][FORENSIC] Auth check result: { hasUser: true, role: 'Admin' }
   # [USER-MGMT][FORENSIC] Invitation created successfully
   ```

3. **Test Logo Upload**
   ```bash
   # Navigate to Branch Settings → Logo Upload
   # Upload a logo file
   # Click Save
   # Check console for logs:
   
   # Expected:
   # [Settings API][FORENSIC] Auth check: { hasUser: true, role: 'Admin' }
   # [Settings API][FORENSIC] Permission check passed
   # [Settings API] Updated settings. New logo_url: https://...
   ```

4. **Test Development CRUD**
   ```bash
   # Navigate to Developments → Add New Development
   # Fill all fields
   # Click Save
   # Check console for logs:
   
   # Expected:
   # [FORENSIC][API] POST /api/admin/developments called
   # [FORENSIC][API] User retrieved: admin@... role: Admin
   # [FORENSIC][API] Development created successfully
   ```

---

### Step 7: Monitor Vercel Logs

**Real-time monitoring:**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Tail production logs
vercel logs --follow

# Filter for forensic logs
vercel logs --follow | grep FORENSIC

# Filter for errors
vercel logs --follow | grep ERROR
```

**Look for these log patterns:**

✅ **Success:**
```
[NEON AUTH][FORENSIC] User authenticated successfully: { email: '...', role: 'Admin' }
[USER-MGMT][FORENSIC] Invitation created: { invitationId: '...', email: '...' }
[Settings API][FORENSIC] Permission check passed. Proceeding with save...
[FORENSIC][API] Development created successfully: { id: '...', name: '...' }
```

❌ **Errors to watch for:**
```
[NEON AUTH][FORENSIC] No Bearer token found
[NEON AUTH][FORENSIC] Token validation failed
[USER-MGMT][FORENSIC] Unauthorized access attempt
[Settings API][FORENSIC] Non-admin attempted to update logo
```

---

## 🧪 Post-Deployment Testing

### Test 1: Admin Authentication

**Expected Result:** Admin users can access all admin endpoints

```bash
# From your local machine, test the API
export PROD_URL="https://your-app.vercel.app"
export AUTH_TOKEN="your-production-token"

# Test authentication
curl -X GET "$PROD_URL/api/admin/diagnostics" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.'

# Expected: HTTP 200 with system diagnostics
# If 401: Auth token issue
# If 403: Role validation issue
```

---

### Test 2: User Invitations

**Expected Result:** Admin can send invitation emails

```bash
curl -X POST "$PROD_URL/api/admin/users/invite" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "AGENT",
    "branch": "HARARE",
    "fullName": "Test User"
  }' | jq '.'

# Expected: HTTP 201 with invitation data
# Check: Email received at test@example.com
# Check: Invitation record in database
```

---

### Test 3: Logo Upload

**Expected Result:** Admin can save logo URL to database

```bash
curl -X POST "$PROD_URL/api/admin/settings" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "HARARE",
    "logo_url": "https://example.com/test-logo.png",
    "company_name": "Test Company"
  }' | jq '.'

# Expected: HTTP 200 with updated settings
# Verify: Logo appears on website
# Verify: Logo persists after refresh
```

---

### Test 4: Development CRUD

**Expected Result:** Admin can create, edit, delete developments

```bash
# Create
curl -X POST "$PROD_URL/api/admin/developments" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Development",
    "location_name": "Test Location",
    "branch": "HARARE",
    "total_stands": 10,
    "base_price": 25000
  }' | jq '.'

# Expected: HTTP 201 with development data
# Save the ID for next tests

# Edit (replace DEV_ID with actual ID from create response)
DEV_ID="dev_xxxxxxxxxxxxx"

curl -X PUT "$PROD_URL/api/admin/developments" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$DEV_ID\",
    \"name\": \"Updated Development Name\",
    \"base_price\": 30000
  }" | jq '.'

# Expected: HTTP 200 with updated data

# Delete
curl -X DELETE "$PROD_URL/api/admin/developments" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$DEV_ID\"
  }" | jq '.'

# Expected: HTTP 200 with deletion confirmation
```

---

## 🔍 Troubleshooting

### Issue: 401 Unauthorized on all endpoints

**Diagnosis:**
```bash
# Check if auth token is being sent
curl -v "$PROD_URL/api/admin/diagnostics" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  2>&1 | grep Authorization

# Expected: > Authorization: Bearer ...
```

**Fixes:**
1. Verify AUTH_TOKEN environment variable is set
2. Check localStorage in browser: `localStorage.getItem('auth_token')`
3. Login again to refresh token
4. Check Vercel logs for auth errors

---

### Issue: 403 Forbidden for admin user

**Diagnosis:**
```bash
# Check user role in database
psql $DATABASE_URL -c "SELECT id, email, role FROM \"User\" WHERE email = 'your-admin@email.com';"
```

**Fixes:**
1. Ensure role is 'ADMIN' (all caps) or 'Admin'
2. Update role if needed:
   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-admin@email.com';
   ```
3. Clear browser cache and login again
4. Check Vercel logs for role validation errors

---

### Issue: Logo not saving to database

**Diagnosis:**
```bash
# Check if company_settings table exists
psql $DATABASE_URL -c "SELECT * FROM company_settings WHERE branch = 'HARARE';"
```

**Fixes:**
1. Create table using SQL from Step 5
2. Verify DATABASE_URL is correct in Vercel
3. Check Vercel logs for database errors
4. Test connection: `curl $PROD_URL/api/admin/test-db`

---

### Issue: Email invitations not sending

**Diagnosis:**
```bash
# Test Resend API key
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>Test</p>"
  }'
```

**Fixes:**
1. Verify RESEND_API_KEY in Vercel env vars
2. Check sender domain is verified in Resend dashboard
3. Check Vercel logs for email sending errors
4. Verify RESEND_FROM_EMAIL matches verified domain

---

## ✅ Success Criteria

After deployment, verify these criteria are met:

### Authentication
- [ ] Admin users can login successfully
- [ ] Role is displayed correctly in UI
- [ ] Auth token is stored in localStorage
- [ ] All API calls include Authorization header

### User Invitations
- [ ] Admin can access user invitation form
- [ ] No 403 errors when submitting form
- [ ] Invitation emails are sent successfully
- [ ] Invitation records created in database
- [ ] Audit trail entries created

### Logo Management
- [ ] Admin can access branch settings
- [ ] Logo upload completes successfully
- [ ] Logo URL saved to company_settings table
- [ ] Logo displays in header, footer, access portal
- [ ] Logo persists after page refresh

### Development CRUD
- [ ] Admin can create new developments
- [ ] Admin can edit existing developments
- [ ] Admin can delete developments
- [ ] Stands are created from GeoJSON
- [ ] All operations logged with [FORENSIC] tags

### Logging & Monitoring
- [ ] Vercel logs show [FORENSIC] entries
- [ ] All auth checks are logged
- [ ] All admin operations are logged
- [ ] Error messages are descriptive
- [ ] No sensitive data in logs

---

## 🎯 Rollback Plan

If deployment causes issues:

### Quick Rollback (< 1 minute)

**Via Vercel Dashboard:**
1. Go to: https://vercel.com/your-org/your-project/deployments
2. Find previous stable deployment
3. Click "⋯" → "Promote to Production"
4. Confirm promotion

**Via Vercel CLI:**
```bash
# List recent deployments
vercel list

# Promote previous deployment
vercel promote <deployment-url>
```

---

### Full Rollback (< 5 minutes)

**Revert git commits:**
```bash
# Check commit history
git log --oneline

# Revert to previous commit
git revert HEAD

# Or reset to specific commit
git reset --hard <commit-hash>

# Force push to trigger redeployment
git push origin main --force
```

---

## 📊 Monitoring Dashboard

After deployment, monitor these metrics:

### Vercel Dashboard
- **Deployments:** https://vercel.com/your-org/your-project/deployments
- **Logs:** https://vercel.com/your-org/your-project/logs
- **Analytics:** https://vercel.com/your-org/your-project/analytics

### Neon Dashboard
- **Database:** https://console.neon.tech/app/projects/your-project
- **SQL Editor:** For running diagnostics queries
- **Monitoring:** CPU, Memory, Connection usage

### Resend Dashboard
- **Emails:** https://resend.com/emails
- **Domains:** https://resend.com/domains
- **API Keys:** https://resend.com/api-keys

---

## 📞 Support & Escalation

If critical issues persist:

1. **Immediate Actions:**
   - Rollback deployment using steps above
   - Check Vercel logs for specific errors
   - Test database connection
   - Verify environment variables

2. **Investigation:**
   - Review FORENSIC_AUDIT_FIX_COMPLETE.md
   - Run test-admin-api.sh locally
   - Compare local vs production behavior
   - Check for environment-specific issues

3. **Contact Support:**
   - Vercel Support: https://vercel.com/support
   - Neon Support: https://neon.tech/docs/introduction/support
   - Resend Support: https://resend.com/docs

---

## 📝 Post-Deployment Notes

**Deployment Date:** ________________  
**Deployed By:** ________________  
**Deployment URL:** ________________  
**All Tests Passed:** ☐ Yes ☐ No  

**Notes:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```

---

**Document Version:** 1.0  
**Last Updated:** January 4, 2026  
**Status:** ✅ Ready for Production
