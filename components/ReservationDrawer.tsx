'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Phone, 
  MapPin, 
  DollarSign, 
  Ruler,
  Shield,
  ChevronDown,
  Loader2,
  AlertCircle,
  ArrowRight,
  User,
  Mail,
  Phone as PhoneIcon
} from 'lucide-react';
import { FeeCalculator, type FeeBreakdown } from '@/lib/feeCalculator';
import { logger } from '@/lib/logger';

interface ReservationDrawerProps {
  selectedStand: {
    id: string;
    number: string;
    price_usd: number;
    price_per_sqm?: number;
    area_sqm?: number;
    developmentName?: string;
    developmentId?: string;
    status?: string;
  };
  user: {
    isLoggedIn: boolean;
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  agents?: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
  }>;
  onReserve: (standId: string, data: ReservationData) => Promise<ReservationResult>;
  onClose: () => void;
  onRequestCallback?: (data: CallbackRequest) => void;
}

interface Development {
  id: string;
  name: string;
  depositPercentage: number;
  installmentPeriods: number[];
  vat_percentage?: number;
  vat_enabled?: boolean;
  aos_enabled?: boolean;
  aos_fee?: number;
  endowment_enabled?: boolean;
  endowment_fee?: number;
  cessions_enabled?: boolean;
  cession_fee?: number;
  admin_fee_enabled?: boolean;
  admin_fee?: number;
  payment_terms_url?: string;
  refund_policy_url?: string;
}

interface ReservationData {
  attributionType: 'self' | 'agent';
  agentId?: string;
  isCompanyLead: boolean;
  // For non-logged in users:
  fullName?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  // Legal Gate - terms acceptance timestamp
  termsAcceptedAt?: string;
}

interface ReservationResult {
  success: boolean;
  reservationId?: string;
  expiresAt?: string;
  error?: string;
}

interface CallbackRequest {
  standId: string;
  name: string;
  phone: string;
  preferredTime?: string;
}

type DrawerStep = 'summary' | 'contact' | 'processing' | 'success' | 'callback';

export const ReservationDrawer: React.FC<ReservationDrawerProps> = ({
  selectedStand,
  user,
  agents = [],
  onReserve,
  onClose,
  onRequestCallback
}) => {
  const [currentStep, setCurrentStep] = useState<DrawerStep>('summary');
  const [isMounted, setIsMounted] = useState(false);
  const [development, setDevelopment] = useState<Development | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Contact form state (for non-logged-in users)
  const [contactForm, setContactForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Legal Gate acceptance state (REQUIRED for all reservations)
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  
  // Callback request state
  const [callbackForm, setCallbackForm] = useState({
    name: '',
    phone: '',
    preferredTime: '',
  });
  
  // Selected agent
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showAgentList, setShowAgentList] = useState(false);

  // Portal mount
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Fetch development data and calculate fees
  useEffect(() => {
    const fetchDevelopmentAndFees = async () => {
      if (!selectedStand.developmentId) return;

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
              vat_percentage: Number(dev.vat_percentage) || 15.5,
              vat_enabled: dev.vat_enabled !== false,
              aos_enabled: !!dev.aos_enabled,
              aos_fee: Number(dev.aos_fee) || undefined,
              endowment_enabled: !!dev.endowment_enabled,
              endowment_fee: Number(dev.endowment_fee) || undefined,
              cessions_enabled: !!dev.cessions_enabled,
              cession_fee: Number(dev.cession_fee) || undefined,
              admin_fee_enabled: dev.admin_fee_enabled === true,
              admin_fee: Number(dev.admin_fee) || undefined,
              payment_terms_url: dev.payment_terms_url,
              refund_policy_url: dev.refund_policy_url,
            });

            // Calculate fees
            if (selectedStand.price_usd) {
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
        }
      } catch (err) {
        logger.error('Failed to fetch development', err as Error, {
          module: 'ReservationDrawer',
          action: 'FETCH_DEVELOPMENT'
        });
      }
    };

    fetchDevelopmentAndFees();
  }, [selectedStand.developmentId, selectedStand.price_usd]);

  // Validate legal acceptance
  const validateLegalAcceptance = () => {
    if (!legalAccepted) {
      setLegalError('You must accept the legal terms to proceed with the reservation');
      return false;
    }
    setLegalError(null);
    return true;
  };

  // Validate contact form
  const validateContactForm = () => {
    const errors: Record<string, string> = {};
    
    if (!contactForm.fullName || contactForm.fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name';
    }
    
    if (!contactForm.email) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactForm.email)) {
        errors.email = 'Please enter a valid email';
      }
    }
    
    if (!contactForm.phone || contactForm.phone.trim().length < 7) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle reserve action
  const handleReserve = async () => {
    // Legal Gate: Validate legal acceptance first (REQUIRED)
    if (!validateLegalAcceptance()) {
      return;
    }
    
    // Validate contact form for non-logged-in users
    if (!user?.isLoggedIn && !validateContactForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const reservationData: ReservationData = {
        attributionType: selectedAgent ? 'agent' : 'self',
        agentId: selectedAgent || undefined,
        isCompanyLead: true,
        termsAcceptedAt: legalAccepted ? new Date().toISOString() : undefined,
      };

      // Add contact info for non-logged-in users
      if (!user?.isLoggedIn) {
        reservationData.fullName = contactForm.fullName;
        reservationData.email = contactForm.email;
        reservationData.phone = contactForm.phone;
      }

      const result = await onReserve(selectedStand.id, reservationData);

      if (result.success) {
        setCurrentStep('success');
      } else {
        setError(result.error || 'Reservation failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle callback request
  const handleCallbackRequest = async () => {
    if (!callbackForm.name || !callbackForm.phone) {
      return;
    }

    if (onRequestCallback) {
      await onRequestCallback({
        standId: selectedStand.id,
        name: callbackForm.name,
        phone: callbackForm.phone,
        preferredTime: callbackForm.preferredTime || undefined,
      });
    }
    
    // Show success and close
    alert('Callback request submitted. Our team will contact you shortly.');
    onClose();
  };

  // Format time remaining
  const formatTimeRemaining = () => {
    const hours = 72;
    return `${hours}h remaining`;
  };

  // Get selected agent info
  const selectedAgentInfo = agents.find(a => a.id === selectedAgent);

  // Render drawer content
  const renderContent = () => {
    switch (currentStep) {
      case 'summary':
        return (
          <div className="space-y-6">
            {/* Stand Summary Header */}
            <div className="bg-gradient-to-r from-fcGold to-amber-500 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black">Stand {selectedStand.number}</h2>
                  <p className="text-white/90 text-sm">{selectedStand.developmentName}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-xs font-bold">72H LOCK</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
                    <Ruler size={14} />
                    Size
                  </div>
                  <div className="text-lg font-bold">{selectedStand.area_sqm || 'N/A'} m²</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
                    <DollarSign size={14} />
                    Price
                  </div>
                  <div className="text-lg font-bold">${selectedStand.price_usd?.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Fees Preview */}
            {feeBreakdown && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-bold text-fcSlate mb-3 flex items-center gap-2">
                  <DollarSign size={18} className="text-fcGold" />
                  Fee Breakdown
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stand Price</span>
                    <span className="font-medium">${feeBreakdown.standPrice?.toLocaleString()}</span>
                  </div>
                  {feeBreakdown.vatAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">VAT ({feeBreakdown.vatRate}%)</span>
                      <span className="font-medium">${feeBreakdown.vatAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  {feeBreakdown.adminAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Admin Fee</span>
                      <span className="font-medium">${feeBreakdown.adminAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-fcGold">${feeBreakdown.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 mt-2">
                    <div className="text-xs text-green-700">
                      <span className="font-bold">{development?.depositPercentage || 30}% Deposit:</span> ${((feeBreakdown.totalAmount || 0) * (development?.depositPercentage || 30) / 100).toLocaleString()} due within 72 hours
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-fcSlate mb-3 flex items-center gap-2">
                <User size={18} className="text-fcGold" />
                Work with an agent?
              </h3>
              
              <button
                onClick={() => setShowAgentList(!showAgentList)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm">
                  {selectedAgentInfo ? `Agent: ${selectedAgentInfo.name}` : 'Select an agent (optional)'}
                </span>
                <ChevronDown size={18} className={`transition-transform ${showAgentList ? 'rotate-180' : ''}`} />
              </button>

              {showAgentList && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      setShowAgentList(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                      !selectedAgent ? 'bg-fcGold/10 text-fcGold' : 'hover:bg-gray-100'
                    }`}
                  >
                    No agent (Direct)
                  </button>
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent.id);
                        setShowAgentList(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        selectedAgent === agent.id ? 'bg-fcGold/10 text-fcGold' : 'hover:bg-gray-100'
                      }`}
                    >
                      {agent.name} - {agent.phone}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Form (for non-logged-in users) */}
            {!user?.isLoggedIn && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-bold text-fcSlate mb-3 flex items-center gap-2">
                  <Mail size={18} className="text-fcGold" />
                  Your Details
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                      className={`w-full p-3 rounded-lg border text-sm ${
                        validationErrors.fullName ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    {validationErrors.fullName && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.fullName}</p>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className={`w-full p-3 rounded-lg border text-sm ${
                        validationErrors.email ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    {validationErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      className={`w-full p-3 rounded-lg border text-sm ${
                        validationErrors.phone ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    {validationErrors.phone && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Terms Links */}
            <div className="flex items-center justify-center gap-4 text-xs">
              {development?.payment_terms_url && (
                <a 
                  href={development.payment_terms_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fcGold hover:underline flex items-center gap-1"
                >
                  <FileText size={12} />
                  Payment Terms
                </a>
              )}
              {development?.refund_policy_url && (
                <a 
                  href={development.refund_policy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fcGold hover:underline flex items-center gap-1"
                >
                  <FileText size={12} />
                  Refund Policy
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* LEGAL GATE - Required checkbox before reservation */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => {
                      setLegalAccepted(e.target.checked);
                      if (e.target.checked) setLegalError(null);
                    }}
                    className="mt-1 w-5 h-5 rounded accent-fcGold cursor-pointer flex-shrink-0"
                  />
                  <span className="text-sm text-amber-900 leading-relaxed">
                    <strong>Legal Gate:</strong> I understand this reservation is legally binding. 
                    I have read and accept the{' '}
                    {development?.payment_terms_url && (
                      <a 
                        href={development.payment_terms_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fcGold hover:underline font-medium"
                      >
                        Payment Terms
                      </a>
                    )}
                    {' '}and{' '}
                    {development?.refund_policy_url && (
                      <a 
                        href={development.refund_policy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fcGold hover:underline font-medium"
                      >
                        Refund Policy
                      </a>
                    )}
                    . I understand the 72-hour deposit requirement and auto-release policy.
                  </span>
                </label>
                {legalError && (
                  <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {legalError}
                  </p>
                )}
              </div>

              <button
                onClick={handleReserve}
                disabled={isLoading}
                className="w-full py-4 bg-fcGold text-white rounded-xl font-black text-lg hover:bg-fcGold/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield size={20} />
                    Reserve Now
                  </>
                )}
              </button>

              <button
                onClick={() => setCurrentStep('callback')}
                className="w-full py-3 bg-white text-fcSlate border-2 border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Phone size={18} />
                Request Callback
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                72H Exclusive Hold
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                No Credit Card Required
              </span>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 border-4 border-fcGold border-t-transparent rounded-full animate-spin" />
            <h3 className="text-xl font-bold text-fcSlate">Processing Reservation</h3>
            <p className="text-gray-600 text-center text-sm">
              Please wait while we secure your stand...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            
            <div>
              <h3 className="text-2xl font-black text-fcSlate mb-2">Reservation Confirmed!</h3>
              <p className="text-gray-600">
                Stand {selectedStand.number} has been reserved in your name.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <Clock size={18} />
                <span className="font-bold">72-Hour Countdown</span>
              </div>
              <p className="text-sm text-amber-600">
                Complete your deposit payment within 72 hours to secure your stand.
              </p>
            </div>

            {!user?.isLoggedIn && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 w-full">
                <p className="text-sm text-blue-700 mb-3">
                  <strong>Next Step:</strong> Set up your account password to access your dashboard and make payments.
                </p>
                <a
                  href={`/set-password?email=${encodeURIComponent(contactForm.email || user?.email || '')}`}
                  className="block w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-center hover:bg-blue-700 transition-colors"
                >
                  Set Up Password
                </a>
              </div>
            )}

            {user?.isLoggedIn && (
              <a
                href="/dashboards/client"
                className="w-full py-4 bg-fcGold text-white rounded-xl font-black text-center hover:bg-fcGold/90 transition-all flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight size={20} />
              </a>
            )}
          </div>
        );

      case 'callback':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-fcSlate">Request a Callback</h3>
              <p className="text-gray-600 text-sm mt-2">
                Our team will call you to assist with your reservation.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={callbackForm.name}
                  onChange={(e) => setCallbackForm({ ...callbackForm, name: e.target.value })}
                  className="w-full p-3 rounded-lg border border-gray-200 text-sm"
                />
              </div>
              
              <div>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={callbackForm.phone}
                  onChange={(e) => setCallbackForm({ ...callbackForm, phone: e.target.value })}
                  className="w-full p-3 rounded-lg border border-gray-200 text-sm"
                />
              </div>
              
              <div>
                <select
                  value={callbackForm.preferredTime}
                  onChange={(e) => setCallbackForm({ ...callbackForm, preferredTime: e.target.value })}
                  className="w-full p-3 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="">Preferred time (optional)</option>
                  <option value="morning">Morning (8am - 12pm)</option>
                  <option value="afternoon">Afternoon (12pm - 5pm)</option>
                  <option value="evening">Evening (5pm - 8pm)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCallbackRequest}
                disabled={!callbackForm.name || !callbackForm.phone || isLoading}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Phone size={20} />
                    Request Callback
                  </>
                )}
              </button>

              <button
                onClick={() => setCurrentStep('summary')}
                className="w-full py-3 text-gray-600 font-medium hover:text-fcGold transition-colors"
              >
                Back to Reservation
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Don't render until mounted (for portal)
  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="relative z-[10000] bg-white rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {currentStep === 'summary' && (
          <div className="px-6 pb-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-fcGold" />
              <span className="font-bold text-fcSlate">Reserve Stand</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && currentStep !== 'callback' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm mb-4">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReservationDrawer;
