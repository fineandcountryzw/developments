# System Diagnostics - Quick Debugging Reference

**Quick Fix Status:** ✅ RESOLVED (Jan 2, 2026)

---

## Issue Symptoms

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Page loads but shows "Error Loading Diagnostics" | API response format mismatch or parse error | Check console logs for `[DIAGNOSTICS_PAGE]` errors |
| Page stuck on "Loading diagnostics..." spinner | Fetch request hanging or API slow | Check Network tab, verify API endpoint responds |
| Error: "Unauthorized. Please log in." | Missing or invalid auth token | Re-login, check Authorization header |
| Error: "Access denied. ADMIN role required." | Non-admin user accessing endpoint | Login with admin account |
| Error: "Server error. Please check the application logs." | API endpoint throwing exception | Check server console for `[DIAGNOSTICS][ERROR]` logs |
| Console shows SyntaxError in JSON parsing | Invalid JSON from API | Check API response in Network tab |

---

## Quick Diagnostic Steps

### Step 1: Check Console Logs
```javascript
// Open DevTools → Console tab and run:
// Should see logs like:
// [DIAGNOSTICS_PAGE] Fetching diagnostics from API...
// [DIAGNOSTICS_PAGE] API response status: 200
// [DIAGNOSTICS_PAGE] Raw API response: {...}
// [DIAGNOSTICS_PAGE] Transformed diagnostic data: {...}
```

### Step 2: Check Network Tab
```
1. Open DevTools → Network tab
2. Click Refresh on diagnostics page
3. Find request: /api/admin/diagnostics
4. Verify:
   - Status: 200 OK
   - Type: fetch
   - Size: ~450B
   - Time: <500ms
5. Click Response tab to see full JSON
```

### Step 3: Test API Directly
```bash
# Get token from localStorage in browser console
# Or use curl with admin token:
curl -X GET http://localhost:3000/api/admin/diagnostics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Expected 200 OK with JSON structure:
# { timestamp, status, services: {...}, metrics: {...} }
```

### Step 4: Check Authentication
```javascript
// In browser console:
// Check if token exists and is valid
const token = localStorage.getItem('auth_token');
console.log('Token:', token ? 'Present' : 'Missing');

// Check decoded token claims (if using JWT)
// Should have role: 'ADMIN'
```

---

## Common Issues & Fixes

### Issue: Page Shows Generic "Error Loading Diagnostics"

**Quick Debug:**
1. Open DevTools → Console
2. Filter by: `[DIAGNOSTICS_PAGE][ERROR]`
3. Read the detailed error message
4. Check Network tab for response status

**Common Causes:**
- **401 Unauthorized** → Re-login, check token is being sent
- **403 Forbidden** → Login with admin account
- **500 Server Error** → Check server logs, API might be crashing
- **JSON Parse Error** → API returned non-JSON response (HTML error page?)

**Fix:**
```bash
# Restart development server
npm run dev

# Or if production:
# Check server logs: tail -f /var/log/app.log
```

---

### Issue: "Unauthorized. Please log in."

**Cause:** No valid auth token sent

**Fix:**
```javascript
// In browser console:
const token = localStorage.getItem('auth_token');
if (!token) {
  console.log('No token found - need to login');
  // Redirect to login
  window.location.href = '/login';
}
```

---

### Issue: "Access denied. ADMIN role required."

**Cause:** User doesn't have ADMIN role

**Fix:**
1. Login with admin account (check your admin credentials)
2. Verify user role in database:
   ```sql
   SELECT id, email, role FROM "User" WHERE email = 'your@email.com';
   ```
3. If role is not 'ADMIN', update it:
   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
   ```

---

### Issue: "Server error. Please check the application logs."

**Cause:** API endpoint crashed with exception

**Steps to Debug:**

1. **Check server logs:**
   ```bash
   # In development (terminal running npm run dev):
   # Look for: [DIAGNOSTICS][ERROR]
   ```

2. **Check database connection:**
   ```bash
   # Test Neon connection
   psql "postgresql://your-connection-string" -c "SELECT 1;"
   ```

3. **Verify environment variables:**
   ```bash
   # Check .env.local has:
   # - DATABASE_URL (Neon connection string)
   # - RESEND_API_KEY
   # - UPLOADTHING_SECRET
   ```

4. **Restart app:**
   ```bash
   npm run dev
   ```

---

### Issue: Stuck on "Loading diagnostics..." spinner

**Cause:** API request hanging or taking too long

**Debug:**

1. **Check Network tab:**
   - Is request still pending (spinning)?
   - What's the current size/time?
   - Any network errors?

2. **Check for slow queries:**
   ```bash
   # In server logs, look for slow operations
   # [DIAGNOSTICS][DATABASE] latency_ms > 1000 indicates cold start
   ```

3. **Force timeout:**
   ```javascript
   // In browser console:
   // Manually call refresh after 10 seconds
   setTimeout(() => {
     // Click Retry button
     document.querySelector('button:contains("Retry")').click();
   }, 10000);
   ```

---

### Issue: Console shows "JSON parse error"

**Cause:** API returned non-JSON response

**Debug:**

1. **Check Network Response:**
   - Network tab → /api/admin/diagnostics
   - Response tab → Look at actual response text
   - If it starts with `<!DOCTYPE` or `<html`, API returned HTML error page

2. **Check API error:**
   ```bash
   # Test API with curl to see raw response
   curl -i http://localhost:3000/api/admin/diagnostics \
     -H "Authorization: Bearer TOKEN"
   
   # Check Content-Type header should be: application/json
   ```

3. **Fix:** Usually means API crashed, restart dev server:
   ```bash
   npm run dev
   ```

---

## Validation Checklist

Use this to verify diagnostics is working correctly:

```
✅ Step 1: Authentication
  [ ] Can access /admin/diagnostics page
  [ ] Not redirected to login
  [ ] Console shows no 401/403 errors

✅ Step 2: API Response
  [ ] Network shows GET /api/admin/diagnostics → 200 OK
  [ ] Response time < 500ms
  [ ] Content-Type: application/json
  [ ] Response includes: timestamp, status, services, metrics

✅ Step 3: Component Display
  [ ] No "Error Loading Diagnostics" message
  [ ] Database Latency card visible with ms value
  [ ] Email Health card visible with % value
  [ ] Active Holds card visible with count
  [ ] Service Status shows all 4 services
  [ ] Each service shows: operational/degraded/offline

✅ Step 4: Functionality
  [ ] Refresh button works
  [ ] Auto-refreshes every 30 seconds
  [ ] Error Retry button appears if error occurs
  [ ] Last updated timestamp updates

✅ Step 5: Console
  [ ] No JavaScript errors
  [ ] No network errors
  [ ] [DIAGNOSTICS_PAGE] logs show execution flow
```

---

## Advanced Debugging

### Enable Verbose Logging

**In `/app/admin/diagnostics/page.tsx`:**
```typescript
// Add before console.log calls:
const DEBUG = true;

const log = (...args: any[]) => {
  if (DEBUG) console.log('[DIAG-DEBUG]', ...args);
};

// Use: log('message', data);
```

### Monitor API Performance

**In DevTools Console:**
```javascript
// Monitor fetch performance
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const start = performance.now();
  const response = await originalFetch(...args);
  const duration = performance.now() - start;
  if (args[0].includes('/api/admin/diagnostics')) {
    console.log(`[FETCH-PERF] ${args[0]} took ${duration.toFixed(2)}ms`);
  }
  return response;
};
```

### Test API with Different Scenarios

```bash
# Test with cURL in different scenarios:

# 1. Valid request
curl -X GET http://localhost:3000/api/admin/diagnostics \
  -H "Authorization: Bearer VALID_TOKEN"

# 2. Missing auth
curl -X GET http://localhost:3000/api/admin/diagnostics
# Expected: 401 Unauthorized

# 3. Invalid token
curl -X GET http://localhost:3000/api/admin/diagnostics \
  -H "Authorization: Bearer INVALID_TOKEN"
# Expected: 401 Unauthorized

# 4. Non-admin user
curl -X GET http://localhost:3000/api/admin/diagnostics \
  -H "Authorization: Bearer NON_ADMIN_TOKEN"
# Expected: 403 Forbidden
```

---

## Performance Metrics

**Healthy Diagnostics Response:**
- Response time: 100-300ms
- Database latency: <100ms (good), <1000ms (degraded)
- Email delivery rate: >95% (good), >85% (warning)
- All services: operational

**Degraded State Indicators:**
- Any service showing "degraded" status
- Email delivery rate between 85-95%
- Database latency > 1000ms (cold start)
- Response time > 500ms

**Critical State:**
- Any service showing "offline" status
- Email delivery rate < 85%
- API returning 500 errors

---

## Getting Help

### Logs to Check:

1. **Browser Console (DevTools):**
   - Filter: `[DIAGNOSTICS_PAGE]`
   - Shows client-side execution flow

2. **Server Console (terminal):**
   - Filter: `[DIAGNOSTICS]`
   - Shows API execution, health check results

3. **Network Tab (DevTools):**
   - Request: `/api/admin/diagnostics`
   - Check status, time, response body

### Error Messages to Note:
- Exact error message from error state
- API status code (401, 403, 500)
- Response body if available
- Console stack trace if present

### For Support:
Provide:
1. Screenshot of error message
2. Console logs (filtered by `[DIAGNOSTICS`)
3. Network tab response for `/api/admin/diagnostics`
4. Your user role (ADMIN confirmation)
5. Steps to reproduce

---

## Quick Command Reference

```bash
# Start dev server with logs visible
npm run dev

# Test API endpoint
curl http://localhost:3000/api/admin/diagnostics \
  -H "Authorization: Bearer TOKEN"

# Check database connection
psql "YOUR_DATABASE_URL" -c "SELECT 1;"

# View build errors
npm run build

# Check specific file for errors
npm run build 2>&1 | grep "diagnostics"
```

---

**Last Updated:** January 2, 2026  
**Status:** ✅ Working - Fixed on this date
