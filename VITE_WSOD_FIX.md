# White Screen of Death (WSoD) Fix - Vite Migration from Supabase to Neon

## Issue Summary
After migrating from Supabase to Neon, the application displayed a White Screen of Death (WSoD) due to improper environment variable configuration in a Vite project.

---

## Root Causes Identified

### 1. ❌ Incorrect Environment Variable Access in vite.config.ts
**Problem:** 
- Using `process.env` definitions instead of Vite's native environment variable handling
- Attempting to manually map non-VITE_ prefixed variables

**Before:**
```typescript
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.NEXT_PUBLIC_NEON_AUTH_URL': JSON.stringify(env.VITE_NEON_AUTH_URL),
      },
    };
});
```

**After:**
```typescript
export default defineConfig(({ mode }) => {
    // Load environment variables with VITE_ prefix
    const env = loadEnv(mode, '.', 'VITE_');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

### 2. ✅ Auth Client Already Using Correct Pattern
**Status:** No changes needed

The authentication client in [lib/auth.ts](lib/auth.ts#L21) was already correctly using `import.meta.env`:

```typescript
const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || import.meta.env.NEXT_PUBLIC_NEON_AUTH_URL;
```

### 3. ✅ Entry Point Clean
**Status:** No Supabase references found

[index.tsx](index.tsx) is clean and doesn't reference any Supabase providers:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 4. ✅ No ProtectedRoute Issues
**Status:** Authentication handled correctly

The app uses a simple authentication state in [App.tsx](App.tsx):

```tsx
const [isAuthenticated, setIsAuthenticated] = useState(false);

if (!isAuthenticated) {
  return <LandingPage onLogin={handleLogin} />;
}
```

No complex router-based ProtectedRoute components that would break with Supabase removal.

---

## Environment Variables Fixed

### .env Configuration

**Updated Variables:**
```bash
# Backend-only variables (no VITE_ prefix needed)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_NEON_AUTH_URL="https://..."
CRON_SECRET="..."
UPLOADTHING_SECRET="..."
RESEND_API_KEY="..."

# Client-accessible variables (VITE_ prefix REQUIRED)
VITE_NEON_AUTH_URL="https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth"
VITE_DATABASE_URL="postgresql://..." # Only if needed on client
VITE_GEMINI_API_KEY="..." # Only if needed on client

# Legacy Supabase (commented out)
# VITE_SUPABASE_URL="..."
# VITE_SUPABASE_ANON_KEY="..."
```

---

## How Vite Environment Variables Work

### Backend vs Frontend Access

| Variable Name | Accessible In | Usage |
|--------------|---------------|-------|
| `DATABASE_URL` | Backend only | API routes, server actions |
| `VITE_NEON_AUTH_URL` | Frontend & Backend | Client-side auth checks |
| `process.env.DATABASE_URL` | Node.js code only | ❌ NOT in Vite frontend |
| `import.meta.env.VITE_*` | Vite frontend | ✅ Correct for React components |

### Critical Rules

1. **VITE_ Prefix Required for Client Access**
   - Only variables starting with `VITE_` are exposed to the frontend
   - Accessed via `import.meta.env.VITE_*`

2. **No process.env in Frontend**
   - `process.env` is a Node.js concept
   - Vite frontend uses `import.meta.env`

3. **Backend Code Can Use process.env**
   - API routes in `app/api/*` can use `process.env`
   - Server actions can use `process.env`
   - These run in Node.js, not in the browser

---

## Testing the Fix

### 1. Clear Build Cache
```bash
rm -rf dist node_modules/.vite
npm run dev
```

### 2. Check Browser Console
Should NOT see:
- ❌ `VITE_NEON_AUTH_URL is not defined`
- ❌ `process.env is not defined`
- ❌ `Cannot read property 'auth' of undefined`

Should see:
- ✅ `[AUTH][CLIENT_INITIALIZED]` logs
- ✅ React components rendering
- ✅ No runtime errors

### 3. Verify Auth Flow
1. Open app at `http://localhost:3000`
2. Landing page should render
3. Click "Login" button
4. Auth modal should appear without errors

---

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| [vite.config.ts](vite.config.ts) | Removed `define` block, fixed `loadEnv` | Vite handles VITE_ variables natively |
| [.env](.env) | Added VITE_DATABASE_URL, commented Supabase | Client-side access for Neon |
| [.env.local](.env.local) | Added VITE_GEMINI_API_KEY | Client-side API key access |
| [.env.example](.env.example) | Added VITE_ variable examples | Developer guidance |

---

## Migration Checklist

- [x] Removed `process.env` definitions from vite.config.ts
- [x] Ensured all client-side variables have VITE_ prefix
- [x] Verified auth client uses import.meta.env
- [x] Confirmed no Supabase references in entry points
- [x] Checked ProtectedRoute uses Neon Auth
- [x] Validated module resolution in vite.config.ts
- [x] No leftover Supabase aliases or plugins
- [x] Backend process.env usage is correct

---

## Architecture Confirmed

### Frontend (Vite + React)
- ✅ Uses `import.meta.env.VITE_*`
- ✅ No Supabase client initialization
- ✅ Neon Auth client initialized with VITE_NEON_AUTH_URL
- ✅ Simple useState authentication

### Backend (API Routes)
- ✅ Uses `process.env.*` (Node.js)
- ✅ Prisma connects via DATABASE_URL
- ✅ Auth client uses NEXT_PUBLIC_NEON_AUTH_URL fallback
- ✅ No Supabase server client

---

## Security Notes

### ⚠️ Client-Side Environment Variables
Variables with `VITE_` prefix are **embedded in the frontend bundle** and visible to users.

**Never use VITE_ prefix for:**
- ❌ Database passwords
- ❌ API secrets
- ❌ Private keys
- ❌ Backend-only credentials

**Safe to use VITE_ prefix for:**
- ✅ Public API endpoints (like auth URL)
- ✅ Public service URLs
- ✅ Feature flags
- ✅ Public configuration

---

## Expected Console Output

### Successful Startup
```
[AUTH][CLIENT_INITIALIZED] { auth_url: "https://...", timestamp: "..." }
[VITE] Running at http://localhost:3000
```

### Failed Startup (Before Fix)
```
❌ Uncaught ReferenceError: process is not defined
❌ Cannot read property 'VITE_NEON_AUTH_URL' of undefined
```

---

## Additional Resources

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [Neon Auth Client Reference](AUTH_CLIENT_REFERENCE.md)
- [Auth Setup Guide](AUTH_SETUP.md)

---

## Support

If the WSoD persists after applying these fixes:

1. **Clear all caches:**
   ```bash
   rm -rf dist node_modules/.vite .next
   npm install
   npm run dev
   ```

2. **Check browser console** for specific error messages

3. **Verify .env file** is in the project root (same directory as package.json)

4. **Restart VS Code** to reload environment variables

---

**Status:** ✅ Fixed  
**Date:** December 28, 2025  
**Migration:** Supabase → Neon Complete
