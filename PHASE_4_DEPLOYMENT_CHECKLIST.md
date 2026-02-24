# Phase 4 Deployment Readiness Checklist

## ✅ Pre-Deployment Verification

### Code Quality
- [ ] All TypeScript files compile without errors
- [ ] No console.log() statements left in production code
- [ ] Proper error handling in all cron endpoints
- [ ] Authorization checks on all protected routes
- [ ] Logging configured for debugging

### Database
- [ ] Schema migration script prepared
- [ ] Backup of production database created
- [ ] Migration tested in staging environment
- [ ] Prisma client regenerated: `npx prisma generate`
- [ ] Invoice model added to schema.prisma

### Email Configuration
- [ ] SMTP provider account created
- [ ] App-specific password generated
- [ ] SMTP credentials tested
- [ ] Sender email verified with provider
- [ ] Reply-to email configured
- [ ] Admin email list confirmed

### Environment Variables
- [ ] SMTP_HOST set correctly
- [ ] SMTP_PORT set correctly (587 or 465)
- [ ] SMTP_SECURE set correctly (false for 587, true for 465)
- [ ] SMTP_USER valid
- [ ] SMTP_PASSWORD valid (app password, not main password)
- [ ] SMTP_FROM verified with provider
- [ ] SMTP_REPLY_TO configured
- [ ] CRON_SECRET generated (min 32 characters)
- [ ] ADMIN_EMAILS list populated
- [ ] All env vars do NOT contain quotes

### Cron Job Setup
- [ ] cron-job.org account created
- [ ] 3 cron jobs created:
  - [ ] send-payment-reminders (5th, 20th @ 09:00 UTC)
  - [ ] escalate-overdue-invoices (1st @ 08:00 UTC)
  - [ ] send-followup-emails (10th, 25th @ 10:00 UTC)
- [ ] Each job has correct Authorization header
- [ ] Each job has correct URL
- [ ] Each job scheduled with correct cron expression

### Testing
- [ ] All endpoints return 200 OK
- [ ] Email reminders send successfully
- [ ] Email escalations send successfully
- [ ] Email follow-ups send successfully
- [ ] Database updates recorded correctly
- [ ] Logs show successful execution
- [ ] Error handling works (401, 403, 500 scenarios)

---

## 🚀 Deployment Steps

### Step 1: Database Migration
```bash
cd /path/to/erp
npx prisma migrate dev --name add_payment_automation
npx prisma generate
```

**Verify**: Check that 4 new tables created in database
```sql
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'invoices' OR tablename LIKE 'payment_automation%';
```

### Step 2: Environment Configuration
```bash
# Add to .env.production
cat >> .env.production << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=accounts@finecountry.co.zw
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
CRON_SECRET=your-min-32-char-secret-key
ADMIN_EMAILS=director@finecountry.co.zw,finance@finecountry.co.zw
EOF
```

### Step 3: Build & Deploy
```bash
# Build the application
npm run build

# Verify build succeeded
npm run start --dry-run

# Deploy (if using Vercel)
vercel deploy --prod

# Or if self-hosted
pm2 restart erp-app
```

### Step 4: Cron Job Setup
1. Go to [cron-job.org](https://cron-job.org)
2. Create 3 cron jobs (see below)
3. Test each job manually
4. Monitor logs for first 24 hours

---

## 📋 Cron Job Creation Guide

### Job 1: Send Payment Reminders

**Settings**:
- Title: `Send Payment Reminders`
- URL: `https://your-domain.com/api/cron/send-payment-reminders`
- Method: POST
- Schedule: `0 9 5,20 * *` (5th & 20th at 09:00 UTC)
- Timeout: 300 seconds

**Headers**:
```
Authorization: Bearer YOUR_CRON_SECRET
Content-Type: application/json
```

**Verification**:
```bash
curl -X POST https://your-domain.com/api/cron/send-payment-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON response
```

### Job 2: Escalate Overdue Invoices

**Settings**:
- Title: `Escalate Overdue Invoices`
- URL: `https://your-domain.com/api/cron/escalate-overdue-invoices`
- Method: POST
- Schedule: `0 8 1 * *` (1st at 08:00 UTC)
- Timeout: 300 seconds

**Headers**:
```
Authorization: Bearer YOUR_CRON_SECRET
Content-Type: application/json
```

**Verification**:
```bash
curl -X POST https://your-domain.com/api/cron/escalate-overdue-invoices \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON response
```

### Job 3: Send Follow-up Emails

**Settings**:
- Title: `Send Follow-up Emails`
- URL: `https://your-domain.com/api/cron/send-followup-emails`
- Method: POST
- Schedule: `0 10 10,25 * *` (10th & 25th at 10:00 UTC)
- Timeout: 300 seconds

**Headers**:
```
Authorization: Bearer YOUR_CRON_SECRET
Content-Type: application/json
```

**Verification**:
```bash
curl -X POST https://your-domain.com/api/cron/send-followup-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON response
```

---

## 🔍 Post-Deployment Validation

### Immediate (First Hour)
- [ ] Application starts without errors
- [ ] No TypeScript compilation errors
- [ ] Database connections established
- [ ] SMTP connection successful
- [ ] API endpoints responding (200 OK)

### First Day
- [ ] Test manually trigger each cron job
- [ ] Verify emails are sent successfully
- [ ] Check database logs for records
- [ ] Confirm admin receiving escalation emails
- [ ] Monitor error logs for issues

### First Week
- [ ] Monitor scheduled jobs run automatically
- [ ] Check email delivery rates
- [ ] Verify client payments responding to reminders
- [ ] Review Payment Automation Logs table
- [ ] Monitor system performance

### Ongoing
- [ ] Track email metrics (open rate, click rate)
- [ ] Monitor payment response rate
- [ ] Check for any delivery failures
- [ ] Review logs weekly for errors
- [ ] Update admin email list as needed

---

## 🐛 Troubleshooting Guide

### Issue: Cron jobs not running
**Symptoms**: Jobs scheduled but no emails sent  
**Check**:
1. Verify cron-job.org shows "Last execution" timestamp
2. Check application logs for errors
3. Verify CRON_SECRET matches in cron-job.org
4. Test endpoint manually: `curl -X POST ...`

### Issue: SMTP connection failed
**Symptoms**: Cron runs but returns error in logs  
**Check**:
1. Verify SMTP credentials in .env
2. Test SMTP connection: See SMTP_SETUP_GUIDE.md
3. Check firewall allows port 587/465
4. Verify Gmail "Less secure app access" or "App password"
5. Check SMTP_SECURE matches port (false for 587, true for 465)

### Issue: Emails not being sent
**Symptoms**: No emails in client inboxes  
**Check**:
1. Verify SMTP_FROM is verified with provider
2. Check email spam folder
3. Review SPF/DKIM records
4. Check application logs for send errors
5. Verify client email addresses in database

### Issue: Database queries failing
**Symptoms**: Cron runs but no database updates  
**Check**:
1. Verify database connection string
2. Check Invoice table exists: `SELECT COUNT(*) FROM invoices;`
3. Verify Prisma schema matches database
4. Run: `npx prisma generate`
5. Check database logs for errors

### Issue: 401/403 Unauthorized errors
**Symptoms**: Cron returns "Unauthorized" or "Invalid token"  
**Check**:
1. Verify CRON_SECRET in .env
2. Verify Authorization header in cron-job.org
3. Confirm format: `Authorization: Bearer YOUR_SECRET`
4. Check for extra spaces in secret
5. Regenerate secret if uncertain

---

## 📊 Monitoring Commands

### Check Application Logs
```bash
# If using PM2
pm2 logs erp-app | grep -i "send-reminders\|escalate\|followup"

# If using systemd
journalctl -u erp-app -f | grep -i "send-reminders\|escalate\|followup"

# If using Docker
docker logs -f erp-app-container | grep -i "send-reminders\|escalate\|followup"
```

### Check Database Activity
```bash
# Recent invoices
SELECT id, invoiceNumber, status, reminderSentAt, escalatedAt, createdAt
FROM invoices
ORDER BY createdAt DESC
LIMIT 20;

# Recent automation logs
SELECT id, invoiceId, action, emailStatus, createdAt
FROM payment_automation_logs
ORDER BY createdAt DESC
LIMIT 50;

# Automation settings
SELECT * FROM payment_automation_settings;

# Count by action
SELECT action, COUNT(*) as count
FROM payment_automation_logs
GROUP BY action
ORDER BY count DESC;
```

### Test Cron Endpoints
```bash
# Set secret variable
CRON_SECRET="your-secret-key"

# Test reminder job
curl -X POST https://your-domain.com/api/cron/send-payment-reminders \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# Test escalation job
curl -X POST https://your-domain.com/api/cron/escalate-overdue-invoices \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# Test follow-up job
curl -X POST https://your-domain.com/api/cron/send-followup-emails \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

---

## 📈 Success Metrics

### Email Delivery
- ✅ >98% delivery rate
- ✅ <5% bounce rate
- ✅ Zero failures after retries

### Business Impact
- ✅ Reduction in overdue invoices
- ✅ Improved payment response time
- ✅ Reduced manual follow-up work
- ✅ Better cash flow predictability

### System Performance
- ✅ <500ms response time per endpoint
- ✅ <2 second job execution time
- ✅ 99.9% uptime
- ✅ Zero data corruption

---

## 🆘 Escalation Procedure

If issues occur:

1. **Check Logs** (First 5 minutes)
   - Application logs
   - SMTP logs
   - Database logs

2. **Manual Test** (Next 10 minutes)
   - Test endpoint with curl
   - Verify database updates
   - Check email provider

3. **Emergency Contact**
   - Finance Director: director@finecountry.co.zw
   - IT Support: it@finecountry.co.zw
   - Development Team: Available 24/7 for critical issues

4. **Rollback Plan**
   - If critical failures: disable cron jobs
   - Revert database migration if needed
   - Notify stakeholders of delay
   - Implement fix and re-deploy

---

## 📋 Final Checklist Before Going Live

- [ ] All 9 files created successfully
- [ ] prisma/schema.prisma modified
- [ ] Database migration created and tested
- [ ] Environment variables configured
- [ ] SMTP tested successfully
- [ ] 3 cron jobs created on cron-job.org
- [ ] Manual cron tests pass (200 OK)
- [ ] Emails sending successfully
- [ ] Database records updating correctly
- [ ] Documentation reviewed
- [ ] Team trained on monitoring
- [ ] Rollback plan documented
- [ ] 24/7 support line confirmed
- [ ] Success metrics established

---

**Status**: Ready for Production Deployment  
**Date**: December 30, 2025  
**Version**: Phase 4 - Payment Automation v1.0

---

*For support or questions, contact accounts@finecountry.co.zw*
