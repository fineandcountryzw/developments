/**
 * Centralized Role-Based Routing
 * 
 * SINGLE SOURCE OF TRUTH for role-to-dashboard mapping and routing logic.
 * All role-based routing decisions must use this module.
 * 
 * @module lib/role-router
 */

import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// ROLE DEFINITIONS (must match Prisma UserRole enum)
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  AGENT: 'AGENT',
  ACCOUNT: 'ACCOUNT',
  CLIENT: 'CLIENT',
  DEVELOPER: 'DEVELOPER',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ROUTES
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_ROUTES = {
  ADMIN: '/dashboards/admin',
  MANAGER: '/dashboards/manager',
  AGENT: '/dashboards/agent',
  ACCOUNT: '/dashboards/account',
  CLIENT: '/dashboards/client',
  DEVELOPER: '/dashboards/developer',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-TO-DASHBOARD MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps normalized roles to their primary dashboard routes
 */
export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  [ROLES.ADMIN]: DASHBOARD_ROUTES.ADMIN,
  [ROLES.MANAGER]: DASHBOARD_ROUTES.MANAGER,
  [ROLES.AGENT]: DASHBOARD_ROUTES.AGENT,
  [ROLES.ACCOUNT]: DASHBOARD_ROUTES.ACCOUNT,
  [ROLES.CLIENT]: DASHBOARD_ROUTES.CLIENT,
  [ROLES.DEVELOPER]: DASHBOARD_ROUTES.DEVELOPER,
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ALIASES (for backward compatibility with legacy role names)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps legacy/incorrect role names to canonical roles
 */
const ROLE_ALIASES: Record<string, UserRole> = {
  // Account role variations
  'ACCOUNTS': ROLES.ACCOUNT,
  'ACCOUNTANT': ROLES.ACCOUNT,
  'ACCOUNTING': ROLES.ACCOUNT,
  
  // Admin variations
  'ADMINISTRATOR': ROLES.ADMIN,
  'SUPERADMIN': ROLES.ADMIN,
  
  // Manager variations
  'MANAGEMENT': ROLES.MANAGER,
  
  // Developer variations
  'DEV': ROLES.DEVELOPER,
  'DEVELOPMENT': ROLES.DEVELOPER,
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a role string to a canonical UserRole
 * Handles case insensitivity and legacy aliases
 * 
 * @param role - Raw role string (e.g., "accounts", "ACCOUNTANT")
 * @returns Normalized UserRole or null if invalid
 * 
 * @example
 * normalizeRole("accounts") // "ACCOUNT"
 * normalizeRole("ACCOUNTANT") // "ACCOUNT"
 * normalizeRole("ADMIN") // "ADMIN"
 * normalizeRole("invalid") // null
 */
export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  
  const upperRole = role.toString().trim().toUpperCase();
  
  // Check if it's already a valid role
  if (Object.values(ROLES).includes(upperRole as UserRole)) {
    return upperRole as UserRole;
  }
  
  // Check aliases
  if (ROLE_ALIASES[upperRole]) {
    return ROLE_ALIASES[upperRole];
  }
  
  // Check if role contains a valid role as substring (for "ACCOUNT_MANAGER" → "ACCOUNT")
  for (const [alias, canonical] of Object.entries(ROLE_ALIASES)) {
    if (upperRole.includes(alias)) {
      return canonical;
    }
  }
  
  // Check for exact substring match with valid roles
  for (const validRole of Object.values(ROLES)) {
    if (upperRole === validRole || upperRole.includes(validRole)) {
      return validRole;
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ROUTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the dashboard route for a given user role
 * 
 * @param role - User role (raw or normalized)
 * @returns Dashboard route path or null if role is invalid
 * 
 * @example
 * getDashboardRouteForRole("ACCOUNT") // "/dashboards/account"
 * getDashboardRouteForRole("accounts") // "/dashboards/account"
 * getDashboardRouteForRole("invalid") // null
 */
export function getDashboardRouteForRole(role: string | null | undefined): string | null {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  return ROLE_DASHBOARD_MAP[normalizedRole];
}

/**
 * Get the appropriate redirect path for a user based on their role
 * Falls back to login if role is invalid
 * 
 * @param role - User role
 * @returns Path to redirect to
 */
export function getRedirectPathForRole(role: string | null | undefined): string {
  const dashboardRoute = getDashboardRouteForRole(role);
  return dashboardRoute ?? '/login';
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a role is valid
 */
export function isValidRole(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null;
}

/**
 * Check if a user has a specific role (after normalization)
 */
export function hasRole(userRole: string | null | undefined, targetRole: UserRole): boolean {
  const normalized = normalizeRole(userRole);
  return normalized === targetRole;
}

/**
 * Check if a user has any of the specified roles
 */
export function hasAnyRole(userRole: string | null | undefined, targetRoles: UserRole[]): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  return targetRoles.includes(normalized);
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defines which roles can access each dashboard
 */
export const DASHBOARD_ACCESS: Record<string, UserRole[]> = {
  [DASHBOARD_ROUTES.ADMIN]: [ROLES.ADMIN],
  [DASHBOARD_ROUTES.MANAGER]: [ROLES.ADMIN, ROLES.MANAGER],
  [DASHBOARD_ROUTES.AGENT]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
  [DASHBOARD_ROUTES.ACCOUNT]: [ROLES.ADMIN, ROLES.ACCOUNT],
  [DASHBOARD_ROUTES.CLIENT]: [ROLES.ADMIN, ROLES.CLIENT],
  [DASHBOARD_ROUTES.DEVELOPER]: [ROLES.ADMIN, ROLES.DEVELOPER],
};

/**
 * Check if a user can access a specific dashboard
 * 
 * @param userRole - User's role
 * @param dashboardPath - Dashboard path (e.g., "/dashboards/account")
 * @returns true if access is allowed
 */
export function canAccessDashboard(userRole: string | null | undefined, dashboardPath: string): boolean {
  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) return false;
  
  // Normalize dashboard path (remove trailing slash, handle sub-routes)
  const normalizedPath = dashboardPath.toLowerCase().replace(/\/$/, '');
  
  // Find matching dashboard
  for (const [route, allowedRoles] of Object.entries(DASHBOARD_ACCESS)) {
    if (normalizedPath.startsWith(route.toLowerCase())) {
      return allowedRoles.includes(normalizedRole);
    }
  }
  
  return false;
}

/**
 * Get the list of dashboards a user can access
 */
export function getAccessibleDashboards(userRole: string | null | undefined): string[] {
  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) return [];
  
  const dashboards: string[] = [];
  
  for (const [route, allowedRoles] of Object.entries(DASHBOARD_ACCESS)) {
    if (allowedRoles.includes(normalizedRole)) {
      dashboards.push(route);
    }
  }
  
  return dashboards;
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a middleware response to redirect to the user's correct dashboard
 * 
 * @param req - NextRequest
 * @param userRole - User's role
 * @returns NextResponse redirect
 */
export function redirectToUserDashboard(req: NextRequest, userRole: string | null | undefined): NextResponse {
  const targetPath = getRedirectPathForRole(userRole);
  return NextResponse.redirect(new URL(targetPath, req.url));
}

/**
 * Check if a request path is a dashboard route
 */
export function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboards/');
}

/**
 * Extract dashboard type from path
 * 
 * @param pathname - Request pathname
 * @returns Dashboard type (e.g., "account", "developer") or null
 */
export function getDashboardTypeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboards\/([^\/]+)/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-ROLE PRECEDENCE (for users with multiple roles)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Role precedence for multi-role users (highest to lowest)
 * Used when a user has multiple roles and we need to pick a primary dashboard
 */
export const ROLE_PRECEDENCE: UserRole[] = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.ACCOUNT,
  ROLES.DEVELOPER,
  ROLES.AGENT,
  ROLES.CLIENT,
];

/**
 * Get the primary role from a list of roles based on precedence
 * 
 * @param roles - Array of user roles
 * @returns Highest precedence role or null
 */
export function getPrimaryRole(roles: string[]): UserRole | null {
  for (const precedenceRole of ROLE_PRECEDENCE) {
    for (const userRole of roles) {
      const normalized = normalizeRole(userRole);
      if (normalized === precedenceRole) {
        return normalized;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE HOOKS (for use in client components)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for user data from /api/auth/me
 */
export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string;
}

/**
 * Check if a user from /api/auth/me can access a dashboard
 * For use in client-side guards
 */
export function canUserAccessDashboard(user: MeUser | null, dashboardType: string): boolean {
  if (!user) return false;
  return canAccessDashboard(user.role, `/dashboards/${dashboardType}`);
}

/**
 * Get redirect path for a user from /api/auth/me
 */
export function getRedirectPathForUser(user: MeUser | null): string {
  if (!user) return '/login';
  return getRedirectPathForRole(user.role);
}