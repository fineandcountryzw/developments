/**
 * Status Badge Component
 * Unified status badge component for all dashboards
 * 
 * @module components/dashboards/shared/StatusBadge
 */

import React from 'react';
import { getStatusConfig, StatusType } from '@/lib/status-definitions';
import { componentVariants } from '@/lib/design-system';

interface StatusBadgeProps {
  status: string | StatusType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ 
  status, 
  size = 'md', 
  showIcon = false,
  className = '' 
}: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const sizeClasses = componentVariants.badge[size];

  return (
    <span
      className={`${sizeClasses} ${config.bg} ${config.text} ${config.border ? `border ${config.border}` : ''} ${className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
