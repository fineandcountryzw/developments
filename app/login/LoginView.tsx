'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useLogo } from '@/contexts/LogoContext';
import { DEFAULT_LOGO } from '@/lib/constants';
import { Logo } from '@/components/Logo';

/**
 * LoginView - Client Component
 * 
 * FLICKER PREVENTION:
 * - Shows loading spinner while session status is resolving
 * - Only renders login form once status !== 'loading'
 * - Redirects authenticated users to /post-login
 * - Prevents flash of login UI before redirect
 */
export default function LoginView() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Routing and session
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { logoUrl } = useLogo();
  
  const authError = searchParams.get('error');

  // CRITICAL: Auto-redirect if already authenticated
  // Keep spinner visible during redirect to prevent flicker
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.replace('/post-login');
    }
  }, [status, session, router]);

  // PREVENT FLICKER: Show loading state while session is being resolved
  if (status === 'loading' || (status === 'authenticated' && session)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-fcGold" />
          <p className="text-slate-500 text-sm">
            {status === 'loading' ? 'Checking session...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  /**
   * Handle login form submission
   * Validates credentials against database via NextAuth
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic validation
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[Login] Attempting sign in for:', email);
      
      // Sign in with NextAuth credentials provider
      // NO callbackUrl to prevent poisoning - use post-login route instead
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password: password,
        redirect: false, // Prevent auto-redirect - we control the flow
      });

      if (result?.error) {
        console.log('[Login] Auth error:', result.error);
        
        // User-friendly error messages
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password. Please check your credentials.');
        } else if (result.error === 'Configuration') {
          setError('Authentication service unavailable. Please try again later.');
        } else {
          setError(result.error);
        }
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        setSuccess(true);
        console.log('[Login] Authentication successful, redirecting to post-login');
        // Full-page redirect so post-login fetches fresh /api/auth/me (DB role)
        window.location.href = '/post-login';
      }
    } catch (err: any) {
      console.error('[Login] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // ONLY NOW render the actual login form
  // Session check is complete (status !== 'loading' && !session)
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative" style={{ height: '80px', width: '200px' }}>
            <Logo variant="header" priority className="h-full" />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-fcSlate mb-2 text-center">
            Welcome Back
          </h1>
          <p className="text-slate-500 text-center mb-8">
            Sign in to your account
          </p>

          {/* Error from URL params (e.g., OAuth error) */}
          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium">Authentication Error</p>
                <p className="text-red-600 text-xs mt-1">
                  {authError === 'OAuthSignin' && 'Error connecting to authentication provider.'}
                  {authError === 'OAuthCallback' && 'Error during authentication callback.'}
                  {authError === 'OAuthCreateAccount' && 'Could not create user account.'}
                  {authError === 'EmailCreateAccount' && 'Could not create user account.'}
                  {authError === 'Callback' && 'Error during authentication.'}
                  {authError === 'OAuthAccountNotLinked' && 'Email already registered with different provider.'}
                  {authError === 'EmailSignin' && 'Check your email for the sign in link.'}
                  {authError === 'CredentialsSignin' && 'Invalid credentials.'}
                  {authError === 'SessionRequired' && 'Please sign in to access this page.'}
                  {authError === 'missing_role' && 'Your session had no role. You have been signed out. Please sign in again.'}
                  {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'EmailCreateAccount', 'Callback', 'OAuthAccountNotLinked', 'EmailSignin', 'CredentialsSignin', 'SessionRequired', 'missing_role'].includes(authError) && authError}
                </p>
              </div>
            </div>
          )}

          {/* Login Form Errors */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm flex-1">{error}</p>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700 text-sm flex-1">Login successful! Redirecting...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || success}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fcGold focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || success}
                  className="w-full pl-11 pr-12 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fcGold focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading || success}
                  className="w-4 h-4 rounded border-slate-300 bg-white text-fcGold focus:ring-2 focus:ring-fcGold focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-fcGold hover:text-fcGold/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full py-3 px-4 bg-gradient-to-r from-fcGold to-[#A69566] hover:from-[#A69566] hover:to-fcGold text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Success!
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/post-login' })}
            disabled={isLoading || success}
            className="w-full py-3 px-4 bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">
                Don't have an account?
              </span>
            </div>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
            Contact your administrator for account issues.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Fine & Country Zimbabwe
        </p>
      </div>
    </div>
  );
}
