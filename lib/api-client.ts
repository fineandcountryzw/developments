/**
 * API Client with automatic authentication
 * Handles Authorization headers and error management
 */

export interface FetchOptions extends RequestInit {
  includeAuth?: boolean;
}

/**
 * Get current auth token
 * Retrieves from localStorage or falls back to dev token in development
 * 
 * Note: This is optional for NextAuth-based authentication (which uses cookies).
 * Bearer tokens are only needed for external API calls or non-NextAuth auth.
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    // Server-side: no token needed (NextAuth uses session)
    return null;
  }

  // Check localStorage first
  const stored = localStorage.getItem('auth_token');
  if (stored) {
    console.log('[API_CLIENT] Using stored auth token');
    return stored;
  }

  // In development mode, use fallback dev token
  if (process.env.NODE_ENV === 'development') {
    console.log('[API_CLIENT] Using fallback dev token');
    return 'dev-token-local';
  }

  // No token found - this is normal for NextAuth (uses cookies instead)
  return null;
}

/**
 * Authenticated fetch wrapper
 * Handles authentication via NextAuth session cookies (primary) or Bearer tokens (fallback)
 * 
 * NextAuth automatically includes session cookies with credentials: 'include'
 * Bearer tokens are only needed for external API calls or non-NextAuth authentication
 */
export async function authenticatedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { includeAuth = true, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers || {});

  // For admin endpoints, check if we have a Bearer token (optional for external APIs)
  // NextAuth sessions work via HTTP-only cookies, so missing token is OK
  if (includeAuth && url.includes('/api/')) {
    const token = getAuthToken();
    if (token) {
      // Token available - add as Bearer (for external APIs or legacy auth)
      headers.set('Authorization', `Bearer ${token}`);
      console.log('[API_CLIENT] Added Bearer token for:', url);
    } else if (url.includes('/api/admin/') || url.includes('/api/agent/') || url.includes('/api/manager/')) {
      // No token, but that's OK - NextAuth uses session cookies
      console.log('[API_CLIENT] No Bearer token for:', url, '- relying on NextAuth session cookie');
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include', // CRITICAL: Include NextAuth session cookies
  });

  // Log response status for debugging
  if (!response.ok) {
    console.error('[API_CLIENT] Request failed', {
      url,
      status: response.status,
      statusText: response.statusText,
      hasAuthCookie: document.cookie.includes('next-auth'),
    });
  }

  return response;
}

/**
 * Convenience wrapper for JSON API calls
 */
export async function apiCall<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await authenticatedFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: result.error || result.message || 'Request failed',
        status: response.status,
      };
    }

    return {
      data: result.data || result,
      error: null,
      status: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API_CLIENT] Error:', message);
    return {
      data: null,
      error: message,
      status: 0,
    };
  }
}

/**
 * Set auth token (for login flow)
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
    console.log('[API_CLIENT] Auth token stored');
  }
}

/**
 * Clear auth token (for logout)
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    console.log('[API_CLIENT] Auth token cleared');
  }
}
