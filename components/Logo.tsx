/**
 * Premium Logo Component
 * Single source of truth for logo display across the application
 * 
 * Usage:
 * <Logo variant="header" />      // Desktop header: 32-36px
 * <Logo variant="sidebar" />      // Dashboard sidebar: 28-32px
 * <Logo variant="mobile" />       // Mobile header: 24-28px
 * <Logo variant="footer" />       // Footer: 20-24px
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { useLogo } from '@/contexts/LogoContext';
import { DEFAULT_LOGO } from '@/lib/constants';

export type LogoVariant = 'header' | 'sidebar' | 'mobile' | 'footer';

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
  /** Whether logo is on dark background (for color inversion) */
  darkBackground?: boolean;
}

const LOGO_SIZES: Record<LogoVariant, { height: number; width: number; maxHeight: string }> = {
  header: { height: 36, width: 140, maxHeight: '36px' },      // Desktop header: 32-36px
  sidebar: { height: 32, width: 120, maxHeight: '32px' },     // Dashboard sidebar: 28-32px
  mobile: { height: 28, width: 100, maxHeight: '28px' },      // Mobile header: 24-28px
  footer: { height: 24, width: 80, maxHeight: '24px' },     // Footer: 20-24px
};

export const Logo: React.FC<LogoProps> = ({ 
  variant = 'header', 
  className = '',
  priority = false,
  darkBackground = false 
}) => {
  const { logoUrl } = useLogo();
  const effectiveLogo = logoUrl || DEFAULT_LOGO;
  const isDefaultLogo = effectiveLogo === DEFAULT_LOGO || effectiveLogo.startsWith('/logos/');
  
  const sizes = LOGO_SIZES[variant];
  
  // Clear space rule: minimum padding = height of logo
  const clearSpace = sizes.height;
  
  const imageStyle = isDefaultLogo && darkBackground 
    ? { filter: 'brightness(0) invert(1)' as const }
    : {};

  return (
    <div 
      className={`flex items-center shrink-0 ${className}`}
      style={{ 
        minHeight: sizes.maxHeight,
        paddingRight: `${clearSpace}px` // Clear space on right
      }}
    >
      <div 
        className="flex items-center"
        style={{
          height: sizes.maxHeight,
          width: 'auto',
          ...imageStyle
        }}
      >
        <Image
          src={effectiveLogo}
          alt="Fine & Country Zimbabwe"
          width={sizes.width}
          height={sizes.height}
          className="object-contain h-full w-auto"
          priority={priority}
          style={{
            maxHeight: sizes.maxHeight,
            height: 'auto',
            width: 'auto'
          }}
        />
      </div>
    </div>
  );
};

export default Logo;
