'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, AlertCircle, CheckCircle2, FileText, Upload, Shield, MapPin, Eye, EyeOff, Lock, Download, ShieldCheck, Loader2 } from 'lucide-react';
import { UploadButton } from '@uploadthing/react';
import { Agent } from '../types.ts';
import type { OurFileRouter } from '../app/api/uploadthing/core';
import { logger } from '@/lib/logger';
import { FeeCalculator, type FeeBreakdown } from '@/lib/feeCalculator';

interface ReservationFlowModalProps {
  selectedStand: {
    id: string;
    number: string;
    price_usd: number;
    price_per_sqm?: number;
    area_sqm?: number;
    developmentName?: string;
    developmentId?: string; // ADD: Development ID for fetching terms
  };
  agents?: Agent[];
  onConfirm: (standId: string, data: any) => void;
  onClose: () => void;
  reservationData?: {
    id?: string;
    reservationId?: string;
    standNumber?: string;
    developmentName?: string;
    developmentLocation?: string;
    status?: string;
    createdAt?: string;
    expiresAt?: string;
    termsPdfUrl?: string | null;
    refundPdfUrl?: string | null;
    finalPriceAtReservation?: number | null;
  };
}

interface Development {
  id: string;
  name: string;
  depositPercentage: number;
  installmentPeriods: number[];
  payment_terms_url?: string;
  refund_policy_url?: string;
}

type Step = 'advisory' | 'attribution' | 'kyc' | 'fees' | 'acceptance' | 'success' | 'password-setup';

export const ReservationFlowModal: React.FC<ReservationFlowModalProps> = ({
  selectedStand,
  agents = [],
  onConfirm,
  onClose,
  reservationData
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('advisory');
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [development, setDevelopment] = useState<Development | null>(null);
  const [developmentLoading, setDevelopmentLoading] = useState(false);

  // Step 1: Advisory - no state needed, just acknowledge
  const [advisoryAccepted, setAdvisoryAccepted] = useState(false);

  // Step 2: Attribution
  const [attributionType, setAttributionType] = useState<'self' | 'agent'>('self');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState('');

  // Step 3: KYC
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Step 4: Fees Breakdown
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);

  // Step 5: Legal Acceptance
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [insuranceInterest, setInsuranceInterest] = useState(false);

  // Step 6: Success
  const [digitalRef, setDigitalRef] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(72 * 60 * 60); // 72 hours in seconds

  // Step 7: Password Setup (after account creation)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const [accountCreationError, setAccountCreationError] = useState('');

  // Portal mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Set success step if reservationData is provided
  useEffect(() => {
    if (reservationData?.id || reservationData?.reservationId) {
      setCurrentStep('success');
      if (reservationData.id) setDigitalRef(reservationData.id.split('-').pop() || reservationData.id);
    }
  }, [reservationData]);

  // Fetch development data for terms
  useEffect(() => {
    const fetchDevelopment = async () => {
      if (selectedStand.developmentId) {
        setDevelopmentLoading(true);
        try {
          const response = await fetch(`/api/admin/developments?id=${selectedStand.developmentId}`);
          if (response.ok) {
            const data = await response.json();
            const dev = data.data?.[0];
            if (dev) {
              setDevelopment({
                id: dev.id,
                name: dev.name,
                depositPercentage: Number(dev.depositPercentage) || 30,
                installmentPeriods: Array.isArray(dev.installmentPeriods)
                  ? dev.installmentPeriods
                  : [12, 24, 48],
                payment_terms_url: dev.payment_terms_url,
                refund_policy_url: dev.refund_policy_url,
              });

              // Calculate fees immediately after fetching development data
              if (selectedStand.price_usd) {
                try {
                  const fees = FeeCalculator.calculateStandFees(
                    selectedStand.price_usd,
                    {
                      vatPercentage: Number(dev.vat_percentage) || 15.5,
                      vatEnabled: dev.vat_enabled !== false,
                      aosEnabled: !!dev.aos_enabled,
                      aosFee: Number(dev.aos_fee) || null,
                      endowmentEnabled: !!dev.endowment_enabled,
                      endowmentFee: Number(dev.endowment_fee) || null,
                      cessionsEnabled: !!dev.cessions_enabled,
                      cessionFee: Number(dev.cession_fee) || null,
                      adminFeeEnabled: dev.admin_fee_enabled === true,
                      adminFee: Number(dev.admin_fee) || null,
                      depositPercentage: Number(dev.deposit_percentage) || 30,
                      installmentPeriods: dev.installment_periods,
                      commissionModel: dev.commission_model || null,
                    }
                  );
                  setFeeBreakdown(fees);
                  logger.info('Fee breakdown calculated', { module: 'ReservationFlowModal', action: 'CALCULATE_FEES', totalAmount: fees.totalAmount });
                } catch (feeError) {
                  logger.error('Failed to calculate fees on load', feeError as Error, { module: 'ReservationFlowModal', action: 'CALCULATE_FEES' });
                  // Fallback to basic calculation
                  const fallbackFees = FeeCalculator.calculateStandFees(
                    selectedStand.price_usd,
                    {
                      vatPercentage: 15.5,
                      vatEnabled: true,
                      aosEnabled: false,
                      aosFee: null,
                      endowmentEnabled: false,
                      endowmentFee: null,
                      cessionsEnabled: false,
                      cessionFee: null,
                      adminFeeEnabled: false,
                      adminFee: null,
                      depositPercentage: Number(dev.deposit_percentage) || 30,
                      installmentPeriods: null,
                      commissionModel: null,
                    }
                  );
                  setFeeBreakdown(fallbackFees);
                }
              }
            }
          }
        } catch (error) {
          logger.error('Failed to fetch development', error as Error, { module: 'ReservationFlowModal', action: 'FETCH_DEVELOPMENT', developmentId: selectedStand.developmentId });
        } finally {
          setDevelopmentLoading(false);
        }
      }
    };
    fetchDevelopment();
  }, [selectedStand.developmentId, selectedStand.price_usd]);

  // Countdown timer for success screen
  useEffect(() => {
    if (currentStep === 'success' && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [currentStep, timeRemaining]);

  // Filter agents
  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(agentSearch.toLowerCase())
  );

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h remaining`;
    }
    return `${hours}h remaining`;
  };

  // Generate digital reference
  const generateDigitalRef = () => {
    const ref = `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90000) + 10000}`;
    return ref;
  };

  // Step navigation
  const handleAdvisoryNext = () => {
    if (!advisoryAccepted) {
      alert('Please acknowledge the legal requirements to proceed');
      return;
    }
    setCurrentStep('attribution');
  };

  const handleAttributionNext = () => {
    if (attributionType === 'agent' && !selectedAgent) {
      alert('Please select an agent');
      return;
    }
    setCurrentStep('kyc');
  };

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleKycNext = async () => {
    const errors: Record<string, string> = {};

    if (!fullName || fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full legal name';
    }
    if (!email) {
      errors.email = 'Email address is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address';
      }
    }
    if (!idNumber || idNumber.trim().length < 5) {
      errors.idNumber = 'Please enter a valid identity number';
    }
    if (!contactPhone || contactPhone.trim().length < 7) {
      errors.contactPhone = 'Please enter a valid phone number (at least 7 characters)';
    }
    if (!idDocumentUrl) {
      errors.idDocument = 'Please upload your identity document';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    // Calculate fee breakdown before proceeding
    if (development && selectedStand.price_usd) {
      try {
        // Fetch full development details for accurate fee calculation
        const devResponse = await fetch(`/api/admin/developments?id=${selectedStand.developmentId}`);
        if (devResponse.ok) {
          const devData = await devResponse.json();
          const dev = devData.data?.[0];
          if (dev) {
            const fees = FeeCalculator.calculateStandFees(
              selectedStand.price_usd,
              {
                vatPercentage: Number(dev.vat_percentage) || 15.5,
                vatEnabled: dev.vat_enabled !== false,
                aosEnabled: !!dev.aos_enabled,
                aosFee: Number(dev.aos_fee) || null,
                endowmentEnabled: !!dev.endowment_enabled,
                endowmentFee: Number(dev.endowment_fee) || null,
                cessionsEnabled: !!dev.cessions_enabled,
                cessionFee: Number(dev.cession_fee) || null,
                adminFeeEnabled: dev.admin_fee_enabled === true,
                adminFee: Number(dev.admin_fee) || null,
                depositPercentage: Number(dev.deposit_percentage) || 30,
                installmentPeriods: dev.installment_periods,
                commissionModel: dev.commission_model || null,
              }
            );
            setFeeBreakdown(fees);
          }
        }
      } catch (error) {
        logger.error('Failed to calculate fees', error as Error, { module: 'ReservationFlowModal', action: 'CALCULATE_FEES' });
        // Fallback to basic calculation
        const fees = FeeCalculator.calculateStandFees(
          selectedStand.price_usd,
          {
            vatPercentage: 15.5,
            vatEnabled: true,
            aosEnabled: false,
            aosFee: null,
            endowmentEnabled: false,
            endowmentFee: null,
            cessionsEnabled: false,
            cessionFee: null,
            adminFeeEnabled: false,
            adminFee: null,
            depositPercentage: development.depositPercentage,
            installmentPeriods: null,
            commissionModel: null,
          }
        );
        setFeeBreakdown(fees);
      }
    }

    setCurrentStep('fees');
  };

  const handleFeesNext = () => {
    setCurrentStep('acceptance');
  };

  const handleAcceptanceNext = () => {
    if (!agreementAccepted || !termsAccepted) {
      alert('Please accept both the Digital Reservation Agreement and Terms & Conditions');
      return;
    }

    // Execute reservation
    setLoading(true);
    const ref = generateDigitalRef();
    setDigitalRef(ref);

    // Prepare data payload
    const reservationData = {
      attributionType,
      agentId: attributionType === 'agent' ? selectedAgent : null,
      isCompanyLead: attributionType === 'self',
      kyc: {
        fullName,
        email,
        idNumber,
        contactPhone,
        idDocumentUrl
      },
      digitalRef: ref,
      termsAcceptedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      insuranceInterest: insuranceInterest,
      insuranceInterestSource: insuranceInterest ? 'legal_gateway' : null,
    };

    logger.info('Reservation flow complete', {
      module: 'ReservationFlowModal',
      action: 'RESERVATION_FLOW_COMPLETE',
      stand_id: selectedStand.id,
      stand_number: selectedStand.number,
      digital_ref: ref,
      ...reservationData,
      timestamp: new Date().toISOString()
    });

    // Simulate API call
    setTimeout(() => {
      onConfirm(selectedStand.id, reservationData);
      setLoading(false);
      setCurrentStep('success');
    }, 1500);
  };

  const handleEnterDashboard = async () => {
    // Create account WITHOUT password first, then show password setup
    setLoading(true);
    setAccountCreationError('');

    try {
      // Create account from reservation data (without password)
      console.log('[ACCOUNT CREATION] Starting account creation with email:', (email || '').substring(0, 5) + '***');

      const response = await fetch('/api/auth/create-account-from-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim(),
          name: (fullName || '').trim(),
          phone: (contactPhone || '').trim(),
          ...(idNumber?.trim() && { idNumber: idNumber.trim() }),
          ...(idDocumentUrl?.trim() && { idDocumentUrl: idDocumentUrl.trim() }),
          reservationData: {
            ...(selectedStand?.id && { standId: selectedStand.id }),
            ...(selectedStand?.number && { standNumber: selectedStand.number }),
            ...(digitalRef && { digitalRef }),
            ...(attributionType && { attributionType }),
            ...(selectedAgent && { agentId: selectedAgent }),
            ...(attributionType === 'self' && { isCompanyLead: true }),
          }
        })
      });

      console.log('[ACCOUNT CREATION] Response status:', response.status);

      const result = await response.json();

      console.log('[ACCOUNT CREATION] Response body:', {
        success: result.success,
        message: result.message,
        error: result.error,
        needsPasswordSetup: result.data?.needsPasswordSetup
      });

      // Handle success response (account created or exists)
      if (response.ok && result.success) {
        // Check if account already exists (but allow password setup)
        if (result.data?.existingAccount) {
          // Account exists and is active - user should log in
          setAccountCreationError('An account with this email already exists. Please log in to continue.');
          setLoading(false);
          return;
        }

        // Account created successfully, now show password setup step
        logger.info('Account created successfully', {
          module: 'ReservationFlowModal',
          action: 'CREATE_ACCOUNT_SUCCESS',
          email: email?.substring(0, 3) + '***',
        });

        setAccountCreated(true);
        setLoading(false);
        setCurrentStep('password-setup');
        return;
      }

      // Handle error responses
      if (!response.ok) {
        console.error('[ACCOUNT CREATION] Error response:', { status: response.status, result });

        // Handle specific cases gracefully
        // Note: apiError returns { success: false, error, code, details }
        if (response.status === 409 && result.details?.needsActivation) {
          // Account exists but needs password setup - allow user to proceed
          logger.info('Account exists, proceeding to password setup', {
            module: 'ReservationFlowModal',
            action: 'CREATE_ACCOUNT',
            email: email?.substring(0, 3) + '***',
            userId: result.details.userId
          });
          // Proceed to password setup step
          setAccountCreated(true);
          setLoading(false);
          setCurrentStep('password-setup');
          return;
        }

        // Extract validation errors if present
        let errorMessage = result.error || 'Failed to create account';
        if (result.details?.validationErrors && Array.isArray(result.details.validationErrors)) {
          const validationMessages = result.details.validationErrors
            .map((err: any) => `${err.path}: ${err.message}`)
            .join(', ');
          errorMessage = `Validation failed: ${validationMessages}`;
        }

        console.error('[ACCOUNT CREATION] Throwing error:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create account. Please try again or contact support.';
      console.error('[ACCOUNT CREATION] Catch block error:', errorMessage, error);
      logger.error('Account creation error', error as Error, {
        module: 'ReservationFlowModal',
        action: 'CREATE_ACCOUNT',
        email: email?.substring(0, 3) + '***',
        errorMessage
      });
      setAccountCreationError(errorMessage);
      setLoading(false);
    }
  };

  const handlePasswordSetup = async () => {
    // Validate password
    setPasswordError('');

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Check for at least one uppercase letter, one number, and one special character
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasNumber || !hasSpecialChar) {
      setPasswordError('Password must contain at least one uppercase letter, one number, and one special character');
      return;
    }

    setLoading(true);

    try {
      // Set password for the account
      console.log('[PASSWORD SETUP] Sending PUT request with email:', email?.substring(0, 5) + '***');

      const response = await fetch('/api/auth/create-account-from-reservation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password
        })
      });

      const result = await response.json();

      console.log('[PASSWORD SETUP] Response:', {
        status: response.status,
        success: result.success,
        message: result.message || result.error
      });

      if (!response.ok) {
        const errorMsg = result.error || result.message || 'Failed to set password';
        console.error('[PASSWORD SETUP] Error:', { status: response.status, error: errorMsg });
        throw new Error(errorMsg);
      }

      logger.info('Password set successfully', {
        module: 'ReservationFlowModal',
        action: 'PASSWORD_SETUP_SUCCESS',
        email: email?.substring(0, 3) + '***',
      });

      // Password set successfully - auto-login then redirect to dashboard
      try {
        const { signIn } = await import('next-auth/react');
        console.log('[PASSWORD SETUP] Attempting auto-login with NextAuth...');

        const loginResult = await signIn('credentials', {
          email: email.trim().toLowerCase(),
          password: password,
          redirect: false,
        });

        console.log('[PASSWORD SETUP] NextAuth login result:', { ok: loginResult?.ok, error: loginResult?.error });

        if (loginResult?.ok) {
          // Successfully logged in - redirect to dashboard
          logger.info('Auto-login successful', {
            module: 'ReservationFlowModal',
            action: 'AUTO_LOGIN_SUCCESS',
          });
          window.location.href = '/dashboards/client';
        } else {
          // Login failed - redirect to login page with email pre-filled
          logger.warn('Auto-login failed after password setup', {
            module: 'ReservationFlowModal',
            action: 'AUTO_LOGIN_FAILED',
            email: email?.substring(0, 3) + '***',
            error: loginResult?.error
          });
          window.location.href = `/login?email=${encodeURIComponent(email)}`;
        }
      } catch (loginError: any) {
        // Fallback: redirect to login page
        console.error('[PASSWORD SETUP] Login error:', loginError);
        logger.error('Auto-login error after password setup', loginError, {
          module: 'ReservationFlowModal',
          action: 'AUTO_LOGIN_ERROR',
        });
        window.location.href = `/login?email=${encodeURIComponent(email)}`;
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to set password. Please try again.';
      console.error('[PASSWORD SETUP] Error:', errorMsg, error);
      logger.error('Password setup error', error as Error, {
        module: 'ReservationFlowModal',
        action: 'SET_PASSWORD',
        email: email,
        errorMessage: errorMsg
      });
      setPasswordError(errorMsg);
      setLoading(false);
    }
  };

  // Step progress indicator
  const steps = ['Advisory', 'Attribution', 'KYC', 'Fees', 'Acceptance', 'Success'];
  const stepIndex = steps.indexOf(currentStep.charAt(0).toUpperCase() + currentStep.slice(1));

  if (!isMounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={currentStep !== 'success' ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative z-[10000] bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-fcGold flex items-center justify-center">
                <MapPin size={24} className="text-white" />
              </div>
              <div>
                <h2 id="reservation-modal-title" className="text-2xl font-black text-white tracking-tight">
                  Stand {selectedStand.number}
                </h2>
                <p className="text-xs text-gray-300 font-bold uppercase tracking-wider">
                  {selectedStand.developmentName || 'Development'}
                </p>
              </div>
            </div>
            {currentStep !== 'success' && (
              <button
                onClick={onClose}
                aria-label="Close reservation dialog"
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Progress Steps */}
          {currentStep !== 'success' && (
            <div className="flex items-center justify-between gap-1 md:gap-2 overflow-x-auto pb-2">
              {steps.slice(0, -1).map((step, idx) => (
                <div key={step} className="flex-1 flex items-center min-w-[60px]">
                  <div className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full text-[10px] md:text-xs font-bold transition-all ${idx <= stepIndex
                    ? 'bg-fcGold text-white'
                    : 'bg-white/20 text-gray-400'
                    }`}>
                    {idx + 1}
                  </div>
                  {idx < steps.length - 2 && (
                    <div className={`flex-1 h-1 mx-1 md:mx-2 rounded-full transition-all ${idx < stepIndex ? 'bg-fcGold' : 'bg-white/20'
                      }`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stand Number Badge - Always Visible */}
          <div className="mt-4 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <MapPin size={14} className="text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Stand {selectedStand.number}</span>
              {currentStep === 'success' && (
                <Lock size={14} className="text-green-300 ml-1" />
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* STEP 1: Legal Gate Advisory */}
            {currentStep === 'advisory' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-300 rounded-full">
                    <Clock size={16} className="text-amber-600" />
                    <span className="text-xs font-black text-amber-900 uppercase tracking-widest">72H Security Lock</span>
                  </div>
                  <h3 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">Legal Gate Advisory</h3>
                  <p className="text-base text-gray-600 max-w-lg mx-auto leading-[1.6]">
                    This stand will be exclusively locked to your profile for 72 hours. Please review the compliance requirements below.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-blue-900 mb-1 leading-[1.3]">72-Hour Exclusive Hold</h4>
                      <p className="text-sm text-blue-700 leading-[1.6]">
                        Stand will be unavailable to other buyers during your reservation window. Timer starts immediately upon confirmation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-6 bg-green-50 rounded-2xl border border-green-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-green-900 mb-1 leading-[1.3]">Deposit Requirement</h4>
                      <p className="text-sm text-green-700 leading-[1.6]">
                        A minimum {development?.depositPercentage || 30}% deposit (${((selectedStand.price_usd * (development?.depositPercentage || 30)) / 100).toLocaleString()} USD) must be paid within 72 hours to convert reservation to contract.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-6 bg-purple-50 rounded-2xl border border-purple-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-purple-900 mb-1 leading-[1.3]">KYC Documentation</h4>
                      <p className="text-sm text-purple-700 leading-[1.6]">
                        Valid government-issued ID and proof of address required. All documentation must be submitted digitally during reservation process.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-800 leading-[1.6]">
                    <strong className="font-semibold">Auto-Release Warning:</strong> Failure to meet deposit deadline results in automatic reservation cancellation and stand re-listing. No extensions granted.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={advisoryAccepted}
                      onChange={(e) => setAdvisoryAccepted(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded accent-fcGold cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-fcGold focus:ring-offset-2"
                    />
                    <span className="text-base text-gray-700 leading-[1.6] group-hover:text-fcSlate transition-colors duration-150">
                      I understand and accept all legal requirements, including the 72-hour enforcement window, deposit obligations, and KYC documentation requirements.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 2: Reservation Attribution */}
            {currentStep === 'attribution' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">Reservation Attribution</h3>
                  <p className="text-base text-gray-600 max-w-lg mx-auto leading-[1.6]">
                    Help us understand how you discovered this opportunity
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Self-Led / Direct */}
                  <div
                    className={`p-6 rounded-2xl cursor-pointer border transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 ${attributionType === 'self'
                      ? 'bg-fcGold text-white border-fcGold shadow-sm'
                      : 'bg-white border-gray-200 hover:border-fcGold hover:shadow-sm'
                      }`}
                    onClick={() => setAttributionType('self')}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${attributionType === 'self' ? 'border-white bg-white' : 'border-gray-300'
                        }`}>
                        {attributionType === 'self' && (
                          <div className="w-3 h-3 rounded-full bg-fcGold" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-xl font-semibold mb-1 leading-[1.3] ${attributionType === 'self' ? 'text-white' : 'text-fcSlate'}`}>
                          Self-Led / Direct
                        </h4>
                        <p className={`text-base leading-[1.6] ${attributionType === 'self' ? 'text-white/90' : 'text-gray-600'}`}>
                          I discovered this opportunity personally through my own research and outreach.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent Assisted */}
                  <div
                    className={`p-5 rounded-2xl cursor-pointer border-2 transition-all ${attributionType === 'agent'
                      ? 'bg-fcSlate text-white border-fcSlate shadow-lg'
                      : 'bg-white border-gray-200 hover:border-fcSlate hover:shadow-md'
                      }`}
                    onClick={() => setAttributionType('agent')}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${attributionType === 'agent' ? 'border-white bg-white' : 'border-gray-300'
                        }`}>
                        {attributionType === 'agent' && (
                          <div className="w-3 h-3 rounded-full bg-fcSlate" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-lg font-bold mb-1 ${attributionType === 'agent' ? 'text-white' : 'text-fcSlate'}`}>
                          Agent Assisted
                        </h4>
                        <p className={`text-sm leading-relaxed ${attributionType === 'agent' ? 'text-white/90' : 'text-gray-600'}`}>
                          I worked with a certified consultant who introduced me to this development.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent Selection */}
                  {attributionType === 'agent' && (
                    <div className="ml-10 mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <input
                        type="text"
                        placeholder="Search agent by name..."
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-fcSlate focus:ring-2 focus:ring-fcSlate/20 outline-none"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {filteredAgents.map(agent => (
                          <div
                            key={agent.id}
                            className={`p-3 rounded-xl cursor-pointer transition-all ${selectedAgent === agent.id
                              ? 'bg-fcSlate text-white shadow-md'
                              : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            onClick={() => setSelectedAgent(agent.id)}
                          >
                            <span className="text-sm font-medium">{agent.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* STEP 3: KYC Verification */}
            {currentStep === 'kyc' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border-2 border-purple-300 rounded-full">
                    <Shield size={16} className="text-purple-600" />
                    <span className="text-xs font-black text-purple-900 uppercase tracking-widest">Required Documentation</span>
                  </div>
                  <h3 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">KYC Verification</h3>
                  <p className="text-base text-gray-600 max-w-lg mx-auto leading-[1.6]">
                    Please provide your personal information and upload a government-issued ID
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 leading-[1.5]">
                      Full Legal Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (validationErrors.fullName) {
                          setValidationErrors(prev => {
                            const next = { ...prev };
                            delete next.fullName;
                            return next;
                          });
                        }
                      }}
                      placeholder="As it appears on your ID document"
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:ring-2 focus:ring-fcGold focus:ring-offset-2 outline-none transition-all duration-150 ease-out min-h-[44px] ${validationErrors.fullName
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-fcGold'
                        }`}
                    />
                    {validationErrors.fullName && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 leading-[1.5]">
                      Identity Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => {
                        setIdNumber(e.target.value);
                        if (validationErrors.idNumber) {
                          setValidationErrors(prev => {
                            const next = { ...prev };
                            delete next.idNumber;
                            return next;
                          });
                        }
                      }}
                      placeholder="National ID, Passport, or Driver's License number"
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:ring-2 focus:ring-fcGold focus:ring-offset-2 outline-none transition-all duration-150 ease-out font-mono min-h-[44px] ${validationErrors.idNumber
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-fcGold'
                        }`}
                    />
                    {validationErrors.idNumber && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.idNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 leading-[1.5]">
                      Email Address <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value.toLowerCase().trim());
                        if (validationErrors.email) {
                          setValidationErrors(prev => {
                            const next = { ...prev };
                            delete next.email;
                            return next;
                          });
                        }
                      }}
                      placeholder="your.email@example.com"
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:ring-2 focus:ring-fcGold focus:ring-offset-2 outline-none transition-all duration-150 ease-out min-h-[44px] ${validationErrors.email
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-fcGold'
                        }`}
                    />
                    {validationErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 leading-[1.5]">
                      Contact Phone <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => {
                        setContactPhone(e.target.value);
                        if (validationErrors.contactPhone) {
                          setValidationErrors(prev => {
                            const next = { ...prev };
                            delete next.contactPhone;
                            return next;
                          });
                        }
                      }}
                      placeholder="+263 XXX XXX XXX"
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:ring-2 focus:ring-fcGold focus:ring-offset-2 outline-none transition-all duration-150 ease-out min-h-[44px] ${validationErrors.contactPhone
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-fcGold'
                        }`}
                    />
                    {validationErrors.contactPhone && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.contactPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 leading-[1.5]">
                      Identity Documentation <span className="text-red-600">*</span>
                    </label>
                    {validationErrors.idDocument && (
                      <p className="mb-2 text-sm text-red-600">{validationErrors.idDocument}</p>
                    )}
                    <div className={`border-2 border-dashed rounded-xl p-6 bg-gray-50 ${validationErrors.idDocument
                      ? 'border-red-300'
                      : 'border-gray-300'
                      }`}>
                      {!idDocumentUrl ? (
                        <div className="text-center space-y-3">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-100">
                            <Upload size={32} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-700 mb-1">Upload Government-Issued ID</p>
                            <p className="text-xs text-gray-500">PDF, JPG, or PNG • Max 5MB</p>
                          </div>
                          {isUploadingDocument && (
                            <div className="w-full max-w-xs mx-auto space-y-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-purple-600 font-semibold">{uploadProgress}% Uploading...</p>
                            </div>
                          )}
                          <UploadButton<OurFileRouter, 'identityDocument'>
                            endpoint="identityDocument"
                            onClientUploadComplete={(res) => {
                              if (res && res.length > 0) {
                                setIdDocumentUrl(res[0].url);
                                setIsUploadingDocument(false);
                                setUploadProgress(0);
                                if (validationErrors.idDocument) {
                                  setValidationErrors(prev => {
                                    const next = { ...prev };
                                    delete next.idDocument;
                                    return next;
                                  });
                                }
                                logger.info('KYC document upload success', { module: 'ReservationFlowModal', action: 'KYC_UPLOAD', url: res[0].url });
                              }
                            }}
                            onUploadBegin={() => {
                              setIsUploadingDocument(true);
                              setUploadProgress(10);
                              // Simulate progress
                              const interval = setInterval(() => {
                                setUploadProgress(prev => {
                                  if (prev >= 90) {
                                    clearInterval(interval);
                                    return prev;
                                  }
                                  return prev + Math.random() * 30;
                                });
                              }, 200);
                            }}
                            onUploadError={(error: Error) => {
                              logger.error('KYC document upload error', error, { module: 'ReservationFlowModal', action: 'KYC_UPLOAD' });
                              setIsUploadingDocument(false);
                              setUploadProgress(0);
                              alert('Upload failed: ' + error.message);
                            }}
                            appearance={{
                              button: `${isUploadingDocument ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white font-bold px-6 py-3 rounded-xl transition-all`,
                              allowedContent: "hidden"
                            }}
                            content={{
                              button: isUploadingDocument ? "Uploading..." : "Choose File"
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-green-900">Document Uploaded Successfully</p>
                            <p className="text-xs text-green-700 truncate">{idDocumentUrl}</p>
                          </div>
                          <button
                            onClick={() => setIdDocumentUrl('')}
                            className="px-3 py-1.5 text-xs font-bold text-green-700 hover:text-green-900 uppercase tracking-wider"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Privacy Notice:</strong> All personal information is encrypted and stored securely in compliance with data protection regulations. Your data will only be used for verification purposes.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4: Fees Breakdown */}
            {currentStep === 'fees' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border-2 border-green-300 rounded-full">
                    <FileText size={16} className="text-green-600" />
                    <span className="text-xs font-black text-green-900 uppercase tracking-widest">Complete Transparency</span>
                  </div>
                  <h3 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">Fee Breakdown</h3>
                  <p className="text-base text-gray-600 max-w-lg mx-auto leading-[1.6]">
                    Review all fees and charges before proceeding to legal acceptance
                  </p>
                </div>

                {/* Stand Summary Card */}
                <div className="bg-gradient-to-br from-fcGold/10 to-fcSlate/10 rounded-2xl border-2 border-fcGold/30 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Stand Details</p>
                      <p className="text-2xl font-black text-fcSlate font-mono">Stand {selectedStand.number}</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedStand.developmentName || development?.name}</p>
                    </div>
                    {selectedStand.area_sqm && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Area</p>
                        <p className="text-xl font-black text-fcSlate">{selectedStand.area_sqm.toLocaleString()} m²</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fee Breakdown Card */}
                {feeBreakdown ? (
                  <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Complete Fee Breakdown</h4>
                    </div>
                    <div className="p-6 space-y-4">
                      {/* Base Stand Price */}
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-700">Stand Price</span>
                        <span className="text-sm font-bold text-fcSlate">${feeBreakdown.standPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* Discount if applicable */}
                      {feeBreakdown.discountAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-green-700">Discount ({feeBreakdown.discountPercent}%)</span>
                          <span className="text-sm font-bold text-green-700">-${feeBreakdown.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* VAT */}
                      {feeBreakdown.vatAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-700">VAT ({feeBreakdown.vatRate}%)</span>
                          <span className="text-sm font-bold text-fcSlate">${feeBreakdown.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Agreement of Sale */}
                      {feeBreakdown.agreementOfSaleAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-700">Agreement of Sale</span>
                          <span className="text-sm font-bold text-fcSlate">${feeBreakdown.agreementOfSaleAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Endowment */}
                      {feeBreakdown.endowmentAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-700">Endowment Fee</span>
                          <span className="text-sm font-bold text-fcSlate">${feeBreakdown.endowmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Cession */}
                      {feeBreakdown.cessionAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-700">Cession Fee</span>
                          <span className="text-sm font-bold text-fcSlate">${feeBreakdown.cessionAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Admin Fee */}
                      {feeBreakdown.adminAmount > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-700">Admin Fee</span>
                          <span className="text-sm font-bold text-fcSlate">${feeBreakdown.adminAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center justify-between py-4 bg-fcGold/5 rounded-xl px-4 mt-4 border-2 border-fcGold/20">
                        <span className="text-base font-black text-fcSlate uppercase tracking-wider">Total Amount</span>
                        <span className="text-2xl font-black text-fcGold">${feeBreakdown.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* Deposit Requirement */}
                      {development && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Deposit Required ({development.depositPercentage}%)</span>
                            <span className="text-lg font-black text-blue-900">
                              ${((feeBreakdown.totalAmount * development.depositPercentage) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">Must be paid within 72 hours to secure your reservation</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl border-2 border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-600">Calculating fees...</p>
                  </div>
                )}

                {/* Refund Policy Notice */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Refund Policy:</strong> Review the complete refund policy document before proceeding. Cancellation terms and refund eligibility are clearly outlined in the legal documents.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 5: Legal Acceptance */}
            {currentStep === 'acceptance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-300 rounded-full">
                    <FileText size={16} className="text-red-600" />
                    <span className="text-xs font-black text-red-900 uppercase tracking-widest">Binding Agreement</span>
                  </div>
                  <h3 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">Legal Acceptance</h3>
                  <p className="text-base text-gray-600 max-w-lg mx-auto leading-[1.6]">
                    Review and accept the legal documents to execute your reservation
                  </p>
                </div>

                {/* Document Preview Area */}
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Digital Reservation Agreement V.2025</h4>
                  </div>
                  <div className="p-6 space-y-4 max-h-64 overflow-y-auto bg-white">
                    <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                      <p className="font-bold text-fcSlate">RESERVATION TERMS & CONDITIONS</p>

                      <p>This Digital Reservation Agreement ("Agreement") is entered into between Fine & Country Zimbabwe ("Developer") and the undersigned Client ("Buyer") for the reservation of Stand {selectedStand.number} in {selectedStand.developmentName}.</p>

                      <p className="font-semibold">1. RESERVATION PERIOD</p>
                      <p>1.1. The reservation is valid for seventy-two (72) hours from the time of digital acceptance.</p>
                      <p>1.2. Upon expiration without deposit payment, the reservation automatically terminates.</p>

                      <p className="font-semibold">2. DEPOSIT REQUIREMENT</p>
                      {(() => {
                        const depositPercent = development?.depositPercentage || 30;
                        const depositAmount = (selectedStand.price_usd * depositPercent / 100);
                        return (
                          <>
                            <p>2.1. A minimum deposit of {depositPercent}% (${depositAmount.toLocaleString()} USD) must be paid within the 72-hour window.</p>
                            <p>2.2. Deposit payment converts this reservation into a binding Sale Agreement.</p>
                          </>
                        );
                      })()}

                      {development?.installmentPeriods && development.installmentPeriods.length > 0 && (
                        <>
                          <p className="font-semibold">3. PAYMENT TERMS</p>
                          <p>3.1. Available installment periods: {development.installmentPeriods.join(', ')} months</p>
                          <p>3.2. Default installment period: {development.installmentPeriods[0]} months</p>
                        </>
                      )}

                      <p className="font-semibold">{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '4' : '3'}. STAND SPECIFICATIONS</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '4' : '3'}.1. Stand Number: {selectedStand.number}</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '4' : '3'}.2. Total Price: ${selectedStand.price_usd.toLocaleString()} USD</p>
                      {selectedStand.area_sqm && <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '4' : '3'}.3. Stand Area: {selectedStand.area_sqm.toLocaleString()} m²</p>}

                      <p className="font-semibold">{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '5' : '4'}. CLIENT OBLIGATIONS</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '5' : '4'}.1. Provide valid KYC documentation within 24 hours of reservation.</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '5' : '4'}.2. Make deposit payment via approved banking channels only.</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '5' : '4'}.3. Respond to Developer communications within prescribed timeframes.</p>

                      <p className="font-semibold">{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '6' : '5'}. CANCELLATION POLICY</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '6' : '5'}.1. Client may cancel within 72 hours with no penalties if no deposit has been paid.</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '6' : '5'}.2. Post-deposit cancellations are subject to the Refund Policy terms.</p>

                      <p className="font-semibold">{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '7' : '6'}. DIGITAL SIGNATURE</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '7' : '6'}.1. Electronic acceptance constitutes a legally binding digital signature.</p>
                      <p>{development?.installmentPeriods && development.installmentPeriods.length > 0 ? '7' : '6'}.2. All actions are logged with timestamps for legal enforceability.</p>

                      <p className="text-xs text-gray-500 mt-4">Last Updated: January 2025</p>
                    </div>
                  </div>
                </div>

                {/* Acceptance Checkboxes */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                    <label className="flex items-start gap-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreementAccepted}
                        onChange={(e) => setAgreementAccepted(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded accent-fcGold cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-fcGold focus:ring-offset-2"
                      />
                      <span className="text-base text-gray-700 leading-[1.6] group-hover:text-fcSlate transition-colors duration-150">
                        I have read and accept the <strong className="font-semibold text-fcSlate">Digital Reservation Agreement V.2025</strong> and understand that this creates a legally binding 72-hour reservation.
                      </span>
                    </label>
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                    <label className="flex items-start gap-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded accent-fcGold cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-fcGold focus:ring-offset-2"
                      />
                      <span className="text-base text-gray-700 leading-[1.6] group-hover:text-fcSlate transition-colors duration-150">
                        I accept the <strong className="font-semibold text-fcSlate">Terms & Conditions</strong>, <strong className="font-semibold text-fcSlate">Refund Policy</strong>, and <strong className="font-semibold text-fcSlate">Privacy Policy</strong> as linked in the footer documentation.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Optional Insurance Add-on */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-fcSlate mb-3">Optional Stand Insurance (Old Mutual)</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    Insurance is available through Old Mutual for clients who wish to cover their stand purchase. This is optional. You may enquire for details at any time.
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={insuranceInterest}
                      onChange={(e) => setInsuranceInterest(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded accent-fcGold cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-fcGold focus:ring-offset-2"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-fcSlate transition-colors duration-150">
                        I would like to know more about Old Mutual insurance.
                      </span>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        No obligation. We will contact you with information if you opt in.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Legal Binding Notice:</strong> By checking both boxes above, you are executing a digital signature that is legally equivalent to a handwritten signature under electronic transaction laws.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 5: Success Confirmation */}
            {currentStep === 'success' && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                    <CheckCircle2 size={48} className="text-green-600" />
                  </div>

                  <h3 className="text-4xl font-black text-fcSlate tracking-tight mb-2">Reservation Confirmed</h3>
                  <p className="text-lg text-gray-600 max-w-md mx-auto leading-relaxed">
                    Your reservation has been successfully created.
                  </p>
                </div>

                {/* Reservation Summary Panel */}
                <div className="p-6 bg-gradient-to-br from-fcGold/10 to-fcSlate/10 rounded-2xl border-2 border-fcGold/30 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Development</p>
                      <p className="text-xl font-black text-fcSlate">{reservationData?.developmentName || development?.name || 'Development'}</p>
                      {reservationData?.developmentLocation && (
                        <p className="text-sm text-gray-600 mt-1">{reservationData.developmentLocation}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-fcGold/20">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Stand Number</p>
                      <p className="text-3xl font-black text-fcSlate font-mono tracking-tight">
                        {reservationData?.standNumber || selectedStand.number}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-fcGold/20">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Reservation Status</p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 border border-green-300">
                        {reservationData?.status === 'PENDING' ? 'RESERVED' : reservationData?.status || 'RESERVED'}
                      </span>
                    </div>

                    {reservationData?.expiresAt && (
                      <div className="pt-3 border-t border-fcGold/20">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Expires</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(reservationData.expiresAt).toLocaleString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}

                    {reservationData?.finalPriceAtReservation && (
                      <div className="pt-3 border-t border-fcGold/20">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Reserved Price</p>
                        <p className="text-lg font-black text-fcSlate">
                          ${reservationData.finalPriceAtReservation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}

                    <div className="pt-3 border-t border-fcGold/20">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Digital Reference</p>
                      <p className="text-xl font-black text-fcSlate font-mono tracking-tight">{digitalRef}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
                    <Clock size={20} className="text-amber-600" />
                    <span className="text-sm font-black text-amber-900 uppercase tracking-wider">
                      {formatTimeRemaining(timeRemaining)}
                    </span>
                  </div>
                </div>

                {/* PDF Download Buttons */}
                {(reservationData?.termsPdfUrl || reservationData?.refundPdfUrl) && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest text-center">Important Documents</p>
                    <div className="grid grid-cols-1 gap-3">
                      {reservationData.termsPdfUrl && (
                        <a
                          href={reservationData.termsPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 rounded-xl hover:border-fcGold hover:bg-fcGold/5 transition-all group"
                        >
                          <FileText size={18} className="text-gray-600 group-hover:text-fcGold" />
                          <span className="text-sm font-bold text-gray-900 group-hover:text-fcSlate">Download Terms & Conditions (PDF)</span>
                          <Download size={16} className="text-gray-400 group-hover:text-fcGold ml-auto" />
                        </a>
                      )}
                      {reservationData.refundPdfUrl && (
                        <a
                          href={reservationData.refundPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 rounded-xl hover:border-fcGold hover:bg-fcGold/5 transition-all group"
                        >
                          <FileText size={18} className="text-gray-600 group-hover:text-fcGold" />
                          <span className="text-sm font-bold text-gray-900 group-hover:text-fcSlate">Download Refund Policy (PDF)</span>
                          <Download size={16} className="text-gray-400 group-hover:text-fcGold ml-auto" />
                        </a>
                      )}
                    </div>
                  </div>
                )}



                <div className="p-5 bg-blue-50 rounded-xl border border-blue-200 text-left">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <strong>Ownership finalization is strictly regulated within 72 hours.</strong> You must complete the {development?.depositPercentage || 30}% deposit payment to convert this reservation into a binding Sale Agreement. Failure to meet this deadline will result in automatic release and re-listing of the stand.
                  </p>
                  {accountCreated ? (
                    <>
                      <p className="text-xs text-blue-700 mt-2 leading-relaxed">
                        <strong>Account Created:</strong> Your reservation is now linked to your account. Click "SET PASSWORD TO CONTINUE" below to set your password and access your dashboard.
                      </p>
                      <p className="text-xs text-blue-600 mt-2 leading-relaxed">
                        <strong>Didn't receive email?</strong> No worries! You can{' '}
                        <a
                          href={`/set-password?email=${encodeURIComponent(email)}`}
                          target="_blank"
                          className="underline font-semibold hover:text-blue-800"
                        >
                          set your password directly here
                        </a>
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-blue-700 mt-2 leading-relaxed">
                      <strong>Next Step:</strong> Click "CREATE ACCOUNT & SET PASSWORD" below to create your client account and access your reservation dashboard.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Next Steps</p>
                  <div className="text-left space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fcGold text-white flex items-center justify-center text-xs font-bold">1</div>
                      <p className="text-sm text-gray-700">Check your email for payment instructions and banking details</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fcGold text-white flex items-center justify-center text-xs font-bold">2</div>
                      <p className="text-sm text-gray-700">Make the {development?.depositPercentage || 30}% deposit payment within 72 hours</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-fcGold text-white flex items-center justify-center text-xs font-bold">3</div>
                      <p className="text-sm text-gray-700">Your assigned agent will guide you through the remaining steps and documentation</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: Password Setup */}
            {currentStep === 'password-setup' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-fcGold/10 border-2 border-fcGold/30 rounded-full">
                    <Lock size={16} className="text-fcGold" />
                    <span className="text-xs font-black text-fcGold uppercase tracking-widest">Account Created</span>
                  </div>
                  <h3 className="text-3xl font-black text-fcSlate tracking-tight">Set Your Password</h3>
                  <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
                    Create a secure password to access your client dashboard
                  </p>
                </div>

                {accountCreationError && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{accountCreationError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                        }}
                        placeholder="Enter password (min 8 characters)"
                        className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-fcGold focus:ring-2 focus:ring-fcGold/20 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Must be at least 8 characters with one uppercase letter and one number
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError('');
                        }}
                        placeholder="Confirm your password"
                        className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-fcGold focus:ring-2 focus:ring-fcGold/20 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{passwordError}</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Security Note:</strong> Your password is encrypted and stored securely. You'll use this password to access your client dashboard and manage your reservation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex-shrink-0 p-4 md:p-6 border-t border-gray-200 bg-white sticky bottom-0 z-10 shadow-sm">
          {currentStep === 'advisory' && (
            <button
              onClick={handleAdvisoryNext}
              disabled={!advisoryAccepted}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-150 ease-out text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 min-h-[44px] ${advisoryAccepted
                ? 'bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] shadow-sm hover:shadow-md'
                : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
              I UNDERSTAND & ACCEPT
            </button>
          )}

          {currentStep === 'attribution' && (
            <button
              onClick={handleAttributionNext}
              className="w-full py-4 rounded-xl font-semibold text-white bg-fcSlate hover:bg-fcSlate/90 active:scale-[0.98] transition-all duration-150 ease-out text-base focus:outline-none focus:ring-2 focus:ring-fcSlate focus:ring-offset-2 shadow-sm hover:shadow-md min-h-[44px]"
            >
              CONTINUE TO COMPLIANCE
            </button>
          )}

          {currentStep === 'kyc' && (
            <button
              onClick={handleKycNext}
              className="w-full py-4 rounded-xl font-semibold text-white bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] transition-all duration-150 ease-out text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 shadow-sm hover:shadow-md min-h-[44px]"
            >
              VERIFY DATA & PROCEED
            </button>
          )}

          {currentStep === 'fees' && (
            <button
              onClick={handleFeesNext}
              className="w-full py-4 rounded-xl font-semibold text-white bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] transition-all duration-150 ease-out text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 shadow-sm hover:shadow-md min-h-[44px]"
            >
              REVIEW TERMS & CONDITIONS
            </button>
          )}

          {currentStep === 'acceptance' && (
            <button
              onClick={handleAcceptanceNext}
              className="w-full py-4 rounded-xl font-semibold text-white bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] transition-all duration-150 ease-out flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 shadow-sm hover:shadow-md min-h-[44px]"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'COMPLETING RESERVATION...' : 'COMPLETE RESERVATION'}
            </button>
          )}

          {currentStep === 'success' && (
            <button
              onClick={handleEnterDashboard}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-150 ease-out flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 min-h-[44px] ${loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] shadow-sm hover:shadow-md'
                }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>CREATING ACCOUNT...</span>
                </>
              ) : accountCreated ? (
                'SET PASSWORD TO CONTINUE'
              ) : (
                'CREATE ACCOUNT & SET PASSWORD'
              )}
            </button>
          )}

          {currentStep === 'password-setup' && (
            <button
              onClick={handlePasswordSetup}
              disabled={loading || !password || !confirmPassword}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-150 ease-out flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 min-h-[44px] ${password && confirmPassword && !loading
                ? 'bg-fcGold hover:bg-fcGold/90 active:scale-[0.98] shadow-sm hover:shadow-md'
                : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>SETTING PASSWORD...</span>
                </>
              ) : (
                'SET PASSWORD & ENTER DASHBOARD'
              )}
            </button>
          )}

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
