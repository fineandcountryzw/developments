'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useLogo } from '@/contexts/LogoContext';
import { DEFAULT_LOGO } from '@/lib/constants';

/**
 * Forgot Password Page
 * 
 * Allows users to request a password reset email.
 * This creates a reset token and sends instructions via email.
 */
export default function ForgotPasswordPage() {
  const { logoUrl } = useLogo();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    try {
      // TODO: Implement actual password reset API
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      // Don't reveal if email exists for security
      setSuccess(true); // Always show success to prevent email enumeration
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32">
            <Image
              src={logoUrl || DEFAULT_LOGO}
              alt="Fine & Country Zimbabwe"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          {/* Back Link */}
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-fcGold transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-fcSlate mb-2">
              Forgot Password?
            </h1>
            <p className="text-slate-500">
              Enter your email and we&apos;ll send you reset instructions
            </p>
          </div>

          {/* Success Message */}
          {success ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-5 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-800 font-semibold">Check your email</p>
                  <p className="text-green-700 text-sm mt-1">
                    If an account exists for <strong>{email}</strong>, you&apos;ll receive 
                    password reset instructions shortly.
                  </p>
                </div>
              </div>

              <div className="text-center text-sm text-slate-500">
                <p>Didn&apos;t receive the email?</p>
                <button 
                  onClick={() => setSuccess(false)}
                  className="text-fcGold hover:text-fcGold/80 font-semibold transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl 
                             focus:ring-2 focus:ring-fcGold focus:border-fcGold 
                             transition-all duration-200
                             disabled:bg-slate-100 disabled:cursor-not-allowed
                             placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-4 px-6 bg-fcSlate hover:bg-slate-800 
                         text-white font-semibold rounded-xl shadow-lg
                         hover:shadow-xl transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Reset Instructions</span>
                )}
              </button>
            </form>
          )}

          {/* Help Text */}
          <p className="mt-8 text-xs text-slate-400 text-center leading-relaxed">
            If you&apos;re having trouble, contact your administrator<br />
            or email support@fineandcountry.co.zw
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Fine & Country Zimbabwe
        </p>
      </div>
    </div>
  );
}
