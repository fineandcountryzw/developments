import { withAuth } from "next-auth/middleware";
import { NextResponse, NextRequest } from "next/server";
import type { NextMiddleware } from "next/server";
import {
  normalizeRole,
  canAccessDashboard,
  getRedirectPathForRole,
  ROLES,
} from "./lib/role-router";

/**
 * Middleware for route protection with role-based access control
 *
 * FEATURES:
 * - ROLE-BASED ACCESS - Dashboard access control based on user role
 *
 * NEVER protects: /, /login, /post-login, /api/auth, static assets
 *
 * This middleware:
 * 1. [PHASE 1] Verifies user has an active session (DASHBOARD ROUTES ONLY)
 * 2. [PHASE 2] Checks user's role from JWT token (refreshed from DB in authOptions)
 * 3. [PHASE 3] Ensures role matches the dashboard route (admin/agent/client/etc.)
 * 4. [PHASE 4] Redirects to correct dashboard via /post-login if role mismatch
 *
 * This prevents login loops by ensuring middleware doesn't intercept
 * public routes or the post-login resolver before session is established.
 */

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ========================================================================
  // DASHBOARD ACCESS CONTROL (only for /dashboards/* routes)
  // ========================================================================

  // Check if this is a dashboard route
  const isDashboardRoute = path.startsWith('/dashboards');

  if (!isDashboardRoute) {
    // Not a dashboard route - allow through
    return NextResponse.next();
  }
  
  // Dashboard route - apply withAuth protection
  // @ts-ignore - withAuth wrapper for dashboard routes only
  return withAuth(
    function middleware(req) {
      const token = req.nextauth.token;
      const path = req.nextUrl.pathname;

      // No token = not authenticated (should redirect to login via withAuth config)
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      // Get and normalize user role from token
      const userRole = normalizeRole(token.role as string);

      // No role in token = incomplete auth, redirect to post-login for role fetch
      if (!userRole) {
        console.warn("[MIDDLEWARE] No role found in token, redirecting to post-login");
        return NextResponse.redirect(new URL("/post-login", req.url));
      }

      console.log(`[MIDDLEWARE] Path: ${path}, User role: ${userRole}`);

      // Check if user can access the requested dashboard using centralized logic
      if (!canAccessDashboard(userRole, path)) {
        console.warn(`[MIDDLEWARE] ${userRole} denied access to ${path}`);
        
        // Redirect to their correct dashboard instead of post-login
        const correctDashboard = getRedirectPathForRole(userRole);
        console.log(`[MIDDLEWARE] Redirecting ${userRole} to ${correctDashboard}`);
        return NextResponse.redirect(new URL(correctDashboard, req.url));
      }

      // Allow request to proceed
      console.log(`[MIDDLEWARE] Access granted to ${userRole} for ${path}`);
      return NextResponse.next();
    },
    {
      callbacks: {
        // Must return true here for middleware function to run
        // Actual authorization logic is in the middleware function above
        authorized: ({ token }) => !!token,
      },
      pages: {
        signIn: "/login",
      },
    }
  )(req);
}

export const config = {
  // Run middleware on all routes for maintenance mode check
  // Dashboard protection only applies to /dashboards/:path*
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
