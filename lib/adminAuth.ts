/**
 * Unified Admin Authorization Helper
 * 
 * SINGLE SOURCE OF TRUTH for admin authentication.
 * Uses ONLY NextAuth getServerSession - no legacy Neon Auth.
 * 
 * Rule: session.user.role === "ADMIN" (case-insensitive)
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  branch?: string;
}

/**
 * Get authenticated user from NextAuth session ONLY
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  console.log("[ADMIN_AUTH] Checking session...");

  try {
    const session = await getServerSession(authOptions);
    
    console.log("[ADMIN_AUTH] Session result:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      role: session?.user?.role,
      email: session?.user?.email,
    });

    if (session?.user) {
      return {
        id: session.user.id || "",
        email: session.user.email || "",
        role: session.user.role?.toUpperCase() || "CLIENT",
        branch: (session.user as any).branch,
      };
    }
  } catch (error) {
    console.error("[ADMIN_AUTH] Session error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  console.log("[ADMIN_AUTH] No authenticated user found");
  return null;
}

/**
 * Check if user has Admin role (case-insensitive)
 */
export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === "ADMIN";
}

/**
 * Check if user has Manager or higher role
 */
export function isManager(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Check if user has Agent or higher role
 */
export function isAgent(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

/**
 * Require Admin authentication - returns user or error response
 * Use this in API routes for consistent admin authorization
 * 
 * @param request - Optional NextRequest for rate limiting (if provided, checks rate limit)
 * @param rateLimit - Optional rate limit configuration (default: 20 requests per minute)
 */
export async function requireAdmin(
  request?: any,
  rateLimit: { limit?: number; windowMs?: number } = {}
): Promise<{ user: AuthUser; error?: never } | { error: NextResponse; user?: never }> {
  // Rate limiting check (if request provided)
  if (request) {
    const identifier = request.headers?.get('x-forwarded-for') || 
                       request.headers?.get('x-real-ip') || 
                       'unknown';
    const limit = rateLimit.limit || 20; // Default: 20 requests per minute
    const windowMs = rateLimit.windowMs || 60000; // Default: 1 minute
    
    if (!checkRateLimit(identifier, limit, windowMs)) {
      return {
        error: apiError(
          'Too many requests. Please try again later.',
          429,
          'RATE_LIMIT'
        )
      };
    }
  }
  
  const user = await getAuthenticatedUser();
  
  if (!user) {
    console.log("[ADMIN_AUTH] requireAdmin: No authenticated user");
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    };
  }

  if (!isAdmin(user)) {
    console.log("[ADMIN_AUTH] requireAdmin: User is not admin:", user.role);
    return {
      error: NextResponse.json(
        { error: "Unauthorized – Admin access required", code: "ADMIN_REQUIRED" },
        { status: 403 }
      )
    };
  }

  console.log("[ADMIN_AUTH] requireAdmin: Admin verified:", user.email);
  return { user };
}

/**
 * Require Manager or higher authentication
 */
export async function requireManager(): Promise<{ user: AuthUser; error?: never } | { error: NextResponse; user?: never }> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    };
  }

  if (!isManager(user)) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized – Manager access required", code: "MANAGER_REQUIRED" },
        { status: 403 }
      )
    };
  }

  return { user };
}

/**
 * Require Agent or higher authentication
 */
export async function requireAgent(): Promise<{ user: AuthUser; error?: never } | { error: NextResponse; user?: never }> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    };
  }

  if (!isAgent(user)) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized – Agent access required", code: "AGENT_REQUIRED" },
        { status: 403 }
      )
    };
  }

  return { user };
}

/**
 * Check if user has Accountant role
 */
export function isAccountant(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  return role === "ACCOUNT";
}

/**
 * Require Accountant or higher authentication (read-only access)
 */
export async function requireAccountant(): Promise<{ user: AuthUser; error?: never } | { error: NextResponse; user?: never }> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    };
  }

  const role = user.role?.toUpperCase();
  // Accountant (ACCOUNT) or Admin/Manager can access
  if (role !== "ACCOUNT" && role !== "ADMIN" && role !== "MANAGER") {
    return {
      error: NextResponse.json(
        { error: "Unauthorized – Accountant access required", code: "ACCOUNTANT_REQUIRED" },
        { status: 403 }
      )
    };
  }

  return { user };
}
