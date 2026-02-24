/**
 * KPI Grid - Unified Layout Primitive
 * 
 * Responsive grid for summary/KPI cards.
 * Automatically adjusts columns based on screen size.
 * 
 * @module components/layouts/KPIGrid
 */

import React from 'react';
import { getKPIGridClasses } from '@/lib/responsive-framework';

interface KPIGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KPIGrid({ children, className = '' }: KPIGridProps) {
  return (
    <div className={`${getKPIGridClasses()} ${className}`}>
      {children}
    </div>
  );
}
