'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  normalizeRole,
  getRedirectPathForRole,
  canUserAccessDashboard,
  ROLES,
  type MeUser
} from '@/lib/role-router';

// Dynamically import App to prevent server-side rendering
const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      inset: 0,
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', color: '#374151', fontWeight: 500 }}>Loading Admin...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

/**
 * Admin Dashboard
 * Full admin access to Development Wizard and all modules
 */
export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Protect route - only Admin can access
  // Middleware handles unauthenticated users automatically
  useEffect(() => {
    // Prevent multiple redirects
    if (isRedirecting) {
      return;
    }

    // Wait for session to load
    if (status === 'loading') {
      return;
    }

    // Redirect to login if no active session (not home to avoid loops)
    if (status === 'unauthenticated' || !session?.user) {
      setIsRedirecting(true);
      setCanRender(false);
      router.replace('/login?callbackUrl=/dashboards/admin');
      return;
    }

    // Authenticated - fetch role from DB (not session) to avoid stale JWT
    if (status === 'authenticated' && session?.user) {
      (async () => {
        try {
          const res = await fetch('/api/auth/me');
          const json = await res.json();
          if (!res.ok || !json?.success) {
            console.warn('[AdminPage] /api/auth/me failed:', json?.error ?? res.status);
            setIsRedirecting(true);
            router.replace('/login?callbackUrl=/dashboards/admin');
            return;
          }
          
          const user = json.data as MeUser;
          const normalizedRole = normalizeRole(user.role);
          
          console.log('[AdminPage] DB role:', user.role, 'Normalized:', normalizedRole);
          
          // Use centralized access control
          if (normalizedRole && canUserAccessDashboard(user, 'admin')) {
            console.log('[AdminPage] Admin role confirmed, allowing render');
            setCanRender(true);
            return;
          }
          
          // Non-admin users - redirect to their correct dashboard
          setIsRedirecting(true);
          const redirectPath = getRedirectPathForRole(normalizedRole);
          console.log('[AdminPage] Non-admin role, redirecting to:', redirectPath);
          router.replace(redirectPath);
        } catch (e) {
          console.error('[AdminPage] /api/auth/me error:', e);
          setIsRedirecting(true);
          router.replace('/login?callbackUrl=/dashboards/admin');
        }
      })();
    }
  }, [status, session, router, isRedirecting]);

  // Show loading while checking authentication or waiting for render permission
  if (status === 'loading' || (status === 'authenticated' && !canRender) || isRedirecting) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'fixed',
        inset: 0,
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ marginTop: '16px', color: '#374151', fontWeight: 500 }}>Loading Admin...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Render the main admin application with full admin access
  return <App initialRole="Admin" />;
}
