/**
 * Section Header - Unified Layout Primitive
 * 
 * Provides consistent section headers with title, description, and actions.
 * 
 * @module components/layouts/SectionHeader
 */

import React from 'react';
import { getToolbarClasses } from '@/lib/responsive-framework';

interface SectionHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 ${className}`}>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        {description && (
          <p className="text-sm sm:text-base text-gray-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className={getToolbarClasses()}>
          {actions}
        </div>
      )}
    </div>
  );
}
