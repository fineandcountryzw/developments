'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

/**
 * Premium Coming Soon Page
 * 
 * Maintenance mode landing page with password unlock.
 * Features:
 * - Full viewport hero background
 * - Glass morphism card design
 * - Secure password unlock
 * - Premium animations and transitions
 * - Mobile-first responsive
 */

export default function ComingSoonPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Please enter password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setPassword('');
        
        // Redirect to home after brief success display
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
      } else {
        setError(data.message || 'Invalid password');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('[UNLOCK] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Hero Background Image */}
      <div className="absolute inset-0">
        <Image
          src="https://p95t08lhll.ufs.sh/f/I5VkKRpIwc8j6cHk9iebfHgyVdO1n3XA9vJzheM4ZYrUSEqw"
          alt="Background"
          fill
          priority
          className="object-cover"
          quality={90}
          sizes="100vw"
        />
        
        {/* Premium gradient overlay - dark to semi-transparent */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/40" />
        
        {/* Subtle vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-60" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          
          {/* Premium Glass Card */}
          <div 
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 sm:p-10"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Animated gradient border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-0 transition-opacity duration-500 hover:opacity-100" />
            
            <div className="relative space-y-6">
              {/* Logo/Brand Area */}
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 backdrop-blur-sm">
                  <Lock className="h-8 w-8 text-amber-400" strokeWidth={1.5} />
                </div>
                
                <h1 className="mb-2 bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-3xl font-light tracking-tight text-transparent sm:text-4xl">
                  Maintenance Mode
                </h1>
                
                <p className="mx-auto mt-3 max-w-sm text-sm text-white/60 sm:text-base">
                  Please enter your access password to continue
                </p>
              </div>

              {/* Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label 
                    htmlFor="access-password" 
                    className="block text-xs font-medium uppercase tracking-wider text-white/50"
                  >
                    Access Password
                  </label>
                  
                  <div className="relative">
                    <input
                      id="access-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      disabled={isLoading || success}
                      placeholder="Enter password..."
                      className={`
                        w-full rounded-lg border bg-white/5 px-4 py-3 text-white 
                        placeholder:text-white/30 backdrop-blur-sm
                        transition-all duration-300
                        focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent
                        disabled:cursor-not-allowed disabled:opacity-50
                        ${error 
                          ? 'border-red-500/50 focus:ring-red-500/50' 
                          : success
                          ? 'border-green-500/50'
                          : 'border-white/10 hover:border-white/20'
                        }
                      `}
                      autoComplete="off"
                      spellCheck="false"
                    />
                    
                    {/* Success icon */}
                    {success && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="h-5 w-5 text-green-400 animate-in fade-in zoom-in duration-300" />
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {error && (
                    <p className="text-xs text-red-400 animate-in fade-in slide-in-from-top-1 duration-300">
                      {error}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || success || !password.trim()}
                  className={`
                    group relative w-full overflow-hidden rounded-lg px-6 py-3 
                    font-medium text-black transition-all duration-300
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${success 
                      ? 'bg-green-500' 
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-[0.98]'
                    }
                  `}
                >
                  {/* Button background shine effect */}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Access Granted</span>
                      </>
                    ) : (
                      <span>Unlock Platform</span>
                    )}
                  </span>
                </button>
              </form>

              {/* Footer Note */}
              <div className="border-t border-white/10 pt-6 text-center">
                <p className="text-xs text-white/40">
                  Secure internal access only
                  <span className="mx-2">•</span>
                  Authorized personnel
                </p>
              </div>
            </div>
          </div>

          {/* Subtle bottom text */}
          <p className="mt-6 text-center text-xs text-white/30">
            Fine & Country Zimbabwe ERP
          </p>
        </div>
      </div>
    </div>
  );
}
