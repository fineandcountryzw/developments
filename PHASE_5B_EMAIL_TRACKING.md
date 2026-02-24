# Phase 5B: Email Tracking & Analytics - Implementation Guide

## Overview

Phase 5B adds comprehensive email tracking and analytics capabilities to the payment automation system. Track email opens, clicks, bounces, and provide detailed engagement metrics through an analytics dashboard.

## Features

### 1. Email Tracking
- **Open Tracking**: Tracks when recipients open emails using invisible 1x1 pixel images
- **Click Tracking**: Tracks when recipients click links in emails
- **Bounce Tracking**: Records failed deliveries and unsubscribes
- **Device Detection**: Identifies device type and user agent for engagement context

### 2. Analytics Dashboard
- **Overview Metrics**: Total sent, opened, clicked, bounced with calculated rates
- **Time-Series Data**: Track engagement trends hourly, daily, weekly, or monthly
- **Recipient Analytics**: Per-recipient engagement metrics with pagination
- **Device Breakdown**: Understand which devices are opening and clicking emails
- **Action Type Breakdown**: Compare performance across reminder, escalation, and follow-up emails

### 3. Tracking Data
All tracking data is stored with proper indexing for performance:
- **EmailOpen**: Records email opens with device and IP information
- **EmailClick**: Records link clicks with URL tracking
- **EmailBounce**: Records delivery failures and bounces
- **EmailAnalyticsSummary**: Pre-computed aggregate metrics refreshed hourly

## Database Schema

### EmailOpen Model
```prisma
model EmailOpen {
  id              String   @id @default(cuid())
  paymentLogId    String   @map("payment_log_id")
  recipientEmail  String   @map("recipient_email")
  clientId        String   @map("client_id")
  action          String   // REMINDER, ESCALATION, FOLLOWUP
  invoiceId       String?  @map("invoice_id")
  clientName      String?  @map("client_name")
  
  openCount       Int      @default(1) @map("open_count")
  firstOpenedAt   DateTime @default(now()) @map("first_opened_at")
  lastOpenedAt    DateTime @updatedAt @map("last_opened_at")
  
  deviceType      String?  @map("device_type") // mobile, desktop, tablet, unknown
  userAgent       String?  @db.Text @map("user_agent")
  ipAddress       String?  @map("ip_address")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@index([recipientEmail])
  @@index([paymentLogId])
  @@index([action])
  @@index([createdAt])
}
```

### EmailClick Model
```prisma
model EmailClick {
  id              String   @id @default(cuid())
  paymentLogId    String   @map("payment_log_id")
  recipientEmail  String   @map("recipient_email")
  clientId        String   @map("client_id")
  action          String   // REMINDER, ESCALATION, FOLLOWUP
  invoiceId       String?  @map("invoice_id")
  clientName      String?  @map("client_name")
  
  clickCount      Int      @default(1) @map("click_count")
  clickedUrl      String   @db.Text @map("clicked_url")
  firstClickedAt  DateTime @default(now()) @map("first_clicked_at")
  lastClickedAt   DateTime @updatedAt @map("last_clicked_at")
  
  deviceType      String?  @map("device_type")
  userAgent       String?  @db.Text @map("user_agent")
  ipAddress       String?  @map("ip_address")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@index([recipientEmail])
  @@index([paymentLogId])
  @@index([action])
  @@index([createdAt])
}
```

### EmailBounce Model
```prisma
model EmailBounce {
  id              String   @id @default(cuid())
  paymentLogId    String   @map("payment_log_id")
  recipientEmail  String   @map("recipient_email")
  clientId        String   @map("client_id")
  action          String
  invoiceId       String?  @map("invoice_id")
  
  bounceType      String   // soft, hard, spam, unsubscribe
  bounceReason    String?  @db.Text @map("bounce_reason")
  smtpCode        String?  @map("smtp_code")
  
  bouncedAt       DateTime @default(now()) @map("bounced_at")
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@index([recipientEmail])
  @@index([paymentLogId])
}
```

### EmailAnalyticsSummary Model
```prisma
model EmailAnalyticsSummary {
  id                  String   @id @default(cuid())
  action              String   // REMINDER, ESCALATION, FOLLOWUP
  dateRange           DateTime @map("date_range")
  
  totalSent           Int      @default(0) @map("total_sent")
  totalOpened         Int      @default(0) @map("total_opened")
  totalClicked        Int      @default(0) @map("total_clicked")
  totalBounced        Int      @default(0) @map("total_bounced")
  
  openRate            Float    @default(0) @map("open_rate")
  clickRate           Float    @default(0) @map("click_rate")
  bounceRate          Float    @default(0) @map("bounce_rate")
  
  lastRefreshedAt     DateTime @default(now()) @updatedAt @map("last_refreshed_at")
  createdAt           DateTime @default(now()) @map("created_at")
  
  @@index([action])
  @@index([dateRange])
}
```

## API Endpoints

### Analytics Endpoints

#### GET /api/admin/email-analytics/overview
Returns summary metrics for the selected date range.

**Query Parameters**:
- `startDate` (required): ISO date string (e.g., 2024-01-01)
- `endDate` (required): ISO date string
- `action` (optional): Filter by action type (REMINDER, ESCALATION, FOLLOWUP)
- `branch` (optional): Filter by branch

**Response**:
```json
{
  "overview": {
    "totalSent": 150,
    "totalOpened": 75,
    "totalClicked": 30,
    "totalBounced": 3,
    "uniqueOpens": 70,
    "uniqueClicks": 28,
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
    { "deviceType": "mobile", "count": 35 },
    { "deviceType": "tablet", "count": 5 }
  ]
}
```

#### GET /api/admin/email-analytics/timeline
Returns time-series data for trend visualization.

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `action` (optional): Filter by action type
- `granularity` (optional): HOURLY | DAILY | WEEKLY | MONTHLY (default: DAILY)
- `branch` (optional): Filter by branch

**Response**:
```json
{
  "timeline": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "sent": 25,
      "opened": 12,
      "clicked": 5,
      "bounced": 1,
      "openRate": 48,
      "clickRate": 20
    },
    {
      "timestamp": "2024-01-02T00:00:00Z",
      "sent": 30,
      "opened": 18,
      "clicked": 8,
      "bounced": 0,
      "openRate": 60,
      "clickRate": 26.7
    }
  ]
}
```

#### GET /api/admin/email-analytics/recipients
Returns per-recipient engagement metrics with pagination.

**Query Parameters**:
- `limit` (optional): Records per page (default: 10)
- `offset` (optional): Number of records to skip (default: 0)
- `sortBy` (optional): openCount | clickCount | lastOpenedAt (default: openCount)
- `action` (optional): Filter by action type
- `branch` (optional): Filter by branch

**Response**:
```json
{
  "recipients": [
    {
      "recipientEmail": "client@example.com",
      "clientName": "ABC Corporation",
      "openCount": 5,
      "clickCount": 2,
      "lastOpenedAt": "2024-01-15T10:30:00Z",
      "deviceTypes": ["desktop", "mobile"]
    }
  ],
  "total": 150
}
```

### Tracking Endpoints

#### GET /api/email-tracking/pixel/[trackingId]
Returns a transparent 1x1 GIF pixel and records the open event.

**Path Parameters**:
- `trackingId`: Base64-encoded tracking data

**Response**: 1x1 transparent GIF image

**Tracking Data Format** (base64 encoded):
```
paymentLogId|recipientEmail|clientId|action|invoiceId|clientName
```

#### GET /api/email-tracking/click
Records a click event and redirects to the original URL.

**Query Parameters**:
- `t`: Tracking ID (base64 encoded)
- `u`: Encoded original URL

**Response**: 302 Redirect to original URL

## Email Template Integration

### Adding Tracking Pixel

Use the `createTrackingPixel()` utility to add an invisible pixel to HTML emails:

```typescript
import { createTrackingPixel } from '@/lib/email-tracking';

const trackingPixel = createTrackingPixel({
  paymentLogId: log.id,
  recipientEmail: client.email,
  clientId: client.id,
  action: 'REMINDER',
  invoiceId: invoice.id,
  clientName: client.name,
});

// Add to end of HTML email body:
emailHtml += trackingPixel;
```

### Adding Link Tracking

Use the `createTrackedLink()` utility to wrap links with click tracking:

```typescript
import { createTrackedLink } from '@/lib/email-tracking';

const trackedPaymentLink = createTrackedLink(
  'https://www.example.com/pay?invoice=123',
  {
    paymentLogId: log.id,
    recipientEmail: client.email,
    clientId: client.id,
    action: 'REMINDER',
    invoiceId: invoice.id,
    clientName: client.name,
  }
);

// Use in HTML email:
emailHtml = emailHtml.replace(
  'https://www.example.com/pay?invoice=123',
  trackedPaymentLink
);
```

### Automatic Tracking Integration

Use `addTrackingToEmailContent()` to automatically add pixel and wrap links:

```typescript
import { addTrackingToEmailContent } from '@/lib/email-tracking';

const htmlWithTracking = addTrackingToEmailContent(emailHtml, {
  paymentLogId: log.id,
  recipientEmail: client.email,
  clientId: client.id,
  action: 'REMINDER',
  invoiceId: invoice.id,
  clientName: client.name,
});
```

## Components

### EmailAnalyticsDashboard
Main analytics dashboard component with filters and multiple views.

**Features**:
- Date range filter (defaults to last 30 days)
- Action type filter (REMINDER, ESCALATION, FOLLOWUP)
- Granularity selector (HOURLY, DAILY, WEEKLY, MONTHLY)
- Three tabs: Overview, Timeline, Recipients

**Location**: `/components/admin/EmailAnalyticsDashboard.tsx`

### AnalyticsOverviewCards
Displays 5 key metric cards: Sent, Open Rate, Click Rate, Bounce Rate, Engagement.

**Props**:
```typescript
interface AnalyticsOverviewCardsProps {
  data: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
}
```

**Location**: `/components/admin/AnalyticsOverviewCards.tsx`

### AnalyticsCharts
Displays bar charts for delivery breakdown and performance by action/device type.

**Props**:
```typescript
interface ChartData {
  overview: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  actionBreakdown: Array<{ action: string; count: number }>;
  deviceBreakdown: Array<{ deviceType: string; count: number }>;
}
```

**Location**: `/components/admin/AnalyticsCharts.tsx`

### RecipientsTable
Paginated table showing per-recipient engagement metrics.

**Props**:
```typescript
interface RecipientsTableProps {
  recipients: Recipient[];
  totalCount: number;
  onPageChange: (page: number) => void;
  currentPage: number;
  pageSize: number;
  sortBy?: 'openCount' | 'clickCount' | 'lastOpenedAt';
  isLoading?: boolean;
}
```

**Location**: `/components/admin/RecipientsTable.tsx`

### EngagementTimeline
Time-series visualization of engagement metrics with stacked bar charts.

**Props**:
```typescript
interface EngagementTimelineProps {
  data: TimelineDataPoint[];
  granularity: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isLoading?: boolean;
}
```

**Location**: `/components/admin/EngagementTimeline.tsx`

## Pages

### Email Analytics Dashboard Page
Standalone page for detailed analytics viewing.

**Route**: `/admin/email-analytics`
**Component**: `EmailAnalyticsDashboard`
**Auth**: Admin-only (via `getServerSession`)

## Integration with Existing Systems

### Phase 5A Integration
- Added "Analytics" tab to `AdminPaymentAutomationDashboard`
- Links to `/admin/email-analytics` page
- Maintains consistency with existing admin UI

### Phase 4 Cron Jobs
Phase 4 cron jobs need to be updated to pass tracking data when sending emails:

1. `/api/cron/send-payment-reminders`
2. `/api/cron/escalate-overdue-invoices`
3. `/api/cron/send-followup-emails`

Each job should:
1. Create a PaymentAutomationLog entry
2. Call email sending function with tracking data
3. Pass `addTrackingToEmailContent()` to modify HTML

## Performance Considerations

### Database Indexing
All tracking tables use strategic indexing:
- `recipientEmail` and `paymentLogId`: For filtering by recipient or log
- `action`: For filtering by email type
- `createdAt`: For date range queries
- `lastOpenedAt` and `lastClickedAt`: For sorting by recency

### Analytics Aggregation
The `EmailAnalyticsSummary` table provides pre-computed metrics refreshed hourly via cron job to avoid expensive queries during dashboard usage.

### Query Optimization
- Overview queries use aggregation and pre-computed summaries
- Timeline queries bucket results by granularity
- Recipient queries use pagination (10 per page default)

## Testing

### Manual Testing
1. Send a test email via admin panel
2. Open the email and verify pixel loads
3. Click a link and verify tracking
4. Check analytics dashboard after 5-10 minutes
5. Verify metrics appear and increment

### API Testing
```bash
# Test overview endpoint
curl "http://localhost:3000/api/admin/email-analytics/overview?startDate=2024-01-01&endDate=2024-01-31"

# Test timeline endpoint
curl "http://localhost:3000/api/admin/email-analytics/timeline?startDate=2024-01-01&endDate=2024-01-31&granularity=DAILY"

# Test recipients endpoint
curl "http://localhost:3000/api/admin/email-analytics/recipients?limit=10&offset=0"
```

### Tracking Verification
1. Check browser network tab when email loads
2. Verify pixel request shows in network tab
3. Check database for EmailOpen record
4. Verify click tracking redirects work

## Troubleshooting

### Pixels Not Loading
- Check if email client supports images
- Verify pixel URL is correct in HTML
- Check analytics API endpoints return data

### Clicks Not Being Tracked
- Verify link wrapper creates correct URL
- Check `u` parameter is properly URL encoded
- Verify redirect response code is 302

### Analytics Dashboard Showing No Data
- Verify date range includes sent emails
- Check PaymentAutomationLog has records
- Verify tracking utilities are being used in email templates
- Check database has EmailOpen/EmailClick records

## Future Enhancements

- Email bounce handling automation
- Unsubscribe list management
- A/B testing for email content
- Advanced segmentation by client type
- Automated reports and alerts
- Integration with third-party email providers
- SPF/DKIM verification for deliverability
- Email template editor in admin UI

## Security & Privacy

- Tracking data is associated with valid PaymentAutomationLog entries
- Admin-only access to analytics endpoints
- User agents and IP addresses stored for analytics only
- No personal data beyond email and client name stored
- GDPR-compliant unsubscribe mechanism via bounce handling

## References

- [Prisma Schema](/prisma/schema.prisma)
- [Email Tracking Utilities](/lib/email-tracking.ts)
- [Analytics Dashboard Component](/components/admin/EmailAnalyticsDashboard.tsx)
- [Admin Dashboard Page](/app/admin/email-analytics/page.tsx)
