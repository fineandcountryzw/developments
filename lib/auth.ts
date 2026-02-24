/**
 * Authentication Client for Fine & Country Zimbabwe ERP
 * 
 * MIGRATED TO NEXTAUTH.JS - This file now uses NextAuth instead of @neondatabase/auth
 * See lib/authOptions.ts for NextAuth configuration.
 * 
 * Architecture:
 * - Provider: NextAuth.js with Credentials + Google providers
 * - Database: Neon PostgreSQL with Prisma adapter
 * - Session: JWT-based session strategy via getServerSession()
 * - Security: Role-based access control (ADMIN, MANAGER, AGENT, ACCOUNT, CLIENT)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUTH CLIENT - NEXTAUTH IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Legacy export for backwards compatibility. Use getServerSession() directly.
 */
export const authClient = null;

// ─────────────────────────────────────────────────────────────────────────────
// USER SESSION HELPERS - NEXTAUTH IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

// User type matching database schema
type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string | null;
};

/**
 * Get Current Authenticated User
 * 
 * Returns the user object from NextAuth session, or null if not authenticated.
 * Includes forensic logging for security audit trail.
 * 
 * @returns User object with id, email, role, or null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user) {
      const user = session.user as any;
      
      console.log('[AUTH][SESSION_VERIFIED]', {
        user_id: user.id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      });
      
      return {
        id: user.id || '',
        email: user.email || '',
        name: user.name || null,
        role: user.role || 'CLIENT',
        branch: user.branch || null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[AUTH][SESSION_ERROR]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Get User Role
 * 
 * Extracts the role from the current session for authorization checks.
 * 
 * @returns 'ADMIN' | 'MANAGER' | 'AGENT' | 'ACCOUNT' | 'CLIENT' | null
 */
export async function getUserRole(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.role || null;
}

/**
 * Check Authentication Status
 * 
 * Quick boolean check for protected routes and conditional rendering.
 * 
 * @returns true if user is authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Require Authentication
 * 
 * Throws an error if user is not authenticated. Use in API routes
 * and server actions to enforce authentication.
 * 
 * @throws Error if not authenticated
 * @returns User object
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    console.error('[AUTH][UNAUTHORIZED_ACCESS]', {
      timestamp: new Date().toISOString(),
    });
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * Require Specific Role
 * 
 * Throws an error if user doesn't have the required role.
 * Use for role-based access control in protected operations.
 * 
 * @param allowedRoles - Array of roles that can access the resource
 * @throws Error if user is not authenticated or doesn't have required role
 * @returns User object
 */
export async function requireRole(allowedRoles: string[]): Promise<AuthUser> {
  const user = await requireAuth();
  
  // Normalize roles to uppercase for comparison
  const normalizedAllowedRoles = allowedRoles.map(r => r.toUpperCase());
  const userRole = user.role.toUpperCase();
  
  if (!normalizedAllowedRoles.includes(userRole)) {
    console.error('[AUTH][FORBIDDEN_ACCESS]', {
      user_id: user.id,
      user_role: user.role,
      required_roles: allowedRoles,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
  
  return user;
}

/**
 * Authorize Reservation Creation
 * 
 * Validates that the user can create a reservation for a specific stand.
 * Enforces authentication requirement.
 * 
 * @param standId - The stand ID to reserve
 * @returns User object with authorization
 */
export async function authorizeReservation(standId: string): Promise<AuthUser> {
  const user = await requireAuth();
  
  console.log('[AUTH][RESERVATION_AUTHORIZED]', {
    user_id: user.id,
    stand_id: standId,
    timestamp: new Date().toISOString(),
  });
  
  return user;
}

/**
 * Sign Out User
 * 
 * Note: This is a no-op on the server side. Use NextAuth signOut() on the client.
 * Included for API compatibility with legacy code.
 */
export async function signOut(): Promise<void> {
  console.warn('[AUTH] Server-side signOut called. Use NextAuth signOut() on client instead.');
}

export default authClient;
