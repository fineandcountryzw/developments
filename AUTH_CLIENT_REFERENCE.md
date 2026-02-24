# Neon Auth Client Reference

**Single Source of Truth for Authentication in Fine & Country Zimbabwe ERP**

---

## Quick Start

```typescript
import { authClient, getCurrentUser, requireAuth, requireRole } from '@/lib/auth';

// Check if user is authenticated
const user = await getCurrentUser();
if (user) {
  console.log('Authenticated:', user.email, user.role);
}

// Protect API routes
const user = await requireAuth(); // Throws if not authenticated

// Enforce role-based access
const admin = await requireRole(['ADMIN']); // Throws if not ADMIN
```

---

## Architecture

| Component | Value |
|-----------|-------|
| **Provider** | Neon Auth (@neondatabase/auth) |
| **Adapter** | BetterAuthVanillaAdapter (default) |
| **Auth URL** | `https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth` |
| **JWKS URL** | `https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks` |
| **Session Type** | JWT with automatic refresh |
| **Session Storage** | Neon PostgreSQL (forensic audit trail) |
| **Cache TTL** | 60 seconds |

---

## API Reference

### Core Client

#### `authClient`

The base Neon Auth client. Use for direct API access.

```typescript
import { authClient } from '@/lib/auth';

// Sign in with email (magic link)
await authClient.signIn.email({
  email: 'user@example.com',
  callbackURL: '/dashboard',
});

// Sign up new user
await authClient.signUp.email({
  email: 'newuser@example.com',
  password: 'secure-password',
  name: 'John Doe',
});

// Get raw session response
const response = await authClient.getSession();
console.log(response.data?.user);
console.log(response.data?.session);

// Sign out
await authClient.signOut();
```

---

### Helper Functions

#### `getCurrentUser()`

Returns the authenticated user or `null`.

```typescript
const user = await getCurrentUser();

if (user) {
  console.log(user.id);          // string
  console.log(user.email);       // string
  console.log(user.role);        // 'ADMIN' | 'AGENT' | 'CLIENT'
  console.log(user.name);        // string
  console.log(user.emailVerified); // boolean
}
```

**Returns:** `User | null`

**Forensic Log:** `[AUTH][SESSION_VERIFIED]`

---

#### `getUserRole()`

Extracts the role from the current session.

```typescript
const role = await getUserRole();
// Returns: 'ADMIN' | 'AGENT' | 'CLIENT' | null
```

**Use Case:** Conditional rendering based on role

```typescript
const role = await getUserRole();

if (role === 'ADMIN') {
  // Show admin dashboard
} else if (role === 'AGENT') {
  // Show agent pipeline
} else if (role === 'CLIENT') {
  // Show client portfolio
}
```

---

#### `isAuthenticated()`

Quick boolean check for authentication status.

```typescript
const isAuth = await isAuthenticated();
// Returns: boolean

if (!isAuth) {
  // Redirect to login
  router.push('/auth/signin');
}
```

**Use Case:** Protected route guards

---

#### `requireAuth()`

Throws an error if user is not authenticated. Use in API routes and server actions.

```typescript
export async function POST(request: Request) {
  const user = await requireAuth(); // Throws if not authenticated
  
  // Proceed with authenticated logic
  const data = await request.json();
  // ...
}
```

**Returns:** `User` (never null)

**Throws:** `Error('Authentication required')` if not authenticated

**Forensic Log:** `[AUTH][UNAUTHORIZED_ACCESS]`

---

#### `requireRole(allowedRoles: string[])`

Throws an error if user doesn't have the required role.

```typescript
export async function DELETE(request: Request) {
  const admin = await requireRole(['ADMIN']); // Only ADMIN can delete
  
  // Proceed with admin operation
  // ...
}

// Multiple roles
const user = await requireRole(['ADMIN', 'AGENT']); // ADMIN or AGENT
```

**Returns:** `User` (with verified role)

**Throws:** `Error('Access denied. Required roles: ...')` if role check fails

**Forensic Log:** `[AUTH][FORBIDDEN_ACCESS]`

---

#### `authorizeReservation(standId: string)`

Validates that the user can create a reservation. Enforces 72-hour business rules.

```typescript
export async function reserveStand(standId: string) {
  const user = await authorizeReservation(standId);
  
  // Create reservation
  await prisma.reservation.create({
    data: {
      clientId: user.id,
      standId,
      // ...
    },
  });
}
```

**Returns:** `User` (with authorization)

**Forensic Log:** `[AUTH][RESERVATION_AUTHORIZED]`

---

#### `signOut()`

Terminates the current session and clears all tokens.

```typescript
await signOut();
// User is now logged out, all tokens cleared
```

**Forensic Log:** `[AUTH][SIGNOUT_SUCCESS]`

---

## Usage Examples

### Protected API Route

```typescript
// app/api/reservations/route.ts
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await requireAuth();
  
  const { standId, agentId } = await request.json();
  
  // Create reservation for authenticated user
  const reservation = await prisma.reservation.create({
    data: {
      clientId: user.id,
      standId,
      agentId: agentId || null,
      isCompanyLead: !agentId,
      termsAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  
  return Response.json(reservation);
}
```

---

### Role-Based Dashboard

```typescript
// components/Dashboard.tsx
import { getCurrentUser } from '@/lib/auth';

export default async function Dashboard() {
  const user = await getCurrentUser();
  
  if (!user) {
    return <LoginPrompt />;
  }
  
  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard user={user} />;
    case 'AGENT':
      return <AgentDashboard user={user} />;
    case 'CLIENT':
      return <ClientDashboard user={user} />;
    default:
      return <UnauthorizedView />;
  }
}
```

---

### Admin-Only Action

```typescript
// app/api/admin/delete-user/route.ts
import { requireRole } from '@/lib/auth';

export async function DELETE(request: Request) {
  const admin = await requireRole(['ADMIN']);
  
  const { userId } = await request.json();
  
  console.log(`Admin ${admin.id} deleting user ${userId}`);
  
  await prisma.user.delete({ where: { id: userId } });
  
  return Response.json({ success: true });
}
```

---

## Forensic Logging

All authentication events are logged with timestamps for audit compliance:

| Log Prefix | Event | Example |
|------------|-------|---------|
| `[AUTH][SESSION_VERIFIED]` | Successful session validation | User logged in successfully |
| `[AUTH][SESSION_ERROR]` | Session validation failure | Invalid JWT token |
| `[AUTH][UNAUTHORIZED_ACCESS]` | Unauthenticated access attempt | API route called without session |
| `[AUTH][FORBIDDEN_ACCESS]` | Role authorization violation | AGENT tried to access ADMIN route |
| `[AUTH][RESERVATION_AUTHORIZED]` | Stand reservation approval | User authorized to reserve stand |
| `[AUTH][SIGNOUT_SUCCESS]` | User logout | Session terminated |

**Log Format:**

```json
{
  "message": "[AUTH][SESSION_VERIFIED]",
  "user_id": "clx...",
  "email": "user@example.com",
  "timestamp": "2025-12-28T19:45:00.000Z"
}
```

---

## Environment Variables

Required in `.env`:

```bash
# Neon Auth Configuration
NEXT_PUBLIC_NEON_AUTH_URL="https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth"
NEON_AUTH_JWKS_URL="https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks"

# Database Connection
DATABASE_URL="postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

---

## Migration Notes

### From Auth.js (NextAuth.js)

| Auth.js | Neon Auth |
|---------|-----------|
| `getServerSession(authOptions)` | `await getCurrentUser()` |
| `session.user.id` | `user.id` |
| `session.user.role` | `user.role` |
| `useSession()` hook | `await getCurrentUser()` |
| `signIn('email', { email })` | `await authClient.signIn.email({ email })` |
| `signOut()` | `await signOut()` |

---

## Security Features

✅ **JWT Authentication** - Token-based with automatic refresh  
✅ **JWKS Validation** - Signature verification via JWKS endpoint  
✅ **Session Caching** - 60-second TTL reduces database load  
✅ **Request Deduplication** - Prevents race conditions  
✅ **Cross-Tab Sync** - Session state synchronized across browser tabs  
✅ **Forensic Logging** - All auth events logged with timestamps  
✅ **Role-Based Access Control** - Enforce permissions at function level  
✅ **No Bypass Mechanisms** - Single source of truth for all auth  

---

## Troubleshooting

### "NEXT_PUBLIC_NEON_AUTH_URL is not defined"

**Solution:** Add the environment variable to `.env`:

```bash
NEXT_PUBLIC_NEON_AUTH_URL="https://ep-mute-river-a4uai6d1.neonauth.us-east-1.aws.neon.tech/neondb/auth"
```

### "Authentication required" error

**Cause:** User is not authenticated

**Solution:** Redirect to login page or show sign-in prompt

```typescript
const user = await getCurrentUser();
if (!user) {
  router.push('/auth/signin');
}
```

### "Access denied. Required roles: ADMIN"

**Cause:** User doesn't have the required role

**Solution:** Check user role before calling restricted functions

```typescript
const role = await getUserRole();
if (role !== 'ADMIN') {
  return <UnauthorizedView />;
}
```

---

## Best Practices

1. **Always use helper functions** - Don't call `authClient.getSession()` directly unless you need the full response object

2. **Protect all API routes** - Every API route should start with `await requireAuth()` or `await requireRole([...])`

3. **Use `requireRole` for admin operations** - Don't rely on client-side role checks for security

4. **Log all authorization events** - The client automatically logs events, but add context in your application logic

5. **Handle errors gracefully** - Wrap auth calls in try-catch and show user-friendly error messages

6. **Don't store sensitive data in JWT** - The user object only contains id, email, name, role - don't add secrets

---

## Next Steps

1. ✅ Auth client created in `lib/auth.ts`
2. ⏳ Create sign-in page with Neon Auth UI components
3. ⏳ Protect reservation endpoints with `requireAuth()`
4. ⏳ Add role-based dashboard rendering
5. ⏳ Test authentication flow end-to-end

---

**File Location:** `lib/auth.ts`  
**Documentation:** [Neon Auth Docs](https://neon.tech/docs/auth)  
**Package:** [@neondatabase/auth](https://www.npmjs.com/package/@neondatabase/auth)
