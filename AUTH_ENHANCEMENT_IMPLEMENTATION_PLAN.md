# AUTH ENHANCEMENT IMPLEMENTATION PLAN

## Project Overview

This implementation plan covers four security enhancements to the existing NextAuth.js authentication system:

1. **Multi-Factor Authentication (MFA)** - Add TOTP-based 2FA
2. **Password Breach Detection** - Check passwords against known breaches
3. **Device Tracking** - Enhanced session security with device fingerprinting
4. **Authentication Documentation** - Comprehensive auth system documentation

---

## ENHANCEMENT 1: Multi-Factor Authentication (MFA)

### Overview
Add TOTP (Time-based One-Time Password) authentication using authenticator apps (Google Authenticator, Authy, etc.)

### Implementation Steps

#### Phase 1: Database Schema Changes
```prisma
// Add to User model in prisma/schema.prisma
model User {
  // ... existing fields
  mfaEnabled        Boolean   @default(false)
  mfaSecret         String?   @map("mfa_secret")  // Encrypted TOTP secret
  mfaBackupCodes    String[]  @map("mfa_backup_codes")  // One-time backup codes
  mfaVerifiedAt     DateTime? @map("mfa_verified_at")
  
  @@map("users")
}
```

#### Phase 2: Install Dependencies
```bash
npm install otplib qrcode
npm install --save-dev @types/qrcode
```

#### Phase 3: Create MFA Service
**File:** `lib/auth/mfa.ts`
```typescript
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY!;

// Encrypt secret for storage
export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt secret
export function decryptSecret(encryptedSecret: string): string {
  const [ivHex, encrypted] = encryptedSecret.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Generate TOTP secret for user
export function generateMfaSecret(userEmail: string): { secret: string; qrCode: string } {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(userEmail, 'Fine & Country ERP', secret);
  const qrCode = await QRCode.toDataURL(otpauth);
  return { secret, qrCode };
}

// Verify TOTP token
export function verifyTotpToken(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}

// Generate backup codes
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}
```

#### Phase 4: Create MFA API Routes

**File:** `app/api/auth/mfa/setup/route.ts`
```typescript
// POST /api/auth/mfa/setup
// Initiates MFA setup, returns QR code for user to scan
```

**File:** `app/api/auth/mfa/verify/route.ts`
```typescript
// POST /api/auth/mfa/verify
// Verifies TOTP token and enables MFA
```

**File:** `app/api/auth/mfa/disable/route.ts`
```typescript
// POST /api/auth/mfa/disable
// Disables MFA for user (requires password)
```

**File:** `app/api/auth/mfa/backup/route.ts`
```typescript
// POST /api/auth/mfa/backup
// Use backup code as alternative to TOTP
```

#### Phase 5: Update Auth Options
**File:** `lib/authOptions.ts` - Add to callbacks:
```typescript
async signIn({ user, account, credentials }) {
  // Check if MFA is enabled for user
  if (credentials?.mfaToken) {
    // MFA verification step - don't create session yet
    return { requiresMfa: true, userId: user.id };
  }
  // ... normal login
}
```

#### Phase 6: Frontend Components

**File:** `components/auth/MfaSetup.tsx`
```typescript
// QR code display and manual entry for MFA setup
```

**File:** `components/auth/MfaVerify.tsx`
```typescript
// TOTP input component for login
```

#### Phase 7: Login Flow Update
1. User enters email/password
2. If MFA enabled, prompt for TOTP token
3. Verify token before creating session
4. Offer "Use backup code" option

### Effort: **HIGH** | Timeline: 1-2 weeks | Risk: Medium

---

## ENHANCEMENT 2: Password Breach Detection

### Overview
Check passwords against the Have I Been Pwned API (HIBP) to prevent use of compromised passwords.

### Implementation Steps

#### Phase 1: Create Breach Detection Service

**File:** `lib/auth/breach-detection.ts`
```typescript
// Using Have I Been Pwned k-Anonymity API
// Only sends first 5 chars of SHA-1 hash

async function sha1Hash(password: string): Promise<string> {
  const buffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function checkPasswordBreach(password: string): Promise<{
  isBreached: boolean;
  breachCount: number;
}> {
  const hash = await sha1Hash(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  
  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    { headers: { 'Add-Padding': 'true' } }
  );
  
  const text = await response.text();
  const lines = text.split('\n');
  
  for (const line of lines) {
    const [hashSuffix, count] = line.split(':');
    if (hashSuffix.trim() === suffix) {
      return {
        isBreached: true,
        breachCount: parseInt(count.trim(), 10)
      };
    }
  }
  
  return { isBreached: false, breachCount: 0 };
}
```

#### Phase 2: Update Password Validation

**File:** `lib/authOptions.ts` - Update authorize function:
```typescript
// In authorize(), after password complexity check:
const breachCheck = await checkPasswordBreach(credentials.password);
if (breachCheck.isBreached) {
  console.log("[NEXTAUTH] Password breached in:", breachCheck.breachCount, "breaches");
  // Option 1: Block completely
  return null; 
  
  // Option 2: Allow but warn (recommended)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branch: user.branch || undefined,
    passwordBreached: true, // Force password change
  };
}
```

#### Phase 3: Password Change Validation

**File:** `app/api/auth/change-password/route.ts`
```typescript
// Check new password against breach API before allowing change
// Also check against previous password history
```

#### Phase 4: Admin Dashboard

**File:** `components/admin/SecurityAudit.tsx`
```typescript
// Show users with breached passwords
// Allow admin to force password reset
```

### Effort: **MEDIUM** | Timeline: 3-5 days | Risk: Low

---

## ENHANCEMENT 3: Device Tracking & Session Security

### Overview
Enhance session security with device fingerprinting, tracking, and anomaly detection.

### Implementation Steps

#### Phase 1: Database Schema

```prisma
// Add session tracking
model UserSession {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  sessionToken  String   @unique @map("session_token")
  deviceInfo    Json     @map("device_info")  // Browser, OS, device type
  ipAddress     String?  @map("ip_address")
  location      String?  // Approximate location
  userAgent     String?  @map("user_agent")
  fingerprint   String?  // Device fingerprint
  isCurrent     Boolean  @default(false) @map("is_current")
  createdAt     DateTime @default(now()) @map("created_at")
  expiresAt     DateTime @map("expires_at")
  lastActiveAt DateTime @default(now()) @map("last_active_at")
  
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("user_sessions")
}

// Add to User model
model User {
  // ... existing
  lastDeviceId  String?  @map("last_device_id")
  lastLoginAt   DateTime? @map("last_login_at")
  lastIpAddress String?  @map("last_ip_address")
  
  @@map("users")
}
```

#### Phase 2: Device Fingerprinting Utility

**File:** `lib/auth/device-fingerprint.ts`
```typescript
export interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceVendor?: string;
  deviceModel?: string;
}

export async function getDeviceInfo(userAgent: string): Promise<DeviceInfo> {
  // Use user-agent parsing library
  // Could use: ua-parser-js
  // Return structured device info
}

export function generateFingerprint(
  userAgent: string,
  ipAddress: string,
  acceptLanguage: string
): string {
  const data = `${userAgent}|${ipAddress}|${acceptLanguage}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

#### Phase 3: Create Session Management API

**File:** `lib/auth/session-manager.ts`
```typescript
export async function createUserSession(
  userId: string,
  token: string,
  deviceInfo: DeviceInfo,
  ipAddress: string
): Promise<UserSession> {
  // Create session record
  // Set all other sessions for user to not current
}

export async function getUserSessions(userId: string): Promise<UserSession[]> {
  // Return all active sessions for user
}

export async function revokeSession(sessionId: string): Promise<void> {
  // Revoke specific session
}

export async function revokeAllSessions(userId: string): Promise<void> {
  // Revoke all sessions except current
}
```

#### Phase 4: Update Auth Callbacks

**File:** `lib/authOptions.ts` - Update session callback:
```typescript
async session({ session, token, user }) {
  // Add device tracking to session
  session.user.lastLoginAt = token.lastLoginAt;
  session.user.deviceFingerprint = token.deviceFingerprint;
  session.user.isNewDevice = token.isNewDevice;
  
  return session;
}

async jwt({ token, user, account }) {
  // Track device on login
  token.lastLoginAt = user.lastLoginAt;
  token.deviceFingerprint = user.deviceFingerprint;
  token.isNewDevice = user.isNewDevice;
  
  return token;
}
```

#### Phase 5: Frontend Session Management

**File:** `components/auth/SessionManager.tsx`
```typescript
// Show active sessions
// Allow user to revoke sessions
// Show "Logged in from X device" notifications
```

**File:** `components/auth/DeviceHistory.tsx`
```typescript
// Show login history by device
// Show location information
```

#### Phase 6: Security Notifications

**File:** `lib/auth/security-alerts.ts`
```typescript
export async function sendSecurityAlert(
  userId: string,
  alertType: 'new_device' | 'new_location' | 'password_change',
  details: { ip: string; device: string; location?: string }
): Promise<void> {
  // Send email notification
  // Could also integrate with notification system
}
```

### Effort: **HIGH** | Timeline: 1-2 weeks | Risk: Medium

---

## ENHANCEMENT 4: Authentication Documentation

### Overview
Create comprehensive documentation of the current robust authentication system.

### Implementation Steps

#### Phase 1: Technical Documentation

**File:** `docs/AUTHENTICATION_SYSTEM.md`
```markdown
# Fine & Country ERP Authentication System

## Overview
- NextAuth.js v4 with custom configuration
- JWT-based sessions
- Multi-role access control
- Branch-based multi-tenancy

## Authentication Flow
1. User submits credentials
2. Validate email exists
3. Verify password (bcrypt)
4. Check password complexity
5. Check password expiration
6. Check account status (isActive)
7. Generate JWT with role/branch
8. Create session
9. Log to audit trail

## Security Features
- Password hashing: bcrypt with 12 rounds
- Password requirements: 8+ chars, uppercase, lowercase, number
- Password expiration: 90 days
- Session duration: 24 hours
- Session update: Every hour
- Role refresh: On every request from DB
- Branch access: Token includes branch

## User Roles
- ADMIN: Full system access
- MANAGER: Branch management
- AGENT: Sales management
- ACCOUNT: Financial operations
- CLIENT: Customer portal

## API Protection
- Middleware checks: getServerSession
- Role validation per route
- Branch isolation

## Audit Logging
- Login events
- Logout events
- Failed attempts
- Role changes
```

#### Phase 2: API Documentation

**File:** `docs/API_AUTH_ENDPOINTS.md`
```markdown
# Authentication API Endpoints

## POST /api/auth/signin
## POST /api/auth/signout
## GET /api/auth/session
## POST /api/auth/change-password
## POST /api/auth/forgot-password
## POST /api/auth/reset-password
## POST /api/auth/request-access
## GET /api/auth/me
```

#### Phase 3: Security Architecture

**File:** `docs/SECURITY_ARCHITECTURE.md`
```markdown
# Security Architecture

## Authentication
- Provider: NextAuth.js
- Credentials + Google OAuth
- JWT strategy

## Authorization
- Role-based (RBAC)
- Branch-based isolation
- API route protection

## Data Protection
- Password: bcrypt hashed
- Sessions: JWT with expiry
- Database: Neon with SSL

## Monitoring
- Sentry error tracking
- Audit logs
- Failed attempt logging
```

#### Phase 4: Deployment Guide

**File:** `docs/AUTH_DEPLOYMENT.md`
```markdown
# Authentication Deployment Guide

## Environment Variables
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

## Database Migrations
Required schema changes for MFA, sessions, device tracking

## Testing
- Login flows
- Role permissions
- Session expiry
- Password requirements
```

### Effort: **LOW** | Timeline: 2-3 days | Risk: None

---

## IMPLEMENTATION TIMELINE

| Enhancement | Effort | Timeline | Dependencies |
|-------------|--------|----------|--------------|
| Password Breach Detection | Medium | 3-5 days | None |
| Authentication Documentation | Low | 2-3 days | None |
| MFA (TOTP) | High | 1-2 weeks | Breach detection |
| Device Tracking | High | 1-2 weeks | None |

### Recommended Order:
1. **Week 1**: Password Breach Detection
2. **Week 2**: Authentication Documentation  
3. **Week 3-4**: MFA Implementation
4. **Week 5-6**: Device Tracking

---

## RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| HIBP API rate limits | Cache results, batch checks |
| MFA user experience | Clear setup wizard, backup codes |
| Session performance | Index sessions by userId |
| Documentation drift | Automated tests document auth behavior |

---

## TESTING PLAN

### Authentication Tests:
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Password complexity validation
- ✅ Password expiration enforcement
- ✅ Role-based access
- ✅ Branch isolation

### MFA Tests:
- ✅ TOTP setup flow
- ✅ TOTP verification
- ✅ Backup code usage
- ✅ MFA disable flow

### Breach Detection Tests:
- ✅ Known breached password rejected
- ✅ New password accepted
- ✅ Breach count displayed to admin

### Device Tracking Tests:
- ✅ New device detection
- ✅ Session listing
- ✅ Session revocation
- ✅ Security alerts

---

*Implementation Plan created: 2026-02-16*
