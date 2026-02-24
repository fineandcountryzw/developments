"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { getRedirectPathForRole, normalizeRole, ROLES } from "@/lib/role-router";

/**
 * Post-Login Route
 *
 * Uses /api/auth/me (DB) for role – not session – so redirect is always correct.
 * Flow: login → /post-login → fetch /api/auth/me → redirect by DB role.
 */
export default function PostLoginPage() {
  const { data: session, status } = useSession();
  const hasRedirectedRef = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (hasRedirectedRef.current || isRedirecting) return;
    if (status === "loading") return;
    console.log("[PostLogin] Session user:", {
      session: session?.user,
      status,
    });
    if (status === "unauthenticated" || !session?.user) {
      hasRedirectedRef.current = true;
      setIsRedirecting(true);
      window.location.href = "/login";
      return;
    }

    if (status !== "authenticated" || !session?.user) return;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (!res.ok || !json?.success) {
          console.warn(
            "[PostLogin] /api/auth/me failed:",
            json?.error ?? res.status,
          );
          hasRedirectedRef.current = true;
          setIsRedirecting(true);
          await signOut({ redirect: false });
          window.location.href = "/login?error=missing_role";
          return;
        }
        const user = json.data as {
          id: string;
          email: string;
          name: string | null;
          role: string;
          branch?: string;
        };
        
        // Use centralized role normalization
        const normalizedRole = normalizeRole(user?.role);
        console.log("[PostLogin] DB role:", user?.role, "Normalized:", normalizedRole, "email:", user?.email);

        // Claim reservations for CLIENT users (async, don't block redirect)
        if (normalizedRole === ROLES.CLIENT) {
          fetch("/api/client/claim-reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch((err) => {
            console.warn("[PostLogin] Failed to claim reservations:", err);
            // Non-fatal - don't block login
          });
        }

        // Use centralized routing function
        const path = getRedirectPathForRole(normalizedRole);

        hasRedirectedRef.current = true;
        setIsRedirecting(true);
        console.log("[PostLogin] Redirecting to:", path);
        // Use window.location for clean navigation without loopy re-renders
        window.location.href = path;
      } catch (e) {
        console.error("[PostLogin] /api/auth/me error:", e);
        hasRedirectedRef.current = true;
        setIsRedirecting(true);
        await signOut({ redirect: false });
        window.location.href = "/login?error=missing_role";
      }
    })();
  }, [status, session?.user, isRedirecting]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-4">
        <div className="inline-block h-12 w-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-semibold">
          Redirecting to your dashboard…
        </p>
      </div>
    </div>
  );
}
