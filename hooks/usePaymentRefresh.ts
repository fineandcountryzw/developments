import { useEffect, useRef } from 'react';

/**
 * Hook to manage dashboard data refresh when payments are recorded
 * Uses browser events to notify all dashboards of payment updates
 */

export type PaymentRefreshEvent = 'payment-recorded' | 'stand-reserved' | 'dashboard-refresh' | 'payment-voided';

export const usePaymentRefresh = (callback: () => Promise<void>, dependencies: any[] = []) => {
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    const handlePaymentEvent = async (event: CustomEvent<{ type: PaymentRefreshEvent }>) => {
      if (isRefreshingRef.current) return;
      
      isRefreshingRef.current = true;
      console.log('[REFRESH_HOOK] Payment event triggered:', event.detail.type);
      
      try {
        // Slight delay to ensure database write is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        await callback();
      } catch (error) {
        console.error('[REFRESH_HOOK] Refresh failed:', error);
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // Listen for payment-related events
    window.addEventListener('payment-recorded', handlePaymentEvent as unknown as EventListener);
    window.addEventListener('stand-reserved', handlePaymentEvent as unknown as EventListener);
    window.addEventListener('dashboard-refresh', handlePaymentEvent as unknown as EventListener);
    window.addEventListener('payment-voided', handlePaymentEvent as unknown as EventListener);

    return () => {
      window.removeEventListener('payment-recorded', handlePaymentEvent as unknown as EventListener);
      window.removeEventListener('stand-reserved', handlePaymentEvent as unknown as EventListener);
      window.removeEventListener('dashboard-refresh', handlePaymentEvent as unknown as EventListener);
      window.removeEventListener('payment-voided', handlePaymentEvent as unknown as EventListener);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [...dependencies, callback]);

  const triggerRefresh = (type: PaymentRefreshEvent = 'dashboard-refresh') => {
    const event = new CustomEvent(type, { detail: { type } });
    window.dispatchEvent(event);
  };

  return { triggerRefresh };
};

/**
 * Dispatch payment refresh event globally
 * Call this after recording a payment to notify all dashboards
 */
export const dispatchPaymentRefresh = (type: PaymentRefreshEvent = 'payment-recorded') => {
  console.log('[PAYMENT_REFRESH] Dispatching:', type);
  const event = new CustomEvent(type, { 
    detail: { type, timestamp: new Date().toISOString() },
    bubbles: true,
    composed: true
  });
  window.dispatchEvent(event);
};
