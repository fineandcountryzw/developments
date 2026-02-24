'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DEFAULT_LOGO } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { dedupeFetch } from '@/lib/request-dedup';

interface LogoContextType {
  logoUrl: string;
  isLoading: boolean;
  error: string | null;
  refreshLogo: () => Promise<void>;
  setLogoUrl: (url: string) => void;
}

const LogoContext = createContext<LogoContextType>({
  logoUrl: DEFAULT_LOGO,
  isLoading: true,
  error: null,
  refreshLogo: async () => {},
  setLogoUrl: () => {}
});

interface LogoProviderProps {
  children: ReactNode;
  initialLogoUrl?: string;
}

/**
 * LogoProvider - Centralized logo state management
 * 
 * This context provides:
 * 1. Single source of truth for logo URL across all components
 * 2. Automatic fetching from database on mount
 * 3. Cache-busting to prevent stale images
 * 4. Refresh capability for real-time updates after logo upload
 * 
 * Usage:
 * - Wrap your app with <LogoProvider>
 * - Use useLogo() hook in any component to access logoUrl
 */
export function LogoProvider({ children, initialLogoUrl }: LogoProviderProps) {
  const [logoUrl, setLogoUrlState] = useState<string>(initialLogoUrl || DEFAULT_LOGO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(Date.now());

  /**
   * Fetch logo URL from database
   * Uses Harare branch as the primary source (both branches share same logo)
   */
  const fetchLogoFromDatabase = useCallback(async (): Promise<string | null> => {
    try {
      logger.debug('Fetching logo from database', { module: 'LogoContext' });
      
      // Use dedupeFetch to prevent duplicate requests with App.tsx
      const data = await dedupeFetch<{ success?: boolean; data?: { logo_url?: string } }>(
        '/api/admin/settings?branch=Harare',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store' // Prevent caching
        }
      );

      if (data.success && data.data?.logo_url) {
        const dbLogoUrl = data.data.logo_url;
        logger.debug('Retrieved logo from database', { module: 'LogoContext', logoUrl: dbLogoUrl });
        
        // Check if it's a valid URL (not the fallback)
        if (dbLogoUrl && dbLogoUrl !== DEFAULT_LOGO && dbLogoUrl.trim() !== '') {
          return dbLogoUrl;
        }
      }
      
      logger.debug('No custom logo in database, using default', { module: 'LogoContext' });
      return null;
    } catch (err) {
      logger.error('Error fetching logo', err instanceof Error ? err : undefined, { module: 'LogoContext' });
      return null;
    }
  }, []);

  /**
   * Refresh logo from database
   * Call this after uploading a new logo
   */
  const refreshLogo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const dbLogoUrl = await fetchLogoFromDatabase();
      
      if (dbLogoUrl) {
        // Add cache-busting parameter for UploadThing URLs
        const cacheBustedUrl = dbLogoUrl.includes('?') 
          ? `${dbLogoUrl}&v=${Date.now()}`
          : `${dbLogoUrl}?v=${Date.now()}`;
        
        setLogoUrlState(cacheBustedUrl);
        setCacheVersion(Date.now());
        
        // Persist to localStorage for offline fallback
        try {
          localStorage.setItem('fc_logo_url', dbLogoUrl);
          localStorage.setItem('fc_logo_updated', Date.now().toString());
        } catch (e) {
          logger.warn('Could not persist logo to localStorage', { module: 'LogoContext' });
        }
      } else {
        setLogoUrlState(DEFAULT_LOGO);
      }
    } catch (err: any) {
      logger.error('Error refreshing logo', err, { module: 'LogoContext' });
      setError(err.message || 'Failed to refresh logo');
    } finally {
      setIsLoading(false);
    }
  }, [fetchLogoFromDatabase]);

  /**
   * Set logo URL directly (for immediate UI updates after upload)
   */
  const setLogoUrl = useCallback((url: string) => {
    logger.debug('Setting logo URL', { module: 'LogoContext', url });
    
    // Add cache-busting for external URLs
    const cacheBustedUrl = url.includes('uploadthing') && !url.includes('?v=')
      ? `${url}?v=${Date.now()}`
      : url;
    
    setLogoUrlState(cacheBustedUrl);
    setCacheVersion(Date.now());
    
    // Persist to localStorage
    try {
      localStorage.setItem('fc_logo_url', url);
      localStorage.setItem('fc_logo_updated', Date.now().toString());
    } catch (e) {
      logger.warn('Could not persist logo to localStorage', { module: 'LogoContext' });
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    const loadLogo = async () => {
      // Try localStorage first for faster initial load
      try {
        const cachedLogoUrl = localStorage.getItem('fc_logo_url');
        if (cachedLogoUrl && cachedLogoUrl !== DEFAULT_LOGO) {
          logger.debug('Using cached logo from localStorage', { module: 'LogoContext', logoUrl: cachedLogoUrl });
          setLogoUrlState(cachedLogoUrl);
        }
      } catch (e) {
        logger.warn('Could not read from localStorage', { module: 'LogoContext' });
      }
      
      // Then refresh from database
      await refreshLogo();
    };
    
    loadLogo();
  }, [refreshLogo]);

  const contextValue: LogoContextType = {
    logoUrl,
    isLoading,
    error,
    refreshLogo,
    setLogoUrl
  };

  return (
    <LogoContext.Provider value={contextValue}>
      {children}
    </LogoContext.Provider>
  );
}

/**
 * Hook to access logo context
 * 
 * Usage:
 * const { logoUrl, refreshLogo, setLogoUrl } = useLogo();
 */
export function useLogo(): LogoContextType {
  const context = useContext(LogoContext);
  if (!context) {
    logger.warn('Hook used outside of LogoProvider, returning default', { module: 'LogoContext' });
    return {
      logoUrl: DEFAULT_LOGO,
      isLoading: false,
      error: null,
      refreshLogo: async () => {},
      setLogoUrl: () => {}
    };
  }
  return context;
}

export default LogoContext;
