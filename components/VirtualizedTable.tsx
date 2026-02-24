/**
 * Virtualized Table Component
 * 
 * Provides virtual scrolling for long lists to improve performance.
 * Only renders visible rows, reducing DOM nodes and improving scroll performance.
 * 
 * @module components/VirtualizedTable
 */

'use client';

import React, { CSSProperties, ComponentType, ReactNode } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FixedSizeList } = require('react-window') as { 
  FixedSizeList: ComponentType<{
    height: number;
    width: string | number;
    itemCount: number;
    itemSize: number;
    overscanCount?: number;
    children: (props: { index: number; style: CSSProperties }) => ReactNode;
  }>
};

// Define the props type for list child components
interface RowProps {
  index: number;
  style: CSSProperties;
}

interface VirtualizedTableProps<T> {
  /** Array of data items to render */
  items: T[];
  /** Height of the table container */
  height: number;
  /** Height of each row */
  rowHeight: number;
  /** Function to render each row */
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  /** Optional header component */
  header?: React.ReactNode;
  /** Optional empty state component */
  emptyState?: React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * VirtualizedTable - Renders a virtualized table for long lists
 * 
 * @example
 * ```tsx
 * <VirtualizedTable
 *   items={clients}
 *   height={600}
 *   rowHeight={80}
 *   renderRow={(client, index, style) => (
 *     <div key={client.id} style={style}>
 *       <ClientRow client={client} />
 *     </div>
 *   )}
 *   header={<TableHeader />}
 *   emptyState={<EmptyState />}
 * />
 * ```
 */
export function VirtualizedTable<T>({
  items,
  height,
  rowHeight,
  renderRow,
  header,
  emptyState,
  className = ''
}: VirtualizedTableProps<T>) {
  if (items.length === 0) {
    return (
      <div className={className}>
        {header}
        {emptyState || (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <p>No items to display</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {header}
      <FixedSizeList
        height={height}
        itemCount={items.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={5} // Render 5 extra items above/below viewport for smoother scrolling
      >
        {({ index, style }: RowProps) => renderRow(items[index], index, style)}
      </FixedSizeList>
    </div>
  );
}

/**
 * VirtualizedList - Simpler version for non-table lists
 */
interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className = ''
}: VirtualizedListProps<T>) {
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 text-gray-500 ${className}`}>
        <p>No items to display</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <FixedSizeList
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        width="100%"
        overscanCount={5}
      >
        {({ index, style }: RowProps) => renderItem(items[index], index, style)}
      </FixedSizeList>
    </div>
  );
}
