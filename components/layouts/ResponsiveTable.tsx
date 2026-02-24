/**
 * Responsive Table - Unified Layout Primitive
 * 
 * Automatically switches between table and card layout based on screen size.
 * Prevents horizontal scrolling on all devices.
 * 
 * @module components/layouts/ResponsiveTable
 */

'use client';

import React, { useState, useEffect } from 'react';
import { shouldUseCardLayout, getTableWrapperClasses } from '@/lib/responsive-framework';

interface ResponsiveTableProps {
  /** Table headers */
  headers: Array<{ key: string; label: string; priority?: 'high' | 'medium' | 'low' }>;
  /** Table rows */
  rows: Array<Record<string, React.ReactNode>>;
  /** Render function for card layout (mobile/tablet) */
  renderCard?: (row: Record<string, React.ReactNode>, index: number) => React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Empty state */
  emptyMessage?: string;
  className?: string;
}

export function ResponsiveTable({
  headers,
  rows,
  renderCard,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: ResponsiveTableProps) {
  const [useCardLayout, setUseCardLayout] = useState(false);

  useEffect(() => {
    const checkLayout = () => {
      setUseCardLayout(shouldUseCardLayout(window.innerWidth));
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fcGold"></div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Card layout for mobile/tablet
  if (useCardLayout && renderCard) {
    return (
      <div className={`space-y-4 ${className}`}>
        {rows.map((row, index) => (
          <div key={index}>
            {renderCard(row, index)}
          </div>
        ))}
      </div>
    );
  }

  // Table layout for desktop
  return (
    <div className={getTableWrapperClasses()}>
      <div className="w-full min-w-0 overflow-hidden -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
            <thead className="bg-gray-50">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                  {headers.map((header) => (
                    <td
                      key={header.key}
                      className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                    >
                      {row[header.key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
