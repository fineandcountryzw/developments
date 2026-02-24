import { useState, useEffect } from 'react';

interface TimerStatus {
  timeRemaining: string;
  hoursRemaining: number;
  isExpired: boolean;
  urgencyLevel: 'safe' | 'warning' | 'critical';
  color: string;
  bgColor: string;
  label: string;
}

/**
 * Custom hook for 72-hour reservation countdown timer
 * 
 * @param expiresAt - ISO timestamp from reservations.expires_at column
 * @returns TimerStatus object with real-time countdown and visual feedback
 * 
 * Color Coding:
 * - Green (safe): > 24 hours remaining
 * - Amber (warning): < 24 hours remaining
 * - Red (critical): < 6 hours remaining with "Payment Urgent" label
 */
export const useReservationTimer = (expiresAt: string | null): TimerStatus => {
  const [status, setStatus] = useState<TimerStatus>({
    timeRemaining: '00h 00m 00s',
    hoursRemaining: 0,
    isExpired: false,
    urgencyLevel: 'safe',
    color: '#10B981', // Green
    bgColor: '#ECFDF5', // Green background
    label: 'Active'
  });

  useEffect(() => {
    if (!expiresAt) {
      setStatus({
        timeRemaining: 'No expiry set',
        hoursRemaining: 0,
        isExpired: true,
        urgencyLevel: 'safe',
        color: '#6B7280',
        bgColor: '#F9FAFB',
        label: 'No Timer'
      });
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      // Forensic logging for timer state
      console.log('[FORENSIC][RESERVATION_TIMER]', {
        expires_at: expiresAt,
        current_time: new Date().toISOString(),
        milliseconds_remaining: diff,
        timestamp: new Date().toISOString()
      });

      if (diff <= 0) {
        setStatus({
          timeRemaining: 'EXPIRED',
          hoursRemaining: 0,
          isExpired: true,
          urgencyLevel: 'critical',
          color: '#DC2626', // Red
          bgColor: '#FEF2F2', // Red background
          label: 'Expired'
        });
        return;
      }

      // Calculate time components
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format display string
      const timeRemaining = `${hours}h ${minutes}m ${seconds}s`;

      // Determine urgency level and visual feedback
      let urgencyLevel: 'safe' | 'warning' | 'critical' = 'safe';
      let color = '#10B981'; // Green
      let bgColor = '#ECFDF5'; // Green background
      let label = 'Active';

      if (hours < 6) {
        // Critical: Less than 6 hours
        urgencyLevel = 'critical';
        color = '#DC2626'; // Red
        bgColor = '#FEF2F2'; // Red background
        label = 'Payment Urgent';
      } else if (hours < 24) {
        // Warning: Less than 24 hours
        urgencyLevel = 'warning';
        color = '#F59E0B'; // Amber
        bgColor = '#FFFBEB'; // Amber background
        label = 'Expiring Soon';
      }

      setStatus({
        timeRemaining,
        hoursRemaining: hours + (minutes / 60),
        isExpired: false,
        urgencyLevel,
        color,
        bgColor,
        label
      });
    };

    // Initial calculation
    calculateTimeRemaining();

    // Update every second for real-time countdown
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return status;
};
