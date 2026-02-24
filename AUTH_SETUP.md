# Auth.js Setup Guide - Fine & Country Zimbabwe ERP

## Overview
This project uses Auth.js (NextAuth.js) with Prisma Adapter for authentication against a Neon PostgreSQL database. Magic link authentication is powered by Resend.

## Architecture

### 1. Database Schema
Located in `prisma/schema.prisma`:
- **User** - Core user model with email, role (ADMIN/AGENT/CLIENT)
- **Account** - OAuth provider accounts
- **Session** - Database-persisted sessions for forensic tracking
- **VerificationToken** - Magic link tokens (15-minute expiry)

### 2. Auth Configuration
Located in `lib/auth.ts`:
- **Adapter**: PrismaAdapter connected to Neon via singleton
- **Provider**: Resend email provider for magic links
- **Session Strategy**: Database (not JWT) for full audit trail
- **Callbacks**: Session enrichment with user.id and role

### 3. Email Template
Custom branded HTML email with:
- Dark charcoal background (#0A1629)
- Gold accent color (#85754E)
- Professional Fine & Country styling
- 15-minute expiry notice
- Security warnings

## Setup Instructions

### Step 1: Install Dependencies
```bash
npm install @prisma/client
npm install -D prisma
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and update:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host/database?sslmode=require"

# Auth.js
NEXTAUTH_URL="http://localhost:5173"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# Resend
AUTH_RESEND_KEY="re_xxxxxxxxxxxxxxxxxxxx"
AUTH_EMAIL_FROM="portal@fineandcountry.co.zw"
```

### Step 3: Generate Prisma Client
```bash
npx prisma generate
```

### Step 4: Push Schema to Database
```bash
npx prisma db push
```

### Step 5: Verify Connection
```bash
npx prisma studio
```

## Usage in React Components

### Get Session
```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') return <div>Please sign in</div>;
  
  return (
    <div>
      Welcome {session.user.email}
      Role: {session.user.role}
      User ID: {session.user.id}
    </div>
  );
}
```

### Sign In
```typescript
import { signIn } from 'next-auth/react';

function SignInButton() {
  return (
    <button onClick={() => signIn('email', { email: 'user@example.com' })}>
      Sign in with Email
    </button>
  );
}
```

### Sign Out
```typescript
import { signOut } from 'next-auth/react';

function SignOutButton() {
  return <button onClick={() => signOut()}>Sign out</button>;
}
```

## Linking Reservations to Users

When creating a reservation, use the session user ID:

```typescript
import { useSession } from 'next-auth/react';
import prisma from '@/lib/prisma';

async function createReservation(standId: string, agentId: string | null) {
  const { data: session } = useSession();
  
  if (!session?.user?.id) throw new Error('Not authenticated');
  
  const reservation = await prisma.reservation.create({
    data: {
      standId,
      userId: session.user.id,        // Linked to authenticated user
      agentId,                         // NULL for company leads
      isCompanyLead: agentId === null,
      termsAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      status: 'PENDING',
    },
  });
  
  return reservation;
}
```

## Security Features

### 1. Magic Link Expiry
- Links expire after **15 minutes**
- Tokens are single-use only
- Automatic cleanup via Prisma

### 2. Email Validation
- Regex validation in `signIn` callback
- Blocks invalid email formats
- Forensic logging of all attempts

### 3. Database Sessions
- Full audit trail in Neon
- Session rotation every 24 hours
- 30-day maximum session age

### 4. HTTPS Only (Production)
- Cookies marked as `secure` in production
- `sameSite: 'lax'` for CSRF protection

## Forensic Logging

All authentication events are logged with timestamps:

```typescript
[AUTH][SESSION_CREATED] { user_id, email, role, timestamp }
[AUTH][SIGNIN_ATTEMPT] { email, timestamp }
[AUTH][SIGNIN_BLOCKED] { reason, email, timestamp }
[AUTH][EMAIL_SEND_ERROR] { email, error, timestamp }
```

## Resend Configuration

### 1. Get API Key
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (fineandcountry.co.zw)
3. Generate API key
4. Add to `.env` as `AUTH_RESEND_KEY`

### 2. Domain Verification
Add these DNS records:
```
TXT _resend.fineandcountry.co.zw
DKIM resend._domainkey.fineandcountry.co.zw
```

## Migration from Supabase

To migrate existing users:

```typescript
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateUsers() {
  const { data: users } = await supabase.from('users').select('*');
  
  for (const user of users) {
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: new Date(),
      },
    });
  }
}
```

## Troubleshooting

### Magic Links Not Sending
1. Check `AUTH_RESEND_KEY` is set correctly
2. Verify domain is verified in Resend dashboard
3. Check Resend logs for delivery status

### Session Not Persisting
1. Verify `DATABASE_URL` is correct
2. Run `npx prisma db push` to sync schema
3. Check `Session` table exists in database

### Type Errors
1. Run `npx prisma generate`
2. Restart TypeScript server
3. Check `types/next-auth.d.ts` is loaded

## Production Checklist

- [ ] Set strong `NEXTAUTH_SECRET` (min 32 chars)
- [ ] Use production database URL
- [ ] Verify Resend domain
- [ ] Set `NEXTAUTH_URL` to production domain
- [ ] Enable HTTPS only
- [ ] Configure proper CORS
- [ ] Set up monitoring for failed auth attempts
- [ ] Regular database backups
- [ ] Session cleanup cronjob

## Support

For issues or questions:
- Email: tech@fineandcountry.co.zw
- Documentation: [Auth.js Docs](https://authjs.dev)
- Resend: [Resend Docs](https://resend.com/docs)
