'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminAgentsModule } from '@/components/AdminAgentsModule';
import { Branch } from '@/types';
import {
  normalizeRole,
  getRedirectPathForRole,
  canUserAccessDashboard,
  type MeUser
} from '@/lib/role-router';

/**
 * Admin Agents Dashboard Page
 * Manage agents with unique codes, status, and branch assignment
 */
export default function AgentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (isRedirecting) return;
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login?callbackUrl=/dashboards/admin/agents');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (!res.ok || !json?.success) {
          router.replace('/login?callbackUrl=/dashboards/admin/agents');
          return;
        }

        const user = json.data as MeUser;
        setMe(user);

        const normalizedRole = normalizeRole(user.role);

        // Only admins can access agents management
        if (normalizedRole && canUserAccessDashboard(user, 'admin')) {
          setCanRender(true);
          return;
        }

        setIsRedirecting(true);
        const redirectPath = getRedirectPathForRole(normalizedRole);
        router.replace(redirectPath);
      } catch (e) {
        console.error('[AgentsPage] Auth error:', e);
        router.replace('/login?callbackUrl=/dashboards/admin/agents');
      }
    })();
  }, [status, session?.user, router, isRedirecting]);

  if (status === 'loading' || !canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-[#B8860B] rounded-full animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Loading Agents Dashboard…</p>
        </div>
      </div>
    );
  }

  if (!session?.user || !me) return null;

  const branch: Branch = (me.branch === 'Bulawayo' ? 'Bulawayo' : 'Harare');

  return <AdminAgentsModule activeBranch={branch} />;
}
