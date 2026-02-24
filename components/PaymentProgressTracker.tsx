/**
 * Payment Progress Tracker
 * 
 * Visual progress indicator showing client's journey from reservation to AOS issuance.
 * Uses Inter Sans typography with color-coded stages.
 */

import React from 'react';
import { CheckCircle, Clock, FileText, Shield, AlertCircle } from 'lucide-react';

type PaymentStage = 
  | 'reserved'
  | 'payment_uploaded'
  | 'payment_verified'
  | 'aos_issued'
  | 'expired';

interface PaymentProgressTrackerProps {
  currentStage: PaymentStage;
  reservedAt?: string;
  paymentUploadedAt?: string;
  paymentVerifiedAt?: string;
  aosIssuedAt?: string;
  timerPaused?: boolean;
}

interface Stage {
  key: PaymentStage;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export const PaymentProgressTracker: React.FC<PaymentProgressTrackerProps> = ({
  currentStage,
  reservedAt,
  paymentUploadedAt,
  paymentVerifiedAt,
  aosIssuedAt,
  timerPaused = false
}) => {
  const stages: Stage[] = [
    {
      key: 'reserved',
      label: 'Reserved',
      icon: <Clock size={20} />,
      description: timerPaused ? 'Timer Paused' : '72-hour timer active'
    },
    {
      key: 'payment_uploaded',
      label: 'Payment Uploaded',
      icon: <FileText size={20} />,
      description: 'Awaiting verification'
    },
    {
      key: 'payment_verified',
      label: 'Payment Verified',
      icon: <CheckCircle size={20} />,
      description: 'Funds confirmed'
    },
    {
      key: 'aos_issued',
      label: 'AOS Issued',
      icon: <Shield size={20} />,
      description: 'Agreement of Sale ready'
    }
  ];

  const getStageIndex = (stage: PaymentStage): number => {
    return stages.findIndex(s => s.key === stage);
  };

  const currentIndex = getStageIndex(currentStage);

  const getStageStatus = (stageIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (currentStage === 'expired') return 'upcoming';
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStageColor = (status: 'completed' | 'current' | 'upcoming'): string => {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'current') return timerPaused ? 'bg-amber-500' : 'bg-emerald-600';
    return 'bg-gray-300';
  };

  const getTextColor = (status: 'completed' | 'current' | 'upcoming'): string => {
    if (status === 'completed') return 'text-green-700';
    if (status === 'current') return timerPaused ? 'text-amber-700' : 'text-emerald-700';
    return 'text-gray-500';
  };

  const getTimestamp = (stageKey: PaymentStage): string | undefined => {
    switch (stageKey) {
      case 'reserved': return reservedAt;
      case 'payment_uploaded': return paymentUploadedAt;
      case 'payment_verified': return paymentVerifiedAt;
      case 'aos_issued': return aosIssuedAt;
      default: return undefined;
    }
  };

  if (currentStage === 'expired') {
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="text-red-600 shrink-0" size={28} />
          <h3 className="font-bold text-red-900">
            Reservation Expired
          </h3>
        </div>
        <p className="text-sm text-red-700">
          The 72-hour payment window has closed. This stand is now available for others to reserve.
          Please contact our sales team if you'd like to re-reserve.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-1">
          Payment Progress
        </h3>
        <p className="text-sm text-gray-600">
          Track your journey from reservation to Agreement of Sale
        </p>
      </div>

      {/* Desktop Progress Bar */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200" />
          
          {/* Stages */}
          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const status = getStageStatus(index);
              const timestamp = getTimestamp(stage.key);
              
              return (
                <div key={stage.key} className="flex flex-col items-center" style={{ width: '25%' }}>
                  {/* Circle Icon */}
                  <div
                    className={`
                      relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                      transition-colors duration-300
                      ${getStageColor(status)}
                      ${status === 'current' ? 'ring-4 ring-opacity-30 ring-emerald-300' : ''}
                    `}
                  >
                    <div className="text-white">
                      {status === 'completed' ? <CheckCircle size={20} /> : stage.icon}
                    </div>
                  </div>

                  {/* Label */}
                  <div className="mt-3 text-center">
                    <p
                      className={`text-sm font-semibold ${getTextColor(status)}`}
                    >
                      {stage.label}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                    >
                      {stage.description}
                    </p>
                    {timestamp && (
                      <p
                        className="text-xs text-gray-400 mt-1"
                      >
                        {new Date(timestamp).toLocaleDateString('en-ZW', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Progress List */}
      <div className="md:hidden space-y-4">
        {stages.map((stage, index) => {
          const status = getStageStatus(index);
          const timestamp = getTimestamp(stage.key);
          
          return (
            <div key={stage.key} className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={`
                  shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${getStageColor(status)}
                  ${status === 'current' ? 'ring-4 ring-opacity-30 ring-emerald-300' : ''}
                `}
              >
                <div className="text-white">
                  {status === 'completed' ? <CheckCircle size={20} /> : stage.icon}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <p
                  className={`text-sm font-semibold ${getTextColor(status)}`}
                >
                  {stage.label}
                </p>
                <p
                  className="text-xs text-gray-500"
                >
                  {stage.description}
                </p>
                {timestamp && (
                  <p
                    className="text-xs text-gray-400 mt-1"
                  >
                    {new Date(timestamp).toLocaleDateString('en-ZW', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>

              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className="absolute left-5 w-0.5 h-12 bg-gray-200" style={{ marginTop: '40px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Timer Paused Badge */}
      {timerPaused && currentStage !== 'payment_verified' && (
        <div className="mt-6 bg-amber-50 border border-amber-300 rounded p-3 flex items-center gap-2">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            <strong>Timer Paused:</strong> Your 72-hour countdown is on hold while we verify your payment.
          </p>
        </div>
      )}
    </div>
  );
};
