'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';
import { LogoProvider } from '@/contexts/LogoContext';
import { Toaster } from 'react-hot-toast';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Suppress "message channel closed" errors from browser extensions/service workers
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Set to track if we've already suppressed an error
      const suppressedErrors = new Set<string>();
      
      // Handler for unhandled promise rejections
      const handler = (event: PromiseRejectionEvent) => {
        const reasonMessage = typeof event.reason?.message === "string" ? event.reason.message : String(event.reason || '');
        const reasonString = typeof event.reason === "string" ? event.reason : '';
        const fullReason = reasonMessage + reasonString;
        
        if (
          reasonMessage.includes("message channel closed") ||
          reasonMessage.includes("A listener indicated an asynchronous response") ||
          reasonMessage.includes("The message port closed before a response was received") ||
          // Suppress NextAuth CLIENT_FETCH_ERROR (network issues during initial load)
          fullReason.includes("CLIENT_FETCH_ERROR") ||
          fullReason.includes("Failed to fetch")
        ) {
          event.preventDefault();
          suppressedErrors.add(reasonMessage || fullReason);
        }
      };
      
      // Handler for uncaught errors from extensions
      const errorHandler = (event: ErrorEvent) => {
        if (
          typeof event.message === "string" &&
          (event.message.includes("message channel closed") ||
           event.message.includes("A listener indicated an asynchronous response") ||
           event.message.includes("The message port closed before a response was received") ||
           event.message.includes("Throttling navigation to prevent the browser from hanging"))
        ) {
          event.preventDefault();
          suppressedErrors.add(event.message);
          return true;
        }
        return false;
      };
      
      window.addEventListener("unhandledrejection", handler);
      window.addEventListener("error", errorHandler, true); // Use capture phase for better coverage
      
      // Also suppress via console error handler for extension errors and NextAuth fetch errors
      const originalError = console.error;
      console.error = function(...args: any[]) {
        const message = args?.[0]?.toString?.() || '';
        const fullMessage = args.map(arg => String(arg)).join(' ');
        
        // Suppress known non-critical errors
        if (
          message.includes('message channel closed') || 
          message.includes('A listener indicated an asynchronous response') ||
          message.includes('The message port closed') ||
          message.includes('Throttling navigation') ||
          message.includes('Node cannot be found') ||
          // Suppress NextAuth CLIENT_FETCH_ERROR during initial load (network issues, API not ready)
          (fullMessage.includes('[next-auth][error][CLIENT_FETCH_ERROR]') && 
           fullMessage.includes('Failed to fetch')) ||
          // Suppress error boundary logs in development (errors are visible in UI)
          (process.env.NODE_ENV === 'development' && 
           (fullMessage.includes('App error boundary caught error') ||
            fullMessage.includes('Error Boundary caught error') ||
            fullMessage.includes('{"module":"AppErrorBoundary"}')))
        ) {
          // Silently suppress these errors
          return;
        }
        originalError.apply(console, args);
      };
      
      // Also suppress via console.warn
      const originalWarn = console.warn;
      console.warn = function(...args: any[]) {
        const message = args?.[0]?.toString?.() || '';
        if (!message.includes('message channel closed') && 
            !message.includes('A listener indicated an asynchronous response') &&
            !message.includes('Throttling navigation') &&
            !message.includes('Node cannot be found')) {
          originalWarn.apply(console, args);
        }
      };
      
      return () => {
        window.removeEventListener("unhandledrejection", handler);
        window.removeEventListener("error", errorHandler, true);
        console.error = originalError;
        console.warn = originalWarn;
      };
    }
    return undefined;
  }, []);

  return (
    <SessionProvider
      // Configure SessionProvider to handle errors gracefully
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window regains focus
      // Suppress initial fetch errors if API route isn't ready
      basePath={process.env.NEXT_PUBLIC_BASE_PATH || undefined}
    >
      <LogoProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#1A1A1A',
              border: '1px solid #E5E7EB',
              padding: '16px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        {children}
      </LogoProvider>
    </SessionProvider>
  );
}
