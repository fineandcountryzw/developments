'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DeveloperDashboard } from '@/components/dashboards/DeveloperDashboard';
import {
  normalizeRole,
  getRedirectPathForRole,
  canUserAccessDashboard,
  type MeUser
} from '@/lib/role-router';

/**
 * Developer Dashboard Page
 * Uses /api/auth/me (DB) for role – not session – to avoid stale JWT redirects.
 */
export default function DeveloperDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isRedirecting) return;
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login?callbackUrl=/dashboards/developer');
      return;
    }

    if (status !== 'authenticated' || !session?.user) return;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (!res.ok || !json?.success) {
          console.warn('[DeveloperPage] /api/auth/me failed:', json?.error ?? res.status);
          router.replace('/login?callbackUrl=/dashboards/developer');
          return;
        }
        const user = json.data as MeUser;
        
        // Use centralized role normalization
        const normalizedRole = normalizeRole(user.role);
        console.log('[DeveloperPage] DB role:', user.role, 'Normalized:', normalizedRole, 'email:', user.email);

        // Use centralized access control
        if (normalizedRole && canUserAccessDashboard(user, 'developer')) {
          setCanRender(true);
          return;
        }

        // Redirect to correct dashboard using centralized routing
        setIsRedirecting(true);
        const redirectPath = getRedirectPathForRole(normalizedRole);
        console.log('[DeveloperPage] Access denied, redirecting to:', redirectPath);
        router.replace(redirectPath);
      } catch (e) {
        console.error('[DeveloperPage] /api/auth/me error:', e);
        router.replace('/login?callbackUrl=/dashboards/developer');
      }
    })();
  }, [status, session?.user, router, isRedirecting]);

  if (status === 'loading' || !canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-[#B8860B] rounded-full animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Loading Developer Portal…</p>
        </div>
      </div>
    );
  }

  return <DeveloperDashboard />;
}
