# WSOD Fix - Quick Test Checklist

## Pre-Flight Check

```bash
# 1. Clear all build caches
rm -rf dist node_modules/.vite

# 2. Verify .env file exists in project root
ls -la .env

# 3. Verify VITE_NEON_AUTH_URL is set
cat .env | grep VITE_NEON_AUTH_URL

# 4. Start dev server
npm run dev
```

## Expected Results

### ✅ Terminal Output
```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:3000/
➜ Network: http://192.168.x.x:3000/
```

### ✅ Browser Console (No Errors)
- No "process is not defined" errors
- No "undefined environment variable" errors
- Application renders successfully

### ✅ Landing Page Loads
- Logo displays
- Navigation works
- Login button is clickable
- No white screen

## If Issues Persist

### Check 1: Verify Environment Variables Load
Add this temporarily to [lib/auth.ts](lib/auth.ts#L21):
```typescript
console.log('VITE_NEON_AUTH_URL:', import.meta.env.VITE_NEON_AUTH_URL);
console.log('All VITE vars:', import.meta.env);
```

### Check 2: Verify vite.config.ts
Should NOT contain:
- ❌ `define: { 'process.env.*' }`
- ❌ Any Supabase plugins

Should contain:
- ✅ `loadEnv(mode, '.', 'VITE_')`

### Check 3: Hard Refresh Browser
- Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Safari: `Cmd+Option+R`
- Firefox: `Cmd+Shift+R` or `Ctrl+Shift+R`

## Quick Rollback (If Needed)

```bash
# Restore original vite.config.ts from git
git checkout vite.config.ts

# Restore original .env
git checkout .env
```

## Success Indicators

| Indicator | Status |
|-----------|--------|
| Dev server starts | ✅ |
| No console errors | ✅ |
| Landing page visible | ✅ |
| Auth client initializes | ✅ |
| No white screen | ✅ |

---

**Next Step:** Test authentication flow by clicking the Login button
