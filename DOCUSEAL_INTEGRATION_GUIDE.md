# DocuSeal E-Signature Integration Guide

## Overview

This document describes the DocuSeal integration for electronic signatures on contracts in the Fine & Country Zimbabwe ERP system.

## Features

- **Two-party signing**: Both Client and Developer sign contracts electronically
- **Real-time status tracking**: DRAFT → SENT → VIEWED → PARTIALLY_SIGNED → SIGNED
- **Branded email notifications**: Custom signature request and confirmation emails
- **Signed PDF storage**: Automatically stored via UploadThing
- **Webhook integration**: Real-time updates from DocuSeal

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# DocuSeal E-Signature Integration
DOCUSEAL_API_KEY=your-docuseal-api-key
DOCUSEAL_BASE_URL=https://api.docuseal.co
DOCUSEAL_WEBHOOK_SECRET=your-webhook-secret
ENABLE_DOCUSEAL=true
```

### Webhook Setup

Configure your DocuSeal webhook to point to:
```
https://your-domain.com/api/webhooks/docuseal
```

Events to enable:
- `submission.created`
- `submission.completed`
- `submission.expired`
- `submitter.opened`
- `submitter.completed`
- `submitter.declined`

## Database Schema

New fields added to `GeneratedContract` and `Contract` models:

| Field | Type | Description |
|-------|------|-------------|
| `docusealSubmissionId` | String? | DocuSeal submission ID |
| `docusealStatus` | String? | Current status (DRAFT/SENT/VIEWED/etc.) |
| `docusealSignerClientId` | Int? | DocuSeal signer ID for client |
| `docusealSignerClientStatus` | String? | Client signing status |
| `docusealSignerDevId` | Int? | DocuSeal signer ID for developer |
| `docusealSignerDevStatus` | String? | Developer signing status |
| `signedPdfUrl` | String? | UploadThing URL for signed PDF |
| `sentForSignatureAt` | DateTime? | When contract was sent |
| `fullySignedAt` | DateTime? | When both parties signed |
| `developerEmail` | String? | Developer's email address |
| `developerName` | String? | Developer's name |

### Run Migration

```bash
npx prisma db push
# or
npx prisma migrate dev
```

## API Endpoints

### Send Contract for E-Signature

```http
POST /api/admin/contracts/:id/send-docuseal
Authorization: Bearer <token>
Content-Type: application/json

{
  "developerEmail": "developer@example.com",
  "developerName": "John Developer",
  "message": "Please review and sign this contract.",
  "expiresInDays": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Contract sent for e-signature",
    "submissionId": 12345,
    "status": "SENT",
    "signers": [
      { "email": "client@example.com", "role": "client" },
      { "email": "developer@example.com", "role": "developer" }
    ],
    "expiresAt": "2026-02-27T00:00:00.000Z"
  }
}
```

### Get DocuSeal Status

```http
GET /api/admin/contracts/:id/send-docuseal
Authorization: Bearer <token>
```

### Webhook Receiver

```http
POST /api/webhooks/docuseal
X-DocuSeal-Signature: <signature>
Content-Type: application/json

{
  "event_type": "submission.completed",
  "timestamp": "2026-01-27T12:00:00Z",
  "data": {
    "id": 12345,
    "metadata": { "contractId": "abc123" },
    "documents": [{ "name": "contract.pdf", "url": "https://..." }]
  }
}
```

## Contract Status Lifecycle

```
DRAFT ─────► SENT ─────► VIEWED ─────► PARTIALLY_SIGNED ─────► SIGNED
                │                               │
                └──────────► EXPIRED ◄──────────┤
                                                │
                              DECLINED ◄────────┘
```

| Status | Description |
|--------|-------------|
| `DRAFT` | Contract created, not sent for signature |
| `SENT` | DocuSeal submission created, emails sent |
| `VIEWED` | At least one signer opened the document |
| `PARTIALLY_SIGNED` | One signer has completed signing |
| `SIGNED` | All signers completed; signed PDF stored |
| `EXPIRED` | Signing deadline passed |
| `DECLINED` | A signer declined to sign |

## UI Components

### ContractsList.tsx

Updated with:
- New status badges with icons
- Send for E-Signature modal
- Download signed PDF button
- Signer progress indicators (Client/Developer)

### Usage

```tsx
import { ContractsList } from '@/components/ContractsList';

// In your dashboard
<ContractsList />
```

## Email Templates

### Signature Request Email
- Sent to both Client and Developer
- Contains signing link with expiration
- Branded with Fine & Country styling

### Signed Contract Confirmation
- Sent when all parties have signed
- Contains download link for signed PDF

### Declined Notification
- Sent to Admins/Managers
- Notifies that a contract was declined

## Security

### RBAC
- **Send for Signature**: Admin, Manager only
- **View Status**: Admin, Manager, Agent
- **Sign**: Client, Developer (their own contracts)
- **Download Signed PDF**: All with contract access

### Webhook Verification
- HMAC-SHA256 signature verification
- Idempotency tracking (prevents duplicate processing)

## Files Created/Modified

### New Files
- `lib/docuseal.ts` - DocuSeal API client
- `app/api/webhooks/docuseal/route.ts` - Webhook receiver
- `app/api/admin/contracts/[id]/send-docuseal/route.ts` - Send for signature
- `prisma/migrations/add_docuseal_fields/migration.sql` - Database migration

### Modified Files
- `prisma/schema.prisma` - Added DocuSeal fields
- `components/ContractsList.tsx` - Updated UI
- `app/api/uploadthing/core.ts` - Added signed contract upload
- `.env.example` - Added DocuSeal config vars

## Troubleshooting

### Common Issues

1. **"DocuSeal e-signature is not enabled"**
   - Set `ENABLE_DOCUSEAL=true` in environment
   - Ensure `DOCUSEAL_API_KEY` is set

2. **Webhook not updating status**
   - Verify webhook URL is correct
   - Check webhook secret matches
   - Look at server logs for errors

3. **Signed PDF not stored**
   - Check UploadThing configuration
   - Verify webhook can access PDF URL

### Logging

All DocuSeal operations are logged with:
- Module: `DocuSeal` or `Webhook`
- Actions: `CREATE_SUBMISSION`, `DOCUSEAL_RECEIVED`, etc.

## Testing

### Local Testing

1. Use DocuSeal's test/sandbox mode
2. Create a test contract
3. Send for signature
4. Use DocuSeal dashboard to simulate signing
5. Verify webhook updates contract status

### Vercel/Production

1. Configure webhook URL in DocuSeal
2. Verify SSL certificate
3. Test with real email addresses
4. Monitor Sentry for errors

## Support

For DocuSeal API issues: https://www.docuseal.co/docs
For integration issues: Check server logs and Sentry
