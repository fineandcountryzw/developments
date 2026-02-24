import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          white: '#FFFFFF',
          light: '#F9FAFB',
          gold: '#C5A059',
          black: '#1A1A1A',
          grey: '#6B7280',
        },
        fcGold: '#C5A059',
        fcDivider: '#E5E7EB',
        fcText: '#1A1A1A',
        fcBorder: '#E5E7EB',
        // ERP Design System
        erp: {
          primary: 'var(--erp-primary)',
          'primary-foreground': 'var(--erp-primary-foreground)',
          accent: 'var(--erp-accent)',
          'accent-foreground': 'var(--erp-accent-foreground)',
          surface: 'var(--erp-surface)',
          'surface-elevated': 'var(--erp-surface-elevated)',
          border: 'var(--erp-border)',
          'border-strong': 'var(--erp-border-strong)',
          danger: 'var(--erp-danger)',
          'danger-foreground': 'var(--erp-danger-foreground)',
          success: 'var(--erp-success)',
          warning: 'var(--erp-warning)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-plus-jakarta)',
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
        mono: ['Courier New', 'monospace'],
      },
      boxShadow: {
        'forensic': '0 4px 30px rgba(0, 0, 0, 0.03)',
        'forensic-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'forensic-md': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'forensic-lg': '0 10px 40px rgba(0, 0, 0, 0.08)',
        // ERP shadows
        'erp': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'erp-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'erp-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'erp-dropdown': '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
