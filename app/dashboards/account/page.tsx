'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AccountDashboard from '@/components/account/AccountDashboard';
import {
  normalizeRole,
  getRedirectPathForRole,
  canUserAccessDashboard,
  ROLES,
  type MeUser
} from '@/lib/role-router';

/**
 * Accounts Dashboard Page
 * Uses /api/auth/me (DB) for role – not session – to avoid stale JWT redirects.
 */
export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (isRedirecting) return;
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login?callbackUrl=/dashboards/account');
      return;
    }

    if (status !== 'authenticated' || !session?.user) return;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (!res.ok || !json?.success) {
          console.warn('[AccountPage] /api/auth/me failed:', json?.error ?? res.status);
          router.replace('/login?callbackUrl=/dashboards/account');
          return;
        }
        const user = json.data as MeUser;
        setMe(user);
        
        // Use centralized role normalization
        const normalizedRole = normalizeRole(user.role);
        console.log('[AccountPage] DB role:', user.role, 'Normalized:', normalizedRole, 'email:', user.email);

        // Use centralized access control
        if (normalizedRole && canUserAccessDashboard(user, 'account')) {
          setCanRender(true);
          return;
        }

        // Redirect to correct dashboard using centralized routing
        setIsRedirecting(true);
        const redirectPath = getRedirectPathForRole(normalizedRole);
        console.log('[AccountPage] Access denied, redirecting to:', redirectPath);
        router.replace(redirectPath);
      } catch (e) {
        console.error('[AccountPage] /api/auth/me error:', e);
        router.replace('/login?callbackUrl=/dashboards/account');
      }
    })();
  }, [status, session?.user, router, isRedirecting]);

  if (status === 'loading' || !canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-[#B8860B] rounded-full animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Loading Accounts Dashboard…</p>
        </div>
      </div>
    );
  }

  if (!session?.user || !me) return null;

  const normalizedRole = normalizeRole(me.role);
  const userBranch = me.branch ?? 'Harare';

  return (
    <AccountDashboard
      user={{
        name: me.name || session.user.name || 'Account User',
        email: me.email || session.user.email || '',
        role: normalizedRole === ROLES.ACCOUNT ? 'ACCOUNT' : (me.role || 'ACCOUNT'),
        branch: userBranch,
      }}
      onLogout={() => signOut({ callbackUrl: '/login' })}
    />
  );
}
