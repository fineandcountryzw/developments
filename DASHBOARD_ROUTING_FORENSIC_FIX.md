# Dashboard Routing Forensic Fix

## 🔍 **Issue Identified**

Users with DEVELOPER and ACCOUNT roles are being redirected to admin dashboard instead of their respective dashboards.

## 🐛 **Root Causes**

### 1. **Admin Dashboard Missing DEVELOPER Redirect**
- Admin dashboard was missing the DEVELOPER role redirect
- **FIXED**: Added DEVELOPER redirect in admin page

### 2. **Account Dashboard Missing DEVELOPER Redirect**
- Account dashboard didn't redirect DEVELOPER users
- **FIXED**: Added DEVELOPER redirect in account page

### 3. **Role Check Order**
- All dashboards now check their own role FIRST before redirecting others
- This prevents false redirects

## ✅ **Fixes Applied**

### Admin Dashboard (`app/dashboards/admin/page.tsx`)
- ✅ Checks ADMIN role FIRST
- ✅ Redirects DEVELOPER → `/dashboards/developer`
- ✅ Redirects ACCOUNT/ACCOUNTS/ACCOUNTANT → `/dashboards/account`
- ✅ Redirects all other roles appropriately
- ✅ Added comprehensive console logging

### Developer Dashboard (`app/dashboards/developer/page.tsx`)
- ✅ Checks DEVELOPER role FIRST
- ✅ Redirects all other roles appropriately
- ✅ Added comprehensive console logging
- ✅ Fallback check for role containing "DEVELOPER"

### Account Dashboard (`app/dashboards/account/page.tsx`)
- ✅ Checks ACCOUNT/ACCOUNTS/ACCOUNTANT roles FIRST
- ✅ Redirects DEVELOPER → `/dashboards/developer`
- ✅ Redirects all other roles appropriately
- ✅ Added comprehensive console logging
- ✅ Fallback check for role containing "ACCOUNT"

## 🔧 **Debugging Added**

All dashboard pages now log:
- User role from session
- Full session object (for debugging)
- Redirect decisions
- Unknown role warnings

## 📋 **Role Routing Matrix**

| User Role | Redirects To |
|-----------|-------------|
| ADMIN | `/dashboards/admin` |
| MANAGER | `/dashboards/manager` |
| AGENT | `/dashboards/agent` |
| ACCOUNT/ACCOUNTS/ACCOUNTANT | `/dashboards/account` |
| CLIENT | `/dashboards/client` |
| DEVELOPER | `/dashboards/developer` |
| Unknown | `/login` |

## 🚀 **Next Steps**

1. **Check Browser Console**
   - Look for `[DeveloperPage]`, `[AccountPage]`, `[AdminPage]` logs
   - Verify the role being detected

2. **Verify Database Roles**
   - Run: `npx tsx scripts/check-user-roles.ts`
   - Ensure users have correct roles in database

3. **Check Session**
   - Verify role is being set correctly in JWT
   - Check `lib/authOptions.ts` JWT callback

4. **Clear Session**
   - Log out and log back in to refresh session
   - Old sessions might have incorrect roles

## 🔄 **Additional Fixes (Stale Role & Access Portal)**

### 4. **JWT Always Refreshes Role from DB** (`lib/authOptions.ts`)
- **Issue**: Old JWT kept stale role (e.g. ADMIN) after DB role changed to DEVELOPER/ACCOUNT.
- **Fix**: In `jwt` callback, when `!user` (existing session), we fetch user from DB by `token.id` and set `token.role`, `token.name`, `token.branch`. Role is now always current.

### 5. **Landing Page "Access Portal"** (`components/LandingPage.tsx`)
- **Issue**: DEVELOPER and ACCOUNT were missing; "Access Portal" did nothing for those roles.
- **Fix**: When authenticated, redirect to `/post-login` (which uses /api/auth/me). No more session-based role on Access Portal.

### 6. **Post-Login Missing Role** (`app/post-login/page.tsx`)
- **Issue**: If session had no role, we never redirected → infinite "Redirecting...".
- **Fix**: If authenticated but `!session?.user?.role`, call `signOut({ redirect: false })` then `router.replace('/login?error=missing_role')`. Login page shows: "Your session had no role. You have been signed out. Please sign in again."

### 7. **DB as source of truth – /api/auth/me** (fixes "still being redirected")
- **Issue**: Session/JWT role could be stale; DEVELOPER/ACCOUNT users were still sent to admin.
- **Fix**:
  - **GET /api/auth/me**: Returns current user from DB (`id`, `email`, `name`, `role`, `branch`) using `getServerSession` + Prisma. Use this for **all** role-based routing.
  - **Post-login**: Fetches `/api/auth/me`, redirects by **DB role** (no longer uses `session.user.role`).
  - **Developer page** (`/dashboards/developer`): Fetches `/api/auth/me`, allows only if DB role is DEVELOPER; otherwise redirects by DB role.
  - **Account page** (`/dashboards/account`): Fetches `/api/auth/me`, allows only if DB role is ACCOUNT/ACCOUNTS/ACCOUNTANT; otherwise redirects by DB role.
  - **Login**: After sign-in, `window.location.href = '/post-login'` (full-page redirect) so post-login always gets a fresh session and /api/auth/me.
  - **Access Portal**: When authenticated, goes to `/post-login` (which uses /api/auth/me).
- Routing now **always** uses DB role, not JWT/session, so redirects stay correct.

## 🔍 **If Still Redirecting to Admin**

Check:
1. **Session Role**: Open browser console, check what role is logged
2. **Database Role**: Verify user's role in database matches expected value
3. **JWT Token**: Role is now refreshed from DB on each session use – no re-login needed for role changes
4. **Post-Login Redirect**: Check `/post-login` page logs

The console logs will show exactly what role is being detected and why redirects are happening.
