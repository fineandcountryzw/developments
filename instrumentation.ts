/**
 * Sentry Instrumentation
 * 
 * This file is automatically executed by Next.js when the server starts.
 * It initializes Sentry for server-side error tracking.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only initialize Sentry on server-side
    if (process.env.SENTRY_DSN) {
      await import('./sentry.server.config');
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for Edge runtime
    if (process.env.SENTRY_DSN) {
      await import('./sentry.edge.config');
    }
  }
}
