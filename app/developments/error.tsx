'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_LOG_ERRORS === 'true') {
      logger.error('Developments error boundary caught error', error, {
        module: 'DevelopmentsErrorBoundary',
        digest: error.digest,
      });
    }

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        level: 'error',
        tags: { module: 'DevelopmentsErrorBoundary' },
        extra: { digest: error.digest },
      });
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-fcCream p-4">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg border border-fcDivider">
        <h2 className="text-2xl font-bold text-fcSlate mb-3">Something went wrong</h2>
        <p className="text-fcText/70 mb-5">{error.message || 'An unexpected error occurred'}</p>
        {error.digest && (
          <p className="text-xs text-fcText/50 mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition font-semibold"
          >
            Try again
          </button>
          <Link
            href="/dashboards/client"
            className="flex-1 px-4 py-2 text-center border border-fcDivider rounded-lg hover:bg-fcCream transition font-semibold text-fcSlate"
          >
            Client dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

