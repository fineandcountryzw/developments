# Phase 4 Payment Automation - Quick Reference Guide

## 🎯 Quick Start

### Email Templates (3 files)
```
app/lib/email-templates/
├── payment-reminder.ts          → Friendly payment reminders
├── overdue-escalation.ts        → Critical 30+ days overdue notices
└── followup-email.ts            → Individual invoice follow-ups
```

### Cron Jobs (3 endpoints)
```
app/api/cron/
├── send-payment-reminders/      → 5th & 20th of month @ 09:00 UTC
├── escalate-overdue-invoices/   → 1st of month @ 08:00 UTC
└── send-followup-emails/        → 10th & 25th of month @ 10:00 UTC
```

---

## 📅 Cron Schedule Matrix

| Date | Time UTC | Job | Frequency |
|------|----------|-----|-----------|
| 1st | 08:00 | Escalate overdue (30+ days) | Monthly |
| 5th | 09:00 | Send payment reminders | 2x month |
| 10th | 10:00 | Send follow-up emails | 2x month |
| 20th | 09:00 | Send payment reminders | 2x month |
| 25th | 10:00 | Send follow-up emails | 2x month |

---

## 🔐 Authentication

All cron endpoints require:
```
Authorization: Bearer {CRON_SECRET}
```

**Get CRON_SECRET**:
```bash
echo $CRON_SECRET
```

---

## 🧪 Test Endpoints

### 1. Test Reminder Job
```bash
curl -X POST http://localhost:3000/api/cron/send-payment-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. Test Escalation Job
```bash
curl -X POST http://localhost:3000/api/cron/escalate-overdue-invoices \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Test Follow-up Job
```bash
curl -X POST http://localhost:3000/api/cron/send-followup-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 💾 Database Models

### Invoice Fields
```
id                String         // Primary key
clientId          String         // Who owes
invoiceNumber     String         // INV-2025-001
invoiceDate       DateTime       // When created
dueDate           DateTime       // Payment deadline
totalAmount       Decimal        // Amount due
paidAmount        Decimal        // Amount paid so far
status            String         // OUTSTANDING | OVERDUE | PAID | CANCELLED
reminderSentAt    DateTime?      // Reminder email sent
escalatedAt       DateTime?      // Escalation email sent
followupSentAt    DateTime?      // Follow-up email sent
followupCount     Int            // Number of follow-ups
```

### Payment Automation Settings
```
branch                String      // Harare | Bulawayo
enableReminders       Boolean     // On/off toggle
enableEscalation      Boolean     // On/off toggle
enableFollowups       Boolean     // On/off toggle
reminderDaysAfterDue  Int         // Days before first reminder
escalationDaysOverdue Int         // Days before escalation (default: 30)
followupFrequencyDays Int         // Days between follow-ups
maxFollowups          Int         // Max follow-ups (default: 3)
notificationEmails    String[]    // Admin emails
```

---

## 📧 Email Templates

### Payment Reminder
- **Trigger**: OUTSTANDING invoices on 5th & 20th
- **Color**: Gold/Brown (brand colors)
- **Content**: Invoice list, total due, payment methods
- **CTA**: "View Dashboard"

### Overdue Escalation
- **Trigger**: 30+ days overdue on 1st
- **Color**: Red (critical)
- **Content**: Total overdue, days overdue, consequences, legal notice
- **CTA**: "Process Payment Now" (urgent)

### Follow-up Email
- **Trigger**: OVERDUE invoices on 10th & 25th
- **Color**: Dynamic (yellow → orange → red based on age)
- **Content**: Individual invoice focus, previous reminder count
- **CTA**: "View & Pay Invoice"

---

## ⚙️ Environment Variables

```env
# Email Server
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw

# Cron Security
CRON_SECRET=your-secret-key-here

# Notifications
ADMIN_EMAILS=admin1@mail.com,admin2@mail.com
```

---

## 🚀 Deployment Checklist

- [ ] Database migrations run: `npx prisma migrate dev`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Environment variables set
- [ ] Cron jobs created on cron-job.org
- [ ] Test endpoints return 200 OK
- [ ] Emails being sent successfully
- [ ] Admin receiving escalation notices
- [ ] Database logs being created
- [ ] Monitoring/alerting configured

---

## 📊 Response Examples

### Success (200)
```json
{
  "status": 200,
  "message": "Payment reminders processed: 5 sent, 0 failed",
  "timestamp": "2025-12-30T04:50:59.047Z",
  "correlationId": "send-reminders-1735632659047",
  "executionTimeMs": 1234,
  "data": {
    "remindersQueued": 5,
    "remindersSent": 5,
    "remindersFailed": 0,
    "invoicesProcessed": 12,
    "clientsProcessed": 5,
    "details": []
  }
}
```

### Partial Failure (207)
```json
{
  "status": 207,
  "message": "Payment reminders processed: 4 sent, 1 failed",
  "data": {
    "remindersSent": 4,
    "remindersFailed": 1,
    "details": [
      {
        "clientId": "xyz",
        "error": "SMTP connection failed"
      }
    ]
  }
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "status": 401
}
```

---

## 🔍 Monitoring & Logs

### Check Job Status
```bash
# View logs in real-time
tail -f /var/log/pm2/erp-app.log

# Search for cron activities
grep "send-reminders\|escalate-overdue\|send-followup" /var/log/pm2/erp-app.log

# Count successful sends
grep -c "Reminder sent to" /var/log/pm2/erp-app.log
```

### Database Queries

**Check latest invoices**:
```sql
SELECT id, invoiceNumber, status, reminderSentAt, escalatedAt, followupSentAt
FROM invoices
ORDER BY createdAt DESC
LIMIT 10;
```

**Check payment automation logs**:
```sql
SELECT * FROM payment_automation_logs
ORDER BY createdAt DESC
LIMIT 20;
```

**Check settings per branch**:
```sql
SELECT * FROM payment_automation_settings;
```

---

## 🐛 Troubleshooting

### "Unauthorized" Error
**Issue**: CRON_SECRET mismatch  
**Solution**: Verify `CRON_SECRET` env var matches cron-job.org header

### Emails Not Sending
**Issue**: SMTP configuration error  
**Solution**: 
1. Check SMTP credentials in .env
2. Verify Gmail "App Password" if using Gmail
3. Check firewall allows port 587

### No Invoices Found
**Issue**: Cron runs but finds no data  
**Solution**:
1. Verify invoices exist with correct status
2. Check invoice dueDate is in the past
3. Verify client has valid email address

### Database Error
**Issue**: Prisma query fails  
**Solution**:
1. Run `npx prisma generate`
2. Check Neon database connection
3. Verify schema migrations applied

---

## 📞 Support

**For Issues**:
1. Check logs: `tail -f /var/log/pm2/erp-app.log`
2. Check database: Query payment_automation_logs table
3. Test endpoint manually with curl
4. Review .env configuration

**Key Contact**: accounts@finecountry.co.zw

---

## 📚 Full Documentation

- [Phase 4 Complete Guide](PHASE_4_PAYMENT_AUTOMATION_COMPLETE.md)
- [Cron Job Setup Guide](CRON_JOB_SETUP_GUIDE.md)
- [SMTP Configuration](SMTP_SETUP_GUIDE.md)

---

*Last Updated: December 30, 2025*
*Phase 4 - Payment Automation v1.0*
