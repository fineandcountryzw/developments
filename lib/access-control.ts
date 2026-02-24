/**
 * Unified Access Control Service
 * 
 * SINGLE SOURCE OF TRUTH for authentication and authorization.
 * Features:
 * - Session caching (5 min TTL)
 * - Permission caching (10 min TTL)
 * - Fine-grained permissions via AccessControl model
 * - Consistent error responses
 * - Rate limiting integration
 * 
 * @module lib/access-control
 */

import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/authOptions';
import { checkRateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string | null;
}

export interface AuthResult {
  user: AuthUser;
  error?: never;
}

export interface AuthError {
  error: NextResponse;
  user?: never;
}

export type AuthResponse = AuthResult | AuthError;

export type PermissionAction = 'READ' | 'WRITE' | 'DELETE' | 'EXECUTE';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CACHE
// ─────────────────────────────────────────────────────────────────────────────

interface CachedSession {
  user: AuthUser;
  expiresAt: number;
}

class SessionCache {
  private cache = new Map<string, CachedSession>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get size(): number {
    return this.cache.size;
  }

  get(userId: string): AuthUser | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    return cached.user;
  }

  set(userId: string, user: AuthUser): void {
    this.cache.set(userId, {
      user,
      expiresAt: Date.now() + this.TTL,
    });
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

const sessionCache = new SessionCache();

// Cleanup expired sessions every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => sessionCache.cleanup(), 60000);
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION CACHE
// ─────────────────────────────────────────────────────────────────────────────

interface CachedPermission {
  allowed: boolean;
  expiresAt: number;
}

class PermissionCache {
  private cache = new Map<string, CachedPermission>();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  get size(): number {
    return this.cache.size;
  }

  getKey(userId: string, resource: string, action: PermissionAction, branch?: string): string {
    return `${userId}:${resource}:${action}:${branch || 'all'}`;
  }

  get(userId: string, resource: string, action: PermissionAction, branch?: string): boolean | null {
    const key = this.getKey(userId, resource, action, branch);
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.allowed;
  }

  set(userId: string, resource: string, action: PermissionAction, allowed: boolean, branch?: string): void {
    const key = this.getKey(userId, resource, action, branch);
    this.cache.set(key, {
      allowed,
      expiresAt: Date.now() + this.TTL,
    });
  }

  invalidate(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const permissionCache = new PermissionCache();

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUTH FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get authenticated user with caching
 * 
 * Caches session for 5 minutes to reduce database lookups.
 * Automatically invalidates on role/permission changes.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return null;
    }

    const userId = session.user.id;
    
    // Check cache first
    const cached = sessionCache.get(userId);
    if (cached) {
      logger.debug('Session cache hit', { module: 'access-control', userId });
      return cached;
    }

    // Build user object
    const user: AuthUser = {
      id: userId,
      email: session.user.email || '',
      name: session.user.name || null,
      role: (session.user.role as string)?.toUpperCase() || 'CLIENT',
      branch: (session.user as any).branch || null,
    };

    // Cache for future requests
    sessionCache.set(userId, user);

    logger.debug('Session cache miss - fetched from session', { module: 'access-control', userId });
    return user;
  } catch (error) {
    logger.error('Session lookup failed', error instanceof Error ? error : undefined, { module: 'access-control' });
    return null;
  }
}

/**
 * Require authentication
 * 
 * Returns user if authenticated, error response if not.
 */
export async function requireAuth(): Promise<AuthResponse> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      error: apiError('Authentication required', 401, 'AUTH_REQUIRED'),
    };
  }

  return { user };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user has specific role
 */
export function hasRole(user: AuthUser | null, role: string): boolean {
  if (!user) return false;
  return user.role.toUpperCase() === role.toUpperCase();
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: AuthUser | null, roles: string[]): boolean {
  if (!user) return false;
  const userRole = user.role.toUpperCase();
  return roles.some(r => r.toUpperCase() === userRole);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'ADMIN');
}

/**
 * Check if user is manager or higher
 */
export function isManager(user: AuthUser | null): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
}

/**
 * Check if user is agent or higher
 */
export function isAgent(user: AuthUser | null): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'AGENT']);
}

/**
 * Check if user is accountant
 */
export function isAccountant(user: AuthUser | null): boolean {
  return hasRole(user, 'ACCOUNT');
}

/**
 * Require specific role(s)
 */
export async function requireRole(allowedRoles: string[]): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  if (!hasAnyRole(authResult.user, allowedRoles)) {
    return {
      error: apiError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        403,
        'FORBIDDEN'
      ),
    };
  }

  return authResult;
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request?: NextRequest,
  rateLimit?: { limit?: number; windowMs?: number }
): Promise<AuthResponse> {
  // Rate limiting (if request provided)
  if (request && rateLimit) {
    const identifier = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
    const limit = rateLimit.limit || 20;
    const windowMs = rateLimit.windowMs || 60000;
    
    if (!checkRateLimit(identifier, limit, windowMs)) {
      return {
        error: apiError('Too many requests. Please try again later.', 429, 'RATE_LIMIT'),
      };
    }
  }

  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  if (!isAdmin(authResult.user)) {
    return {
      error: apiError('Admin access required', 403, 'ADMIN_REQUIRED'),
    };
  }

  return authResult;
}

/**
 * Require manager or higher role
 */
export async function requireManager(): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  if (!isManager(authResult.user)) {
    return {
      error: apiError('Manager access required', 403, 'MANAGER_REQUIRED'),
    };
  }

  return authResult;
}

/**
 * Require agent or higher role
 */
export async function requireAgent(): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  if (!isAgent(authResult.user)) {
    return {
      error: apiError('Agent access required', 403, 'AGENT_REQUIRED'),
    };
  }

  return authResult;
}

/**
 * Require accountant or higher role
 */
export async function requireAccountant(): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  const user = authResult.user;
  if (!isAccountant(user) && !isManager(user)) {
    return {
      error: apiError('Accountant access required', 403, 'ACCOUNTANT_REQUIRED'),
    };
  }

  return authResult;
}

/**
 * Require admin OR accountant role
 * Used for payment recording operations that both roles can perform
 */
export async function requireAdminOrAccountant(
  request?: NextRequest,
  rateLimit?: { limit?: number; windowMs?: number }
): Promise<AuthResponse> {
  // Rate limiting (if request provided)
  if (request && rateLimit) {
    const identifier = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
    const limit = rateLimit.limit || 20;
    const windowMs = rateLimit.windowMs || 60000;
    
    if (!checkRateLimit(identifier, limit, windowMs)) {
      return {
        error: apiError('Too many requests. Please try again later.', 429, 'RATE_LIMIT'),
      };
    }
  }

  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  const user = authResult.user;
  if (!isAdmin(user) && !isAccountant(user)) {
    return {
      error: apiError('Admin or Accountant access required', 403, 'ADMIN_OR_ACCOUNTANT_REQUIRED'),
    };
  }

  return authResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINE-GRAINED PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user has permission for resource/action
 * 
 * Checks:
 * 1. Role-based permissions (admin has all permissions)
 * 2. AccessControl table (fine-grained permissions)
 * 3. Branch isolation (if branch specified)
 */
export async function hasPermission(
  user: AuthUser,
  resource: string,
  action: PermissionAction,
  branch?: string
): Promise<boolean> {
  // Admins have all permissions
  if (isAdmin(user)) {
    return true;
  }

  // Check cache first
  const cached = permissionCache.get(user.id, resource, action, branch || user.branch || undefined);
  if (cached !== null) {
    // Record cache hit
    const { accessControlMetrics } = await import('./access-control-metrics');
    accessControlMetrics.recordPermissionCacheHit();
    logger.debug('Permission cache hit', { module: 'access-control', userId: user.id, resource, action });
    return cached;
  }
  
  // Record cache miss
  const { accessControlMetrics } = await import('./access-control-metrics');
  accessControlMetrics.recordPermissionCacheMiss();

  // Check AccessControl table
  try {
    const accessControl = await prisma.accessControl.findFirst({
      where: {
        userId: user.id,
        resource,
        action,
        branch: branch || user.branch || 'Harare',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    const allowed = !!accessControl;

    // Cache result
    permissionCache.set(user.id, resource, action, allowed, branch || user.branch || undefined);

    logger.debug('Permission check', { 
      module: 'access-control', 
      userId: user.id, 
      resource, 
      action, 
      allowed 
    });

    return allowed;
  } catch (error) {
    logger.error('Permission check failed', error instanceof Error ? error : undefined, { module: 'access-control' });
    return false;
  }
}

/**
 * Require permission for resource/action
 */
export async function requirePermission(
  resource: string,
  action: PermissionAction,
  branch?: string
): Promise<AuthResponse> {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;

  const hasAccess = await hasPermission(authResult.user, resource, action, branch);
  if (!hasAccess) {
    return {
      error: apiError(
        `Access denied. Required permission: ${action} on ${resource}`,
        403,
        'PERMISSION_DENIED'
      ),
    };
  }

  return authResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate user session cache
 * 
 * Call this when user role/permissions change.
 */
export function invalidateUserCache(userId: string): void {
  sessionCache.invalidate(userId);
  permissionCache.invalidate(userId);
  logger.debug('User cache invalidated', { module: 'access-control', userId });
}

/**
 * Clear all caches
 */
export function clearCaches(): void {
  sessionCache.clear();
  permissionCache.clear();
  logger.debug('All caches cleared', { module: 'access-control' });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Re-export for backward compatibility
export { getAuthenticatedUser as getCurrentUser };
