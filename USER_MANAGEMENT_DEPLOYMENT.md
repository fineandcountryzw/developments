# User Management System - Setup & Deployment Guide

---

## Phase Overview

**Name**: User Management (Replaces: Agency Access Control)
**Status**: ✅ Phase 1 Complete (Invitations + Access Control)
**Priority**: HIGH
**Timeline**: 1-2 weeks full deployment

### What's Included

✅ **Tier 1 - Invitations & Acceptance** (COMPLETE)
- Email-based user invitations
- Secure token generation (30-day expiry)
- User account creation from invitations
- Password setup during acceptance
- Audit trail logging

✅ **Tier 2 - Access Management** (COMPLETE)
- User access revocation
- User deletion
- Admin dashboard UI
- Role-based permissions
- Branch filtering

🔄 **Tier 3 - Role Dashboards** (PENDING)
- Manager Dashboard (team metrics, KPIs)
- Agent Dashboard (sales pipeline)
- Client Portal (properties, reservations)
- Accounts Dashboard (payment reconciliation)

---

## Installation Steps

### 1. Environment Configuration

Add to `.env.local`:

```bash
# Email Service (Resend)
RESEND_API_KEY=re_YOUR_API_KEY_HERE

# Auth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-secret-key-here

# Invitation Configuration
NEXT_PUBLIC_INVITATION_EXPIRY_DAYS=30
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Get Resend API Key**:
1. Go to [resend.com](https://resend.com)
2. Sign up for free tier
3. Navigate to "API Keys"
4. Generate new API key
5. Copy and paste to `.env.local`

### 2. Database Migrations

Create Prisma migration for Invitation table:

```bash
# Generate migration
npx prisma migrate dev --name add_invitations_table

# Apply migration
npx prisma db push
```

**Migration content** (if manual):

```prisma
model Invitation {
  id              String   @id @default(cuid())
  email           String   @unique
  role            String
  branch          String
  fullName        String?
  token           String   @unique
  status          String   @default("PENDING")
  expiresAt       DateTime
  acceptedAt      DateTime?
  acceptedByUserId String?
  invitedBy       String
  invitedByUser   User     @relation("InvitedBy", fields: [invitedBy], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([email])
  @@index([status])
  @@index([expiresAt])
}
```

Add to User model:

```prisma
// In User model
isActive          Boolean?   @default(true)
accessRevokedAt   DateTime?
accessRevokedBy   String?
invitations       Invitation[] @relation("InvitedBy")
```

### 3. File Structure Verification

Verify all files created:

```
✅ lib/email-service.ts
✅ app/api/admin/users/invite/route.ts
✅ app/api/admin/users/route.ts
✅ app/api/auth/accept-invitation/route.ts
✅ app/api/admin/users/[id]/revoke/route.ts
✅ components/UserManagement.tsx
```

### 4. Component Integration

Add to admin layout/navigation:

```typescript
// In your admin navigation/sidebar
<NavLink href="/admin/user-management" icon={Users}>
  User Management
</NavLink>
```

Create admin page:

```typescript
// /app/admin/user-management/page.tsx
'use client';
import { UserManagement } from '@/components/UserManagement';

export default function UserManagementPage() {
  return <UserManagement />;
}
```

### 5. Authentication Middleware

Update auth middleware to check `isActive`:

```typescript
// In your auth middleware/session handling
if (session.user) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });
  
  // Deny access if user is revoked
  if (!user?.isActive) {
    throw new Error('User access has been revoked');
  }
}
```

### 6. Test the System

**Test Invitation Flow**:
```bash
# 1. Send invitation via API
curl -X POST http://localhost:3000/api/admin/users/invite \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "AGENT",
    "branch": "Harare"
  }'

# 2. Copy the token from database or console
# SELECT token FROM "Invitation" WHERE email = 'test@example.com';

# 3. Accept invitation
curl -X POST http://localhost:3000/api/auth/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "password": "TestPassword123!",
    "confirmPassword": "TestPassword123!"
  }'

# 4. Verify user created
# SELECT * FROM "User" WHERE email = 'test@example.com';
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All files created and verified
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Resend API key validated
- [ ] Auth middleware updated
- [ ] Navigation links added
- [ ] Tests pass locally

### Database

- [ ] Invitation table created
- [ ] User model updated
- [ ] Indexes added for performance
- [ ] Backup created before migration
- [ ] Migration tested on staging

### Security

- [ ] CSRF tokens enabled
- [ ] Rate limiting configured
- [ ] SSL/TLS enabled (production)
- [ ] Email templates reviewed
- [ ] Token validation tested
- [ ] Admin-only endpoints verified

### Performance

- [ ] Database queries optimized
- [ ] Pagination implemented (20 users per page)
- [ ] Email service tested at scale
- [ ] Cache configured (if applicable)
- [ ] Indexes verified

### Testing

- [ ] Invitation creation works
- [ ] Email delivery verified
- [ ] Token validation works
- [ ] User creation from invitation works
- [ ] Access revocation blocks login
- [ ] User deletion removes all records
- [ ] Audit trails captured
- [ ] Admin UI loads without errors

---

## Configuration Options

### Email Service

```typescript
// In email-service.ts
const roleColors: Record<string, string> = {
  'ADMIN': '#85754E',
  'MANAGER': '#2563EB',
  'AGENT': '#059669',
  'ACCOUNT': '#7C3AED',
  'CLIENT': '#0891B2'
};

// Customize email from address
from: 'invitations@fineandcountry.co.zw'  // Change as needed
```

### Invitation Expiry

```typescript
// In invite/route.ts
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
// Change the multiplier: 7 for 7 days, 60 for 60 days, etc.
```

### Pagination

```typescript
// In users/route.ts
const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
// Change default from 20 to your preferred page size
```

---

## Troubleshooting

### Issue: "RESEND_API_KEY not found"

**Solution**:
1. Check `.env.local` exists in project root
2. Verify API key format: `re_xxxxxxxxxxxxx`
3. Restart development server
4. Check environment variables loaded: `console.log(process.env.RESEND_API_KEY)`

### Issue: "Invitation table does not exist"

**Solution**:
```bash
# Run migrations
npx prisma migrate dev

# Or recreate schema
npx prisma db push
```

### Issue: "User with this email already exists" when accepting invitation

**Solution**:
1. Verify email address is correct
2. Check if user already created manually
3. If needed, delete user and resend invitation
4. Prevent duplicates by checking before creation

### Issue: "Email not being sent"

**Solution**:
1. Verify Resend API key is correct
2. Check email address is valid
3. Look for rate limiting (Resend free tier limits)
4. Check server logs for HTTP errors
5. Verify network connectivity to Resend API

### Issue: "Token expired" error

**Solution**:
1. Invitations valid for 30 days by default
2. Admin can send new invitation
3. Verify system time is correct (affects expiry)
4. Check token isn't corrupted in transit

### Issue: "Revoked user can still login"

**Solution**:
1. Update auth middleware to check `isActive`
2. Clear session/cookies after revocation
3. Implement session invalidation on backend
4. Verify middleware is enforced on all protected routes

---

## Monitoring & Maintenance

### Daily Tasks

- [ ] Check for failed invitations in logs
- [ ] Monitor email delivery rate
- [ ] Review new user signups
- [ ] Check for revoked users (should be rare)

### Weekly Tasks

- [ ] Review audit trail for suspicious activity
- [ ] Check pending invitations expiring soon
- [ ] Monitor system performance metrics
- [ ] Review failed login attempts

### Monthly Tasks

- [ ] Generate user management report
- [ ] Review role distribution
- [ ] Audit all administrative actions
- [ ] Clean up expired invitations
- [ ] Review email template effectiveness

**Audit Query Example**:
```typescript
// Find all invitations sent this month
const invitationsSentThisMonth = await prisma.auditTrail.findMany({
  where: {
    action: 'USER_INVITED',
    createdAt: {
      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    }
  }
});

console.log(`Invitations sent this month: ${invitationsSentThisMonth.length}`);
```

---

## Performance Optimization

### Database Indexes

Already added:
```prisma
@@index([email])     // Fast lookup by email
@@index([status])    // Filter by invitation status
@@index([expiresAt]) // Find expiring invitations
```

### Query Optimization

**Use pagination**:
```typescript
const limit = 20; // Pages of 20 users
const page = request.nextUrl.searchParams.get('page') || '1';
const skip = (page - 1) * limit;
```

**Limit field selection**:
```typescript
select: {
  id: true,
  email: true,
  name: true,
  role: true,
  branch: true,
  isActive: true
  // Don't select password, accessToken, etc.
}
```

### Caching Strategy

**Cache invitation list** (5 minute TTL):
```typescript
const cacheKey = `invitations:${branch}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const invitations = await prisma.invitation.findMany({ ... });
await redis.setex(cacheKey, 300, JSON.stringify(invitations));
return invitations;
```

---

## Rollback Plan

If issues arise:

### Step 1: Stop accepting invitations
```typescript
// In invite/route.ts
if (process.env.DISABLE_INVITATIONS === 'true') {
  return NextResponse.json({ error: 'Invitations disabled' }, { status: 503 });
}
```

### Step 2: Revert database changes
```bash
# Rollback to previous migration
npx prisma migrate resolve --rolled-back add_invitations_table

# Or manually delete Invitation table
```

### Step 3: Remove component from navigation
Comment out UserManagement link in navigation

### Step 4: Notify users
Send email to admins that system is under maintenance

---

## Success Metrics

**KPIs to track**:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Email Delivery Rate | > 99% | Resend dashboard |
| Invitation Acceptance Rate | > 80% | Count ACCEPTED status |
| Average Acceptance Time | < 24 hours | acceptedAt - createdAt |
| Failed Invitations | < 1% | Failed email attempts |
| Support Tickets | < 5/week | Zendesk/support system |
| System Uptime | > 99.9% | Status page |

**Queries**:
```typescript
// Email delivery rate
const sent = await prisma.invitation.count();
const accepted = await prisma.invitation.count({ where: { status: 'ACCEPTED' } });
const acceptanceRate = (accepted / sent) * 100;

// Average acceptance time
const invitations = await prisma.invitation.findMany({
  where: { acceptedAt: { not: null } },
  select: { createdAt: true, acceptedAt: true }
});
const avgTime = invitations.reduce((sum, inv) => {
  return sum + (inv.acceptedAt!.getTime() - inv.createdAt.getTime());
}, 0) / invitations.length;
```

---

## Next Phase - Role Dashboards

After invitations are working smoothly, implement:

### Manager Dashboard
- [ ] Team member list with activity
- [ ] Branch KPIs (sales, leads, conversions)
- [ ] Agent performance metrics
- [ ] Top properties by interest
- [ ] Revenue tracking

### Agent Dashboard
- [ ] Prospect pipeline
- [ ] Deal tracking
- [ ] Activity timeline
- [ ] Client management
- [ ] Target vs actual

### Client Portal
- [ ] Saved properties
- [ ] Reservation status
- [ ] Document access
- [ ] Payment history
- [ ] Support contact

### Accounts Dashboard
- [ ] Payment reconciliation
- [ ] Invoice management
- [ ] Financial reports
- [ ] Transaction logs
- [ ] Audit trail

---

## Support & Escalation

**Issues & Contact**:
- Code errors → Check logs in `/app/api/admin/users/invite/route.ts`
- Email issues → Check Resend dashboard
- Database issues → Check PostgreSQL connection
- Auth issues → Verify `getNeonAuthUser()` middleware
- UI issues → Check browser console

**Debugging**:
```typescript
// Enable detailed logging in API routes
console.log('[USER-MGMT] Invitation request:', { email, role, branch });
console.log('[USER-MGMT] Email sent successfully:', { id: result.id });
console.log('[USER-MGMT] Invitation error:', error?.message);
```

---

## Documentation Files

- `USER_MANAGEMENT_IMPLEMENTATION.md` - Full technical details
- `USER_MANAGEMENT_QUICK_REF.md` - Quick API reference
- `USER_MANAGEMENT_DEPLOYMENT.md` - This file (setup guide)

---

**Status**: Ready for Production
**Last Updated**: 2024
**Version**: 1.0
**Maintainer**: Admin Team
