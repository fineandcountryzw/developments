# User Management Testing Guide

---

## Test Environment Setup

### Prerequisites
- Development server running on localhost:3000
- Database connection active
- Resend API key configured (or use mock for testing)
- Admin user account with ADMIN role

### Setup Steps

```bash
# Install dependencies
npm install

# Setup environment
cp .env.local.example .env.local
# Add: RESEND_API_KEY=re_test_key

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

---

## Unit Test Cases

### 1. Email Service Tests

**Test**: Email validation
```typescript
import { isValidEmail } from '@/lib/email-service';

describe('Email Validation', () => {
  test('should accept valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user+tag@company.co.zw')).toBe(true);
  });

  test('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});
```

**Test**: HTML generation
```typescript
describe('Invitation Email HTML', () => {
  test('should generate valid HTML', () => {
    const html = generateInvitationHTML({
      fullName: 'John Doe',
      role: 'AGENT',
      branch: 'Harare',
      invitationLink: 'http://localhost/accept?token=xyz',
      invitedByName: 'Admin User'
    });

    expect(html).toContain('John Doe');
    expect(html).toContain('AGENT');
    expect(html).toContain('Harare');
    expect(html).toContain('Accept Invitation');
  });

  test('should use role-specific colors', () => {
    const html = generateInvitationHTML({
      fullName: 'Jane Doe',
      role: 'AGENT',
      branch: 'Harare',
      invitationLink: 'http://localhost/accept?token=xyz',
      invitedByName: 'Admin User'
    });

    expect(html).toContain('#059669'); // Agent green
  });
});
```

---

### 2. API Endpoint Tests

#### Test: POST /api/admin/users/invite

**Test Case 1: Valid invitation**
```typescript
describe('POST /api/admin/users/invite', () => {
  test('should create invitation with valid data', async () => {
    const response = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newagent@company.com',
        fullName: 'New Agent',
        role: 'AGENT',
        branch: 'Harare'
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.email).toBe('newagent@company.com');
    expect(data.data.role).toBe('AGENT');
    expect(data.data.status).toBe('PENDING');
    expect(data.data.expiresAt).toBeDefined();
  });
});
```

**Test Case 2: Duplicate email**
```typescript
test('should reject duplicate email', async () => {
  // First invitation
  await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'duplicate@company.com',
      role: 'AGENT',
      branch: 'Harare'
    })
  });

  // Second invitation (should fail)
  const response = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'duplicate@company.com',
      role: 'AGENT',
      branch: 'Harare'
    })
  });

  expect(response.status).toBe(409);
  const data = await response.json();
  expect(data.error).toContain('already exists');
});
```

**Test Case 3: Missing required fields**
```typescript
test('should reject missing fields', async () => {
  const response = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@company.com'
      // missing role, branch
    })
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('required fields');
});
```

**Test Case 4: Unauthorized access**
```typescript
test('should reject non-admin users', async () => {
  // Simulate non-admin user
  const response = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({
      email: 'test@company.com',
      role: 'AGENT',
      branch: 'Harare'
    })
  });

  expect(response.status).toBe(401);
  const data = await response.json();
  expect(data.error).toContain('Unauthorized');
});
```

#### Test: POST /api/auth/accept-invitation

**Test Case 1: Valid acceptance**
```typescript
describe('POST /api/auth/accept-invitation', () => {
  test('should accept invitation and create user', async () => {
    // Create invitation
    const inviteRes = await fetch('/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@company.com',
        fullName: 'New User',
        role: 'AGENT',
        branch: 'Harare'
      })
    });
    const inviteData = await inviteRes.json();
    const token = inviteData.data.token; // Get from response

    // Accept invitation
    const acceptRes = await fetch('/api/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({
        token,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!'
      })
    });

    expect(acceptRes.status).toBe(201);
    const userData = await acceptRes.json();
    expect(userData.user.email).toBe('newuser@company.com');
    expect(userData.user.role).toBe('AGENT');
  });
});
```

**Test Case 2: Invalid token**
```typescript
test('should reject invalid token', async () => {
  const response = await fetch('/api/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({
      token: 'invalid_token_xyz',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    })
  });

  expect(response.status).toBe(404);
  const data = await response.json();
  expect(data.error).toContain('Invalid invitation token');
});
```

**Test Case 3: Expired token**
```typescript
test('should reject expired token', async () => {
  // Create invitation but manipulate expiry in database
  // Set expiresAt to past date
  
  const response = await fetch('/api/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({
      token: 'expired_token',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    })
  });

  expect(response.status).toBe(410); // Gone
  const data = await response.json();
  expect(data.error).toContain('expired');
});
```

**Test Case 4: Password validation**
```typescript
test('should reject weak passwords', async () => {
  // Get valid token first...
  
  const response = await fetch('/api/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({
      token: validToken,
      password: 'short',  // Too short
      confirmPassword: 'short'
    })
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('at least 8 characters');
});
```

**Test Case 5: Password mismatch**
```typescript
test('should reject mismatched passwords', async () => {
  const response = await fetch('/api/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({
      token: validToken,
      password: 'ValidPassword123!',
      confirmPassword: 'DifferentPassword123!'
    })
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('do not match');
});
```

#### Test: POST /api/admin/users/[id]/revoke

**Test Case 1: Valid revocation**
```typescript
describe('POST /api/admin/users/[id]/revoke', () => {
  test('should revoke user access', async () => {
    // Create user first...
    const userId = 'user123';

    const response = await fetch(`/api/admin/users/${userId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Employee departed'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.isActive).toBe(false);
    expect(data.user.accessRevokedAt).toBeDefined();
  });
});
```

**Test Case 2: Self-revocation prevention**
```typescript
test('should prevent user from revoking self', async () => {
  const response = await fetch(`/api/admin/users/current-user-id/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Self revoke' })
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('cannot revoke your own access');
});
```

#### Test: DELETE /api/admin/users/[id]/revoke

**Test Case 1: Valid deletion**
```typescript
describe('DELETE /api/admin/users/[id]/revoke', () => {
  test('should delete user permanently', async () => {
    const userId = 'user123';

    const response = await fetch(`/api/admin/users/${userId}/revoke`, {
      method: 'DELETE',
      body: JSON.stringify({ userId })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify user deleted
    const checkRes = await fetch(`/api/admin/users?search=${userId}`);
    const checkData = await checkRes.json();
    expect(checkData.users.find((u: any) => u.id === userId)).toBeUndefined();
  });
});
```

---

## Integration Tests

### Test: Complete Invitation Flow

```typescript
describe('Complete Invitation Workflow', () => {
  test('should complete full lifecycle', async () => {
    const email = `test_${Date.now()}@company.com`;

    // Step 1: Send invitation
    const inviteRes = await fetch('/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify({
        email,
        fullName: 'Test User',
        role: 'AGENT',
        branch: 'Harare'
      })
    });
    expect(inviteRes.status).toBe(201);
    const inviteData = await inviteRes.json();
    const token = inviteData.data.token;

    // Step 2: Validate invitation before acceptance
    const validateRes = await fetch(`/api/auth/accept-invitation?token=${token}`);
    expect(validateRes.status).toBe(200);
    const validateData = await validateRes.json();
    expect(validateData.invitation.status).toBe('PENDING');
    expect(validateData.invitation.isExpired).toBe(false);

    // Step 3: Accept invitation
    const acceptRes = await fetch('/api/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({
        token,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      })
    });
    expect(acceptRes.status).toBe(201);
    const userData = await acceptRes.json();
    const userId = userData.user.id;

    // Step 4: Verify user in database
    const listRes = await fetch('/api/admin/users');
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const createdUser = listData.users.find((u: any) => u.email === email);
    expect(createdUser).toBeDefined();
    expect(createdUser.isActive).toBe(true);

    // Step 5: Revoke access
    const revokeRes = await fetch(`/api/admin/users/${userId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test revocation' })
    });
    expect(revokeRes.status).toBe(200);

    // Step 6: Verify user marked inactive
    const checkRes = await fetch(`/api/admin/users/${userId}/revoke?userId=${userId}`);
    const checkData = await checkRes.json();
    expect(checkData.user.isActive).toBe(false);

    // Step 7: Delete user
    const deleteRes = await fetch(`/api/admin/users/${userId}/revoke`, {
      method: 'DELETE',
      body: JSON.stringify({ userId })
    });
    expect(deleteRes.status).toBe(200);

    // Step 8: Verify deletion
    const finalCheckRes = await fetch('/api/admin/users');
    const finalData = await finalCheckRes.json();
    expect(finalData.users.find((u: any) => u.email === email)).toBeUndefined();
  });
});
```

---

## UI Component Tests

### Test: UserManagement Component

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserManagement } from '@/components/UserManagement';

describe('UserManagement Component', () => {
  test('should render tabs', () => {
    render(<UserManagement />);
    
    expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
  });

  test('should render invitation form when button clicked', async () => {
    render(<UserManagement />);
    
    const sendButton = screen.getByText('Send Invitation');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    });
  });

  test('should validate email input', async () => {
    render(<UserManagement />);
    
    const sendButton = screen.getByText('Send Invitation');
    fireEvent.click(sendButton);

    const submitButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/all fields are required/i)).toBeInTheDocument();
    });
  });

  test('should submit invitation form', async () => {
    render(<UserManagement />);
    
    const sendButton = screen.getByText('Send Invitation');
    fireEvent.click(sendButton);

    const emailInput = screen.getByPlaceholderText('user@example.com');
    const roleSelect = screen.getByDisplayValue('AGENT');
    const submitButton = screen.getByRole('button', { name: /send invitation/i });

    await userEvent.type(emailInput, 'test@company.com');
    fireEvent.change(roleSelect, { target: { value: 'MANAGER' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument();
    });
  });

  test('should load and display invitations', async () => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          invitations: [
            {
              id: '1',
              email: 'pending@company.com',
              role: 'AGENT',
              status: 'PENDING',
              expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString()
            }
          ]
        })
      })
    );

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('pending@company.com')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  test('should show revoke confirmation dialog', async () => {
    // Mock fetch for users
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          users: [
            {
              id: 'user1',
              email: 'active@company.com',
              name: 'Active User',
              role: 'AGENT',
              isActive: true
            }
          ]
        })
      })
    );

    render(<UserManagement />);

    // Switch to Users tab
    const usersTab = screen.getByText('Active Users');
    fireEvent.click(usersTab);

    await waitFor(() => {
      expect(screen.getByText('active@company.com')).toBeInTheDocument();
    });

    // Click revoke button
    const lockButton = screen.getByRole('button', { name: /lock/i });
    fireEvent.click(lockButton);

    await waitFor(() => {
      expect(screen.getByText(/revoke user access/i)).toBeInTheDocument();
    });
  });
});
```

---

## Performance Tests

### Email Sending Performance

```typescript
describe('Email Sending Performance', () => {
  test('should send 100 invitations in < 10 seconds', async () => {
    const startTime = Date.now();

    const promises = Array.from({ length: 100 }).map((_, i) =>
      fetch('/api/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: `perf_test_${i}@company.com`,
          role: 'AGENT',
          branch: 'Harare'
        })
      })
    );

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    expect(duration).toBeLessThan(10);
    expect(results.every(r => r.status === 201)).toBe(true);
  });
});
```

### Database Query Performance

```typescript
describe('Database Performance', () => {
  test('should list 1000 users in < 1 second', async () => {
    const startTime = Date.now();

    const response = await fetch('/api/admin/users?limit=1000');
    const data = await response.json();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    expect(duration).toBeLessThan(1);
    expect(data.users.length).toBeLessThanOrEqual(1000);
  });
});
```

---

## Audit Trail Tests

### Verify Audit Logging

```typescript
describe('Audit Trail Logging', () => {
  test('should log USER_INVITED action', async () => {
    await fetch('/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify({
        email: 'audit_test@company.com',
        role: 'AGENT',
        branch: 'Harare'
      })
    });

    // Check audit trail
    const auditRes = await fetch('/api/admin/audit-trail?action=USER_INVITED');
    const auditData = await auditRes.json();

    const latestEntry = auditData.entries[0];
    expect(latestEntry.action).toBe('USER_INVITED');
    expect(latestEntry.details.email).toBe('audit_test@company.com');
  });

  test('should log USER_ACCESS_REVOKED action', async () => {
    const userId = 'test_user_123';

    await fetch(`/api/admin/users/${userId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test' })
    });

    const auditRes = await fetch('/api/admin/audit-trail?action=USER_ACCESS_REVOKED');
    const auditData = await auditRes.json();

    expect(auditData.entries[0].action).toBe('USER_ACCESS_REVOKED');
    expect(auditData.entries[0].resourceId).toBe(userId);
  });
});
```

---

## Manual Testing Checklist

### Invitation Flow
- [ ] Admin can send invitation to new email
- [ ] Email arrives in inbox (or Resend dashboard in dev)
- [ ] Email contains correct role color
- [ ] Email contains correct invitation link
- [ ] Email contains 30-day expiration notice
- [ ] User can click link and accept invitation
- [ ] User creates account with password
- [ ] User can login after acceptance
- [ ] Duplicate email prevention works
- [ ] Audit trail captures invitation sent

### Access Management
- [ ] Admin can see list of users
- [ ] Admin can filter users by branch
- [ ] Admin can revoke user access
- [ ] Revoked user cannot login
- [ ] Admin can see revoked users
- [ ] Admin can delete user permanently
- [ ] Deleted user removed from all views
- [ ] Audit trail captures revocation
- [ ] Audit trail captures deletion

### UI/UX
- [ ] Component loads without errors
- [ ] Tabs switch smoothly
- [ ] Branch filter updates list
- [ ] Form validation shows errors
- [ ] Success messages display
- [ ] Loading states show spinners
- [ ] Dialog closes after successful action
- [ ] Table pagination works

---

**Status**: Testing Framework Ready
**Last Updated**: 2024
**Next Step**: Execute test cases before production release
