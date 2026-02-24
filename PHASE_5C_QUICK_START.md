# Phase 5C Quick Start Guide

**Get up and running with Phase 5C in 15 minutes**

## 1. Database Setup (2 minutes)

Phase 5C adds 5 new database models. They're already in `prisma/schema.prisma`:

```bash
# Generate Prisma client
npx prisma generate

# Create migration (if needed)
npx prisma migrate dev --name phase_5c_bounce_and_analytics
```

**Models added**:
- `UnsubscribeList` - Track unsubscribed recipients
- `BouncePattern` - Manage bounces and suppression
- `EmailEngagementScore` - Calculate engagement scores
- `CampaignPerformance` - Track campaign ROI
- `SendTimeOptimization` - Optimize send times

## 2. API Endpoints Overview (5 minutes)

### Bounce Management
```bash
GET    /api/admin/bounces/summary          # Stats
GET    /api/admin/bounces/list             # List with filtering
POST   /api/admin/bounces/suppress         # Suppress recipient
GET    /api/admin/bounces/suppressed       # List suppressed
DELETE /api/admin/bounces/suppressed       # Unsuppress
```

### Unsubscribe Management
```bash
GET    /api/admin/unsubscribes/list        # List unsubscribed
POST   /api/admin/unsubscribes/list        # Add to list
POST   /api/admin/unsubscribes/remove      # Remove from list
GET    /api/email/unsubscribe              # Public unsubscribe link
```

### Engagement Scoring
```bash
GET    /api/admin/engagement/scores        # List with scores
GET    /api/admin/engagement/summary       # Statistics
```

### Campaign Analytics
```bash
GET    /api/admin/analytics/campaigns      # Compare campaigns
GET    /api/admin/analytics/send-times     # Optimal send times
```

## 3. Utility Libraries (3 minutes)

Import and use in your code:

```typescript
// Bounce handling
import { processBounce, shouldSuppressRecipient, getBounceStats } from '@/lib/bounce-handling';

// Engagement scoring
import { updateEngagementScore, getTopEngagedRecipients } from '@/lib/engagement-scoring';

// Unsubscribe management
import { addToUnsubscribeList, isUnsubscribed } from '@/lib/unsubscribe-management';

// Campaign analytics
import { recordCampaignMetrics, getCampaignComparison } from '@/lib/campaign-analytics';
```

## 4. React Components (3 minutes)

Add Phase 5C dashboards to admin pages:

```typescript
import { BounceManagementDashboard } from '@/components/admin/BounceManagementDashboard';
import { EngagementScoringDashboard } from '@/components/admin/EngagementScoringDashboard';
import { CampaignAnalyticsDashboard } from '@/components/admin/CampaignAnalyticsDashboard';
import { UnsubscribeListManager } from '@/components/admin/UnsubscribeListManager';

// In your page component
export default function AdminDashboard() {
  return (
    <div>
      <BounceManagementDashboard branch="Harare" />
      <EngagementScoringDashboard branch="Harare" />
      <CampaignAnalyticsDashboard branch="Harare" />
      <UnsubscribeListManager branch="Harare" />
    </div>
  );
}
```

## 5. Common Tasks

### Process a Bounce
```typescript
import { processBounce } from '@/lib/bounce-handling';

await processBounce({
  recipientEmail: 'invalid@example.com',
  clientId: 'client123',
  bounceType: 'hard',
  bounceReason: 'Mailbox does not exist',
  smtpCode: '5.1.1'
});
// Auto-suppresses after 3 hard bounces
```

### Check if Recipient is Suppressed
```typescript
import { shouldSuppressRecipient } from '@/lib/bounce-handling';
import { isUnsubscribed } from '@/lib/unsubscribe-management';

const isSuppressed = await shouldSuppressRecipient('john@example.com', 'client123');
const isUnsub = await isUnsubscribed('john@example.com', 'client123');

if (isSuppressed || isUnsub) {
  // Don't send email
  return;
}
```

### Update Engagement Score
```typescript
import { updateEngagementScore } from '@/lib/engagement-scoring';

const score = await updateEngagementScore('john@example.com', 'client123');
console.log(`Score: ${score.engagementScore}, Tier: ${score.engagementTier}`);
```

### Get High-Value Targets
```typescript
import { getTopEngagedRecipients } from '@/lib/engagement-scoring';

const hotRecipients = await getTopEngagedRecipients('client123', 100);
// Use for targeted campaigns
```

### Record Campaign Performance
```typescript
import { recordCampaignMetrics } from '@/lib/campaign-analytics';

await recordCampaignMetrics('REMINDER', {
  sentCount: 5000,
  openCount: 1250,
  clickCount: 500,
  conversionCount: 350,
  totalRevenueGenerated: 52500,
  campaignCost: 250
});
```

### Compare Campaigns
```typescript
import { getCampaignComparison } from '@/lib/campaign-analytics';

const comparison = await getCampaignComparison(
  new Date('2025-12-01'),
  new Date('2025-12-31')
);
// Compare REMINDER vs ESCALATION vs FOLLOWUP
```

## 6. API Examples

### Get Bounce Summary
```bash
curl -X GET "http://localhost:3000/api/admin/bounces/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "summary": {
    "totalBounces": 1250,
    "hardBounces": 450,
    "suppressionRate": "32.00"
  },
  "bounceByType": [
    { "type": "soft", "count": 800 },
    { "type": "hard", "count": 450 }
  ]
}
```

### List Engagement Scores
```bash
curl -X GET "http://localhost:3000/api/admin/engagement/scores?tier=hot&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Suppress a Recipient
```bash
curl -X POST "http://localhost:3000/api/admin/bounces/suppress" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "john@example.com",
    "bounceType": "hard",
    "reason": "Invalid address"
  }'
```

### Public Unsubscribe Link
```bash
# In email template
<a href="https://erp.example.com/api/email/unsubscribe?email=john@example.com&clientId=client123&token=YOUR_TOKEN">
  Unsubscribe
</a>

# User clicks → recipient automatically unsubscribed
```

## 7. Configuration

### Auto-Suppression Rules
Edit in `lib/bounce-handling.ts`:
```typescript
const shouldSuppress = 
  (bounceType === 'hard' && bounce.totalBounceCount >= 3) ||  // ← Change this
  (bounceType === 'soft' && bounce.totalBounceCount >= 5);
```

### Engagement Scoring Weights
Edit in `lib/engagement-scoring.ts`:
```typescript
const rawScore = 
  (openCount * 30) +      // ← Change weight
  (clickCount * 50) -      // ← Change weight
  (bounceCount * 20) -
  (unsubscribeCount * 40);
```

### Data Retention
Default policies:
- UnsubscribeList: Keep forever
- BouncePattern: 180 days
- EngagementScore: 90 days
- CampaignPerformance: Forever

To cleanup:
```typescript
import { cleanupOldUnsubscribes } from '@/lib/unsubscribe-management';

// Keep last 90 days only
await cleanupOldUnsubscribes(90);
```

## 8. Testing

### Test Bounce Processing
```bash
# Check if bounce auto-suppresses
curl -X POST "http://localhost:3000/api/admin/bounces/suppress" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com",
    "bounceType": "hard",
    "reason": "Test"
  }'

# Verify suppressed
curl -X GET "http://localhost:3000/api/admin/bounces/suppressed" \
  -H "Authorization: Bearer TOKEN"
```

### Test Unsubscribe Flow
```bash
# Add to unsubscribe list
curl -X POST "http://localhost:3000/api/admin/unsubscribes/list" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com",
    "clientId": "client123",
    "reason": "requested"
  }'

# Use public unsubscribe link
curl -X GET "http://localhost:3000/api/email/unsubscribe?email=test@example.com&clientId=client123&token=abc123"

# Verify unsubscribed
curl -X GET "http://localhost:3000/api/admin/unsubscribes/list" \
  -H "Authorization: Bearer TOKEN"
```

### Test Engagement Scoring
```bash
# Get engagement summary
curl -X GET "http://localhost:3000/api/admin/engagement/summary" \
  -H "Authorization: Bearer TOKEN"

# Get top engaged
curl -X GET "http://localhost:3000/api/admin/engagement/scores?tier=hot" \
  -H "Authorization: Bearer TOKEN"
```

## 9. Next Steps

1. **Add Phase 5C tabs to admin dashboard** - Integrate components
2. **Connect cron jobs** - Record campaign metrics after sends
3. **Implement bounce callbacks** - Process bounces from email provider
4. **Set up engagement cron** - Update scores every 24 hours
5. **Create admin pages** - Build dedicated Phase 5C management pages

## 10. Troubleshooting

**Q: Bounces not suppressing?**
- Check: `totalBounceCount >= 3` for hard bounces
- Verify: `processBounce()` is being called
- Test: Manual suppress via API

**Q: Engagement scores empty?**
- Check: Phase 5B EmailOpen/EmailClick records exist
- Run: `batchUpdateEngagementScores()` manually
- Verify: Cron job integration

**Q: Campaign metrics missing?**
- Check: `recordCampaignMetrics()` is being called
- Verify: Cron jobs completed successfully
- Test: Manual insert via API

## Quick Reference

| Task | Function | File |
|------|----------|------|
| Process bounce | `processBounce()` | bounce-handling |
| Check suppression | `shouldSuppressRecipient()` | bounce-handling |
| Update engagement | `updateEngagementScore()` | engagement-scoring |
| Get hot recipients | `getTopEngagedRecipients()` | engagement-scoring |
| Manage unsubscribe | `addToUnsubscribeList()` | unsubscribe-management |
| Record campaign | `recordCampaignMetrics()` | campaign-analytics |
| Compare campaigns | `getCampaignComparison()` | campaign-analytics |

## Documentation Files

- **PHASE_5C_IMPLEMENTATION.md** - Complete technical guide
- **PHASE_5C_API_REFERENCE.md** - Full API documentation
- **PHASE_5C_QUICK_START.md** - This file

---

**Ready to use!** Start with the Components section and build out your admin pages.
