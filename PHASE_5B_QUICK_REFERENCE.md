# Phase 5B Email Tracking & Analytics - Quick Reference

## 🚀 Quick Start

### Accessing Analytics Dashboard
```
URL: http://localhost:3000/admin/email-analytics
Auth: Admin user required
```

### Basic API Calls

```bash
# Get overview metrics (last 30 days)
curl "http://localhost:3000/api/admin/email-analytics/overview?startDate=2024-01-01&endDate=2024-01-31"

# Get daily trends
curl "http://localhost:3000/api/admin/email-analytics/timeline?startDate=2024-01-01&endDate=2024-01-31&granularity=DAILY"

# Get recipient engagement (paginated)
curl "http://localhost:3000/api/admin/email-analytics/recipients?limit=10&offset=0"
```

## 📊 Dashboard Features

### Filters
- **Date Range**: Default last 30 days
- **Action Type**: REMINDER, ESCALATION, FOLLOWUP, or All
- **Granularity**: HOURLY, DAILY, WEEKLY, MONTHLY

### Tabs
1. **Overview Charts** - Delivery breakdown, action breakdown, device breakdown
2. **Engagement Timeline** - Time-series data showing trends
3. **Recipients** - Per-recipient engagement with pagination

## 🔧 Integration Checklist

### For Each Email Type (Reminder, Escalation, Follow-up):

1. **Get Tracking ID**:
   ```typescript
   import { createTrackingPixel, createTrackedLink, addTrackingToEmailContent } from '@/lib/email-tracking';
   
   const trackingData = {
     paymentLogId: log.id,
     recipientEmail: client.email,
     clientId: client.id,
     action: 'REMINDER', // or ESCALATION, FOLLOWUP
     invoiceId: invoice.id,
     clientName: client.name,
   };
   ```

2. **Add Tracking Pixel** (at end of HTML):
   ```typescript
   const pixel = createTrackingPixel(trackingData);
   emailHtml += pixel;
   ```

3. **Wrap Links**:
   ```typescript
   const trackedLink = createTrackedLink(originalUrl, trackingData);
   emailHtml = emailHtml.replace(originalUrl, trackedLink);
   ```

4. **Or Use Auto-Integration**:
   ```typescript
   emailHtml = addTrackingToEmailContent(emailHtml, trackingData);
   ```

## 📈 Key Metrics

| Metric | Definition | Formula |
|--------|-----------|---------|
| **Open Rate** | % of sent emails opened | (Opened / Sent) × 100 |
| **Click Rate** | % of sent emails with clicks | (Clicked / Sent) × 100 |
| **Bounce Rate** | % of sent emails bounced | (Bounced / Sent) × 100 |
| **Engagement** | Emails with opens OR clicks | (Opened + Clicked) / Sent |

## 🗄️ Database Tables

```
EmailOpen
├── Tracks email opens with device info
├── Indexed: recipientEmail, paymentLogId, action, createdAt
└── TTL: None (keeps full history)

EmailClick
├── Tracks link clicks with URL
├── Indexed: recipientEmail, paymentLogId, action, createdAt
└── TTL: None

EmailBounce
├── Tracks failed deliveries
├── Indexed: recipientEmail, paymentLogId
└── Bounce types: soft, hard, spam, unsubscribe

EmailAnalyticsSummary
├── Pre-computed metrics (hourly refresh)
├── Indexed: action, dateRange
└── Improves dashboard performance
```

## 🎯 API Response Examples

### Overview Response
```json
{
  "overview": {
    "totalSent": 150,
    "totalOpened": 75,
    "totalClicked": 30,
    "totalBounced": 3,
    "openRate": 50,
    "clickRate": 20,
    "bounceRate": 2
  },
  "actionBreakdown": [
    { "action": "REMINDER", "count": 100 },
    { "action": "ESCALATION", "count": 40 },
    { "action": "FOLLOWUP", "count": 10 }
  ],
  "deviceBreakdown": [
    { "deviceType": "desktop", "count": 85 },
    { "deviceType": "mobile", "count": 35 }
  ]
}
```

### Timeline Response
```json
{
  "timeline": [
    {
      "timestamp": "2024-01-15T00:00:00Z",
      "sent": 25,
      "opened": 12,
      "clicked": 5,
      "bounced": 1,
      "openRate": 48,
      "clickRate": 20
    }
  ]
}
```

### Recipients Response
```json
{
  "recipients": [
    {
      "recipientEmail": "john@company.com",
      "clientName": "ABC Corp",
      "openCount": 5,
      "clickCount": 2,
      "lastOpenedAt": "2024-01-15T10:30:00Z",
      "deviceTypes": ["desktop", "mobile"]
    }
  ],
  "total": 150
}
```

## 🔍 Debugging

### Check if Tracking is Working
1. **Send Test Email** via admin panel
2. **Open Email** and check browser console for pixel request
3. **Query Database**:
   ```sql
   SELECT * FROM "EmailOpen" 
   WHERE "recipientEmail" = 'test@example.com' 
   ORDER BY "createdAt" DESC;
   ```
4. **Check Dashboard** after 5 minutes for updated metrics

### Common Issues

| Issue | Solution |
|-------|----------|
| Pixels not loading | Check if email client supports images; verify pixel URL |
| Clicks not tracked | Verify links are wrapped; check URL encoding |
| No dashboard data | Verify date range includes sent emails; check logs in DB |
| High bounce rate | Check email validity; verify SMTP credentials |

## 📁 File Locations

```
Components:
├── /components/admin/EmailAnalyticsDashboard.tsx
├── /components/admin/AnalyticsOverviewCards.tsx
├── /components/admin/AnalyticsCharts.tsx
├── /components/admin/RecipientsTable.tsx
└── /components/admin/EngagementTimeline.tsx

APIs:
├── /app/api/admin/email-analytics/overview/route.ts
├── /app/api/admin/email-analytics/timeline/route.ts
├── /app/api/admin/email-analytics/recipients/route.ts
├── /app/api/email-tracking/pixel/[trackingId]/route.ts
└── /app/api/email-tracking/click/route.ts

Utilities:
└── /lib/email-tracking.ts

Pages:
└── /app/admin/email-analytics/page.tsx

Database:
└── /prisma/schema.prisma (EmailOpen, EmailClick, EmailBounce, EmailAnalyticsSummary)
```

## ⚡ Performance Tips

1. **Use pre-computed EmailAnalyticsSummary** for dashboard overview
2. **Limit timeline queries** to max 3 months (use MONTHLY granularity)
3. **Paginate recipient queries** (10 per page recommended)
4. **Cache API responses** for 5 minutes on client side
5. **Schedule hourly aggregation** cron job for summaries

## 🔐 Security Notes

- All analytics endpoints require admin authentication
- Tracking pixels tied to PaymentAutomationLog entries
- No session IDs or auth tokens exposed in tracking URLs
- User agents and IPs stored for analytics only
- Proper GDPR unsubscribe mechanism via bounce handling

## 📞 Related Documentation

- Full Implementation Guide: [PHASE_5B_EMAIL_TRACKING.md](/PHASE_5B_EMAIL_TRACKING.md)
- Phase 5A (Admin Panel): [PHASE_5A_COMPLETION_SUMMARY.md](/PHASE_5A_COMPLETION_SUMMARY.md)
- Phase 4 (Payment Automation): [COMPLETE_IMPLEMENTATION_SUMMARY.md](/COMPLETE_IMPLEMENTATION_SUMMARY.md)
