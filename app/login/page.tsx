'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginView from './LoginView';

/**
 * Login Page - Client Component
 * 
 * Handles authentication state and redirects appropriately.
 * Uses client-side session check to avoid server-side timing issues.
 */
function LoginPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  // If there's a configuration error, don't redirect - show the error
  // This prevents loops when NextAuth has config issues
  const hasConfigError = error === 'configuration';

  // Redirect authenticated users to post-login (only if no config error)
  // Show explicit message before redirect to prevent silent auto-login
  useEffect(() => {
    if (!hasConfigError && status === 'authenticated' && session?.user) {
      // Small delay to show message, then redirect
      const timer = setTimeout(() => {
        router.replace('/post-login');
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, session, router, hasConfigError]);

  // Show loading while checking session (unless there's a config error)
  if (!hasConfigError && status === 'loading') {
    return <LoadingScreen />;
  }

  // Show explicit message for authenticated users before redirect
  if (!hasConfigError && status === 'authenticated' && session?.user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-fcGold border-t-transparent rounded-full animate-spin" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                You are already logged in
              </p>
              <p className="text-sm text-gray-600">
                Redirecting to your dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show login form for unauthenticated users or if there's a config error
  if (status === 'unauthenticated' || hasConfigError) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LoginView />
      </Suspense>
    );
  }

  // Fallback loading state
  return <LoadingScreen />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginPageContent />
    </Suspense>
  );
}

/**
 * Loading screen while LoginView suspends
 * Prevents flicker during client component hydration
 */
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

