/**
 * Sentry Server Configuration
 * 
 * This file configures Sentry for the server-side of your Next.js application.
 * It captures errors and performance data from API routes and server components.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
  // Adjust this value in production to reduce the volume of performance data
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Set profilesSampleRate to profile 10% of transactions
  // Adjust this value in production
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking
  release: process.env.SENTRY_RELEASE,
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events if DSN is not configured
    if (!process.env.SENTRY_DSN) {
      return null;
    }
    
    // Filter out non-error events in development
    if (process.env.NODE_ENV === 'development' && event.level !== 'error') {
      return null;
    }
    
    // Remove sensitive data from event
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        const queryString = event.request.query_string;
        const queryStr = typeof queryString === 'string' ? queryString : Array.isArray(queryString) ? queryString.join('&') : '';
        if (queryStr.includes('password') || queryStr.includes('token')) {
          event.request.query_string = '[Filtered]';
        }
      }
    }
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    // Database connection errors (handled gracefully)
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    // Prisma errors that are handled
    'P2002', // Unique constraint violation
    'P2025', // Record not found
  ],
});
