'use client';

import { LandingPage } from '@/components/pages/home/LandingPage';

/**
 * Home Page - Public Landing Page
 *
 * This is the public homepage. No authentication required.
 * Middleware protects /dashboards/* routes.
 * Users navigate to dashboards via login or "Go to Dashboard" button.
 * Logo comes from LogoContext (same source as dashboards).
 */
export default function Home() {
  return <LandingPage />;
}
