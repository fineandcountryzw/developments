/**
 * Page Container - Unified Layout Primitive
 * 
 * Provides consistent page structure with proper spacing and max-widths.
 * All pages MUST use this component instead of custom containers.
 * 
 * @module components/layouts/PageContainer
 */

import React from 'react';
import { getContainerClasses } from '@/lib/responsive-framework';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Override default container classes */
  noMaxWidth?: boolean;
}

export function PageContainer({ children, className = '', noMaxWidth = false }: PageContainerProps) {
  const containerClasses = noMaxWidth 
    ? 'w-full px-4 sm:px-6 lg:px-8 xl:px-12'
    : getContainerClasses();
  
  return (
    <div className={`${containerClasses} ${className}`}>
      {children}
    </div>
  );
}
