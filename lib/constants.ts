/**
 * Global Application Constants
 * Single source of truth for shared values across the application
 */

/**
 * Default logo path for Fine & Country Zimbabwe
 * Used across all branches (Harare, Bulawayo) and authentication screens
 * 
 * This path points to the static fallback logo in /public/logos/logo.svg
 * Database-uploaded logos (via UploadThing) will override this default
 */
export const DEFAULT_LOGO = '/logos/logo.svg';

/**
 * Brand colors (for reference)
 * Already defined in Tailwind config but exported here for programmatic use
 */
export const BRAND_COLORS = {
  gold: '#C5A059',
  slate: '#1A1A1A',
  divider: '#E5E7EB',
  text: '#1A1A1A',
  border: '#E5E7EB',
  cream: '#F9FAFB',
} as const;

/**
 * Application URLs
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fineandcountryerp.com';

/**
 * Branch configurations
 */
export const BRANCHES = ['Harare', 'Bulawayo'] as const;
export type Branch = typeof BRANCHES[number];
