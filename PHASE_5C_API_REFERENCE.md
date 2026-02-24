# Phase 5C API Reference

Complete API endpoint documentation for Phase 5C.

## Base URL
```
/api/admin/    - Admin endpoints (requires authentication)
/api/email/    - Public endpoints (no auth required)
```

---

## Bounce Management

### `GET /api/admin/bounces/summary`
Get bounce statistics and metrics.

**Auth**: Required (Admin)  
**Method**: GET

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
    { "type": "hard", "count": 450 },
    { "type": "spam", "count": 0 }
  ],
  "recentBounces": [
    {
      "recipientEmail": "invalid@example.com",
      "bounceType": "hard",
      "bounceReason": "Mailbox does not exist",
      "consecutiveBounces": 1,
      "smtpCode": "5.1.1",
      "lastBounceAt": "2025-12-30T10:30:00Z"
    }
  ]
}
```

---

### `GET /api/admin/bounces/list`
Get paginated list of bounces with filtering.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Results per page |
| bounceType | string | - | Filter: 'soft', 'hard', 'spam' |
| suppressed | boolean | - | Show only suppressed |
| branch | string | 'Harare' | Branch filter |
| search | string | - | Search email or clientId |

**Example**:
```bash
GET /api/admin/bounces/list?page=1&bounceType=hard&branch=Harare
```

**Response**:
```json
{
  "bounces": [
    {
      "id": "bounce123",
      "recipientEmail": "john@invalid.com",
      "clientId": "client123",
      "bounceType": "hard",
      "lastBounceAt": "2025-12-30T10:30:00Z",
      "consecutiveBounces": 1,
      "totalBounceCount": 3,
      "bounceReason": "Mailbox does not exist",
      "smtpCode": "5.1.1",
      "shouldSuppress": true,
      "suppressedAt": "2025-12-30T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25
  }
}
```

---

### `POST /api/admin/bounces/suppress`
Manually suppress a recipient.

**Auth**: Required (Admin)  
**Method**: POST

**Request Body**:
```json
{
  "recipientEmail": "john@example.com",
  "bounceType": "hard",
  "reason": "Invalid address"
}
```

**Response**:
```json
{
  "success": true,
  "message": "john@example.com has been suppressed",
  "suppressed": {
    "id": "bounce123",
    "recipientEmail": "john@example.com",
    "shouldSuppress": true,
    "suppressedAt": "2025-12-30T10:30:00Z"
  }
}
```

---

### `GET /api/admin/bounces/suppressed`
Get suppressed recipients.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| page | number | 1 |
| limit | number | 50 |
| reason | string | - |
| branch | string | 'Harare' |

**Response**:
```json
{
  "suppressedRecipients": [
    {
      "id": "bounce123",
      "recipientEmail": "john@example.com",
      "bounceType": "hard",
      "suppressedAt": "2025-12-30T10:30:00Z",
      "suppressedReason": "Auto-suppressed: hard bounce (3 total)"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 400,
    "pages": 8
  }
}
```

---

### `DELETE /api/admin/bounces/suppressed`
Unsuppress a recipient.

**Auth**: Required (Admin)  
**Method**: DELETE

**Request Body**:
```json
{
  "recipientEmail": "john@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "john@example.com has been unsuppressed",
  "updated": 1
}
```

---

## Unsubscribe Management

### `GET /api/admin/unsubscribes/list`
Get unsubscribed recipients.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| page | number | 1 |
| limit | number | 50 |
| reason | string | - |
| branch | string | 'Harare' |
| search | string | - |

**Response**:
```json
{
  "unsubscribed": [
    {
      "id": "unsub123",
      "recipientEmail": "john@example.com",
      "clientId": "client123",
      "reason": "requested",
      "description": "User clicked unsubscribe",
      "unsubscribedAt": "2025-12-30T10:30:00Z",
      "unsubscribedBy": "user_request",
      "resubscribeAttemptAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 850,
    "pages": 17
  }
}
```

---

### `POST /api/admin/unsubscribes/list`
Add recipient to unsubscribe list.

**Auth**: Required (Admin)  
**Method**: POST

**Request Body**:
```json
{
  "recipientEmail": "john@example.com",
  "clientId": "client123",
  "reason": "requested",
  "description": "User requested removal"
}
```

**Valid Reasons**:
- `requested` - User request
- `hard_bounce` - Hard bounce
- `spam` - Marked as spam
- `other` - Other reason

**Response**:
```json
{
  "success": true,
  "message": "john@example.com has been added to unsubscribe list",
  "unsubscribed": {
    "id": "unsub123",
    "recipientEmail": "john@example.com",
    "reason": "requested",
    "unsubscribedAt": "2025-12-30T10:30:00Z"
  }
}
```

---

### `POST /api/admin/unsubscribes/remove`
Remove recipient from unsubscribe list (resubscribe).

**Auth**: Required (Admin)  
**Method**: POST

**Request Body**:
```json
{
  "recipientEmail": "john@example.com",
  "clientId": "client123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "john@example.com has been removed from unsubscribe list",
  "deleted": 1
}
```

---

### `GET /api/email/unsubscribe` (PUBLIC)
Public unsubscribe endpoint for email links.

**Auth**: Not required  
**Method**: GET

**Query Parameters** (All required):
| Parameter | Type | Description |
|-----------|------|-------------|
| email | string | Recipient email |
| clientId | string | Client ID |
| token | string | Validation token (≥10 chars) |

**Example**:
```bash
GET /api/email/unsubscribe?email=john@example.com&clientId=client123&token=abc123def456
```

**Response**:
```json
{
  "success": true,
  "message": "You have been unsubscribed from our mailing list. We respect your choice.",
  "email": "john@example.com"
}
```

**Error Response** (Invalid token):
```json
{
  "error": "Invalid or missing unsubscribe token"
}
```

---

## Engagement Scoring

### `GET /api/admin/engagement/scores`
Get engagement scores for recipients.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Results per page |
| tier | string | - | Filter: 'hot', 'warm', 'cold' |
| minScore | number | 0 | Minimum engagement score |
| branch | string | 'Harare' | Branch filter |
| search | string | - | Search email or client |

**Response**:
```json
{
  "scores": [
    {
      "id": "score123",
      "recipientEmail": "john@example.com",
      "clientName": "John Doe",
      "engagementScore": 85,
      "engagementTier": "hot",
      "openCount": 15,
      "clickCount": 8,
      "lastEngagementAt": "2025-12-30T09:00:00Z",
      "predictedPaymentProbability": 0.82
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5000,
    "pages": 100
  },
  "tierDistribution": [
    { "tier": "hot", "count": 1625, "avgScore": "78.3" },
    { "tier": "warm", "count": 2000, "avgScore": "45.2" },
    { "tier": "cold", "count": 1375, "avgScore": "15.8" }
  ]
}
```

**Engagement Tiers**:
- `hot`: Score 60-100 (highly engaged)
- `warm`: Score 30-60 (moderate engagement)
- `cold`: Score 0-30 (low engagement)

---

### `GET /api/admin/engagement/summary`
Get engagement statistics.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| branch | string | 'Harare' |

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
    {
      "tier": "hot",
      "count": 1625,
      "percentage": "32.50",
      "avgScore": "78.3"
    },
    {
      "tier": "warm",
      "count": 2000,
      "percentage": "40.00",
      "avgScore": "45.2"
    },
    {
      "tier": "cold",
      "count": 1375,
      "percentage": "27.50",
      "avgScore": "15.8"
    }
  ]
}
```

---

## Campaign Analytics

### `GET /api/admin/analytics/campaigns`
Compare campaign performance.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| branch | string | 'Harare' |
| startDate | string | 30 days ago |
| endDate | string | today |

**Response**:
```json
{
  "campaigns": [
    {
      "type": "REMINDER",
      "sent": 5000,
      "opened": 1250,
      "clicked": 500,
      "bounced": 100,
      "converted": 350,
      "revenue": 52500,
      "roi": 125.5,
      "openRate": "25.00",
      "clickRate": "10.00",
      "bounceRate": "2.00",
      "conversionRate": "7.00"
    },
    {
      "type": "ESCALATION",
      "sent": 3000,
      "opened": 1050,
      "clicked": 450,
      "bounced": 60,
      "converted": 280,
      "revenue": 42000,
      "roi": 180.5,
      "openRate": "35.00",
      "clickRate": "15.00",
      "bounceRate": "2.00",
      "conversionRate": "9.33"
    },
    {
      "type": "FOLLOWUP",
      "sent": 2500,
      "opened": 625,
      "clicked": 200,
      "bounced": 50,
      "converted": 75,
      "revenue": 11250,
      "roi": 45.0,
      "openRate": "25.00",
      "clickRate": "8.00",
      "bounceRate": "2.00",
      "conversionRate": "3.00"
    }
  ],
  "timeRange": {
    "start": "2025-11-30T00:00:00Z",
    "end": "2025-12-30T23:59:59Z"
  },
  "branch": "Harare"
}
```

**Campaign Types**:
- `REMINDER`: Payment reminder emails
- `ESCALATION`: Overdue invoice escalations
- `FOLLOWUP`: Follow-up emails

**Metrics Explained**:
- `openRate`: (Opens / Sent) × 100
- `clickRate`: (Clicks / Sent) × 100
- `bounceRate`: (Bounces / Sent) × 100
- `conversionRate`: (Conversions / Sent) × 100
- `roi`: ((Revenue - Cost) / Cost) × 100

---

### `GET /api/admin/analytics/send-times`
Get optimal send times for recipients.

**Auth**: Required (Admin)  
**Method**: GET

**Query Parameters**:
| Parameter | Type | Default |
|-----------|------|---------|
| page | number | 1 |
| limit | number | 50 |
| branch | string | 'Harare' |
| search | string | - |

**Response**:
```json
{
  "optimizations": [
    {
      "id": "opt123",
      "recipientEmail": "john@example.com",
      "clientName": "John Doe",
      "bestSendHour": 9,
      "bestSendDayOfWeek": 1,
      "bestSendDay": "Monday",
      "bestSendTime": "9:00",
      "totalOpens": 45,
      "totalSends": 100,
      "openRate": "45.2",
      "confidencePercentage": "78"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3200,
    "pages": 64
  }
}
```

**Best Send Days**:
- 0: Sunday
- 1: Monday
- 2: Tuesday
- 3: Wednesday
- 4: Thursday
- 5: Friday
- 6: Saturday

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data returned successfully |
| 400 | Bad Request | Missing required parameter |
| 401 | Unauthorized | Missing or invalid auth token |
| 404 | Not Found | Endpoint doesn't exist |
| 500 | Server Error | Database error, etc. |

### Error Response Format

```json
{
  "error": "Failed to fetch bounce summary"
}
```

---

## Rate Limiting & Performance

### Recommended Practices

1. **Pagination**: Use `limit=50` for large datasets
2. **Caching**: Cache engagement scores for 24 hours
3. **Batch Operations**: Use batch endpoints for >100 operations
4. **Filtering**: Use specific filters to reduce result sets

### Response Times (Typical)

| Endpoint | Time |
|----------|------|
| /bounces/summary | 200ms |
| /bounces/list (limit=50) | 150ms |
| /engagement/scores (limit=50) | 200ms |
| /analytics/campaigns | 300ms |
| /analytics/send-times | 250ms |

---

## Example Requests

### cURL Examples

**Get bounce summary**:
```bash
curl -X GET "https://erp.example.com/api/admin/bounces/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Add to unsubscribe list**:
```bash
curl -X POST "https://erp.example.com/api/admin/unsubscribes/list" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "john@example.com",
    "clientId": "client123",
    "reason": "requested"
  }'
```

**Public unsubscribe**:
```bash
curl -X GET "https://erp.example.com/api/email/unsubscribe?email=john@example.com&clientId=client123&token=abc123def456"
```

---

## Pagination Notes

All list endpoints support pagination:

```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25
  }
}
```

To get the next page:
```
page=2&limit=50
```

Maximum limit: 100 (recommended: 50)

---

## Authentication

All `/api/admin/*` endpoints require:
- Header: `Authorization: Bearer {token}`
- Or: Session cookie from login

Public `/api/email/*` endpoints don't require authentication.
