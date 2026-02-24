# Cron Job Deployment Guide

## Overview

The `expireReservations` function automatically expires pending reservations that have passed their 72-hour window and resets the associated stands to available status.

**Location:** `app/api/cron/expire-reservations/route.ts`

## Deployment Options

### Option 1: EasyCron (Recommended for Vite)

1. Sign up at [easycron.com](https://www.easycron.com)
2. Create a new cron job:
   - **URL:** `https://your-domain.com/api/cron/expire-reservations`
   - **Method:** POST
   - **Schedule:** Every hour (`0 * * * *`)
   - **Headers:**
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```

### Option 2: cron-job.org (Free Alternative)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL:** `https://your-domain.com/api/cron/expire-reservations`
   - **Schedule:** Every hour
   - **Request Method:** POST
   - **Headers:** Add `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: Vercel Cron (If Migrating to Next.js)

Already configured in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/expire-reservations",
    "schedule": "0 * * * *"
  }]
}
```

### Option 4: GitHub Actions (Self-Hosted)

Create `.github/workflows/expire-reservations.yml`:

```yaml
name: Expire Reservations

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Manual trigger

jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Job
        run: |
          curl -X POST https://your-domain.com/api/cron/expire-reservations \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

## Express/Fastify Integration

To expose the function as an HTTP endpoint in your Vite project:

### With Express

```typescript
// server/api/cron.ts
import express from 'express';
import { expireReservations } from '../../app/api/cron/expire-reservations/route';

const router = express.Router();

router.post('/expire-reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const result = await expireReservations(authHeader);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message === 'Unauthorized') {
      res.status(401).json({ error: 'Unauthorized' });
    } else if (message === 'Cron job not configured') {
      res.status(500).json({ error: 'Cron job not configured' });
    } else {
      res.status(500).json({ error: 'Internal server error', message });
    }
  }
});

router.get('/expire-reservations', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/cron/expire-reservations',
    method: 'POST',
    configured: !!process.env.CRON_SECRET,
    description: 'Expires pending reservations past their 72-hour window',
    schedule: 'Every hour (0 * * * *)',
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### With Fastify

```typescript
// server/routes/cron.ts
import { FastifyInstance } from 'fastify';
import { expireReservations } from '../../app/api/cron/expire-reservations/route';

export default async function cronRoutes(fastify: FastifyInstance) {
  fastify.post('/expire-reservations', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization as string | undefined;
      const result = await expireReservations(authHeader);
      reply.status(200).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      if (message === 'Unauthorized') {
        reply.status(401).send({ error: 'Unauthorized' });
      } else if (message === 'Cron job not configured') {
        reply.status(500).send({ error: 'Cron job not configured' });
      } else {
        reply.status(500).send({ error: 'Internal server error', message });
      }
    }
  });

  fastify.get('/expire-reservations', async (request, reply) => {
    reply.send({
      status: 'ok',
      endpoint: '/api/cron/expire-reservations',
      method: 'POST',
      configured: !!process.env.CRON_SECRET,
      description: 'Expires pending reservations past their 72-hour window',
      schedule: 'Every hour (0 * * * *)',
      timestamp: new Date().toISOString(),
    });
  });
}
```

## Environment Variables

Add to your `.env` file:

```bash
# Generate secure secret:
# openssl rand -base64 32

CRON_SECRET="your-secure-random-secret-here"
```

## Security Checklist

- [x] Generate cryptographically secure `CRON_SECRET`
- [x] Never expose `CRON_SECRET` in client-side code
- [x] Use HTTPS for all cron job requests
- [x] Verify Authorization header in every request
- [x] Log all cron job executions for audit trail

## Testing

### Local Testing

```bash
# Test with curl
curl -X POST http://localhost:5173/api/cron/expire-reservations \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "expired_count": 2,
  "reset_stands_count": 2,
  "error_count": 0,
  "expired_reservation_ids": ["res_123", "res_456"],
  "reset_stand_ids": ["stand_789", "stand_012"],
  "duration_ms": 145,
  "timestamp": "2025-06-15T14:30:00.000Z"
}
```

### Health Check

```bash
curl http://localhost:5173/api/cron/expire-reservations

# Expected response:
{
  "status": "ok",
  "endpoint": "/api/cron/expire-reservations",
  "method": "POST",
  "configured": true,
  "description": "Expires pending reservations past their 72-hour window",
  "schedule": "Every hour (0 * * * *)",
  "timestamp": "2025-06-15T14:30:00.000Z"
}
```

## Monitoring

### Forensic Logs

The cron job produces detailed forensic logs:

```
[CRON][EXPIRE_RESERVATIONS][STARTED] { current_time: "2025-06-15T14:00:00.000Z" }
[CRON][EXPIRE_RESERVATIONS][FOUND] { count: 3, reservation_ids: ["res_1", "res_2", "res_3"] }
[CRON][EXPIRE_RESERVATIONS][PROCESSED] { 
  reservation_id: "res_1",
  stand_number: "A24",
  development: "Borrowdale Heights",
  client_email: "client@example.com",
  hours_past_expiry: 2
}
[CRON][EXPIRE_RESERVATIONS][COMPLETED] { 
  expired_count: 3, 
  reset_stands_count: 3,
  duration_ms: 234 
}
```

### Error Handling

- **Unauthorized (401):** Invalid or missing `CRON_SECRET`
- **Internal Server Error (500):** Database connection issues or invalid data
- **Partial Success:** Individual reservation errors are logged but don't stop the job

## Troubleshooting

### No Reservations Expiring

- Check database: Are there PENDING reservations with `expiresAt < now()`?
- Verify timezone: Ensure `expiresAt` is stored in UTC
- Check logs: Look for `[CRON][EXPIRE_RESERVATIONS][FOUND]` with count > 0

### Unauthorized Errors

- Verify `CRON_SECRET` is set in `.env`
- Check Authorization header format: `Bearer YOUR_SECRET`
- Ensure cron service is sending correct header

### Transaction Failures

- Check Prisma connection: `npx prisma db pull`
- Verify foreign key constraints: Stand must exist for Reservation
- Check enum values: `EXPIRED` and `AVAILABLE` must be valid

## Manual Execution

For immediate testing or emergency expiry:

```typescript
// server/scripts/expire-now.ts
import { expireReservations } from '../app/api/cron/expire-reservations/route';

async function main() {
  const secret = process.env.CRON_SECRET;
  
  if (!secret) {
    throw new Error('CRON_SECRET not configured');
  }
  
  const result = await expireReservations(`Bearer ${secret}`);
  console.log('Expiry result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

Run with:

```bash
tsx server/scripts/expire-now.ts
```

## Cost Considerations

| Service | Free Tier | Cost (Hourly Cron) |
|---------|-----------|-------------------|
| EasyCron | 1 job | Free |
| cron-job.org | Unlimited | Free |
| GitHub Actions | 2,000 min/month | Free |
| Vercel Cron | 100 invocations/day | Free |

**Recommendation:** Use **cron-job.org** for zero-cost, reliable hourly execution.
