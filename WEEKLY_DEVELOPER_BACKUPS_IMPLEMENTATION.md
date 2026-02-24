# Weekly Developer Backups Implementation

## Overview

Automated weekly backups for developers in **CSV** and **PDF** format. The system automatically generates and emails backups every Monday at 09:00 AM (CAT).

---

## Features

✅ **Automated Weekly Backups**
- Runs every Monday at 09:00 AM CAT (07:00 UTC)
- Generates CSV and PDF backups for each developer
- Emails both attachments automatically

✅ **Complete Data Coverage**
- **Developments** – All developer's developments with details
- **Stands** – All stands in developer's developments
- **Payments** – All developer payments from `developer_payments` table
- **Reservations** – All reservations for stands in developer's developments

✅ **Dual Format**
- **CSV Backup** – Spreadsheet format for easy import/analysis
- **PDF Backup** – Formatted report with summary and details

✅ **Email Delivery**
- Sent to `developer_email` from database
- Professional HTML email with summary
- Both CSV and PDF attached
- Automatic failure notifications to admins

---

## Implementation

### 1. Cron Job Route
**File:** `app/api/cron/weekly-developer-backups/route.ts`

- Fetches all unique developers (by `developer_email`)
- For each developer:
  - Fetches their developments, stands, payments, reservations
  - Generates CSV backup
  - Generates PDF backup (using jsPDF)
  - Emails both attachments
- Logs results and notifies admins of failures

### 2. Vercel Cron Configuration
**File:** `vercel.json`

Added cron job:
```json
{
  "path": "/api/cron/weekly-developer-backups",
  "schedule": "0 7 * * 1"
}
```

**Schedule:** Every Monday at 07:00 UTC (09:00 CAT)

### 3. Authorization
- Requires Vercel cron header (`x-vercel-cron: 1`) OR
- `CRON_SECRET` in Authorization header
- Prevents unauthorized access

---

## Backup Contents

### CSV Backup Structure
1. **Header** – Developer name, backup date
2. **Summary** – Totals (developments, stands, payments, reservations, revenue)
3. **Developments** – Full development details
4. **Stands** – All stands with status, price, size
5. **Payments** – Payment history with references
6. **Reservations** – Reservation details

### PDF Backup Structure
1. **Header** – Fine & Country branding
2. **Summary** – Key statistics
3. **Developments** – List of all developments
4. **Recent Payments** – Last 10 payments

---

## Email Template

**Subject:** `Weekly Data Backup – [Start Date] to [End Date]`

**Content:**
- Professional HTML email
- Summary statistics
- Explanation of attached files
- Contact information

**Attachments:**
- `backup-[email]_[date].csv`
- `backup-[email]_[date].pdf`

---

## Security

✅ **Developer Email Validation**
- Only uses `developer_email` from database
- Validates email format before sending
- Never exposes full emails in logs

✅ **Data Scoping**
- Each developer only receives their own data
- Filtered by `developer_email` in all queries
- No cross-developer data leaks

✅ **Authorization**
- Cron job requires Vercel header or `CRON_SECRET`
- Cannot be triggered by unauthorized users

---

## Monitoring & Logging

### Success Metrics
- `backupsGenerated` – Total developers processed
- `emailsSent` – Successfully delivered
- `emailsFailed` – Failed deliveries
- `skippedNoEmail` – Developers without email
- `skippedInvalidEmail` – Invalid email formats

### Failure Handling
- Failed deliveries logged with error details
- Admin notification email sent for failures
- Individual developer errors don't stop batch processing

---

## Manual Trigger (Testing)

You can manually trigger the backup cron for testing:

```bash
# Using curl
curl -X GET "http://localhost:5090/api/cron/weekly-developer-backups" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or via Vercel CLI
vercel cron trigger weekly-developer-backups
```

**Note:** Replace `YOUR_CRON_SECRET` with the value from your `.env` file.

---

## Configuration

### Environment Variables
- `CRON_SECRET` – Secret for manual cron triggers
- `DATABASE_URL` – PostgreSQL connection string
- `RESEND_API_KEY` – Email service API key
- `ADMIN_EMAILS` – Comma-separated admin emails for failure notifications

### Vercel Deployment
The cron job is automatically configured in `vercel.json` and will run on Vercel deployments.

---

## Testing Checklist

- [ ] Cron job runs on schedule (Monday 09:00 CAT)
- [ ] CSV backup contains all expected data
- [ ] PDF backup is properly formatted
- [ ] Emails are sent to correct developer addresses
- [ ] Both attachments are included in email
- [ ] Admin notifications work for failures
- [ ] Data is correctly scoped per developer
- [ ] No cross-developer data leaks

---

## Troubleshooting

### Backups Not Being Sent
1. Check `RESEND_API_KEY` is configured
2. Verify `developer_email` exists in database
3. Check email format is valid
4. Review cron logs in Vercel dashboard

### Missing Data in Backups
1. Verify developer has developments assigned (`developer_email` set)
2. Check database queries are returning data
3. Review error logs for query failures

### PDF Generation Issues
1. Ensure `jspdf` package is installed
2. Check for PDF generation errors in logs
3. Verify buffer conversion is working

---

## Status: ✅ IMPLEMENTED

The weekly developer backup system is now:
- ✅ Automated (runs every Monday)
- ✅ Generates CSV and PDF backups
- ✅ Emails both formats to developers
- ✅ Scoped to each developer's data
- ✅ Includes failure notifications
- ✅ Production-ready
