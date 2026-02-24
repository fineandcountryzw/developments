'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error using structured logger (only in production or if explicitly enabled)
    // In development, errors are already visible in the UI
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_LOG_ERRORS === 'true') {
      logger.error('App error boundary caught error', error, { 
        module: 'AppErrorBoundary',
        digest: error.digest 
      });
    }
    
    // Send to Sentry if configured (always send to Sentry for production monitoring)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          module: 'AppErrorBoundary',
        },
        extra: {
          digest: error.digest,
        },
      });
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-fcCream">
      <div className="max-w-md w-full mx-4 p-6 bg-white rounded-lg shadow-lg border border-fcDivider">
        <h2 className="text-2xl font-bold text-fcSlate mb-4">Something went wrong</h2>
        <p className="text-fcText/70 mb-6">{error.message || 'An unexpected error occurred'}</p>
        {error.digest && (
          <p className="text-xs text-fcText/50 mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="w-full px-4 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
