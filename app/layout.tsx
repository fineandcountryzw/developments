import type { Metadata } from "next";
import React from "react";
import { Plus_Jakarta_Sans } from 'next/font/google';
import "./globals.css";
import { Providers } from './providers';

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ['latin'], 
  variable: '--font-plus-jakarta',
  display: 'swap',
});
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fineandcountryerp.com';

export const metadata: Metadata = {
  title: "Fine & Country Zimbabwe - Enterprise Resource Planning",
  description: "Enterprise Resource Planning (ERP) system for Fine & Country Zimbabwe. Manage developments, agents, clients, contracts, and real estate operations with advanced analytics and automation.",
  keywords: ["ERP", "Real Estate", "Fine & Country", "Zimbabwe", "Property Management", "Development", "Contracts"],
  
  // Canonical URL for SEO - prevents duplicate content issues
  alternates: {
    canonical: appUrl,
  },
  
  // Open Graph tags for social media sharing
  openGraph: {
    type: 'website',
    url: appUrl,
    title: "Fine & Country Zimbabwe ERP",
    description: "Enterprise Resource Planning solution for Fine & Country Zimbabwe",
    siteName: "Fine & Country Zimbabwe ERP",
    locale: 'en_ZW',
  },
  
  // Twitter Card tags for Twitter sharing
  twitter: {
    card: 'summary_large_image',
    title: "Fine & Country Zimbabwe ERP",
    description: "Enterprise Resource Planning for Fine & Country Zimbabwe",
  },
  
  // Mobile and app configuration
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  
  // Robots and search engine configuration
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

// Viewport configuration for responsive design (separate export as required by Next.js 15)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#85754E" />
        
        {/* Canonical URL for this page - overridable per page */}
        <link rel="canonical" href={appUrl} />
        
        {/* Alternate versions (if supporting multiple locales in future) */}
        <link rel="alternate" hrefLang="en-ZW" href={appUrl} />
        
        {/* Security and performance headers */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Font: Plus Jakarta Sans via next/font (--font-plus-jakarta). Tailwind font-sans uses it. */}
        
        {/* Tailwind CSS is configured via PostCSS - DO NOT use CDN in production */}
        <script dangerouslySetInnerHTML={{__html: `
          // Tailwind config is handled via tailwind.config.ts and PostCSS
          if (typeof window !== 'undefined' && window.tailwind) {
            window.tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol']
                  },
                  colors: {
                    fcGold: '#C5A059',
                    fcSlate: '#1A1A1A',
                    fcDivider: '#E5E7EB',
                    fcText: '#1A1A1A',
                    fcBorder: '#E5E7EB',
                    fcCream: '#F9FAFB'
                  }
                }
              }
            };
          }
        `}} />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}