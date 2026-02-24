# Phase 5A: Quick Reference Guide

## Quick Start

### Access the Control Panel
```
URL: /admin/payment-automation
Auth: Admin role required
```

### What You Can Do
1. ✅ View all email automation logs
2. ✅ Filter logs by type, status, date
3. ✅ Toggle reminders/escalation/follow-ups on/off
4. ✅ Adjust timing thresholds
5. ✅ Send test emails to verify SMTP
6. ✅ Configure admin notification emails
7. ✅ Customize email templates (optional)

---

## API Endpoints Cheat Sheet

### Get/Update Settings
```bash
# Get current settings
curl -X GET http://localhost:3000/api/admin/payment-automation/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update settings
curl -X POST http://localhost:3000/api/admin/payment-automation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enableReminders": true,
    "reminderDaysAfterDue": 5,
    "enableEscalation": true,
    "escalationDaysOverdue": 30,
    "enableFollowups": true,
    "followupFrequencyDays": 15,
    "maxFollowups": 3,
    "notificationEmails": ["admin@company.com"]
  }'
```

### View Email Logs
```bash
# Get all logs
curl -X GET "http://localhost:3000/api/admin/payment-automation/logs" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by action
curl -X GET "http://localhost:3000/api/admin/payment-automation/logs?action=send-reminder" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by status
curl -X GET "http://localhost:3000/api/admin/payment-automation/logs?emailStatus=sent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Date range filter
curl -X GET "http://localhost:3000/api/admin/payment-automation/logs?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Pagination
curl -X GET "http://localhost:3000/api/admin/payment-automation/logs?limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Test Email
```bash
curl -X POST http://localhost:3000/api/admin/payment-automation/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "subject": "[TEST] Payment Reminder",
    "content": "<h2>Test Email</h2><p>This is a test.</p>"
  }'
```

---

## Component Structure

```
AdminPaymentAutomationDashboard (Main)
├── Status Cards (3)
│   ├── Reminders Status
│   ├── Escalations Status
│   └── Follow-ups Status
├── Tabs (3)
│   ├── Overview Tab
│   │   └── System Status Card
│   ├── Email Activity Tab
│   │   └── EmailLogsViewer
│   │       ├── Filter Controls
│   │       └── Paginated Logs Table
│   └── Settings Tab
│       └── AutomationSettingsForm
│           ├── Payment Reminders Section
│           ├── Invoice Escalation Section
│           ├── Follow-up Emails Section
│           ├── Admin Notifications
│           └── Custom Email Template
└── TestEmailModal
    ├── Email Input
    ├── Subject Input
    ├── Content Textarea
    └── Send Button
```

---

## Database Schema

### PaymentAutomationSettings Table
```sql
CREATE TABLE "PaymentAutomationSettings" (
  id STRING PRIMARY KEY,
  branch STRING NOT NULL,
  enableReminders BOOLEAN DEFAULT true,
  enableEscalation BOOLEAN DEFAULT true,
  enableFollowups BOOLEAN DEFAULT true,
  reminderDaysAfterDue INT DEFAULT 0,
  escalationDaysOverdue INT DEFAULT 30,
  followupFrequencyDays INT DEFAULT 15,
  maxFollowups INT DEFAULT 3,
  customEmailTemplate STRING,
  notificationEmails JSON DEFAULT [],
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### PaymentAutomationLog Table
```sql
CREATE TABLE "PaymentAutomationLog" (
  id STRING PRIMARY KEY,
  action STRING NOT NULL,
  emailStatus STRING NOT NULL,
  recipientEmail STRING NOT NULL,
  subject STRING NOT NULL,
  sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);
```

---

## Common Tasks

### Task: Enable Payment Reminders
1. Go to `/admin/payment-automation`
2. Click **Settings** tab
3. Toggle "Enable Payment Reminders" ON
4. Set "Days After Due Date" to desired value (e.g., 0 for immediate, 5 for 5 days)
5. Click **Save Settings**

### Task: View Failed Emails
1. Go to `/admin/payment-automation`
2. Click **Email Activity** tab
3. In Status filter, select "Failed"
4. Review failed emails
5. Check error messages in logs

### Task: Test SMTP Configuration
1. Click **Send Test Email** button in header
2. Enter your email address
3. Click **Send Test Email**
4. Check if you receive the email
5. If not received, check SMTP credentials in `.env.local`

### Task: Add New Admin for Escalation Emails
1. Go to **Settings** tab
2. Scroll to "Admin Notifications" section
3. Add new email on a new line
4. Click **Save Settings**

### Task: Customize Email Template
1. Go to **Settings** tab
2. Scroll to "Custom Email Template" section
3. Enter custom HTML
4. Use variables: {CLIENT_NAME}, {TOTAL_AMOUNT}, {INVOICE_NUMBER}, etc.
5. Click **Save Settings**

---

## Status Codes & Error Messages

### API Responses
```
200 OK
  - Success response, data returned

400 Bad Request
  - Missing required fields
  - Invalid email format
  - Invalid date format

401 Unauthorized
  - User not logged in
  - Session expired

403 Forbidden
  - User is not an admin
  - Insufficient permissions

500 Internal Server Error
  - Database error
  - SMTP error
  - Unexpected server error
```

### Common Error Messages
```
"Failed to fetch settings"
  → Check database connection

"Failed to update settings"
  → Verify all required fields are filled

"Failed to send test email"
  → Check SMTP configuration
  → Verify email address is valid
  → Check server logs for details
```

---

## Performance Tips

### For Large Email Logs
- Use date range filters to reduce data
- Paginate through results (don't load all at once)
- Index the `sentAt` column in database

### For Settings Changes
- Changes take effect immediately on next cron run
- Restart cron jobs if changes seem delayed
- Settings are cached, so API calls are fast

### For Test Emails
- SMTP operations take 2-5 seconds
- Wait for success message before sending another
- Check spam folder if test email not received

---

## File Locations

### API Endpoints
- `app/api/admin/payment-automation/settings/route.ts`
- `app/api/admin/payment-automation/logs/route.ts`
- `app/api/admin/payment-automation/test-email/route.ts`

### React Components
- `components/admin/AdminPaymentAutomationDashboard.tsx` (main)
- `components/admin/AutomationSettingsForm.tsx`
- `components/admin/EmailLogsViewer.tsx`
- `components/admin/TestEmailModal.tsx`

### Pages
- `app/admin/payment-automation/page.tsx`

### Documentation
- `PHASE_5A_ADMIN_CONTROL_PANEL.md` (detailed)
- `PHASE_5A_QUICK_REFERENCE.md` (this file)

---

## Keyboard Shortcuts

None implemented yet, but consider:
- `Ctrl+K`: Quick search for emails
- `Ctrl+S`: Save settings form
- `Ctrl+/`: Help menu

---

## Related Documentation

- **Phase 4**: `PHASE_4_PAYMENT_AUTOMATION.md` - Cron jobs & email templates
- **Phase 3**: `PHASE_3_LAUNCH_SUMMARY.md` - Initial system setup
- **Database**: `NEON_DATABASE_INTEGRATION.md` - Database queries & setup

---

## Support Resources

### Debugging Steps
1. Check browser console (F12 → Console tab)
2. Check network requests (F12 → Network tab)
3. Check server logs (`npm run dev` output)
4. Check database with Prisma Studio: `npx prisma studio`
5. Test API directly with curl (see examples above)

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Not authorized" error | Verify you're logged in as admin |
| Settings not saving | Check form validation, reload page |
| Test email not received | Check spam folder, verify SMTP creds |
| Logs not appearing | Check cron jobs are running, wait 1-5 min |
| Table loads slowly | Use date filters to reduce data |

---

**Last Updated**: January 2024
**Version**: 1.0
**Status**: Production Ready ✅
