'use client';

import React, { ReactNode, ReactElement } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * Catches React errors anywhere in the component tree,
 * logs those errors, and displays a fallback UI instead.
 * 
 * Usage:
 * <ErrorBoundary onError={(e, info) => logErrorToService(e, info)}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to logger (imported dynamically to avoid circular dependencies)
    if (typeof window !== 'undefined') {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error Boundary caught error', error, {
          module: 'ErrorBoundary',
          componentStack: errorInfo.componentStack
        });
      }).catch(() => {
        // Fallback if logger fails
        if (process.env.NODE_ENV === 'development') {
          console.error('Error Boundary caught error:', error, errorInfo);
        }
      });
    }

    // Log to external service (Sentry, etc)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // Strict payload limiting to prevent 413 (Content Too Large) errors
    const MAX_MESSAGE_LENGTH = 500;
    const MAX_STACK_LENGTH = 2000; // ~2KB
    const MAX_PAYLOAD_BYTES = 8000; // 8KB hard limit

    const truncate = (str: string | null | undefined, maxLength: number = MAX_STACK_LENGTH): string | undefined => {
      if (!str) return undefined;
      return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    };

    const baseErrorData = {
      name: error.name,
      message: truncate(error.message, MAX_MESSAGE_LENGTH),
      stack: truncate(error.stack),
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      truncated: false,
    };

    // Calculate payload size and truncate further if needed
    let errorData = { ...baseErrorData };
    let payloadSize = new Blob([JSON.stringify(errorData)]).size;

    if (payloadSize > MAX_PAYLOAD_BYTES) {
      // If still too large, drop stack and userAgent
      errorData = {
        ...baseErrorData,
        stack: undefined,
        userAgent: 'REDACTED',
        truncated: true,
      };
      payloadSize = new Blob([JSON.stringify(errorData)]).size;

      if (payloadSize > MAX_PAYLOAD_BYTES) {
        // Last resort: only send minimal data
        errorData = {
          name: error.name,
          message: truncate(error.message, 200),
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
          truncated: true,
          stack: undefined,
          userAgent: 'REDACTED',
        };
      }
    }

    try {
      // Send to Sentry if available
      if (typeof window !== 'undefined') {
        import('@sentry/nextjs').then((Sentry) => {
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              module: 'ErrorBoundary',
            },
            // DO NOT send componentStack - it's too large
            extra: errorData,
          });
        }).catch(() => {
          // Fallback to logger if Sentry fails
          import('@/lib/logger').then(({ logger }) => {
            logger.error('Error logged to service', error, {
              module: 'ErrorBoundary',
              ...errorData
            });
          }).catch(() => {
            // Final fallback
            if (process.env.NODE_ENV === 'development') {
              console.log('[ERROR_BOUNDARY] Error logged:', errorData);
            }
          });
        });
      }
    } catch (logError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to log error to service:', logError);
      }
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 * 
 * Displayed when an error is caught and no custom fallback is provided.
 */
interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

export function DefaultErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6 animate-in fade-in duration-300">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-red-50 rounded-full">
            <AlertCircle className="text-red-600" size={40} />
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-brand-black">Something went wrong</h1>
          <p className="text-sm text-brand-grey">
            We encountered an unexpected error. Please try again or contact support if the problem persists.
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="p-4 bg-brand-light rounded-lg text-left space-y-2 border border-brand-gold/20">
            <p className="text-xs font-mono text-red-600 break-words">
              <strong>Error:</strong> {error.message}
            </p>
            {error.stack && (
              <details className="text-xs">
                <summary className="cursor-pointer text-brand-grey font-semibold">Stack trace</summary>
                <pre className="mt-2 text-red-600 overflow-auto max-h-40 text-[10px]">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 bg-brand-gold text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-forensic"
          >
            <RefreshCw size={18} />
            Try Again
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-brand-light text-brand-black px-6 py-3 rounded-xl font-bold hover:bg-brand-gold/10 transition-colors"
          >
            <Home size={18} />
            Go Home
          </Link>
        </div>

        {/* Support Info */}
        <div className="pt-4 border-t border-brand-gold/10">
          <p className="text-xs text-brand-grey">
            Error ID: {Math.random().toString(36).substr(2, 9)}
          </p>
          <p className="text-xs text-brand-grey mt-1">
            If this keeps happening, please <a href="mailto:support@fineandcountry.com" className="text-brand-gold hover:underline">contact support</a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom Error Fallback Component
 * 
 * Use this to create specific error UIs for different parts of your app.
 * 
 * Example:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <ImportantFeature />
 * </ErrorBoundary>
 */
interface CustomErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function CustomErrorFallback({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error.',
  onRetry,
}: CustomErrorFallbackProps) {
  return (
    <div className="p-6 bg-brand-light rounded-2xl border border-brand-gold/20 text-center space-y-4">
      <div className="flex justify-center">
        <div className="p-3 bg-red-50 rounded-full">
          <AlertCircle className="text-red-600" size={32} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-brand-black">{title}</h3>
        <p className="text-sm text-brand-grey mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-brand-gold text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      )}
    </div>
  );
}
