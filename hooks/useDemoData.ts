/**
 * React Hook for Demo Data
 * 
 * Simplifies using demo data in components
 * Automatically switches between demo and real data
 */

import { useState, useEffect } from 'react';
import { 
  isDemoMode, 
  getAllDemoData, 
  getDemoDevelopmentById,
  getDemoStandsByDevelopment,
  getDemoAvailableStandsCount,
} from '../lib/demo-data';

/**
 * Hook to get all demo data or real data based on mode
 */
export function useDemoData<T>(
  fetchRealData: () => Promise<T>,
  getDemoDataFn: () => T
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        if (isDemoMode()) {
          // Use demo data
          const demoData = getDemoDataFn();
          setData(demoData);
        } else {
          // Fetch real data
          const realData = await fetchRealData();
          setData(realData);
        }
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error, isDemo: isDemoMode() };
}

/**
 * Hook for developments
 */
export function useDevelopments() {
  return useDemoData(
    async () => {
      const response = await fetch('/api/developments');
      if (!response.ok) throw new Error('Failed to fetch developments');
      return response.json();
    },
    () => getAllDemoData().developments
  );
}

/**
 * Hook for stands by development
 */
export function useStands(developmentId?: string) {
  return useDemoData(
    async () => {
      const url = developmentId 
        ? `/api/stands?developmentId=${developmentId}`
        : '/api/stands';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch stands');
      return response.json();
    },
    () => developmentId 
      ? getDemoStandsByDevelopment(developmentId)
      : getAllDemoData().stands
  );
}

/**
 * Hook for clients
 */
export function useClients() {
  return useDemoData(
    async () => {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
    () => getAllDemoData().clients
  );
}

/**
 * Hook for profiles/users
 */
export function useProfiles() {
  return useDemoData(
    async () => {
      const response = await fetch('/api/profiles');
      if (!response.ok) throw new Error('Failed to fetch profiles');
      return response.json();
    },
    () => getAllDemoData().profiles
  );
}

/**
 * Hook for notifications
 */
export function useNotifications(recipientId?: string) {
  return useDemoData(
    async () => {
      const url = recipientId
        ? `/api/notifications?recipientId=${recipientId}`
        : '/api/notifications';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    () => {
      const allNotifs = getAllDemoData().notifications;
      return recipientId
        ? allNotifs.filter(n => n.recipientId === recipientId)
        : allNotifs;
    }
  );
}

/**
 * Hook for single development by ID
 */
export function useDevelopment(id: string) {
  return useDemoData(
    async () => {
      const response = await fetch(`/api/developments/${id}`);
      if (!response.ok) throw new Error('Failed to fetch development');
      return response.json();
    },
    () => getDemoDevelopmentById(id)
  );
}

/**
 * Example usage in a component:
 * 
 * ```tsx
 * import { useDevelopments } from '../hooks/useDemoData';
 * 
 * export function DevelopmentList() {
 *   const { data: developments, loading, error, isDemo } = useDevelopments();
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       {isDemo && <span className="badge">Demo Data</span>}
 *       {developments?.map(dev => (
 *         <DevelopmentCard key={dev.id} development={dev} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
