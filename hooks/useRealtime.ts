/**
 * Real-time Updates Hook
 * 
 * Connects to Server-Sent Events endpoint for real-time updates.
 * Automatically reconnects on disconnect.
 * 
 * @module hooks/useRealtime
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

export type RealtimeEventType = 'payment' | 'reservation' | 'activity' | 'stand' | 'client' | 'connected' | 'ping';
export type RealtimeAction = 'created' | 'updated' | 'deleted';

export interface RealtimeEvent {
  type: RealtimeEventType;
  action?: RealtimeAction;
  payload?: any;
  connectionId?: string;
  timestamp: string;
}

interface UseRealtimeOptions {
  /** Callback when a specific event type is received */
  onEvent?: (event: RealtimeEvent) => void;
  /** Callback for payment updates */
  onPayment?: (event: RealtimeEvent) => void;
  /** Callback for reservation updates */
  onReservation?: (event: RealtimeEvent) => void;
  /** Callback for activity log updates */
  onActivity?: (event: RealtimeEvent) => void;
  /** Callback for stand updates */
  onStand?: (event: RealtimeEvent) => void;
  /** Callback for client updates */
  onClient?: (event: RealtimeEvent) => void;
  /** Enable/disable the connection */
  enabled?: boolean;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

/**
 * useRealtime - Hook for real-time updates via Server-Sent Events
 * 
 * @example
 * ```tsx
 * const { isConnected, lastEvent } = useRealtime({
 *   onPayment: (event) => {
 *     if (event.action === 'updated') {
 *       refreshPayments();
 *     }
 *   },
 *   onReservation: (event) => {
 *     updateReservation(event.payload);
 *   }
 * });
 * ```
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const { data: session } = useSession();
  const {
    onEvent,
    onPayment,
    onReservation,
    onActivity,
    onStand,
    onClient,
    enabled = true,
    autoReconnect = true,
    reconnectDelay = 3000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!enabled || !session?.user || isConnectingRef.current) return;

    isConnectingRef.current = true;
    setError(null);

    try {
      const eventSource = new EventSource('/api/realtime');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        isConnectingRef.current = false;
        logger.debug('SSE connection opened', { module: 'useRealtime' });
      };

      eventSource.onmessage = (e) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data);
          setLastEvent(event);

          // Call specific handlers
          if (event.type === 'payment' && onPayment) {
            onPayment(event);
          } else if (event.type === 'reservation' && onReservation) {
            onReservation(event);
          } else if (event.type === 'activity' && onActivity) {
            onActivity(event);
          } else if (event.type === 'stand' && onStand) {
            onStand(event);
          } else if (event.type === 'client' && onClient) {
            onClient(event);
          }

          // Call general handler
          if (onEvent) {
            onEvent(event);
          }
        } catch (err) {
          logger.error('Failed to parse SSE event', err as Error, { module: 'useRealtime', data: e.data });
        }
      };

      eventSource.onerror = (err) => {
        logger.warn('SSE connection error', { module: 'useRealtime', error: err });
        setIsConnected(false);
        isConnectingRef.current = false;

        // Close and cleanup
        eventSource.close();
        eventSourceRef.current = null;

        // Auto-reconnect if enabled
        if (autoReconnect && enabled) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          setError('Connection lost. Refresh to reconnect.');
        }
      };
    } catch (err) {
      logger.error('Failed to create SSE connection', err as Error, { module: 'useRealtime' });
      setError('Failed to connect to real-time updates');
      isConnectingRef.current = false;
    }
  }, [enabled, session, onEvent, onPayment, onReservation, onActivity, onStand, onClient, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
  }, []);

  useEffect(() => {
    if (enabled && session?.user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, session, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    error,
    connect,
    disconnect
  };
}
