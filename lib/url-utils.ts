/**
 * URL Utilities for Production Configuration
 * Handles canonical URLs, domain configuration, and URL generation
 * Production Domain: https://fineandcountryerp.com
 */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fineandcountryerp.com';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || `${APP_URL}/api`;
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'fineandcountryerp.com';

/**
 * Generate canonical URL for a page
 * @param path - Relative path from root (e.g., '/dashboards/manager')
 * @returns Full canonical URL
 */
export function getCanonicalUrl(path: string = ''): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${APP_URL}${normalizedPath}`;
}

/**
 * Generate API endpoint URL
 * @param endpoint - API endpoint path (e.g., '/admin/developments')
 * @returns Full API URL for external requests
 */
export function getApiUrl(endpoint: string): string {
  // For internal client-side calls, use relative paths
  // For external/server-side calls, use full URL
  return endpoint;
}

/**
 * Get full URL for static assets
 * @param assetPath - Path to asset (e.g., '/logos/logo-harare.svg')
 * @returns Full URL to asset
 */
export function getAssetUrl(assetPath: string): string {
  // Assets are served from /public directory, use relative paths
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return normalizedPath;
}

/**
 * Generate email-safe domain
 * @returns Email domain (e.g., 'fineandcountryerp.com')
 */
export function getEmailDomain(): string {
  return EMAIL_DOMAIN;
}

/**
 * Check if URL is valid and safe
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate Open Graph tags
 * @param options - Configuration for OG tags
 * @returns Object with OG tag properties
 */
export interface OpenGraphConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
}

export function generateOpenGraphTags(options: OpenGraphConfig) {
  const {
    title = 'Fine & Country Zimbabwe ERP',
    description = 'Enterprise Resource Planning for Fine & Country Zimbabwe',
    image = `${APP_URL}/og-image.png`,
    url = APP_URL,
    type = 'website',
  } = options;

  return {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:url': url,
    'og:type': type,
    'og:site_name': 'Fine & Country Zimbabwe ERP',
    'og:locale': 'en_ZW',
  };
}

/**
 * Generate Twitter Card tags
 * @param options - Configuration for Twitter tags
 * @returns Object with Twitter tag properties
 */
export interface TwitterCardConfig {
  title?: string;
  description?: string;
  image?: string;
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

export function generateTwitterTags(options: TwitterCardConfig) {
  const {
    title = 'Fine & Country Zimbabwe ERP',
    description = 'Enterprise Resource Planning for Fine & Country Zimbabwe',
    image = `${APP_URL}/twitter-image.png`,
    card = 'summary_large_image',
  } = options;

  return {
    'twitter:card': card,
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
  };
}

/**
 * Normalize internal links to use relative paths
 * @param url - URL to normalize
 * @returns Relative path if internal, full URL if external
 */
export function normalizeInternalUrl(url: string): string {
  if (!url) return '/';

  // If URL is already relative, return as is
  if (url.startsWith('/') || url.startsWith('#')) {
    return url;
  }

  // If URL is to our domain, convert to relative path
  if (url.includes(APP_URL)) {
    return url.replace(APP_URL, '');
  }

  // Otherwise return as is (external URL)
  return url;
}

/**
 * URL configuration for deployment environments
 */
export const URL_CONFIG = {
  production: {
    appUrl: 'https://fineandcountryerp.com',
    apiBaseUrl: 'https://fineandcountryerp.com/api',
    emailDomain: 'fineandcountryerp.com',
  },
  staging: {
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://staging.fineandcountryerp.com',
    apiBaseUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://staging.fineandcountryerp.com'}/api`,
    emailDomain: 'staging.fineandcountryerp.com',
  },
  development: {
    appUrl: 'http://localhost:3000',
    apiBaseUrl: 'http://localhost:3000/api',
    emailDomain: 'localhost',
  },
};

/**
 * Get URL configuration for current environment
 * @returns Current environment URL configuration
 */
export function getUrlConfig() {
  const env = (process.env.NODE_ENV || 'development') as string;
  const isDev = env === 'development' || env === 'test';

  if (env.includes('staging')) {
    return URL_CONFIG.staging;
  }

  if (isDev) {
    return URL_CONFIG.development;
  }

  return URL_CONFIG.production;
}
