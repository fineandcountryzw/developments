/**
 * Unified Responsive Framework
 * 
 * Single source of truth for breakpoints, layout primitives, and responsive utilities.
 * All modules MUST use this framework - no custom breakpoints or layout logic.
 * 
 * @module lib/responsive-framework
 */

/**
 * Canonical Breakpoints (Single Source of Truth)
 * 
 * These breakpoints are enforced across all modules.
 * No magic pixel values should exist outside this file.
 */
export const BREAKPOINTS = {
  // Small laptop (13" - 1366px width)
  LAPTOP_SM: 1280,
  // Standard laptop (14"-15" - 1440px width)
  LAPTOP: 1440,
  // Large desktop (16"+ - 1920px+ width)
  DESKTOP: 1920,
  // Tablet landscape
  TABLET_LANDSCAPE: 1024,
  // Tablet portrait
  TABLET: 768,
  // Mobile
  MOBILE: 640,
} as const;

/**
 * Tailwind breakpoint mapping
 * These align with Tailwind's default breakpoints for consistency
 */
export const TAILWIND_BREAKPOINTS = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / Small laptop
  xl: '1280px',  // Laptop
  '2xl': '1536px', // Large desktop
} as const;

/**
 * Layout Density Modes
 * 
 * Controls spacing, font sizes, and component density based on screen size
 */
export type DensityMode = 'comfortable' | 'compact' | 'mobile';

/**
 * Get density mode based on viewport width
 */
export function getDensityMode(width: number): DensityMode {
  if (width < BREAKPOINTS.TABLET) return 'mobile';
  if (width < BREAKPOINTS.LAPTOP) return 'compact';
  return 'comfortable';
}

/**
 * Sidebar Configuration
 * 
 * Sidebar width adapts to screen size to maximize content space
 */
export const SIDEBAR_WIDTH = {
  desktop: '256px',      // w-64 - Full sidebar on large screens
  laptop: '240px',       // Slightly narrower on laptops
  tablet: '0px',         // Hidden on tablets
  mobile: '0px',         // Hidden on mobile
} as const;

/**
 * Content Container Max Widths
 * 
 * Ensures content doesn't stretch too wide on large desktops
 * while maximizing space on laptops
 */
export const CONTENT_MAX_WIDTH = {
  desktop: '1500px',     // Comfortable reading width
  laptop: '100%',        // Full width on laptops (sidebar takes space)
  tablet: '100%',
  mobile: '100%',
} as const;

/**
 * KPI Card Grid Configuration
 * 
 * Responsive grid columns for summary/KPI cards
 */
export const KPI_GRID_COLS = {
  mobile: 1,
  tablet: 2,
  laptop: 3,
  desktop: 4,
  wide: 5,
} as const;

/**
 * Table Configuration
 * 
 * Defines when to switch from table to card layout
 */
export const TABLE_BREAKPOINT = BREAKPOINTS.LAPTOP_SM; // 1280px

/**
 * Action Toolbar Configuration
 * 
 * Controls button grouping and wrapping behavior
 */
export const TOOLBAR_BREAKPOINT = BREAKPOINTS.TABLET_LANDSCAPE; // 1024px

/**
 * Typography Scale by Density
 */
export const TYPOGRAPHY = {
  comfortable: {
    h1: 'text-3xl sm:text-4xl',
    h2: 'text-2xl sm:text-3xl',
    h3: 'text-xl sm:text-2xl',
    body: 'text-base',
    small: 'text-sm',
    tiny: 'text-xs',
  },
  compact: {
    h1: 'text-2xl sm:text-3xl',
    h2: 'text-xl sm:text-2xl',
    h3: 'text-lg sm:text-xl',
    body: 'text-sm',
    small: 'text-xs',
    tiny: 'text-[10px]',
  },
  mobile: {
    h1: 'text-2xl',
    h2: 'text-xl',
    h3: 'text-lg',
    body: 'text-sm',
    small: 'text-xs',
    tiny: 'text-[10px]',
  },
} as const;

/**
 * Spacing Scale by Density
 */
export const SPACING = {
  comfortable: {
    card: 'p-6',
    section: 'p-8',
    gap: 'gap-6',
    gapSmall: 'gap-4',
  },
  compact: {
    card: 'p-4',
    section: 'p-6',
    gap: 'gap-4',
    gapSmall: 'gap-3',
  },
  mobile: {
    card: 'p-4',
    section: 'p-4',
    gap: 'gap-4',
    gapSmall: 'gap-2',
  },
} as const;

/**
 * Utility: Get responsive grid classes for KPI cards
 */
export function getKPIGridClasses(): string {
  return `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4`;
}

/**
 * Utility: Get responsive container classes
 */
export function getContainerClasses(): string {
  return `w-full max-w-full xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12`;
}

/**
 * Utility: Get responsive table wrapper classes
 * 
 * Switches to card layout below laptop breakpoint
 */
export function getTableWrapperClasses(): string {
  return `w-full min-w-0 overflow-hidden`;
}

/**
 * Utility: Get responsive action toolbar classes
 */
export function getToolbarClasses(): string {
  return `flex flex-wrap items-center gap-2 sm:gap-3 justify-end`;
}

/**
 * Utility: Check if current viewport should use table or card layout
 */
export function shouldUseCardLayout(width: number): boolean {
  return width < TABLE_BREAKPOINT;
}

/**
 * Utility: Get sidebar width class based on viewport
 */
export function getSidebarWidthClass(): string {
  return `w-64 xl:w-64 lg:w-64 hidden lg:flex`;
}

/**
 * Utility: Get main content margin/padding to account for sidebar
 */
export function getMainContentClasses(): string {
  return `lg:ml-64 flex-1 min-w-0`;
}
