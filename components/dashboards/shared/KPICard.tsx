/**
 * KPI Card Component
 * Unified KPI card component for all dashboards
 * 
 * @module components/dashboards/shared/KPICard
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { componentVariants } from '@/lib/design-system';

export type KPICardVariant = 'default' | 'gradient' | 'compact';
export type TrendDirection = 'up' | 'down' | 'neutral';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: TrendDirection;
  trendValue?: string;
  variant?: KPICardVariant;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'indigo' | 'emerald' | 'teal';
  className?: string;
}

const colorClasses = {
  blue: {
    bg: 'from-blue-50 to-blue-100/[0.5]',
    border: 'border-blue-200',
    icon: 'bg-blue-600',
    text: 'text-blue-600',
    badge: 'bg-blue-200 text-blue-700',
  },
  green: {
    bg: 'from-green-50 to-emerald-100/[0.5]',
    border: 'border-green-200',
    icon: 'bg-green-600',
    text: 'text-green-600',
    badge: 'bg-green-200 text-green-700',
  },
  amber: {
    bg: 'from-amber-50 to-amber-100/[0.5]',
    border: 'border-amber-200',
    icon: 'bg-amber-600',
    text: 'text-amber-600',
    badge: 'bg-amber-200 text-amber-700',
  },
  purple: {
    bg: 'from-purple-50 to-purple-100/[0.5]',
    border: 'border-purple-200',
    icon: 'bg-purple-600',
    text: 'text-purple-600',
    badge: 'bg-purple-200 text-purple-700',
  },
  red: {
    bg: 'from-red-50 to-red-100/[0.5]',
    border: 'border-red-200',
    icon: 'bg-red-600',
    text: 'text-red-600',
    badge: 'bg-red-200 text-red-700',
  },
  indigo: {
    bg: 'from-indigo-50 to-indigo-100/[0.5]',
    border: 'border-indigo-200',
    icon: 'bg-indigo-600',
    text: 'text-indigo-600',
    badge: 'bg-indigo-200 text-indigo-700',
  },
  emerald: {
    bg: 'from-emerald-50 to-emerald-100/[0.5]',
    border: 'border-emerald-200',
    icon: 'bg-emerald-600',
    text: 'text-emerald-600',
    badge: 'bg-emerald-200 text-emerald-700',
  },
  teal: {
    bg: 'from-teal-50 to-teal-100/[0.5]',
    border: 'border-teal-200',
    icon: 'bg-teal-600',
    text: 'text-teal-600',
    badge: 'bg-teal-200 text-teal-700',
  },
} as const;

const ALLOWED_COLORS = new Set<keyof typeof colorClasses>(['blue', 'green', 'amber', 'purple', 'red', 'indigo', 'emerald', 'teal']);
const defaultColors = colorClasses.blue;

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  color = 'blue',
  className = '',
}: KPICardProps) {
  const colorKey = (typeof color === 'string' && ALLOWED_COLORS.has(color as keyof typeof colorClasses)) ? color : 'blue';
  const colors = (colorClasses[colorKey] ?? defaultColors) || defaultColors;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  if (variant === 'gradient') {
    return (
      <div className={`bg-gradient-to-br ${colors.bg} rounded-2xl p-6 border ${colors.border} shadow-sm hover:shadow-md transition-all ${className}`}>
        <div className="flex justify-between items-start mb-4">
          {Icon && (
            <div className={`p-3 ${colors.icon} rounded-xl`}>
              <Icon className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
          )}
          {trend && trendValue && (
            <span className={`text-xs font-semibold ${colors.badge} px-3 py-1 rounded-full flex items-center gap-1`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendValue}
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm text-gray-600">{title}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`${componentVariants.kpiCard.compact} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {Icon && (
            <div className={`p-2 ${colors.icon} rounded-lg ml-4`}>
              <Icon className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
          )}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trendColor}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`${componentVariants.kpiCard.default} ${className}`}>
      <div className="flex items-start justify-between mb-4">
        {Icon && (
          <div className={`p-3 ${colors.icon} rounded-lg`}>
            <Icon className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
        )}
        {trend && trendValue && (
          <div className={`flex items-center text-sm ${trendColor}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
