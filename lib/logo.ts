/**
 * Global Logo Management System
 * Provides centralized logo URL resolution with fallback support
 */

import { DEFAULT_LOGO } from './constants';

/**
 * Retrieves the site logo URL from settings or returns default fallback
 * 
 * Priority order:
 * 1. Uploaded admin logo URL (from database settings)
 * 2. Default logo (/logos/logo.svg)
 * 
 * @param uploadedLogoUrl - Optional URL from database settings or admin upload
 * @returns Logo URL to use in Image components
 */
export function getSiteLogo(uploadedLogoUrl?: string | null): string {
  // If we have an uploaded logo URL, use it
  if (uploadedLogoUrl && uploadedLogoUrl.trim().length > 0) {
    return uploadedLogoUrl;
  }
  
  // Fallback to default logo
  return DEFAULT_LOGO;
}

/**
 * React hook for logo URL resolution
 * Can be used in components to access logo with real-time updates
 */
export function useSiteLogo(uploadedLogoUrl?: string | null): string {
  return getSiteLogo(uploadedLogoUrl);
}

/**
 * Logo configuration interface
 * Used for passing logo metadata across components
 */
export interface LogoConfig {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

/**
 * Get complete logo configuration with defaults
 */
export function getLogoConfig(uploadedLogoUrl?: string | null): LogoConfig {
  return {
    url: getSiteLogo(uploadedLogoUrl),
    alt: 'Fine & Country Zimbabwe',
    width: 180,
    height: 60,
  };
}
