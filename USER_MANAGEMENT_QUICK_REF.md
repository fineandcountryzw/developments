# User Management Quick Reference Guide

---

## Overview

The User Management system handles the complete user lifecycle:
1. **Invite** users via email
2. **Activate** accounts through secure tokens
3. **Manage** roles and permissions
4. **Revoke** access immediately
5. **Delete** users permanently

---

## API Endpoints

### Invitations

**Send Invitation**
```
POST /api/admin/users/invite
{
  email: "agent@company.com",
  fullName: "John Doe",
  role: "AGENT",
  branch: "Harare"
}
```
**Response**: 201 Created with invitation details

**List Pending Invitations**
```
GET /api/admin/users/invite?branch=Harare
```
**Response**: Array of pending invitations

---

### User Accounts

**List All Users**
```
GET /api/admin/users?branch=Harare&page=1&limit=20
```
**Response**: Paginated user list

**Bulk Update Users**
```
POST /api/admin/users
{
  action: "update-branch" | "bulk-enable" | "bulk-disable",
  userIds: ["user1", "user2"],
  data: { branch: "Bulawayo" }
}
```

---

### Access Control

**Revoke User Access**
```
POST /api/admin/users/{userId}/revoke
{
  reason: "Employee departed"
}
```
**Result**: User immediately disabled, sessions remain valid until timeout

**Check User Status**
```
GET /api/admin/users/{userId}/revoke?userId={userId}
```

**Delete User Permanently**
```
DELETE /api/admin/users/{userId}/revoke
{
  userId: "{userId}"
}
```

---

### Authentication

**Accept Invitation** (User-facing)
```
POST /api/auth/accept-invitation
{
  token: "base64_invitation_token",
  password: "SecurePassword123!",
  confirmPassword: "SecurePassword123!"
}
```
**Response**: 201 Created with user account details

**Validate Invitation** (UI Verification)
```
GET /api/auth/accept-invitation?token={token}
```
**Response**: Invitation status, expiration, days remaining

---

## User Roles

| Role | Capabilities | Invite Power |
|------|-------------|--------------|
| **ADMIN** | Full system access | All roles |
| **MANAGER** | Team management, metrics | Agent, Client |
| **AGENT** | Sales pipeline, prospects | None |
| **ACCOUNT** | Payment reconciliation | None |
| **CLIENT** | Property access, reservations | None |

---

## Workflows

### 1. Inviting a New Agent

```
Admin Dashboard
  ↓
User Management Tab
  ↓
"Send Invitation" Button
  ↓
Form:
  - Email: agent@company.com
  - Name: John Smith
  - Role: AGENT
  - Branch: Harare
  ↓
Send → Email delivered → Invitation logged
```

### 2. User Accepts Invitation

```
Email received
  ↓
Click "Accept Invitation" link
  ↓
Accept Invitation Page (token validation)
  ↓
Create password form
  ↓
Submit → User account created → Password hashed
  ↓
Redirect to login
```

### 3. Revoking User Access

```
Admin Dashboard
  ↓
User Management → Users Tab
  ↓
Find user in table
  ↓
Click lock icon
  ↓
Confirm revocation (optional reason)
  ↓
Revoke → isActive = false → Audit logged
  ↓
User blocked at login
```

### 4. Deleting User

```
Admin Dashboard
  ↓
User Management → Users Tab
  ↓
Find user in table
  ↓
Click trash icon
  ↓
Confirm permanent deletion
  ↓
Delete → User removed → Audit logged
```

---

## Audit Trail Actions

All user management actions are logged:

| Action | Trigger | Details Logged |
|--------|---------|----------------|
| `USER_INVITED` | Invitation sent | Email, role, branch, invited by |
| `USER_ACCOUNT_CREATED` | Invitation accepted | Email, role, branch, method |
| `USER_ACCESS_REVOKED` | Access removed | Email, role, reason, timestamp |
| `USER_DELETED` | User removed | Email, role, deletion timestamp |
| `USERS_BULK_*` | Bulk operations | Count, action, affected users |

**Query Example**:
```typescript
// Find all invitations sent by admin
await prisma.auditTrail.findMany({
  where: {
    action: 'USER_INVITED',
    userId: adminId
  }
});

// Find all revocations in last 7 days
await prisma.auditTrail.findMany({
  where: {
    action: 'USER_ACCESS_REVOKED',
    createdAt: { gte: new Date(Date.now() - 7*24*60*60*1000) }
  }
});
```

---

## Email Templates

### Invitation Email Features

✅ Role-colored design (Manager: Blue, Agent: Green, Account: Purple, Client: Cyan)
✅ Personalized greeting with full name
✅ Role and branch assignment details
✅ Secure invitation link (valid 30 days)
✅ Expiration warning
✅ Support contact information
✅ HTML + plain text fallback

**From**: `invitations@fineandcountry.co.zw`
**Subject**: `You're invited to Fine & Country Zimbabwe - {ROLE} Account`

---

## Security Features

✅ **Email Validation**: Regex check + uniqueness enforcement
✅ **Token Security**: 30-day expiration, one-time use, unique per invitation
✅ **Password Security**: 8+ characters, bcryptjs hashing (10 rounds)
✅ **Admin-Only**: All management endpoints require ADMIN role
✅ **Self-Protection**: Cannot revoke own access, cannot delete self
✅ **Audit Trail**: Every action logged with context
✅ **Dev Mode**: Localhost bypass for development testing

### Planned (TODO)

⏳ **Session Termination**: Invalidate all sessions on revocation
⏳ **Rate Limiting**: Prevent invitation spam
⏳ **CSRF Protection**: Token validation on forms
⏳ **JWT Tokens**: Upgrade from base64 for better security

---

## Component Props & State

### UserManagement Component

**State Management**:
```typescript
- activeTab: 'invitations' | 'users'
- selectedBranch: string
- invitations: Invitation[]
- users: User[]
- loading: boolean
- inviteOpen: boolean
- inviteEmail, inviteRole, inviteBranch, inviteFullName
- revokeUserId, revokeReason, revokeLoading
- deleteUserId, deleteLoading
```

**Key Functions**:
- `loadInvitations()` - Fetch pending invitations
- `loadUsers()` - Fetch active users
- `handleSendInvitation()` - POST to /api/admin/users/invite
- `handleRevokeAccess()` - POST to /api/admin/users/[id]/revoke
- `handleDeleteUser()` - DELETE /api/admin/users/[id]/revoke

---

## Common Tasks

### Send Bulk Invitations

```typescript
// Load CSV, then for each row:
const invitations = await Promise.all([
  fetch('/api/admin/users/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: row.email,
      fullName: row.name,
      role: 'AGENT',
      branch: 'Harare'
    })
  }),
  // ... more rows
]);
```

### Export Users to CSV

```typescript
// After loading users from GET /api/admin/users
const csv = [
  ['Email', 'Name', 'Role', 'Branch', 'Status', 'Last Login'],
  ...users.map(u => [
    u.email, u.name, u.role, u.branch,
    u.isActive ? 'Active' : 'Revoked',
    u.lastLogin || 'Never'
  ])
].map(row => row.join(',')).join('\n');

// Download
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
// ... download
```

### Check User Activity

```typescript
// Find last activity
const user = await prisma.user.findUnique({
  where: { email: 'agent@company.com' },
  select: {
    id: true,
    lastLogin: true,
    isActive: true
  }
});

// Find all actions by user
const actions = await prisma.auditTrail.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

---

## Error Handling

### Email Not Sent

```
Error: Failed to send invitation email
Solution: Check RESEND_API_KEY environment variable
Fallback: Invitation record still created, user can request resend
```

### User Already Exists

```
Error: User with this email already exists (409)
Solution: Use different email or delete existing user first
```

### Invalid Token

```
Error: Invalid invitation token (404)
Solution: Request new invitation with fresh token
```

### Token Expired

```
Error: Invitation has expired (410)
Solution: Admin must send new invitation (30-day limit)
```

### Duplicate Email

```
Error: User with this email already exists (409)
Solution: Verify email address, delete previous user if needed
```

---

## Database Schema (Quick)

```prisma
// Invitations table
model Invitation {
  id              String   @id
  email           String   @unique
  role            String
  branch          String
  token           String   @unique
  status          String   // PENDING, ACCEPTED, EXPIRED
  expiresAt       DateTime
  acceptedAt      DateTime?
  acceptedByUserId String?
  createdAt       DateTime @default(now())
}

// User model additions
model User {
  // ... existing fields ...
  isActive        Boolean?   @default(true)
  accessRevokedAt DateTime?
  accessRevokedBy String?
}
```

---

## Monitoring & Metrics

**Key Metrics to Track**:
1. Invitations sent per day
2. Invitation acceptance rate
3. Average time to accept invitation
4. User registration completion rate
5. Access revocations per week
6. Deleted users per month
7. Failed login attempts (revoked users)

**Queries**:
```typescript
// Invitations sent today
await prisma.auditTrail.count({
  where: {
    action: 'USER_INVITED',
    createdAt: { gte: startOfDay }
  }
});

// Pending invitations expiring soon
await prisma.invitation.count({
  where: {
    status: 'PENDING',
    expiresAt: { lte: new Date(Date.now() + 3*24*60*60*1000) }
  }
});

// Recently revoked users
await prisma.user.findMany({
  where: {
    accessRevokedAt: { gte: new Date(Date.now() - 7*24*60*60*1000) }
  }
});
```

---

## Environment Setup

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx
DATABASE_URL=postgresql://...

# Optional for dev
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Support Resources

- **Email Service**: `/lib/email-service.ts`
- **Invitation API**: `/app/api/admin/users/invite/route.ts`
- **Acceptance API**: `/app/api/auth/accept-invitation/route.ts`
- **Revocation API**: `/app/api/admin/users/[id]/revoke/route.ts`
- **UI Component**: `/components/UserManagement.tsx`
- **Documentation**: `USER_MANAGEMENT_IMPLEMENTATION.md`

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Active
