'use client';

import React from 'react';

/**
 * Skeleton Loaders - Comprehensive Loading State Components
 * 
 * Provides a collection of skeleton components for different UI patterns
 * to show loading states and improve perceived performance.
 * 
 * Usage:
 * <SkeletonText lines={3} />
 * <SkeletonTable rows={5} columns={4} />
 * <SkeletonCard count={3} />
 */

// ─────────────────────────────────────────────────────────────────────────────
// BASIC SKELETON PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

/**
 * Base Skeleton component - animated placeholder
 */
export function Skeleton({
  className = '',
  width = '100%',
  height = '20px',
  animate = true,
}: SkeletonProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-brand-light rounded-lg ${animate ? 'animate-pulse' : ''} ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALIZED SKELETON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Skeleton text with multiple lines
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="16px"
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for card/section headers
 */
export function SkeletonHeader({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <Skeleton height="24px" width="60%" />
      <Skeleton height="14px" width="40%" />
    </div>
  );
}

/**
 * Skeleton for avatar + text combination
 */
export function SkeletonAvatar({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeMap = {
    sm: { avatar: '32px', gap: 'gap-2' },
    md: { avatar: '48px', gap: 'gap-3' },
    lg: { avatar: '64px', gap: 'gap-4' },
  };

  const { avatar, gap } = sizeMap[size];

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <Skeleton width={avatar} height={avatar} className="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton height="16px" width="60%" />
        <Skeleton height="12px" width="40%" />
      </div>
    </div>
  );
}

/**
 * Skeleton for button placeholder
 */
export function SkeletonButton({
  variant = 'primary',
  className = '',
}: {
  variant?: 'primary' | 'secondary' | 'text';
  className?: string;
}) {
  return <Skeleton height="48px" className={`rounded-xl ${className}`} />;
}

/**
 * Skeleton for input field
 */
export function SkeletonInput({ className = '' }: { className?: string }) {
  return <Skeleton height="44px" className={`rounded-lg ${className}`} />;
}

/**
 * Skeleton for table cell
 */
export function SkeletonCell({
  width = '100%',
  className = '',
}: {
  width?: string;
  className?: string;
}) {
  return <Skeleton height="20px" width={width} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE SKELETON LAYOUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Skeleton for card component
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-gold/10 p-6 space-y-4 shadow-forensic ${className}`}>
      <SkeletonHeader />
      <div className="space-y-3">
        <SkeletonText lines={2} />
      </div>
      <SkeletonButton />
    </div>
  );
}

/**
 * Skeleton for card grid
 */
export function SkeletonCardGrid({
  count = 3,
  columns = 3,
  className = '',
}: {
  count?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns} gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for table row
 */
export function SkeletonTableRow({
  columns = 4,
  className = '',
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <SkeletonCell />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for entire table
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-gold/10 shadow-forensic overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-brand-gold/10 px-6 py-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1">
              <SkeletonCell />
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`px-6 py-4 flex gap-4 ${i !== rows - 1 ? 'border-b border-brand-gold/5' : ''}`}>
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="flex-1">
                <SkeletonCell />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard/page header
 */
export function SkeletonPageHeader({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 mb-8 ${className}`}>
      <Skeleton height="32px" width="50%" />
      <Skeleton height="16px" width="30%" />
    </div>
  );
}

/**
 * Skeleton for modal/dialog
 */
export function SkeletonModal({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-forensic-lg p-8 space-y-6 max-w-lg w-full ${className}`}>
      <SkeletonHeader />
      <div className="space-y-4">
        <SkeletonInput />
        <SkeletonInput />
        <SkeletonText lines={2} />
      </div>
      <div className="flex gap-3 pt-4">
        <Skeleton height="48px" width="40%" className="rounded-lg" />
        <Skeleton height="48px" width="60%" className="rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton for form
 */
export function SkeletonForm({
  fields = 4,
  className = '',
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton height="16px" width="30%" />
          <SkeletonInput />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
  );
}

/**
 * Skeleton for list item
 */
export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border-b border-brand-gold/10 last:border-0 ${className}`}>
      <SkeletonAvatar size="sm" />
    </div>
  );
}

/**
 * Skeleton for list
 */
export function SkeletonList({
  items = 5,
  className = '',
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-gold/10 shadow-forensic overflow-hidden ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for chart/graph
 */
export function SkeletonChart({
  height = '300px',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-gold/10 shadow-forensic p-6 ${className}`}
      style={{ height }}>
      <Skeleton height="100%" className="rounded-lg" />
    </div>
  );
}

/**
 * Skeleton for image placeholder
 */
export function SkeletonImage({
  width = '100%',
  height = '200px',
  className = '',
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      className={`rounded-xl ${className}`}
    />
  );
}

/**
 * Skeleton for breadcrumb navigation
 */
export function SkeletonBreadcrumb({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <React.Fragment key={i}>
          <Skeleton height="16px" width="60px" />
          {i < 2 && <div className="text-brand-grey">/</div>}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Skeleton for dashboard overview cards
 */
export function SkeletonDashboardCards({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-brand-gold/10 p-6 shadow-forensic space-y-3">
          <Skeleton height="14px" width="50%" />
          <Skeleton height="32px" width="80%" />
          <Skeleton height="12px" width="40%" />
        </div>
      ))}
    </div>
  );
}
