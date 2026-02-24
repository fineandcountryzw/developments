/**
 * Type definitions for LandingPage components
 */

export interface LandingPageProps {
  /** Logo comes from useLogo() everywhere – same source as dashboards, login, sidebar. */
  logoUrl?: string;
}

export interface ImageGalleryProps {
  images: string[];
  developmentName: string;
}
