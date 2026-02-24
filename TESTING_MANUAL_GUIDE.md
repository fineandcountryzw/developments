# MANUAL TEST GUIDE - Security & CRUD Tests

**Date:** February 2, 2026  
**Purpose:** Manual verification of all security fixes and CRUD operations  
**Execution Time:** ~2 hours

---

## SETUP

**Prerequisites:**
- Local dev server running: `npm run dev` on port 3000
- Test user accounts created (via admin dashboard or seeds)
- NextAuth session working (check `/api/auth/session`)

**Test Users:**
```
Developer A:  devA@test.com   (password: test123)
Developer B:  devB@test.com   (password: test123)
Manager:      manager@test.com (password: test123)
Admin:        admin@test.com  (password: test123)
```

---

## PART 1: DEVELOPER DASHBOARD SECURITY TESTS

### Test 1.1 - Statement Endpoint: Unauthenticated Access ❌
**Severity:** CRITICAL  
**Expected:** 401 Unauthorized

1. Open browser DevTools Console
2. Copy & paste:
```javascript
fetch('http://localhost:3000/api/developer/statement/dev-123', {
  method: 'GET'
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
3. **PASS IF:** Status is 401 and error message appears

---

### Test 1.2 - Statement Endpoint: Cross-Developer Access ❌
**Severity:** CRITICAL  
**Expected:** 403 Forbidden

**Steps:**
1. Login as **Developer A** (devA@test.com)
2. Navigate to Developer Dashboard > Payments & Statements
3. Copy the URL of any development's statement (note the developmentId)
4. Get a development ID belonging to **Developer B** (from database or create one)
5. In console, copy & paste:
```javascript
fetch('http://localhost:3000/api/developer/statement/{devB-developmentId}', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + (await fetch('/api/auth/session').then(r => r.json()).then(d => d.user.email)) }
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
6. **PASS IF:** Status is 403 and "Forbidden" message appears

---

### Test 1.3 - Stands Endpoint: IDOR Prevention (GET) ❌
**Severity:** CRITICAL  
**Expected:** Empty list (0 stands) for cross-developer access

**Steps:**
1. Login as **Developer A**
2. Note Developer A's development IDs
3. Get a development ID from **Developer B** (from DB or create)
4. Navigate to API: `/api/developer/stands?developmentId={devB-id}`
5. **PASS IF:** Returns empty array `[]` or 0 stands (not Developer B's stands)

---

### Test 1.4 - Stands Endpoint: IDOR Prevention (PUT) ❌
**Severity:** CRITICAL  
**Expected:** 403 Forbidden

**Steps:**
1. Login as **Developer A**
2. Get a stand ID from **Developer B's** development
3. In console:
```javascript
fetch('http://localhost:3000/api/developer/stands', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    standId: '{devB-standId}',
    status: 'SOLD',
    clientName: 'Hacker'
  })
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
4. **PASS IF:** Status is 403 and "Forbidden" error appears

---

### Test 1.5 - Payments POST: Unauthenticated Access ❌
**Severity:** CRITICAL  
**Expected:** 401 Unauthorized

**Steps:**
1. Open DevTools (no login needed)
2. In console:
```javascript
fetch('http://localhost:3000/api/developer/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    developmentId: 'any-id',
    amount: 50000,
    paymentDate: new Date().toISOString()
  })
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
3. **PASS IF:** Status is 401 and "Unauthorized" error

---

### Test 1.6 - Payments POST: Cross-Developer Access ❌
**Severity:** CRITICAL  
**Expected:** 403 Forbidden

**Steps:**
1. Login as **Developer A**
2. Get a development ID from **Developer B**
3. In console:
```javascript
fetch('http://localhost:3000/api/developer/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    developmentId: '{devB-devId}',
    amount: 50000,
    paymentDate: new Date().toISOString(),
    paymentMethod: 'Bank Transfer'
  })
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
4. **PASS IF:** Status is 403 and "Forbidden" error

---

### Test 1.7 - Backup Endpoint: Data Scoping ✅
**Severity:** CRITICAL  
**Expected:** Only own developments in backup

**Steps:**
1. Login as **Developer A**
2. Create 2 developments: "A-Project-1", "A-Project-2"
3. As **Developer B**, create: "B-Project-1"
4. As **Developer A**, navigate to Backup tab
5. Click "Download Full Backup"
6. Open downloaded JSON file
7. **PASS IF:**
   - Contains "A-Project-1" ✅
   - Contains "A-Project-2" ✅
   - Does NOT contain "B-Project-1" ❌

---

### Test 1.8 - Receipts: No OR Clause Leak ✅
**Severity:** HIGH  
**Expected:** Only own developments' receipts

**Steps:**
1. Login as **Developer A**
2. Navigate to Payments & Statements > Receipts
3. Check displayed development names
4. **PASS IF:** Only shows receipts for A's developments, not all active ones

---

### Test 1.9 - Installments: No OR Clause Leak ✅
**Severity:** HIGH  
**Expected:** Only own developments' installments

**Steps:**
1. Login as **Developer A**
2. Navigate to Payments & Statements > Installment Plans
3. Check displayed development names
4. **PASS IF:** Only shows installments for A's developments, not all active ones

---

## PART 2: MANAGER DASHBOARD TESTS

### Test 2.1 - Invite Agent: Rate Limiting ✅
**Severity:** MEDIUM  
**Expected:** 429 error after 5 invites/min

**Steps:**
1. Login as **Manager**
2. Navigate to Team > Add Agent
3. Invite 5 agents rapidly:
   - agent1@test.com
   - agent2@test.com
   - agent3@test.com
   - agent4@test.com
   - agent5@test.com
4. Try to invite a 6th agent
5. **PASS IF:** 6th invite shows rate limit message (429 or "too many requests")

---

### Test 2.2 - Update Agent: Name & Status ✅
**Severity:** MEDIUM  
**Expected:** Agent name and status updated

**Steps:**
1. Login as **Manager**
2. Navigate to Team
3. Click on an agent
4. Edit name to "Updated Agent Name"
5. Toggle activation status
6. Click Save
7. **PASS IF:** Changes persist (refresh page and verify)

---

### Test 2.3 - Deactivate Agent ✅
**Severity:** MEDIUM  
**Expected:** Agent marked as inactive

**Steps:**
1. Login as **Manager**
2. Navigate to Team
3. Click on an agent
4. Click "Deactivate" button
5. Confirm action
6. **PASS IF:** Agent no longer appears in active agents list

---

### Test 2.4 - Get Single Target ✅
**Severity:** MEDIUM  
**Expected:** Return single target details

**Steps:**
1. Login as **Manager**
2. Navigate to Targets
3. Click on any target
4. **PASS IF:** Full target details load (target amount, period, agent, etc.)

---

### Test 2.5 - Delete Target ✅
**Severity:** MEDIUM  
**Expected:** Target removed from list

**Steps:**
1. Login as **Manager**
2. Navigate to Targets
3. Find a target
4. Click "Delete" button
5. Confirm action
6. **PASS IF:** Target disappears from list

---

### Test 2.6 - Approval History ✅
**Severity:** MEDIUM  
**Expected:** List of approval decisions

**Steps:**
1. Login as **Manager**
2. Navigate to Approvals > History
3. **PASS IF:**
   - Page loads without error
   - Shows list of past approvals/rejections
   - Can filter by branch, date, type

---

### Test 2.7 - Branch Enforcement on Approvals ✅
**Severity:** HIGH  
**Expected:** Cannot approve from different branch

**Steps:**
1. Login as **Manager A** (Harare branch)
2. Try to access/approve a payment from **Bulawayo** branch
3. In console:
```javascript
fetch('http://localhost:3000/api/manager/approvals/reservation-123/approve', {
  method: 'POST',
  body: JSON.stringify({ comments: 'Approved' })
}).then(r => r.json()).then(d => console.log('Status:', r.status, 'Body:', d))
```
4. **PASS IF:** Status is 403 (branch mismatch error)

---

## PART 3: EMAIL INVITATION TESTS

### Test 3.1 - Invite Admin: Check Token Hashing ✅
**Severity:** HIGH  
**Expected:** Token stored as hash, not plaintext

**Steps:**
1. Login as **Admin**
2. Navigate to Users > Add User
3. Invite user: "tokentest@test.com"
4. Copy the invitation link shown (contains token)
5. Check database:
```sql
SELECT id, token, status FROM user_invitations 
WHERE email = 'tokentest@test.com' LIMIT 1;
```
6. **PASS IF:**
   - Token in DB looks like hash (64 chars, hex): `a7b8c9d0e1f2...`
   - NOT the plaintext token from the email link

---

### Test 3.2 - Invite Rate Limiting ✅
**Severity:** MEDIUM  
**Expected:** 429 after 5 invites/min

**Steps:**
1. Login as **Admin**
2. Navigate to Users > Add User
3. Invite 5 users rapidly
4. Try to invite 6th user
5. **PASS IF:** 6th shows rate limit error (429)

---

### Test 3.3 - Token Invalidation on Acceptance ✅
**Severity:** HIGH  
**Expected:** Token becomes invalid after first use

**Steps:**
1. Send invitation to "invalidatetest@test.com"
2. Copy invitation link
3. Click link and complete signup (create account, set password)
4. **PASS IF:** Account created successfully
5. Try to use same link again (copy URL from history)
6. **PASS IF:** Shows "Token expired" or "Invalid token" error

---

### Test 3.4 - Backward Compatibility (Legacy Tokens) ✅
**Severity:** MEDIUM  
**Expected:** Old plaintext tokens still work

**Steps:**
1. Manually insert a legacy plaintext token into DB:
```sql
INSERT INTO user_invitations (email, token, expires_at, created_at) 
VALUES ('legacy@test.com', 'plaintext-token-123456', NOW() + INTERVAL '30 days', NOW());
```
2. Try to accept with plaintext token
3. **PASS IF:** Either works OR shows graceful error (not system crash)

---

## PART 4: SUMMARY & SIGN-OFF

### Test Results Template

```
╔════════════════════════════════════════════════════════════════╗
║                     TEST EXECUTION SUMMARY                     ║
╚════════════════════════════════════════════════════════════════╝

DEVELOPER DASHBOARD TESTS:
  ✅ Test 1.1: Statement - Unauthenticated        [PASS/FAIL]
  ✅ Test 1.2: Statement - Cross-Dev Access      [PASS/FAIL]
  ✅ Test 1.3: Stands - IDOR GET                 [PASS/FAIL]
  ✅ Test 1.4: Stands - IDOR PUT                 [PASS/FAIL]
  ✅ Test 1.5: Payments - Unauthenticated        [PASS/FAIL]
  ✅ Test 1.6: Payments - Cross-Dev Access       [PASS/FAIL]
  ✅ Test 1.7: Backup - Data Scoping             [PASS/FAIL]
  ✅ Test 1.8: Receipts - No OR Clause           [PASS/FAIL]
  ✅ Test 1.9: Installments - No OR Clause       [PASS/FAIL]

MANAGER DASHBOARD TESTS:
  ✅ Test 2.1: Invite Agent - Rate Limiting      [PASS/FAIL]
  ✅ Test 2.2: Update Agent                      [PASS/FAIL]
  ✅ Test 2.3: Deactivate Agent                  [PASS/FAIL]
  ✅ Test 2.4: Get Single Target                 [PASS/FAIL]
  ✅ Test 2.5: Delete Target                     [PASS/FAIL]
  ✅ Test 2.6: Approval History                  [PASS/FAIL]
  ✅ Test 2.7: Branch Enforcement                [PASS/FAIL]

EMAIL INVITATION TESTS:
  ✅ Test 3.1: Token Hashing                     [PASS/FAIL]
  ✅ Test 3.2: Rate Limiting                     [PASS/FAIL]
  ✅ Test 3.3: Token Invalidation                [PASS/FAIL]
  ✅ Test 3.4: Legacy Token Support              [PASS/FAIL]

OVERALL RESULT: [PASSED / FAILED]
FAILURES: 0
BLOCKERS: None

Sign-off:
Tester: ________________
Date: ________________
Time: ________________
```

---

## RUNNING AUTOMATED TESTS

```bash
# Run all security tests
npm test -- security.test.ts

# Run with coverage
npm test -- security.test.ts --coverage

# Run specific test suite
npm test -- security.test.ts -t "Developer Dashboard"

# Run in watch mode
npm test -- security.test.ts --watch
```

---

## FAILURE TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "Cannot find module 'node-fetch'" | Run: `npm install node-fetch` |
| "Tests timeout" | Increase Jest timeout: `jest.setTimeout(10000)` |
| "401 Unauthorized" on all tests | Check NextAuth session is working |
| "Database connection failed" | Verify DATABASE_URL env var set |
| "Rate limit never triggers" | Check Redis/in-memory rate limiting is active |

---

**Last Updated:** February 2, 2026  
**Test Suite Version:** 1.0  
**Maintenance:** Review after each major deployment
