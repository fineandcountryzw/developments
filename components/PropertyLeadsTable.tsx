/**
 * Property Leads Table Component
 * 
 * Professional table displaying pending reservations with payment verification.
 * Designed for admin dashboard to track 72-hour reservation window.
 * 
 * Features:
 * - Stand number with development context
 * - Client email from Neon Auth users
 * - Live countdown timer (time remaining)
 * - Payment status with attachment verification
 * - Gold-themed "View Attachment" button
 * - Side-panel drawer for document preview
 * - Payment verification action with email confirmation
 */

'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, FileText, Clock, CheckCircle2, AlertCircle, X, Check } from 'lucide-react';
import type { PendingReservationWithDetails } from '@/app/actions/reservations';
import { verifyPayment } from '@/app/actions/verify-payment';
import { SkeletonTable } from './Skeleton';
import AttachmentViewer from './AttachmentViewer';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PropertyLeadsTableProps {
  reservations: PendingReservationWithDetails[];
  onRefresh?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Time Remaining
 * 
 * Returns human-readable time remaining until expiry.
 * Updates every second for live countdown.
 */
function getTimeRemaining(expiresAt: Date): {
  total: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string;
} {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const total = expiry - now;

  if (total <= 0) {
    return {
      total: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      formatted: 'Expired',
    };
  }

  const hours = Math.floor(total / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return {
    total,
    hours,
    minutes,
    seconds,
    isExpired: false,
    formatted: `${hours}h ${minutes}m ${seconds}s`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Time Remaining Cell
 * 
 * Live countdown timer with color-coded urgency.
 */
function TimeRemainingCell({ expiresAt }: { expiresAt: Date }) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(expiresAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeRemaining.isExpired) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle size={16} />
        <span className="text-sm font-bold">Expired</span>
      </div>
    );
  }

  // Color-coded urgency: Red < 6h, Amber < 24h, Green >= 24h
  const urgencyColor =
    timeRemaining.hours < 6 ? 'text-red-600' :
      timeRemaining.hours < 24 ? 'text-amber-600' :
        'text-green-600';

  return (
    <div className={`flex items-center gap-2 ${urgencyColor}`}>
      <Clock size={16} />
      <span className="text-sm font-mono font-bold">{timeRemaining.formatted}</span>
    </div>
  );
}

/**
 * Payment Status Cell
 * 
 * Shows attachment status with visual indicator.
 */
function PaymentStatusCell({ hasAttachment }: { hasAttachment: boolean }) {
  if (hasAttachment) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 size={16} />
        <span className="text-sm font-semibold">Attached</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-amber-600">
      <AlertCircle size={16} />
      <span className="text-sm font-semibold">Pending</span>
    </div>
  );
}

/**
 * Attachment Drawer
 * 
 * Side-panel for viewing uploaded documents without leaving the page.
 */
function AttachmentDrawer({
  isOpen,
  onClose,
  attachmentUrl,
  clientEmail
}: {
  isOpen: boolean;
  onClose: () => void;
  attachmentUrl: string;
  clientEmail: string;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl z-[1001] animate-in slide-in-from-right duration-300">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-bold text-fcSlate uppercase tracking-wider">
                Payment Proof
              </h3>
              <p className="text-sm text-gray-600 mt-1">{clientEmail}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <iframe
              src={attachmentUrl}
              className="w-full h-full border-0"
              title="Payment Proof"
            />
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-semibold text-fcGold hover:text-fcSlate transition-colors"
              >
                <ExternalLink size={16} />
                Open in New Tab
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PropertyLeadsTable({ reservations, onRefresh }: PropertyLeadsTableProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<{
    url: string;
    email: string;
    reservationId: string;
  } | null>(null);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleViewAttachment = (popUrl: string, clientEmail: string, reservationId: string) => {
    setSelectedAttachment({ url: popUrl, email: clientEmail, reservationId });
  };

  const handleCloseDrawer = () => {
    setSelectedAttachment(null);
  };

  const handleVerifyPayment = async (reservationId: string) => {
    setVerifyingId(reservationId);

    try {
      console.log('[PROPERTY_LEADS_TABLE][VERIFY_START]', { reservationId });

      const result = await verifyPayment({ reservationId });

      if (result.success) {
        setToast({
          message: `Payment verified! Confirmation email sent to ${result.data?.clientEmail}`,
          type: 'success',
        });

        // Close drawer if open
        if (selectedAttachment?.reservationId === reservationId) {
          setSelectedAttachment(null);
        }

        // Refresh table
        if (onRefresh) {
          setTimeout(onRefresh, 1500);
        }
      } else {
        setToast({
          message: result.error || 'Failed to verify payment',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[PROPERTY_LEADS_TABLE][VERIFY_ERROR]', error);
      setToast({
        message: 'An unexpected error occurred',
        type: 'error',
      });
    } finally {
      setVerifyingId(null);

      // Auto-hide toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
    }
  };

  if (isLoading) {
    return <SkeletonTable rows={5} columns={5} />;
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-fcDivider p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-fcGold/10 rounded-full mb-4">
          <FileText size={32} className="text-fcGold" />
        </div>
        <h3 className="text-lg font-bold text-fcSlate mb-2">No Pending Reservations</h3>
        <p className="text-sm text-gray-600">
          All reservations have been processed or expired.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border-2 border-brand-gold/10 shadow-forensic overflow-hidden">
        {/* Table Header */}
        <div className="bg-brand-black text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} />
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider">Property Leads</h2>
              <p className="text-xs text-brand-gold/80 uppercase tracking-widest mt-0.5">
                72-Hour Reservation Window
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black">{reservations.length}</div>
            <div className="text-[10px] text-gray-300 uppercase tracking-widest">Pending</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-fcDivider">
                <th className="px-6 py-4 text-left">
                  <span className="text-xs font-black text-fcGold uppercase tracking-widest">
                    Stand #
                  </span>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-xs font-black text-fcGold uppercase tracking-widest">
                    Client Email
                  </span>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-xs font-black text-fcGold uppercase tracking-widest">
                    Time Remaining
                  </span>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-xs font-black text-fcGold uppercase tracking-widest">
                    Payment Status
                  </span>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-xs font-black text-fcGold uppercase tracking-widest">
                    Action
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr
                  key={reservation.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {/* Stand # */}
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-bold text-fcSlate">
                        {reservation.stand.standNumber}
                      </div>
                      <div className="text-xs text-gray-600">
                        {reservation.stand.development.name}
                      </div>
                    </div>
                  </td>

                  {/* Client Email */}
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {reservation.user?.email || 'No email'}
                    </div>
                  </td>

                  {/* Time Remaining */}
                  <td className="px-6 py-4">
                    <TimeRemainingCell expiresAt={reservation.expiresAt} />
                  </td>

                  {/* Payment Status */}
                  <td className="px-6 py-4">
                    <PaymentStatusCell hasAttachment={reservation.hasAttachment} />
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {reservation.popUrl ? (
                        <>
                          <button
                            onClick={() => handleViewAttachment(
                              reservation.popUrl!,
                              reservation.user?.email || 'Unknown',
                              reservation.id
                            )}
                            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-fcGold text-fcGold hover:bg-fcGold hover:text-white font-semibold rounded-lg transition-all"
                          >
                            <FileText size={16} />
                            <span className="text-sm">View</span>
                          </button>

                          <button
                            onClick={() => handleVerifyPayment(reservation.id)}
                            disabled={verifyingId === reservation.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
                          >
                            {verifyingId === reservation.id ? (
                              <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                <span className="text-sm">Verifying...</span>
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                <span className="text-sm">Verify</span>
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">No attachment</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-fcDivider">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing <span className="font-bold text-fcSlate">{reservations.length}</span> pending reservation{reservations.length !== 1 ? 's' : ''}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 bg-white border border-gray-300 hover:border-fcGold text-gray-700 hover:text-fcGold font-semibold rounded transition-colors"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl border-2 flex items-center gap-3 min-w-[300px] ${toast.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-900'
                : 'bg-red-50 border-red-500 text-red-900'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            )}
            <p className="text-sm font-semibold">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-gray-500 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Attachment Viewer Modal */}
      {selectedAttachment && (
        <AttachmentViewer
          url={selectedAttachment.url}
          onClose={handleCloseDrawer}
        />
      )}

      {/* Legacy Drawer (kept for backward compatibility) */}
      <AttachmentDrawer
        isOpen={false}
        onClose={() => { }}
        attachmentUrl=""
        clientEmail=""
      />
    </>
  );
}
