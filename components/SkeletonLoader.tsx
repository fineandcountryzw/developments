import React from 'react';

/**
 * SkeletonLoader Component
 * Shimmer animation effect for loading states
 * Maintains Inter Sans styling and proper spacing
 */

export const SkeletonLoader: React.FC<{ height?: string; width?: string; rounded?: boolean }> = ({ 
  height = 'h-12', 
  width = 'w-full',
  rounded = false 
}) => {
  return (
    <div className={`${width} ${height} ${rounded ? 'rounded-2xl' : 'rounded-lg'} bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer-animation" />
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-fcDivider shadow-sm space-y-4">
      <SkeletonLoader height="h-8" width="w-2/3" />
      <SkeletonLoader height="h-6" width="w-full" />
      <SkeletonLoader height="h-6" width="w-5/6" />
      <div className="flex space-x-3 pt-2">
        <SkeletonLoader height="h-10" width="w-1/3" rounded />
        <SkeletonLoader height="h-10" width="w-1/3" rounded />
      </div>
    </div>
  );
};

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader key={i} height="h-4" width={i === lines - 1 ? 'w-4/5' : 'w-full'} />
      ))}
    </div>
  );
};

export const SkeletonDiagnosticCard: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-fcDivider shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonLoader height="h-6" width="w-1/3" />
        <SkeletonLoader height="h-10" width="w-10" rounded />
      </div>
      <SkeletonLoader height="h-12" width="w-2/3" />
      <SkeletonLoader height="h-20" width="w-full" />
    </div>
  );
};
