/**
 * Premium Design System Constants
 * Strict spacing, typography, and component standards
 */

// Spacing Scale (4pt base unit)
export const SPACING = {
  xs: '4px',   // 0.25rem - p-1
  sm: '8px',   // 0.5rem  - p-2
  md: '12px',  // 0.75rem - p-3
  base: '16px', // 1rem   - p-4
  lg: '24px',   // 1.5rem - p-6
  xl: '32px',   // 2rem   - p-8
  '2xl': '48px', // 3rem  - p-12
} as const;

// Border Radius
export const RADIUS = {
  sm: '8px',    // rounded-lg
  md: '12px',   // rounded-xl
  lg: '16px',   // rounded-2xl
  full: '9999px', // rounded-full
} as const;

// Typography Scale
export const TYPOGRAPHY = {
  h1: {
    fontSize: '40px',      // text-4xl
    lineHeight: '1.2',     // leading-tight
    fontWeight: '600',     // font-semibold
  },
  h2: {
    fontSize: '32px',      // text-3xl
    lineHeight: '1.25',   // leading-tight
    fontWeight: '600',    // font-semibold
  },
  h3: {
    fontSize: '22px',      // text-xl
    lineHeight: '1.3',    // leading-snug
    fontWeight: '600',    // font-semibold
  },
  body: {
    fontSize: '16px',      // text-base
    lineHeight: '1.6',    // leading-relaxed
    fontWeight: '400',    // font-normal
  },
  caption: {
    fontSize: '13px',     // text-sm
    lineHeight: '1.5',    // leading-normal
    fontWeight: '500',    // font-medium
  },
  small: {
    fontSize: '12px',     // text-xs
    lineHeight: '1.5',    // leading-normal
    fontWeight: '500',    // font-medium
  },
} as const;

// Shadows (single elevation system)
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',           // shadow-sm
  md: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)', // shadow
  lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', // shadow-lg
} as const;

// Transitions
export const TRANSITIONS = {
  fast: '150ms ease-out',
  base: '200ms ease-out',
  slow: '300ms ease-out',
} as const;

// Component Standards
export const COMPONENTS = {
  card: {
    padding: SPACING.lg,      // p-6
    borderRadius: RADIUS.lg,  // rounded-2xl
    shadow: SHADOWS.sm,        // shadow-sm
  },
  input: {
    padding: `${SPACING.md} ${SPACING.base}`, // py-3 px-4
    borderRadius: RADIUS.md,   // rounded-xl
    minHeight: '44px',         // Touch target
  },
  button: {
    padding: `${SPACING.base} ${SPACING.xl}`, // py-4 px-8
    borderRadius: RADIUS.md,   // rounded-xl
    minHeight: '44px',         // Touch target
    transition: TRANSITIONS.base,
  },
} as const;

// Color Usage Rules
export const COLORS = {
  // Use only for:
  primary: 'fcGold',      // Primary actions
  status: {
    success: 'green-600',
    warning: 'amber-600',
    error: 'red-600',
    info: 'blue-600',
  },
  // Backgrounds
  background: {
    default: 'white',
    subtle: 'gray-50',
    muted: 'gray-100',
  },
  // Text
  text: {
    primary: 'fcSlate',
    secondary: 'gray-600',
    tertiary: 'gray-500',
  },
} as const;

// Component Variants (for shared components)
export const componentVariants = {
  kpiCard: {
    default: 'bg-white rounded-2xl p-6 border border-gray-200 shadow-sm',
    compact: 'bg-white rounded-xl p-4 border border-gray-200',
    gradient: 'bg-gradient-to-br from-fcGold/10 to-fcSlate/10 rounded-2xl p-6 border border-fcGold/20',
  },
  badge: {
    sm: 'px-2 py-0.5 text-xs rounded-full',
    md: 'px-3 py-1 text-sm rounded-full',
    lg: 'px-4 py-1.5 text-base rounded-full',
  },
} as const;
