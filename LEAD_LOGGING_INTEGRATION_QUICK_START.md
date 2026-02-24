# Lead Activity Logging - Quick Integration Guide

## Overview

The `/api/admin/log-lead` endpoint captures user intent at key moments:
- **Clicked Reserve** - User initiated reservation
- **Started Onboarding** - User began identity verification
- **Viewed Stand** - User selected stand on map
- **Initiated Payment** - User submitted payment proof

---

## Quick Start

### 1. Basic Usage

```typescript
// Simple lead log
await fetch('/api/admin/log-lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stand_id: 'A1',
    email: 'user@example.com',
    action_type: 'CLICKED_RESERVE',
  }),
});
```

### 2. With Full Context

```typescript
await fetch('/api/admin/log-lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stand_id: 'A1',
    email: 'user@example.com',
    action_type: 'CLICKED_RESERVE',
    user_id: currentUser?.id,
    agent_id: selectedAgent?.id,
    development_id: development?.id,
  }),
});
```

### 3. Non-Blocking (Recommended)

```typescript
// Log async, don't wait for response
fetch('/api/admin/log-lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stand_id: standId,
    email: userEmail,
    action_type: 'CLICKED_RESERVE',
  }),
}).catch(err => console.error('Lead log failed:', err));

// Continue with reservation immediately
await completeReservation();
```

---

## Integration Locations

### In ReservationModal.tsx

```tsx
// When user clicks "Confirm 72H Reservation"
const handleConfirm = async () => {
  // Log the intent
  try {
    const logResponse = await fetch('/api/admin/log-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stand_id: standId,
        email: userEmail,
        action_type: 'CLICKED_RESERVE',
        user_id: currentUser?.id,
        agent_id: selectedAgent,
      }),
    });
    
    if (!logResponse.ok) {
      console.warn('[ReservationModal] Lead log failed (non-blocking)');
    }
  } catch (error) {
    console.warn('[ReservationModal] Lead log error (non-blocking):', error);
  }

  // Proceed with reservation regardless of logging result
  onConfirm(selectedAgent);
};
```

### In PlotSelectorMap.tsx

```tsx
// When user selects a stand
const handleStandSelected = async (standId: string) => {
  // Log the view
  try {
    fetch('/api/admin/log-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stand_id: standId,
        action_type: 'VIEWED_STAND',
        development_id: development?.id,
      }),
    }).catch(() => {}); // Silent fail
  } catch (error) {
    // Log async, ignore errors
  }

  // Update UI immediately
  setSelectedStand(standId);
};
```

### In LandingPage.tsx (Onboarding)

```tsx
// When user starts email verification
const handleStartOnboarding = async (email: string, standId: string) => {
  // Log onboarding start
  try {
    await fetch('/api/admin/log-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stand_id: standId,
        email: email,
        action_type: 'STARTED_ONBOARDING',
      }),
    });
  } catch (error) {
    console.error('Lead log failed:', error);
  }

  // Send magic link
  await sendMagicLink(email);
};
```

---

## Action Types Explained

| Type | When | Who Logs | Example |
|------|------|----------|---------|
| `CLICKED_RESERVE` | User clicks "Reserve" button | ReservationModal | User initiating purchase |
| `STARTED_ONBOARDING` | User enters email | LandingPage | Beginning verification |
| `VIEWED_STAND` | User selects stand on map | PlotSelectorMap | Browsing stands |
| `INITIATED_PAYMENT` | User uploads payment proof | UploadSection | Serious buyer signal |

---

## Response Handling

### Success Response (201)
```json
{
  "success": true,
  "leadLogId": "cly9x8k5m0000...",
  "standId": "A1",
  "actionType": "CLICKED_RESERVE",
  "location": "Harare",
  "timestamp": "2025-12-29T14:30:00Z"
}
```

**What to do:**
```tsx
if (response.ok) {
  const data = await response.json();
  console.log('Lead logged with ID:', data.leadLogId);
  // Optional: Store leadLogId for later reference
}
```

### Error Response (400/500)
```json
{
  "error": "Stand ID is required",
  "code": "MISSING_STAND_ID"
}
```

**What to do:**
```tsx
if (!response.ok) {
  console.error('Failed to log lead (non-critical)');
  // Continue anyway - don't block user
}
```

---

## Best Practices

### ✅ DO

- Log asynchronously (non-blocking)
- Continue user workflow even if logging fails
- Include email when available
- Use correct action_type for each scenario
- Log early (before API calls)

### ❌ DON'T

- Block user interaction for logging
- Throw errors if logging fails
- Log sensitive information (passwords, tokens)
- Make multiple API calls to log same event
- Wait for lead log response before proceeding

---

## Testing

### Test with curl
```bash
curl -X POST http://localhost:3000/api/admin/log-lead \
  -H "Content-Type: application/json" \
  -d '{
    "stand_id": "A1",
    "email": "test@example.com",
    "action_type": "CLICKED_RESERVE"
  }'
```

### Check System Diagnostics
1. Open Admin Dashboard
2. Go to System Diagnostics
3. Filter Activity by type = "RESERVATION"
4. Should see your test log entry

### Monitor Logs
```bash
# Watch API logs in Vercel/development
tail -f /path/to/logs
# Should see: "[LeadLog] Creating activity record: { stand_id: 'A1', action_type: 'CLICKED_RESERVE' }"
```

---

## Troubleshooting

### Log not appearing in System Diagnostics

**Check:**
1. Is the API endpoint returning 201?
2. Is the Activity record being created in Neon?
3. Is the System user linked correctly?

**Debug:**
```typescript
const response = await fetch('/api/admin/log-lead', {...});
console.log('Status:', response.status);
console.log('Response:', await response.json());
```

### Location always shows "Harare"

**Reason:** IP-based location detection
- Local dev machines default to Harare
- Need real IP to test Bulawayo detection

**To test:**
- Use IP from actual Zimbabwe ISP
- Or modify `LOCATION_MAPPING` for testing

### System user creation fails

**Check:**
1. DATABASE_URL is set correctly
2. Neon database is accessible
3. users table exists

**Fallback:**
- System user doesn't have to exist
- Logs will fail gracefully and be retried

---

## Expected Data in System Diagnostics

Each lead log appears as an Activity with this structure:

```
Type: RESERVATION
Description: "Lead CLICKED_RESERVE: Stand A1 from Harare (john@example.com)"
Metadata: {
  "action": "CLICKED_RESERVE",
  "email": "john@example.com",
  "ip_address": "41.76.x.x",
  "location": "Harare",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2025-12-29T14:30:00Z"
}
UserId: user-123
CreatedAt: 2025-12-29T14:30:00Z
```

---

## Summary

**Lead Activity Logging provides:**
- ✅ Intent tracking before reservation lock
- ✅ Location-aware logging
- ✅ System Diagnostics visibility
- ✅ Forensic audit trail
- ✅ Non-blocking integration

**Key integration point:**
```typescript
// Simple async call, doesn't block user workflow
fetch('/api/admin/log-lead', {
  method: 'POST',
  body: JSON.stringify({ stand_id, email, action_type })
}).catch(() => {}); // Ignore failures
```

**Status:** Ready to integrate into components
