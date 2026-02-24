
import React from 'react';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { useReservationTimer } from '../hooks/useReservationTimer';

interface ReservationTimerProps {
  expiresAt: string | null;
  expiryDate?: string; // Legacy prop for backward compatibility
  standNumber?: string;
  developmentName?: string;
  compact?: boolean;
  timerPaused?: boolean; // NEW: Indicates payment verification in progress
  paymentStatus?: 'reserved' | 'payment_uploaded' | 'payment_verified' | 'aos_issued';
}

/**
 * ReservationTimer Component
 * 
 * Displays a real-time 72-hour countdown timer with color-coded urgency levels:
 * - Green: > 24 hours remaining (Safe)
 * - Amber: < 24 hours remaining (Expiring Soon)
 * - Red: < 6 hours remaining (Payment Urgent)
 * 
 * Persists across browser refreshes by fetching expires_at from Supabase
 */
export const ReservationTimer: React.FC<ReservationTimerProps> = ({ 
  expiresAt,
  expiryDate, // Legacy support
  standNumber, 
  developmentName,
  compact = false,
  timerPaused = false,
  paymentStatus = 'reserved'
}) => {
  // Use expiresAt or fall back to legacy expiryDate prop
  const timerDate = expiresAt || expiryDate;
  const timer = useReservationTimer(timerDate || null);

  if (!timerDate) {
    return null;
  }

  // If timer is paused (payment verification in progress)
  if (timerPaused && paymentStatus === 'payment_uploaded') {
    if (compact) {
      return (
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{ 
            backgroundColor: '#FFFBEB',
            borderColor: '#F59E0B',
            color: '#F59E0B'
          }}
        >
          <Clock size={14} className="shrink-0" />
          <span className="text-xs font-bold tracking-tight">
            TIMER PAUSED
          </span>
        </div>
      );
    }

    return (
      <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="text-amber-600 shrink-0" size={24} />
          <h3 className="font-bold text-amber-900">
            Timer Paused - Payment Verification
          </h3>
        </div>
        <p className="text-sm text-amber-800 mb-3">
          Your 72-hour countdown is on hold while our team verifies your payment proof.
          You'll receive confirmation within 24 hours.
        </p>
        <div className="bg-white rounded p-3 text-xs text-amber-700">
          <strong>Status:</strong> Payment Pending Verification<br />
          <strong>Stand:</strong> {standNumber || 'N/A'}<br />
          <strong>Paused At:</strong> {new Date().toLocaleString('en-ZW')}
        </div>
      </div>
    );
  }

  // If payment verified, show success state
  if (paymentStatus === 'payment_verified' || paymentStatus === 'aos_issued') {
    if (compact) {
      return (
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{ 
            backgroundColor: '#ECFDF5',
            borderColor: '#10B981',
            color: '#10B981'
          }}
        >
          <Clock size={14} className="shrink-0" />
          <span className="text-xs font-bold tracking-tight">
            PAID
          </span>
        </div>
      );
    }

    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Clock className="text-green-600 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-green-900">
              Payment Verified ✓
            </h3>
            <p className="text-sm text-green-700">
              Your reservation is secure. {paymentStatus === 'aos_issued' ? 'AOS issued.' : 'AOS will be issued within 24 hours.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal timer display (active countdown)
  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
        style={{ 
          backgroundColor: timer.bgColor,
          borderColor: timer.color,
          color: timer.color
        }}
      >
        <Clock size={14} className="shrink-0" />
        <span className="text-xs font-bold font-mono tracking-tight">
          {timer.timeRemaining}
        </span>
      </div>
    );
  }

  return (
    <div 
      className="p-6 rounded-2xl border-2 transition-all duration-300"
      style={{ 
        backgroundColor: timer.bgColor,
        borderColor: timer.color
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {timer.urgencyLevel === 'critical' ? (
            <div className="p-2 rounded-full" style={{ backgroundColor: timer.color + '20' }}>
              <AlertCircle size={20} style={{ color: timer.color }} />
            </div>
          ) : timer.urgencyLevel === 'warning' ? (
            <div className="p-2 rounded-full" style={{ backgroundColor: timer.color + '20' }}>
              <AlertTriangle size={20} style={{ color: timer.color }} />
            </div>
          ) : (
            <div className="p-2 rounded-full" style={{ backgroundColor: timer.color + '20' }}>
              <Clock size={20} style={{ color: timer.color }} />
            </div>
          )}
          <div>
            <h4 
              className="text-xs font-black uppercase tracking-wider font-sans"
              style={{ color: timer.color }}
            >
              {timer.label}
            </h4>
            {(standNumber || developmentName) && (
              <p className="text-[10px] text-gray-600 font-medium mt-0.5 font-sans">
                {standNumber && `Stand ${standNumber}`}
                {standNumber && developmentName && ' • '}
                {developmentName}
              </p>
            )}
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ 
            backgroundColor: timer.color + '20',
            color: timer.color
          }}
        >
          72H Window
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 font-sans">
            Time Remaining
          </span>
          {timer.isExpired ? (
            <span 
              className="text-2xl font-black font-mono tracking-tight"
              style={{ color: timer.color }}
            >
              EXPIRED
            </span>
          ) : (
            <span 
              className="text-3xl font-black font-mono tracking-tight"
              style={{ color: timer.color }}
            >
              {timer.timeRemaining}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/50 rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-1000 ease-linear rounded-full"
            style={{ 
              backgroundColor: timer.color,
              width: `${Math.min((timer.hoursRemaining / 72) * 100, 100)}%`
            }}
          />
        </div>

        {timer.urgencyLevel === 'critical' && !timer.isExpired && (
          <div 
            className="flex items-center gap-2 p-3 rounded-xl mt-3"
            style={{ backgroundColor: timer.color + '10' }}
          >
            <AlertCircle size={16} style={{ color: timer.color }} className="shrink-0" />
            <p 
              className="text-xs font-bold leading-relaxed font-sans"
              style={{ color: timer.color }}
            >
              Critical: Payment required within {Math.floor(timer.hoursRemaining)} hours to secure this reservation.
            </p>
          </div>
        )}

        {timer.urgencyLevel === 'warning' && (
          <p className="text-[10px] text-gray-600 font-medium mt-2 font-sans">
            ⚠️ Less than 24 hours remaining. Complete payment to secure your reservation.
          </p>
        )}

        {timer.isExpired && (
          <div 
            className="flex items-center gap-2 p-3 rounded-xl mt-3"
            style={{ backgroundColor: timer.color + '10' }}
          >
            <AlertCircle size={16} style={{ color: timer.color }} className="shrink-0" />
            <p 
              className="text-xs font-bold leading-relaxed font-sans"
              style={{ color: timer.color }}
            >
              This reservation has expired. The stand is now available for other clients.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: timer.color + '30' }}>
        <p className="text-[9px] text-gray-600 leading-relaxed font-sans">
          <strong>Forensic Notice:</strong> Timer syncs with server time. Expires at:{' '}
          <span className="font-mono">{new Date(timerDate).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })}</span>
        </p>
      </div>
    </div>
  );
};
