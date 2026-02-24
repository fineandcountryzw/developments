# 🧪 AUTOMATION MODULE - TESTING & VERIFICATION PLAN

**Date:** 2026-01-23  
**Status:** 🔄 **READY FOR TESTING**

---

## ✅ COMPLETED STEPS

### 1. Implementation ✅
- ✅ Core automation infrastructure (9 files)
- ✅ API routes (4 endpoints)
- ✅ UI components (3 components)
- ✅ Database schema and migration
- ✅ Integration with payment/deal systems
- ✅ Optimized engine with caching

### 2. Deployment ✅
- ✅ Database tables created
- ✅ Migration script executed
- ✅ 4 automations created in database
- ✅ No linter errors

### 3. UI Integration ✅
- ✅ App.tsx updated to use new AutomationList component
- ✅ Sidebar menu item exists (`automation`)
- ✅ Old AdminPaymentAutomationDashboard replaced

---

## 🚀 TESTING PLAN

### Phase 1: API Testing (Backend)

#### Test 1.1: List Automations API
**Endpoint:** `GET /api/admin/automations`

**Expected Result:**
```json
{
  "success": true,
  "data": [
    {
      "id": "auto-payment-reminder-Harare",
      "name": "Payment Reminders - Harare",
      "enabled": true,
      "triggerType": "schedule",
      "schedule": "0 9 5,20 * *",
      ...
    },
    ...
  ]
}
```

**Test Steps:**
1. Start dev server: `npm run dev`
2. Call API: `curl http://localhost:3000/api/admin/automations`
3. Verify 4 automations are returned
4. Verify all fields are present

**Success Criteria:**
- [ ] API returns 200 status
- [ ] Returns 4 automations (payment reminders, escalation, follow-up, payment→contract)
- [ ] All automations have correct structure

---

#### Test 1.2: Worker Endpoint
**Endpoint:** `GET /api/automation/worker`

**Expected Result:**
```json
{
  "status": "running",
  "message": "Automation worker is running"
}
```

**Test Steps:**
1. Call API: `curl http://localhost:3000/api/automation/worker`
2. Verify worker starts successfully
3. Check server logs for worker activity

**Success Criteria:**
- [ ] API returns 200 status
- [ ] Worker starts without errors
- [ ] Logs show "Automation worker started"

---

#### Test 1.3: Automation Runs API
**Endpoint:** `GET /api/admin/automations/runs`

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "runs": [],
    "total": 0
  }
}
```

**Test Steps:**
1. Call API: `curl http://localhost:3000/api/admin/automations/runs`
2. Should return empty array initially (no runs yet)

**Success Criteria:**
- [ ] API returns 200 status
- [ ] Returns empty array (no runs yet)

---

### Phase 2: Event Emission Testing

#### Test 2.1: Payment Confirmed Event
**File:** `lib/payment-success-handler.ts`

**Test Steps:**
1. Create a test payment with status CONFIRMED
2. Call payment API: `POST /api/admin/payments` with `status: "CONFIRMED"`
3. Check if event `payment.confirmed` is emitted
4. Check AutomationEventLog table

**Expected:**
- Event emitted with correlation ID
- Event logged in `automation_event_logs` table
- Automation matched and queued

**Query to verify:**
```sql
SELECT * FROM automation_event_logs 
WHERE event_type = 'payment.confirmed' 
ORDER BY timestamp DESC LIMIT 5;
```

**Success Criteria:**
- [ ] Event appears in automation_event_logs
- [ ] Correlation ID is generated
- [ ] Automation matched in triggered_automations array

---

#### Test 2.2: Deal Updated Event
**File:** `app/api/admin/deals/[id]/route.ts`

**Test Steps:**
1. Update a deal: `PUT /api/admin/deals/:id`
2. Check if event `deal.updated` is emitted
3. Verify event in AutomationEventLog

**Success Criteria:**
- [ ] Event appears in automation_event_logs
- [ ] Event has correct deal data in payload

---

### Phase 3: Automation Execution Testing

#### Test 3.1: Payment → Contract Flow

**Setup:**
1. Ensure automation exists:
   ```sql
   SELECT * FROM automations WHERE name LIKE '%Contract Creation%';
   ```

**Test Steps:**
1. Create payment with status CONFIRMED
2. Wait 10 seconds (worker processes queue)
3. Check automation_runs table
4. Verify contract was created
5. Verify email was sent (check logs)

**Queries:**
```sql
-- Check automation runs
SELECT * FROM automation_runs 
WHERE event_type = 'payment.confirmed' 
ORDER BY created_at DESC LIMIT 10;

-- Check if contract was created
SELECT * FROM contracts 
WHERE payment_id = 'YOUR_PAYMENT_ID';
```

**Success Criteria:**
- [ ] Automation run created (status: pending)
- [ ] Worker processes run (status: running → completed)
- [ ] Contract created in database
- [ ] Stand status updated to SOLD
- [ ] Email sent (check logs or email service)
- [ ] Idempotency: Running again doesn't create duplicate

---

#### Test 3.2: Scheduled Automations (Cron)

**Test Steps:**
1. Manually trigger cron job: `curl http://localhost:3000/api/cron/send-payment-reminders`
2. Check if scheduler processes scheduled automations
3. Verify events emitted
4. Verify emails sent

**Success Criteria:**
- [ ] Scheduler finds matching invoices
- [ ] Events emitted for each invoice
- [ ] Automation runs created
- [ ] Emails sent

---

### Phase 4: UI Testing

#### Test 4.1: Automation List View

**Test Steps:**
1. Login as Admin
2. Click "Automation" in sidebar
3. Verify AutomationList component renders

**Expected:**
- Table with 4 automations
- Columns: Name, Trigger, Status, Last Run, Success Rate, Actions
- Enable/Disable toggle for each automation
- Stats display (run count, success rate)

**Success Criteria:**
- [ ] AutomationList renders without errors
- [ ] All 4 automations displayed
- [ ] Toggle enable/disable works
- [ ] Stats displayed correctly
- [ ] "View Details" button for each automation

---

#### Test 4.2: Automation Detail View

**Test Steps:**
1. Click "View Details" on an automation
2. Verify AutomationDetail component renders
3. Test editing name/description
4. View condition and actions (read-only for now)

**Success Criteria:**
- [ ] Detail view renders
- [ ] Can edit basic info (name, description, enabled)
- [ ] Can view trigger config
- [ ] Can view condition (read-only JSON)
- [ ] Can view actions (read-only JSON)
- [ ] Stats displayed (runs, success rate)

---

#### Test 4.3: Automation Logs View

**Test Steps:**
1. Navigate to AutomationLogs component
2. Filter by automation, status, correlation ID
3. Test pagination
4. Test retry on failed run

**Success Criteria:**
- [ ] Logs displayed in table
- [ ] Filters work (automation, status, correlation ID)
- [ ] Pagination works
- [ ] Retry button works for failed runs
- [ ] Duration displayed correctly

---

### Phase 5: Performance Testing

#### Test 5.1: Cache Performance

**Test Steps:**
1. Emit 10 `payment.confirmed` events rapidly
2. Check logs for cache hits
3. Verify database query count

**Expected:**
- First event: Cache miss (1 DB query)
- Next 9 events: Cache hits (0 DB queries)
- Total queries: 1 (not 10)

**Success Criteria:**
- [ ] Cache hits logged
- [ ] Database query reduction verified
- [ ] Event processing < 150ms average

---

#### Test 5.2: Worker Polling Efficiency

**Test Steps:**
1. Start worker
2. Monitor polling behavior with empty queue
3. Add jobs to queue
4. Monitor polling behavior with jobs

**Expected:**
- Empty queue: Backoff to 60 seconds
- Jobs present: Poll every 5 seconds
- No CPU spikes during idle

**Success Criteria:**
- [ ] Adaptive polling works
- [ ] Backoff when empty
- [ ] Fast polling when jobs exist

---

### Phase 6: Regression Testing

#### Test 6.1: Existing Payment Flow
**Verify payment success workflow still works:**

**Test Steps:**
1. Create payment with CONFIRMED status
2. Verify stand updated to SOLD
3. Verify contract created
4. Verify email sent

**Success Criteria:**
- [ ] Payment flow unchanged
- [ ] No errors in logs
- [ ] Contract created successfully
- [ ] Email sent

---

#### Test 6.2: Cron Jobs Still Work

**Test Steps:**
1. Test payment reminders: `curl http://localhost:3000/api/cron/send-payment-reminders`
2. Test escalation: `curl http://localhost:3000/api/cron/escalate-overdue-invoices`
3. Test follow-ups: `curl http://localhost:3000/api/cron/send-followup-emails`

**Success Criteria:**
- [ ] All cron jobs execute successfully
- [ ] No errors in logs
- [ ] Emails sent as expected
- [ ] Backward compatibility maintained

---

## 🔧 DEBUGGING TOOLS

### Database Queries

**Check automations:**
```sql
SELECT id, name, enabled, trigger_type, event_type, run_count, success_count, failure_count
FROM automations
ORDER BY created_at DESC;
```

**Check automation runs:**
```sql
SELECT ar.id, ar.status, ar.event_type, ar.entity_type, ar.correlation_id, 
       ar.retry_count, ar.error_message, ar.created_at, a.name as automation_name
FROM automation_runs ar
JOIN automations a ON a.id = ar.automation_id
ORDER BY ar.created_at DESC
LIMIT 20;
```

**Check event logs:**
```sql
SELECT id, event_type, entity_type, entity_id, 
       triggered_automations, timestamp
FROM automation_event_logs
ORDER BY timestamp DESC
LIMIT 20;
```

**Trace by correlation ID:**
```sql
SELECT * FROM automation_runs
WHERE correlation_id = 'payment-123'
ORDER BY created_at;
```

---

### API Testing Commands

**List automations:**
```bash
curl http://localhost:3000/api/admin/automations | jq
```

**Start worker:**
```bash
curl http://localhost:3000/api/automation/worker | jq
```

**List runs:**
```bash
curl http://localhost:3000/api/admin/automations/runs | jq
```

**Get specific automation:**
```bash
curl http://localhost:3000/api/admin/automations/:id | jq
```

---

## 📊 SUCCESS METRICS

### Performance
- [ ] Event processing < 150ms (70% reduction from 200-500ms)
- [ ] Cache hit rate > 80%
- [ ] Database queries per event: 2-3 (50% reduction)
- [ ] Worker CPU usage < 5% when idle

### Functionality
- [ ] All 4 automations functional
- [ ] Payment → Contract flow works
- [ ] Deal update → Pipeline rules work
- [ ] Cron jobs still work
- [ ] No regressions in existing flows

### Code Quality
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] All tests pass
- [ ] Documentation complete

---

## ✅ FINAL CHECKLIST

### Pre-Production
- [ ] All API tests pass
- [ ] All event emission tests pass
- [ ] All automation execution tests pass
- [ ] All UI tests pass
- [ ] Performance tests pass
- [ ] Regression tests pass
- [ ] No errors in logs

### Production Ready
- [ ] Worker auto-starts on server start
- [ ] Monitoring in place
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] User training completed

---

## 🎯 NEXT STEPS

### Immediate
1. **Start dev server:** `npm run dev`
2. **Start worker:** Visit `http://localhost:3000/api/automation/worker`
3. **Test API:** Check `/api/admin/automations` returns 4 automations
4. **Test UI:** Navigate to Automation view in admin panel

### Testing
1. Run through Phase 1-6 tests systematically
2. Document any failures or issues
3. Fix issues and retest
4. Verify success metrics

### Production
1. Deploy to staging
2. Run full test suite
3. Monitor for 24 hours
4. Deploy to production
5. Monitor and optimize

---

**Status:** 🔄 **READY FOR TESTING**

**Last Updated:** 2026-01-23

---

## 📝 NOTES

### Known Limitations
1. Condition/Action Builder UI not implemented (read-only JSON)
2. Email templates need configuration
3. Webhook signature verification not implemented

### Future Enhancements
1. Visual condition builder
2. Visual action builder
3. Template management UI
4. Real-time monitoring dashboard
5. Advanced analytics
