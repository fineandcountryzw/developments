'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  normalizeRole,
  getRedirectPathForRole,
  canUserAccessDashboard,
  type MeUser
} from '@/lib/role-router';

// Dynamic import with SSR disabled to prevent "window is not defined" during build
const ManagerDashboard = dynamic(
  () => import('@/components/dashboards/ManagerDashboard').then(mod => mod.ManagerDashboard),
  { ssr: false }
);

export default function ManagerDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isRedirecting) return;
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login?callbackUrl=/dashboards/manager');
      return;
    }

    if (status !== 'authenticated' || !session?.user) return;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (!res.ok || !json?.success) {
          console.warn('[ManagerPage] /api/auth/me failed:', json?.error ?? res.status);
          router.replace('/login?callbackUrl=/dashboards/manager');
          return;
        }
        const user = json.data as MeUser;
        
        // Use centralized role normalization
        const normalizedRole = normalizeRole(user.role);
        console.log('[ManagerPage] DB role:', user.role, 'Normalized:', normalizedRole, 'email:', user.email);

        // Use centralized access control
        if (normalizedRole && canUserAccessDashboard(user, 'manager')) {
          setCanRender(true);
          return;
        }

        // Redirect to correct dashboard using centralized routing
        setIsRedirecting(true);
        const redirectPath = getRedirectPathForRole(normalizedRole);
        console.log('[ManagerPage] Access denied, redirecting to:', redirectPath);
        router.replace(redirectPath);
      } catch (e) {
        console.error('[ManagerPage] /api/auth/me error:', e);
        router.replace('/login?callbackUrl=/dashboards/manager');
      }
    })();
  }, [status, session?.user, router, isRedirecting]);

  // Show loading while checking session or role
  if (status === 'loading' || !canRender) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin">
            <div className="h-12 w-12 border-4 border-amber-400 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-white font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no session (will redirect)
  if (!session?.user) {
    return null;
  }

  return <ManagerDashboard />;
}
