/**
 * useDebounce Hook
 * 
 * Delays updating a value until after a specified delay period.
 * Useful for search inputs to prevent excessive API calls.
 * 
 * Usage:
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     fetchData(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 */

import { useState, useEffect } from 'react';

/**
 * Debounce a value
 * 
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
