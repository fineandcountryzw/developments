/**
 * Payment Dashboard Component
 * 
 * Integrated payment interface for clients to:
 * 1. Pay via Paynow (instant verification)
 * 2. Upload Proof of Payment (manual verification)
 * 
 * Displays payment progress tracker and reservation timer.
 */

import React, { useState } from 'react';
import { CreditCard, Upload, ExternalLink, ArrowRight } from 'lucide-react';
import { initiatePaynowPayment } from '../services/paynowService';
import { triggerAdminNotification } from '../services/notificationService';
import { ProofOfPaymentUploader } from './ProofOfPaymentUploader';
import { PaymentProgressTracker } from './PaymentProgressTracker';
import { ReservationTimer } from './ReservationTimer';

interface PaymentDashboardProps {
  reservationId: string;
  standId: string;
  standNumber: string;
  developmentName: string;
  branchId: 'harare' | 'bulawayo';
  amount: number;
  pricePerSqm: number;
  standSize: number;
  clientName: string;
  clientEmail: string;
  expiresAt: string;
  currentStage: 'reserved' | 'payment_uploaded' | 'payment_verified' | 'aos_issued';
  timerPaused?: boolean;
  onPaymentSuccess?: () => void;
}

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({
  reservationId,
  standId,
  standNumber,
  developmentName,
  branchId,
  amount,
  pricePerSqm,
  standSize,
  clientName,
  clientEmail,
  expiresAt,
  currentStage,
  timerPaused = false,
  onPaymentSuccess
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'paynow' | 'manual' | null>(null);
  const [processingPaynow, setProcessingPaynow] = useState(false);

  const handlePaynowPayment = async () => {
    setProcessingPaynow(true);

    console.log('[FORENSIC][PAYNOW_PAYMENT_INITIATED]', {
      reservation_id: reservationId,
      stand_id: standId,
      stand_number: standNumber,
      amount,
      client_email: clientEmail,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await initiatePaynowPayment({
        amount,
        client_email: clientEmail,
        client_name: clientName,
        stand_id: standId,
        stand_number: standNumber,
        development_name: developmentName,
        reservation_id: reservationId
      });

      if (response.success && response.payment_url) {
        // Redirect to Paynow payment page
        console.log('[FORENSIC][PAYNOW_REDIRECT]', {
          payment_url: response.payment_url,
          reference_id: response.reference_id,
          timestamp: new Date().toISOString()
        });

        // Open Paynow in new window
        window.open(response.payment_url, '_blank');

        // Notify admin of payment attempt
        await triggerAdminNotification({
          type: 'paynow_payment_received',
          reservation_id: reservationId,
          branch_id: branchId,
          stand_number: standNumber,
          amount,
          payment_method: 'Paynow',
          client_name: clientName,
          client_email: clientEmail
        });

        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        throw new Error(response.error || 'Payment initialization failed');
      }
    } catch (error) {
      console.error('[FORENSIC][PAYNOW_ERROR]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      alert('Payment initialization failed. Please try again or upload proof of payment.');
    } finally {
      setProcessingPaynow(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Complete Your Payment
        </h1>
        <p className="text-emerald-100">
          {developmentName} - Stand {standNumber}
        </p>
        <div className="mt-4 pt-4 border-t border-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-200">
              Reservation Amount
            </p>
            <p className="text-3xl font-bold">
              ${amount.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-200 mt-1">
              {standSize}m² @ ${pricePerSqm.toFixed(2)}/m²
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-emerald-200">
              Branch
            </p>
            <p className="text-lg font-semibold">
              {branchId === 'harare' ? 'Harare' : 'Bulawayo'}
            </p>
          </div>
        </div>
      </div>

      {/* Timer */}
      {currentStage === 'reserved' && (
        <ReservationTimer
          expiresAt={expiresAt}
          standNumber={standNumber}
          developmentName={developmentName}
          compact={false}
        />
      )}

      {/* Progress Tracker */}
      <PaymentProgressTracker
        currentStage={currentStage}
        reservedAt={expiresAt}
        timerPaused={timerPaused}
      />

      {/* Payment Method Selection */}
      {currentStage === 'reserved' && !paymentMethod && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Choose Your Payment Method
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Paynow Option */}
            <button
              onClick={() => setPaymentMethod('paynow')}
              className="relative border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 rounded-lg p-6 transition-colors text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <CreditCard className="text-emerald-600" size={32} />
                <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded font-semibold">
                  INSTANT
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                Pay via Paynow
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Secure online payment. Instant verification and timer stops immediately.
              </p>
              <div className="flex items-center text-emerald-600 text-sm font-semibold group-hover:gap-2 transition-all">
                Pay Now
                <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Manual POP Option */}
            <button
              onClick={() => setPaymentMethod('manual')}
              className="relative border-2 border-gray-300 bg-white hover:bg-gray-50 rounded-lg p-6 transition-colors text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <Upload className="text-gray-600" size={32} />
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded font-semibold">
                  MANUAL
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                Upload Proof of Payment
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Paid via bank transfer, RTGS, or cash? Upload proof. Timer pauses during verification.
              </p>
              <div className="flex items-center text-gray-600 text-sm font-semibold group-hover:gap-2 transition-all">
                Upload Receipt
                <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Paynow Payment Flow */}
      {paymentMethod === 'paynow' && currentStage === 'reserved' && (
        <div className="bg-white border-2 border-emerald-500 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">
              Paynow Payment
            </h2>
            <button
              onClick={() => setPaymentMethod(null)}
              className="text-sm text-gray-600 hover:text-gray-800"            >
              Change Method
            </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-4 mb-6">
            <h3 className="font-semibold text-emerald-900 mb-2">
              What happens next:
            </h3>
            <ul className="space-y-2 text-sm text-emerald-800">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">1.</span>
                You'll be redirected to Paynow's secure payment page
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">2.</span>
                Complete payment using your preferred method (EcoCash, OneMoney, Visa, etc.)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">3.</span>
                Your reservation timer stops immediately upon successful payment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">4.</span>
                You'll receive instant confirmation and AOS documents within 24 hours
              </li>
            </ul>
          </div>

          <button
            onClick={handlePaynowPayment}
            disabled={processingPaynow}
            className={`
              w-full py-4 px-6 rounded-lg font-bold text-lg transition-colors
              flex items-center justify-center gap-3
              ${processingPaynow
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            `}
          >
            {processingPaynow ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Initializing Payment...
              </>
            ) : (
              <>
                <CreditCard size={24} />
                Proceed to Paynow - ${amount.toLocaleString()}
                <ExternalLink size={20} />
              </>
            )}
          </button>
        </div>
      )}

      {/* Manual POP Upload Flow */}
      {paymentMethod === 'manual' && currentStage === 'reserved' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Manual Payment Verification
            </h2>
            <button
              onClick={() => setPaymentMethod(null)}
              className="text-sm text-gray-600 hover:text-gray-800"            >
              Change Method
            </button>
          </div>

          <ProofOfPaymentUploader
            reservationId={reservationId}
            standId={standId}
            standNumber={standNumber}
            branchId={branchId}
            amount={amount}
            onUploadSuccess={onPaymentSuccess}
          />
        </div>
      )}

      {/* Bank Details for Manual Payment */}
      {paymentMethod === 'manual' && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Bank Details for {branchId === 'harare' ? 'Harare' : 'Bulawayo'} Branch
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-600">Bank Name:</span>
              <span className="font-semibold text-gray-900">Standard Chartered Bank</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-600">Account Name:</span>
              <span className="font-semibold text-gray-900">Fine & Country Zimbabwe Ltd</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-600">Account Number:</span>
              <span className="font-semibold text-gray-900">
                {branchId === 'harare' ? '0123456789' : '9876543210'}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-600">Branch Code:</span>
              <span className="font-semibold text-gray-900">
                {branchId === 'harare' ? 'HARARE-001' : 'BULAWAYO-002'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reference:</span>
              <span className="font-semibold text-gray-900">STAND-{standNumber}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
