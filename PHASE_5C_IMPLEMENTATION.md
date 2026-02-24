# Phase 5C Implementation Guide

**Status**: ✅ COMPLETE  
**Last Updated**: December 30, 2025  
**Implemented By**: AI Assistant  

## Overview

Phase 5C is a comprehensive email analytics and management system built on top of Phase 5B's email tracking infrastructure. It adds sophisticated bounce management, unsubscribe handling, engagement scoring, and campaign analytics capabilities.

## Architecture

### Database Models (5 New Models)

#### 1. **UnsubscribeList**
Tracks recipients who have unsubscribed, hard bounced, or marked emails as spam.

```prisma
model UnsubscribeList {
  recipientEmail: String (unique with clientId)
  clientId: String
  reason: String // 'requested', 'hard_bounce', 'spam', 'other'
  description: String? (optional details)
  unsubscribedAt: DateTime
  resubscribeAttemptAt: DateTime? (tracks resubscribe attempts)
  unsubscribedBy: String // 'automatic', 'manual', 'user_request'
  branch: String
}
```

**Purpose**: GDPR-compliant suppression list  
**Key Features**:
- Automatic unsubscribe on hard bounces
- User-initiated unsubscribe via email link
- Manual admin unsubscribe
- Resubscribe attempt tracking

#### 2. **BouncePattern**
Categorizes and tracks bounce history, enabling automatic suppression.

```prisma
model BouncePattern {
  recipientEmail: String (unique with clientId)
  bounceType: String // 'soft', 'hard', 'spam', 'unsubscribe'
  lastBounceAt: DateTime
  consecutiveBounces: Int
  totalBounceCount: Int
  bounceReason: String? (SMTP error message)
  smtpCode: String? (5.1.1, 4.2.1, etc.)
  shouldSuppress: Boolean (auto-suppress after 3 hard bounces)
  suppressedAt: DateTime?
  suppressedReason: String?
}
```

**Purpose**: Bounce management and suppression logic  
**Key Features**:
- Soft bounce detection (temporary, retry)
- Hard bounce detection (permanent, suppress)
- Spam complaint tracking
- Auto-suppression rules

#### 3. **EmailEngagementScore**
Calculates engagement 0-100 and predicts payment probability.

```prisma
model EmailEngagementScore {
  recipientEmail: String (unique with clientId)
  clientId: String
  clientName: String?
  engagementScore: Float (0-100)
  engagementTier: String // 'hot', 'warm', 'cold'
  openCount: Int
  clickCount: Int
  bounceCount: Int
  unsubscribeCount: Int
  totalEmailsSent: Int
  lastEngagementAt: DateTime?
  lastOpenAt: DateTime?
  lastClickAt: DateTime?
  predictedPaymentProbability: Float (0-1)
  paymentHistoryDaysAgo: Int?
}
```

**Purpose**: Recipient engagement analysis  
**Scoring Formula**:
- (Opens × 30) + (Clicks × 50) - (Bounces × 20) - (Unsubscribes × 40)
- Normalized to 0-100 scale
- Tiers: Hot (60-100), Warm (30-60), Cold (0-30)

**Payment Probability**:
- Base: engagement score / 100
- Boost: recent opens/clicks (+5-10%)
- Decay: old payments (×0.5 after 90 days)

#### 4. **CampaignPerformance**
Tracks ROI and effectiveness of each campaign type.

```prisma
model CampaignPerformance {
  campaignType: String // 'REMINDER', 'ESCALATION', 'FOLLOWUP'
  dateRange: DateTime (start of week)
  sentCount: Int
  openCount: Int
  clickCount: Int
  bounceCount: Int
  conversionCount: Int (payments within 7 days)
  conversion30DayCount: Int (payments within 30 days)
  totalRevenueGenerated: Decimal
  campaignCost: Decimal
  roi: Float
  openRate: Float
  clickRate: Float
  bounceRate: Float
  conversionRate: Float
}
```

**Purpose**: Campaign comparison and optimization  
**Metrics Tracked**:
- Sent, Open, Click, Bounce, Conversion counts
- Revenue generated vs. cost
- ROI percentage
- Conversion rates

#### 5. **SendTimeOptimization**
Tracks best send times per recipient for maximum open rates.

```prisma
model SendTimeOptimization {
  recipientEmail: String (unique with clientId)
  bestSendHour: Int? (0-23)
  bestSendDayOfWeek: Int? (0-6)
  openRateByHour: String (JSON object)
  openRateByDay: String (JSON object)
  totalOpens: Int
  totalSends: Int
  sampleSize: Int (emails analyzed)
  confidence: Float (0-1 confidence level)
}
```

**Purpose**: Data-driven send time optimization  
**Key Features**:
- Hour-level open rate tracking
- Day-of-week analysis
- Confidence scoring (only show if >50% confident)

## API Endpoints

### Bounce Management APIs

#### `GET /api/admin/bounces/summary`
Returns bounce statistics and metrics.

**Response**:
```json
{
  "summary": {
    "totalBounces": 1250,
    "hardBounces": 450,
    "softBounces": 800,
    "suppressedRecipients": 400,
    "suppressionRate": "32.00"
  },
  "bounceByType": [
    { "type": "soft", "count": 800 },
    { "type": "hard", "count": 450 }
  ],
  "recentBounces": [...]
}
```

#### `GET /api/admin/bounces/list`
Returns paginated bounce list with filtering.

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)
- `bounceType`: Filter by type (soft/hard/spam)
- `suppressed`: Show only suppressed (true/false)
- `search`: Search email or client ID

#### `POST /api/admin/bounces/suppress`
Suppress a recipient manually.

**Request Body**:
```json
{
  "recipientEmail": "test@example.com",
  "bounceType": "hard",
  "reason": "Invalid address"
}
```

#### `GET /api/admin/bounces/suppressed`
List currently suppressed recipients.

#### `DELETE /api/admin/bounces/suppressed`
Unsuppress a recipient.

### Unsubscribe Management APIs

#### `GET /api/admin/unsubscribes/list`
List unsubscribed recipients.

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)
- `reason`: Filter by reason
- `search`: Search email or client

#### `POST /api/admin/unsubscribes/list`
Add recipient to unsubscribe list.

**Request Body**:
```json
{
  "recipientEmail": "test@example.com",
  "clientId": "client123",
  "reason": "requested",
  "description": "User clicked unsubscribe"
}
```

#### `POST /api/admin/unsubscribes/remove`
Remove from unsubscribe list (resubscribe).

**Request Body**:
```json
{
  "recipientEmail": "test@example.com",
  "clientId": "client123"
}
```

#### `GET /api/email/unsubscribe` (PUBLIC)
Public unsubscribe endpoint for email links.

**Query Parameters**:
- `email`: Recipient email
- `clientId`: Client ID
- `token`: Validation token (unsubscribe link token)

**Response**:
```json
{
  "success": true,
  "message": "You have been unsubscribed...",
  "email": "test@example.com"
}
```

### Engagement Scoring APIs

#### `GET /api/admin/engagement/scores`
List recipients with engagement scores.

**Query Parameters**:
- `page`: Page number
- `limit`: Results per page
- `tier`: Filter by tier (hot/warm/cold)
- `minScore`: Minimum score filter
- `search`: Search email or client

**Response**:
```json
{
  "scores": [
    {
      "recipientEmail": "john@example.com",
      "engagementScore": 85,
      "engagementTier": "hot",
      "openCount": 15,
      "clickCount": 8,
      "predictedPaymentProbability": 0.82
    }
  ],
  "tierDistribution": [
    { "tier": "hot", "count": 150, "avgScore": "75.5" }
  ]
}
```

#### `GET /api/admin/engagement/summary`
Engagement statistics and distribution.

**Response**:
```json
{
  "summary": {
    "totalRecipients": 5000,
    "avgEngagementScore": 48.5,
    "highEngagementPercentage": 32.5,
    "estimatedPaymentProbability": 65.3
  },
  "tierBreakdown": [
    { "tier": "hot", "count": 1625, "percentage": 32.5, "avgScore": 78.3 }
  ]
}
```

### Campaign Analytics APIs

#### `GET /api/admin/analytics/campaigns`
Compare campaign performance.

**Query Parameters**:
- `branch`: Branch filter
- `startDate`: Date range start
- `endDate`: Date range end

**Response**:
```json
{
  "campaigns": [
    {
      "type": "REMINDER",
      "sentCount": 5000,
      "openCount": 1250,
      "openRate": "25.00",
      "conversionCount": 350,
      "conversionRate": "7.00",
      "totalRevenueGenerated": 52500,
      "roi": 125.5
    }
  ]
}
```

#### `GET /api/admin/analytics/send-times`
Get best send times for recipients.

**Response**:
```json
{
  "optimizations": [
    {
      "recipientEmail": "john@example.com",
      "bestSendHour": 9,
      "bestSendDay": "Tuesday",
      "bestSendTime": "9:00",
      "openRate": "45.2",
      "confidencePercentage": "78"
    }
  ]
}
```

## Utility Libraries

### `lib/bounce-handling.ts`

**Key Functions**:

```typescript
// Process a bounce event
async function processBounce({
  recipientEmail: string;
  clientId: string;
  bounceType: 'soft' | 'hard' | 'spam';
  bounceReason?: string;
}): Promise<{ suppressed: boolean; bounce: BouncePattern }>

// Check if recipient should be suppressed
async function shouldSuppressRecipient(
  recipientEmail: string,
  clientId?: string
): Promise<boolean>

// Get bounce statistics
async function getBounceStats(clientId: string): Promise<BounceStats>

// Batch suppress recipients
async function batchSuppressRecipients(
  recipientEmails: string[],
  clientId: string,
  reason: string
): Promise<{ successful: number; failed: number }>

// Unsuppress a recipient
async function unsuppressRecipient(
  recipientEmail: string,
  clientId: string
): Promise<{ bounceUpdated: number; unsubscribeDeleted: number }>
```

### `lib/engagement-scoring.ts`

**Key Functions**:

```typescript
// Update engagement score for recipient
async function updateEngagementScore(
  recipientEmail: string,
  clientId: string,
  clientName?: string
): Promise<EmailEngagementScore>

// Get top engaged recipients
async function getTopEngagedRecipients(
  clientId: string,
  limit?: number
): Promise<EmailEngagementScore[]>

// Get at-risk recipients
async function getAtRiskRecipients(
  clientId: string,
  limit?: number
): Promise<EmailEngagementScore[]>

// Batch update engagement scores
async function batchUpdateEngagementScores(
  clientId: string
): Promise<{ successful: number; failed: number }>

// Get engagement trends
async function getEngagementTrends(
  clientId: string,
  days?: number
): Promise<TrendData>
```

### `lib/unsubscribe-management.ts`

**Key Functions**:

```typescript
// Add to unsubscribe list
async function addToUnsubscribeList(
  recipientEmail: string,
  clientId: string,
  reason: UnsubscribeReason
): Promise<UnsubscribeList>

// Remove from unsubscribe list
async function removeFromUnsubscribeList(
  recipientEmail: string,
  clientId?: string
): Promise<{ removed: boolean; count: number }>

// Check if unsubscribed
async function isUnsubscribed(
  recipientEmail: string,
  clientId?: string
): Promise<boolean>

// Get unsubscribe statistics
async function getUnsubscribeStats(clientId: string): Promise<UnsubscribeStats>

// Export unsubscribe list (GDPR)
async function exportUnsubscribeList(clientId: string): Promise<UnsubscribeRecord[]>

// Cleanup old records
async function cleanupOldUnsubscribes(retentionDays?: number): Promise<{ deletedCount: number }>
```

### `lib/campaign-analytics.ts`

**Key Functions**:

```typescript
// Record campaign metrics
async function recordCampaignMetrics(
  campaignType: CampaignType,
  metrics: CampaignMetrics
): Promise<CampaignPerformance>

// Get campaign comparison
async function getCampaignComparison(
  startDate: Date,
  endDate: Date
): Promise<CampaignComparison>

// Get best performing campaign
async function getBestPerformingCampaign(
  startDate: Date,
  endDate: Date,
  metric?: 'openRate' | 'conversionRate' | 'roi'
): Promise<CampaignPerformance>

// Get campaign trends
async function getCampaignTrends(
  campaignType: CampaignType,
  weeks?: number
): Promise<TrendData[]>

// Calculate ROI
function calculateROI(revenue: number, cost: number): number

// Calculate cost per conversion
function calculateCostPerConversion(cost: number, conversions: number): number

// Calculate effectiveness score
function calculateEffectivenessScore(
  openRate: number,
  clickRate: number,
  conversionRate: number,
  roi: number
): number
```

## React Components

### 1. **BounceManagementDashboard**
Component: `components/admin/BounceManagementDashboard.tsx`

**Features**:
- Bounce statistics cards (total, hard, soft, suppression rate)
- Bounce distribution pie chart
- Recent bounces list
- Real-time filtering by type

### 2. **EngagementScoringDashboard**
Component: `components/admin/EngagementScoringDashboard.tsx`

**Features**:
- Engagement tier breakdown cards
- Tier distribution pie chart
- Top engaged recipients table
- Pagination support
- Filter by engagement tier
- Payment probability predictions

### 3. **CampaignAnalyticsDashboard**
Component: `components/admin/CampaignAnalyticsDashboard.tsx`

**Features**:
- Campaign comparison metrics
- Open rate, conversion rate, ROI charts
- Detailed campaign metrics table
- Total revenue and ROI calculations
- Date range filtering

### 4. **UnsubscribeListManager**
Component: `components/admin/UnsubscribeListManager.tsx`

**Features**:
- Unsubscribe list display with pagination
- Search by email or client ID
- Filter by unsubscribe reason
- Resubscribe action with confirmation
- Bulk operations support

## Integration Points

### Phase 5B Integration
All Phase 5B email tracking features (opens, clicks) are automatically used:
- EmailOpen records provide open count
- EmailClick records provide click count
- EmailBounce records map to BouncePattern
- EmailAnalyticsSummary provides sent count

### Cron Job Integration
Phase 5C models are populated by:
- **send-payment-reminders**: Records sent to CampaignPerformance (REMINDER)
- **escalate-overdue-invoices**: Records sent to CampaignPerformance (ESCALATION)
- **send-followup-emails**: Records sent to CampaignPerformance (FOLLOWUP)
- Bounce callbacks update BouncePattern
- User unsubscribes update UnsubscribeList

## Usage Examples

### 1. Processing a Bounce
```typescript
import { processBounce } from '@/lib/bounce-handling';

// When receiving bounce from email service provider
await processBounce({
  recipientEmail: 'invalid@example.com',
  clientId: 'client123',
  bounceType: 'hard',
  bounceReason: 'Mailbox does not exist',
  smtpCode: '5.1.1'
});
// Auto-suppresses after 3 hard bounces
```

### 2. Updating Engagement Score
```typescript
import { updateEngagementScore } from '@/lib/engagement-scoring';

// Recalculate engagement for a recipient
const score = await updateEngagementScore(
  'john@example.com',
  'client123',
  'John Doe'
);

console.log(`Score: ${score.engagementScore}, Tier: ${score.engagementTier}`);
// Output: Score: 75, Tier: hot
```

### 3. Recording Campaign Metrics
```typescript
import { recordCampaignMetrics } from '@/lib/campaign-analytics';

// After campaign completion
await recordCampaignMetrics('REMINDER', {
  sentCount: 5000,
  openCount: 1250,
  clickCount: 500,
  bounceCount: 100,
  conversionCount: 350,
  totalRevenueGenerated: 52500,
  campaignCost: 250
});
```

### 4. Handling User Unsubscribe
```typescript
// In email unsubscribe link handler
const response = await fetch(
  '/api/email/unsubscribe?email=john@example.com&clientId=client123&token=abc123def456'
);
// Automatically added to UnsubscribeList and BouncePattern
```

### 5. Getting Engagement Insights
```typescript
import { getTopEngagedRecipients, getAtRiskRecipients } from '@/lib/engagement-scoring';

// Target hot segments
const hotRecipients = await getTopEngagedRecipients('client123', 100);

// Re-engage cold segments
const atRisk = await getAtRiskRecipients('client123', 100);

// Create targeted campaigns for each segment
```

## Configuration & Customization

### Bounce Auto-Suppression Rules
```typescript
// In lib/bounce-handling.ts, processBounce()
const shouldSuppress = 
  (bounceType === 'hard' && bounce.totalBounceCount >= 3) ||  // 3 hard bounces
  (bounceType === 'soft' && bounce.totalBounceCount >= 5) ||  // 5 soft bounces
  bounceType === 'spam';  // Immediate for spam
```

### Engagement Scoring Weights
```typescript
// In lib/engagement-scoring.ts, calculateEngagementScore()
const rawScore = 
  (openCount * 30) +      // 30 points per open
  (clickCount * 50) -      // 50 points per click
  (bounceCount * 20) -     // -20 per bounce
  (unsubscribeCount * 40); // -40 per unsubscribe
```

### Engagement Tiers
```typescript
// In lib/engagement-scoring.ts
if (normalizedScore >= 60) tier = 'hot';     // 60-100
if (normalizedScore >= 30) tier = 'warm';    // 30-60
else tier = 'cold';                          // 0-30
```

### Payment Probability Calculation
```typescript
// In lib/engagement-scoring.ts, predictPaymentProbability()
let probability = engagementScore / 100;     // Base
probability += openFrequency * 0.05;         // +5% per open
probability += clickFrequency * 0.1;         // +10% per click
if (daysSinceLastPayment > 90) probability *= 0.5;  // Decay
```

## Performance Considerations

### Indexing Strategy
All models use strategic indexing:
- **Unique Indexes**: `recipientEmail_clientId` for fast lookups
- **Filter Indexes**: `bounceType`, `shouldSuppress`, `engagementTier`, `engagementScore`
- **Time Series Indexes**: `lastBounceAt`, `lastEngagementAt`, `dateRange`

### Query Optimization
- Batch operations for bulk unsubscribe/suppress
- Pagination with limit=50 default
- Aggregation queries for statistics
- Conditional updates only

### Caching Recommendations
For production deployments, consider Redis caching for:
- Engagement scores (cache 24 hours)
- Campaign metrics (cache 6 hours)
- Unsubscribe checks (cache 1 hour)

## Data Retention & GDPR Compliance

### Retention Policies
- **UnsubscribeList**: Keep indefinitely (legal requirement)
- **BouncePattern**: Keep 180 days (6 months)
- **EmailEngagementScore**: Keep 90 days (update rolling)
- **CampaignPerformance**: Keep indefinitely (analytics)
- **SendTimeOptimization**: Keep 365 days (yearly patterns)

### GDPR Compliance Features
- Public `/api/email/unsubscribe` endpoint (no auth)
- Export functionality for GDPR data requests
- `cleanupOldUnsubscribes()` for retention policies
- Reason tracking for compliance audits

## Migration from Phase 5B

Phase 5C extends Phase 5B without breaking changes:
1. Run `npx prisma migrate dev` to add new models
2. Phase 5B tables remain untouched
3. Existing email tracking continues working
4. Gradual adoption of new features

## Testing Checklist

- [ ] Bounce processing (soft, hard, spam)
- [ ] Auto-suppression after 3 hard bounces
- [ ] Unsubscribe list management
- [ ] Engagement score calculations
- [ ] Campaign metrics aggregation
- [ ] Send time optimization tracking
- [ ] Public unsubscribe endpoint
- [ ] API error handling
- [ ] Pagination and filtering
- [ ] Component rendering

## Support & Troubleshooting

**Issue**: Bounces not being suppressed
- Check: `bounceType` is correct
- Check: `totalBounceCount >= 3` for hard bounces
- Verify: Database indexes created

**Issue**: Engagement scores not updating
- Check: Email opens/clicks are being recorded
- Run: `batchUpdateEngagementScores()` manually
- Verify: Cron job integration

**Issue**: Campaign metrics missing
- Check: Cron jobs are running
- Verify: `recordCampaignMetrics()` is called
- Check: Date range in queries

## Next Steps & Future Enhancements

Phase 5D considerations:
- Machine learning bounce prediction
- A/B testing framework
- Dynamic send time per recipient
- Segment-based campaign automation
- Real-time engagement alerts
- Advanced cohort analysis
