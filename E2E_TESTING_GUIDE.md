# Fine & Country Zimbabwe ERP - End-to-End Testing Guide

## Test Execution Date: December 31, 2025

### Overview
Complete user flow testing from landing page through dashboard functionality.

---

## Test Case 1: Landing Page & Development Data Display
**Status:** ✅ Ready to Test
**Prerequisites:** App is deployed and accessible at https://developmentsfc.vercel.app/

### Steps:
1. **Navigate to landing page**
   - Open: https://developmentsfc.vercel.app/
   - Expected: Page loads, shows "Fine & Country Zimbabwe" header with navigation

2. **Verify development listings**
   - Check if properties display (may show "No developments" if database empty)
   - Expected: Properties should show from API `/api/admin/developments`
   - Check browser console (F12 → Console) for any errors

3. **Verify logo persistence**
   - Check if company logo displays in header
   - Logo should load from database via `/api/admin/settings`

### Observed Results:
- [ ] Page loads successfully
- [ ] Navigation bar visible
- [ ] Development listings display (or show appropriate empty state)
- [ ] No console errors
- [ ] Logo displays correctly

---

## Test Case 2: Access Portal (Login Flow)
**Status:** ✅ Ready to Test

### Steps:
1. **Click "Access Portal" button**
   - Expected: Login modal opens with role selection

2. **Test Admin Login**
   - Select: "Systems administrator" role
   - Enter email or proceed with demo mode
   - Expected: Redirects to dashboard with admin role

3. **Test Agent Login**
   - Return to home, click "Access Portal" again
   - Select: "Conveyance agent" role
   - Expected: Redirects to dashboard with agent role

4. **Test Client Login**
   - Return to home, click "Access Portal" again
   - Select: "Private client" role
   - Expected: Redirects to dashboard with client role

### Observed Results:
- [ ] Login modal opens correctly
- [ ] All three roles can be selected
- [ ] Dashboard loads after login
- [ ] Correct role is applied (check URL params)
- [ ] No authentication errors

---

## Test Case 3: Dashboard Access & Role-Based UI
**Status:** ✅ Ready to Test

### Steps:
1. **Admin Dashboard**
   - Login as Admin
   - Expected: Full system overview, all menu items visible
   - Check for: Analytics, User Management, Settings

2. **Agent Dashboard**
   - Login as Agent
   - Expected: Pipeline view, client management
   - Check for: Kanban board, deals, commissions

3. **Client Dashboard**
   - Login as Client
   - Expected: Portfolio view, reservations, statements
   - Check for: My Properties, Reservations, Payments

### Observed Results:
- [ ] Admin sees all options
- [ ] Agent sees agent-specific features
- [ ] Client sees client-specific features
- [ ] No permission errors
- [ ] Navigation works between sections

---

## Test Case 4: Development Data & Seeding
**Status:** ⚠️ May Need Seeding

### Information:
- Seed script location: `scripts/seed-demo-data.ts`
- Seed command: `npm run db:seed`
- This should populate with:
  - 3 demo developments (projects)
  - 150+ demo stands (plots)
  - 5+ demo agents
  - 10+ demo clients
  - Sample reservations and activity logs

### Steps if needed:
```bash
cd /Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp
npm run db:seed
```

### Observed Results:
- [ ] Database has development data
- [ ] Developments visible on landing page
- [ ] Stands load when development selected
- [ ] Agent list populated

---

## Test Case 5: Property Selection & Reservation Flow
**Status:** ✅ Ready to Test (if data exists)

### Steps:
1. **Select a development**
   - Click on a property listing on landing page
   - Expected: Property details panel shows

2. **View stands on map**
   - Expected: Interactive map displays available plots
   - Hover/click stands to see details

3. **Initiate reservation**
   - Click "Reserve" on a stand
   - Expected: 72-hour reservation modal opens (desktop) or drawer (mobile)

4. **Complete reservation**
   - Select assigned agent or "Company HQ"
   - Accept terms and conditions
   - Expected: Reservation confirmed, timer starts

### Observed Results:
- [ ] Property details load
- [ ] Map displays correctly
- [ ] Stand selection works
- [ ] Reservation modal/drawer opens
- [ ] Confirmation message shows
- [ ] Reservation timer activates

---

## Test Case 6: API Endpoint Testing
**Status:** ✅ Ready to Test

### Critical Endpoints:

#### 1. Get Developments
```
GET https://developmentsfc.vercel.app/api/admin/developments
Expected Response: Array of development objects with name, location, price, etc.
```

#### 2. Get Agents
```
GET https://developmentsfc.vercel.app/api/admin/agents
Expected Response: Array of agent objects with name, email, contact
```

#### 3. Get Settings
```
GET https://developmentsfc.vercel.app/api/admin/settings
Expected Response: Company settings (logo_url, company_name, phone, email, address)
```

#### 4. Test with cURL:
```bash
curl https://developmentsfc.vercel.app/api/admin/developments
curl https://developmentsfc.vercel.app/api/admin/agents
curl https://developmentsfc.vercel.app/api/admin/settings
```

### Observed Results:
- [ ] /api/admin/developments returns data or empty array
- [ ] /api/admin/agents returns agent list
- [ ] /api/admin/settings returns configuration
- [ ] Response times < 1 second
- [ ] No 500 errors

---

## Test Case 7: Database Integration
**Status:** ✅ Ready to Test

### Checks:
1. **Neon Database Connection**
   - Check: Vercel environment variables set correctly
   - Variables needed:
     - `DATABASE_URL` (pooled connection)
     - `DATABASE_URL_UNPOOLED` (direct connection)
     - `NEON_DATA_API` (if using Data API)

2. **Data Persistence**
   - Login, modify a setting (e.g., save logo)
   - Refresh page
   - Expected: Settings persist

3. **API to Database**
   - Make API call to `/api/admin/developments`
   - Expected: Returns data from Neon database

### Observed Results:
- [ ] Database connection established
- [ ] Data persists across sessions
- [ ] API queries return fresh data
- [ ] No connection timeouts
- [ ] Neon dashboard shows queries

---

## Test Case 8: Error Handling & Edge Cases
**Status:** ✅ Ready to Test

### Tests:
1. **Network Errors**
   - Open DevTools → Network throttling → Slow 3G
   - Navigate page
   - Expected: Graceful degradation, error messages shown

2. **Missing Data**
   - Empty development list
   - Expected: "No developments found" message

3. **Invalid Login**
   - Try accessing dashboard directly without login
   - Expected: Redirect to landing page or login required

4. **API Errors**
   - Manually call non-existent endpoint
   - Expected: 404 or 500 error with message

### Observed Results:
- [ ] Errors displayed to user
- [ ] No console crashes
- [ ] Fallback UI shown
- [ ] User can recover

---

## Performance Metrics
**Status:** ✅ Ready to Test

### Measurements:
- Landing page load time: ___ ms
- API response time: ___ ms
- Dashboard load time: ___ ms
- Image load time: ___ ms

Use: F12 → Network tab → reload page

---

## Summary

### ✅ Working Features:
- [x] Production deployment
- [x] MIME type errors fixed
- [x] Landing page renders
- [x] Error boundaries in place
- [x] API endpoints structured

### ⚠️ Needs Verification:
- [ ] Development data seeded to database
- [ ] Login flow functional
- [ ] Dashboard accessible
- [ ] Reservation system working
- [ ] Data persistence verified

### 🔴 Known Issues:
- None at this time

### Next Steps:
1. Run `npm run db:seed` if database is empty
2. Execute all test cases above
3. Document any issues found
4. Fix critical issues before user acceptance
5. Prepare for deployment to staging environment

---

## Testing Notes:
Date: December 31, 2025
Tester: [Your Name]
Environment: Production (Vercel)
App URL: https://developmentsfc.vercel.app/

