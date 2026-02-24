import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Target, MapPin, Filter, Search, X, Lock,
  ShieldCheck, CheckCircle2, Clock, AlertCircle,
  Loader2, ZoomIn, ZoomOut, Maximize2, Info, ArrowRight, DollarSign
} from 'lucide-react';
import { Stand, StandStatus, Branch, Development } from '../types.ts';
import { getDevelopments, reserveStand } from '../lib/db';
import { ReservationTimer } from './ReservationTimer.tsx';
import { PaymentModule } from './PaymentModule.tsx';

interface MobileInventoryProps {
  activeBranch: Branch;
}

// Touch-optimized stand card with 44x44px minimum target
const TouchStandCard: React.FC<{
  stand: Stand;
  onClick: () => void;
  isSelected: boolean;
}> = ({ stand, onClick, isSelected }) => {
  const getStatusColor = (status: StandStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'border-[#22C55E] bg-gradient-to-br from-white to-[#22C55E]/5';
      case 'RESERVED': return 'border-[#F59E0B] bg-gradient-to-br from-white to-[#F59E0B]/5';
      case 'SOLD': return 'border-slate-300 bg-gradient-to-br from-white to-slate-50';
      default: return 'border-gray-300 bg-gradient-to-br from-white to-gray-50';
    }
  };

  const getStatusBadge = (status: StandStatus) => {
    switch (status) {
      case 'AVAILABLE': return { text: 'Available', color: 'text-white bg-[#22C55E]', pulse: true };
      case 'RESERVED': return { text: 'Reserved', color: 'text-white bg-[#F59E0B]', pulse: false };
      case 'SOLD': return { text: 'Sold', color: 'text-gray-600 bg-slate-200', pulse: false };
      default: return { text: 'Unknown', color: 'text-gray-600 bg-gray-200', pulse: false };
    }
  };

  const badge = getStatusBadge(stand.status);
  const pricePerSqm = stand.priceUsd / stand.areaSqm;

  return (
    <button
      onClick={onClick}
      disabled={stand.status !== 'AVAILABLE'}
      className={`
        relative w-full min-h-[100px] p-5 rounded-3xl border-2 transition-all duration-200
        touch-manipulation shadow-sm
        ${stand.status === 'AVAILABLE' ? 'active:scale-[0.97] hover:shadow-xl cursor-pointer' : 'cursor-not-allowed opacity-60'}
        ${getStatusColor(stand.status)}
        ${isSelected ? 'ring-4 ring-fcGold/40 border-fcGold shadow-2xl scale-[1.02]' : ''}
        ${stand.status === 'AVAILABLE' ? 'hover:border-[#22C55E] hover:shadow-[#22C55E]/20' : ''}
      `}
    >
      {/* Decorative blob */}
      <div className={`
        absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity
        ${stand.status === 'AVAILABLE' ? 'bg-[#22C55E]' :
          stand.status === 'RESERVED' ? 'bg-[#F59E0B]' : 'bg-slate-400'}
      `} />

      <div className="relative flex items-start justify-between gap-4">
        {/* Left side: Icon + Info */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className={`
            flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center
            shadow-lg transform transition-transform duration-200
            ${stand.status === 'AVAILABLE' ? 'bg-gradient-to-br from-[#22C55E] to-emerald-600 text-white' :
              stand.status === 'RESERVED' ? 'bg-gradient-to-br from-[#F59E0B] to-orange-600 text-white' :
                'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700'}
            ${isSelected ? 'scale-110 rotate-6' : ''}
          `}>
            {stand.status === 'RESERVED' ? <Lock size={22} strokeWidth={2.5} /> : <MapPin size={22} strokeWidth={2.5} />}
          </div>

          <div className="text-left min-w-0 flex-1 pt-1">
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-xl font-black text-fcSlate tracking-tight font-sans">
                Stand {stand.number}
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badge.color} ${badge.pulse ? 'animate-pulse' : ''} font-sans`}>
                {badge.text}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2 font-sans">
              <Maximize2 size={12} className="text-gray-600" />
              <span>{stand.areaSqm.toLocaleString()} m²</span>
            </div>

            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-black text-fcGold font-mono">
                ${(stand.priceUsd / 1000).toFixed(0)}k
              </div>
              <div className="text-xs font-semibold text-gray-600 font-mono">
                ${pricePerSqm.toFixed(0)}/m²
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Arrow indicator */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-200
          ${stand.status === 'AVAILABLE'
            ? 'bg-[#22C55E]/10 text-[#22C55E]'
            : 'bg-slate-100 text-gray-600'
          }
          ${isSelected ? 'rotate-90 bg-fcGold text-white' : ''}
        `}>
          <ArrowRight size={18} strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
};

// Bottom Drawer Component
const BottomDrawer: React.FC<{
  stand: Stand | null;
  development: Development | null;
  onClose: () => void;
  onReserve: () => void;
  isReserving: boolean;
}> = ({ stand, development, onClose, onReserve, isReserving }) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [legalChecked, setLegalChecked] = useState({ refund: false, terms: false });
  const drawerRef = useRef<HTMLDivElement>(null);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    if (currentY > 100) onClose();
    setCurrentY(0);
  };

  const canReserve = stand?.status === 'AVAILABLE' && legalChecked.refund && legalChecked.terms;
  const pricePerSqm = stand ? stand.priceUsd / stand.areaSqm : 0;

  if (!stand || !development) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gradient-to-b from-black/40 to-black/50 backdrop-blur-md z-[100] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-[101] animate-in slide-in-from-bottom-4 duration-300"
        style={{ transform: `translateY(${currentY}px)` }}
      >
        {/* Handle */}
        <div
          className="bg-white rounded-t-[32px] pb-3 pt-5 px-6 touch-manipulation"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-16 h-1.5 bg-slate-300 rounded-full mx-auto" />
        </div>

        {/* Content */}
        <div className="bg-white px-6 pb-48 max-h-[85vh] overflow-y-auto"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Timer Banner - For Reserved Stands */}
          {stand.status === 'RESERVED' && stand.reservationExpiresAt && (
            <div className="mb-6 -mx-6 px-6 py-4 bg-gradient-to-r from-[#F59E0B] to-amber-600">
              <ReservationTimer expiresAt={stand.reservationExpiresAt} />
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-black text-fcSlate tracking-tight font-sans mb-1">
                Stand {stand.number}
              </h2>
              <p className="text-sm font-semibold text-gray-600 font-sans">
                {development.name}, {development.locationName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-600 hover:text-gray-600 active:scale-90 transition-all touch-manipulation"
            >
              <X size={24} />
            </button>
          </div>

          {/* Promo Badge - If On Promotion */}
          {development.marketingBadgeType === 'On Promotion' && development.promoStandsCount && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-wider font-sans">
                    🔥 Limited Promotion
                  </div>
                  <div className="text-xs font-semibold opacity-90 font-sans">
                    Only {development.promoStandsCount} stands at this price!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="mb-6 p-8 rounded-3xl bg-gradient-to-br from-fcGold/10 via-amber-50 to-fcGold/5 border-2 border-fcGold/30 shadow-inner relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-fcGold/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-200/20 rounded-full blur-2xl -ml-12 -mb-12" />

            <div className="relative">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 font-sans flex items-center gap-2">
                    <DollarSign size={14} className="text-fcGold" />
                    Total Investment
                  </div>
                  <div className="text-5xl font-black text-fcGold font-mono tracking-tighter">
                    ${stand.priceUsd.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 font-sans">
                    Per m²
                  </div>
                  <div className="text-2xl font-black text-slate-700 font-mono">
                    ${pricePerSqm.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white/50 rounded-xl px-4 py-3 backdrop-blur-sm font-sans">
                <Maximize2 size={16} className="text-fcGold" />
                <span>Plot Size: <span className="text-fcSlate font-black">{stand.areaSqm.toLocaleString()} m²</span></span>
              </div>
            </div>
          </div>

          {/* Status Info */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#22C55E]/10 to-emerald-50 border-2 border-[#22C55E]/30 shadow-sm backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#22C55E]/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="relative">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 font-sans">
                  Status
                </div>
                <div className={`text-sm font-black font-sans flex items-center gap-2 ${stand.status === 'AVAILABLE' ? 'text-[#22C55E]' :
                  stand.status === 'RESERVED' ? 'text-[#F59E0B]' :
                    'text-gray-600'
                  }`}>
                  {stand.status === 'AVAILABLE' && (
                    <>
                      <div className="w-3 h-3 rounded-full bg-[#22C55E] animate-pulse shadow-lg shadow-[#22C55E]/50" />
                      Available Now
                    </>
                  )}
                  {stand.status === 'RESERVED' && '⏱️ Reserved'}
                  {stand.status === 'SOLD' && '✗ Sold Out'}
                </div>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/50 shadow-sm backdrop-blur-sm relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-amber-200/20 rounded-full blur-2xl -ml-10 -mb-10" />
              <div className="relative">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 font-sans flex items-center gap-1">
                  <Clock size={12} className="text-amber-600" />
                  Hold Period
                </div>
                <div className="text-sm font-black text-amber-600 font-sans">
                  48 Hours
                </div>
              </div>
            </div>
          </div>

          {/* Legal Gate - Only for Available Stands */}
          {stand.status === 'AVAILABLE' && (
            <>
              <div className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300/50 shadow-inner relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-200/20 rounded-full blur-3xl -ml-16 -mt-16" />
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-orange-200/20 rounded-full blur-2xl -mr-12 -mb-12" />

                <div className="relative">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-200/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                      <ShieldCheck size={20} className="text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 mb-1.5 font-sans">
                        Legal Requirements
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed font-sans">
                        Before proceeding, you must review and accept our legal terms.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all">
                      <input
                        type="checkbox"
                        checked={legalChecked.refund}
                        onChange={(e) => {
                          console.log('[FORENSIC][LEGAL_CONSENT]', {
                            type: 'refund_policy',
                            checked: e.target.checked,
                            standId: stand.id,
                            timestamp: new Date().toISOString()
                          });
                          setLegalChecked(prev => ({ ...prev, refund: e.target.checked }));
                        }}
                        className="mt-0.5 w-5 h-5 rounded border-2 border-amber-400 text-fcGold focus:ring-2 focus:ring-fcGold cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-gray-900 flex-1 font-sans">
                        I have read and agree to the{' '}
                        <a
                          href={development.refundPolicyUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fcGold underline hover:text-amber-700"
                          onClick={(e) => {
                            console.log('[FORENSIC][PDF_LINK_CLICK]', {
                              document: 'refund_policy',
                              url: development.refundPolicyUrl,
                              standId: stand.id,
                              timestamp: new Date().toISOString()
                            });
                          }}
                        >
                          Refund Policy
                        </a>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all">
                      <input
                        type="checkbox"
                        checked={legalChecked.terms}
                        onChange={(e) => {
                          console.log('[FORENSIC][LEGAL_CONSENT]', {
                            type: 'payment_terms',
                            checked: e.target.checked,
                            standId: stand.id,
                            timestamp: new Date().toISOString()
                          });
                          setLegalChecked(prev => ({ ...prev, terms: e.target.checked }));
                        }}
                        className="mt-0.5 w-5 h-5 rounded border-2 border-amber-400 text-fcGold focus:ring-2 focus:ring-fcGold cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-gray-900 flex-1 font-sans">
                        I have read and agree to the{' '}
                        <a
                          href={development.paymentTermsUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fcGold underline hover:text-amber-700"
                          onClick={(e) => {
                            console.log('[FORENSIC][PDF_LINK_CLICK]', {
                              document: 'payment_terms',
                              url: development.paymentTermsUrl,
                              standId: stand.id,
                              timestamp: new Date().toISOString()
                            });
                          }}
                        >
                          Payment Terms
                        </a>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sticky Reserve Button */}
              <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 z-[999] bg-white backdrop-blur-md border-t-2 border-slate-200 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                {/* Sell Now Button */}
                <button
                  onClick={() => {
                    console.log('[MOBILE_INVENTORY][SELL_NOW]', {
                      standId: stand.id,
                      standNumber: stand.number,
                      price: stand.priceUsd,
                      timestamp: new Date().toISOString()
                    });
                    onClose();
                    // Trigger sell flow via parent component
                    if (typeof window !== 'undefined' && (window as any).mobileInventory_handleSellNow) {
                      (window as any).mobileInventory_handleSellNow(stand);
                    }
                  }}
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-3 transition-all touch-manipulation active:scale-[0.97] font-sans shadow-lg bg-gradient-to-r from-fcGold to-amber-500 text-white hover:shadow-xl hover:shadow-fcGold/30 mb-3"
                >
                  <DollarSign size={20} />
                  <span>Sell Now</span>
                </button>

                <button
                  onClick={() => {
                    console.log('[FORENSIC][RESERVE_BUTTON_CLICK]', {
                      standId: stand.id,
                      standNumber: stand.number,
                      status: stand.status,
                      canReserve,
                      legalChecked,
                      isReserving,
                      timestamp: new Date().toISOString()
                    });

                    // Triple validation guard
                    if (stand.status !== 'AVAILABLE') {
                      console.error('[FORENSIC][BLOCKED_RESERVE]', {
                        reason: 'Stand not available',
                        status: stand.status,
                        timestamp: new Date().toISOString()
                      });
                      return;
                    }

                    if (!legalChecked.refund || !legalChecked.terms) {
                      console.error('[FORENSIC][BLOCKED_RESERVE]', {
                        reason: 'Legal terms not accepted',
                        refund: legalChecked.refund,
                        terms: legalChecked.terms,
                        timestamp: new Date().toISOString()
                      });
                      return;
                    }

                    if (isReserving) {
                      console.warn('[FORENSIC][DUPLICATE_RESERVE]', {
                        reason: 'Already processing',
                        timestamp: new Date().toISOString()
                      });
                      return;
                    }

                    onReserve();
                  }}
                  disabled={!canReserve || isReserving}
                  className={`
                    w-full h-14 rounded-2xl font-black uppercase tracking-wider text-sm
                    flex items-center justify-center gap-3 transition-all touch-manipulation
                    active:scale-[0.97] font-sans shadow-lg
                    ${canReserve && !isReserving
                      ? 'bg-gradient-to-r from-fcSlate to-slate-700 text-white hover:shadow-xl hover:shadow-fcSlate/30'
                      : 'bg-slate-200 text-gray-600 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  {isReserving ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      <span>Reserve Now</span>
                    </>
                  )}
                </button>
                {!canReserve && !isReserving && (
                  <p className="text-center text-xs text-gray-600 mt-3 font-semibold font-sans">
                    ⚠️ Accept both legal terms to continue
                  </p>
                )}
              </div>
            </>
          )}

          {/* Reserved/Sold Status Message */}
          {stand.status !== 'AVAILABLE' && (
            <div className="mb-6 p-5 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-gray-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-slate-700 mb-1 font-sans">
                    {stand.status === 'RESERVED' ? 'Currently Reserved' : 'No Longer Available'}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed font-sans">
                    {stand.status === 'RESERVED'
                      ? 'This stand is currently on hold. It will become available if the reservation expires.'
                      : 'This stand has been sold and is no longer available for reservation.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Skeleton Loader
const InventorySkeleton = () => (
  <div className="space-y-4 px-4 animate-pulse">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
    ))}
  </div>
);

export const MobileInventory: React.FC<MobileInventoryProps> = ({ activeBranch }) => {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | StandStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Payment modal state for "Sell Now" feature
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStandForSale, setSelectedStandForSale] = useState<Stand | null>(null);

  // Map ref for touch-optimized map view
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any | null>(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const devs = await getDevelopments(activeBranch);
      setDevelopments(devs);
      // Default to null/ALL for consolidated view
      setSelectedDev(null);
      setIsLoading(false);
    };
    init();
  }, [activeBranch]);

  useEffect(() => {
    if (selectedDev) {
      loadStands();
    }
  }, [selectedDev?.id]);

  const loadStands = async () => {
    try {
      setIsLoading(true);

      const baseUrl = selectedDev ? `/api/stands/by-development?developmentId=${selectedDev.id}` : `/api/admin/stands?branch=${activeBranch}`;
      const metricsUrl = selectedDev ? `/api/developments/${selectedDev.id}/metrics` : `/api/stands/inventory?branch=${activeBranch}`; // Fallback or unified endpoint

      const [standsRes, metricsRes] = await Promise.all([
        fetch(baseUrl),
        fetch(metricsUrl)
      ]);

      if (!standsRes.ok || !metricsRes.ok) {
        console.error('[UI] API fetch failed', {
          standsOk: standsRes.ok,
          metricsOk: metricsRes.ok
        });
        setStands([]);
        setSummary({ total: 0, available: 0, reserved: 0, sold: 0, totalValue: 0 });
        return;
      }

      const resObj = await standsRes.json();
      const metricsObj = await metricsRes.json();

      const apiStands = resObj.data?.stands || [];
      const metrics = (metricsObj.data || metricsObj.summary || metricsObj) as any;

      console.log('[UI] Loaded stands and metrics', {
        standCount: apiStands.length,
        metrics
      });

      // Transform API response to match Stand interface
      const transformedStands = apiStands.map((stand: any) => ({
        id: stand.id,
        number: stand.standNumber,
        status: stand.status,
        areaSqm: Number(stand.sizeSqm || 0),
        priceUsd: Number(stand.price || 0),
        pricePerSqm: Number(stand.pricePerSqm || 0),
        developmentId: stand.developmentId,
        developmentName: stand.development?.name || 'Unknown',
        branch: stand.branch,
        coordinates: stand.geoJsonData?.geometry?.coordinates || [],
        reservationExpiresAt: stand.reservationExpiresAt,
        reservedBy: stand.reservedBy,
      }));

      setStands(transformedStands || []);

      // Calculate summary locally for UI consistency (Available/Reserved)
      const localSummary = {
        AVAILABLE: transformedStands.filter((s: any) => s.status === 'AVAILABLE').length,
        RESERVED: transformedStands.filter((s: any) => s.status === 'RESERVED').length,
        SOLD: transformedStands.filter((s: any) => s.status === 'SOLD').length,
        TOTAL: transformedStands.length
      };

      setSummary(localSummary);
    } catch (error) {
      console.error('[UI] loadStands error:', error);
      setStands([]);
      setSummary({ total: 0, available: 0, reserved: 0, sold: 0, totalValue: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStands = useMemo(() => {
    return stands
      .filter(s => statusFilter === 'ALL' || s.status === statusFilter)
      .filter(s => s.number.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stands, statusFilter, searchQuery]);

  const handleReserve = async () => {
    if (!selectedStand) {
      console.error('[FORENSIC][RESERVE_ERROR]', {
        reason: 'No stand selected',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('[FORENSIC][RESERVATION_START]', {
      standId: selectedStand.id,
      standNumber: selectedStand.number,
      status: selectedStand.status,
      price: selectedStand.priceUsd,
      area: selectedStand.areaSqm,
      developmentId: selectedDev?.id,
      timestamp: new Date().toISOString()
    });

    setIsReserving(true);
    const termsAcceptedAt = new Date().toISOString();

    try {
      console.log('[FORENSIC][SUPABASE_CALL]', {
        standId: selectedStand.id,
        termsAcceptedAt,
        userAgent: navigator.userAgent,
        touchDevice: 'ontouchstart' in window,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        timestamp: new Date().toISOString()
      });

      await reserveStand(selectedStand.id, 'admin-1', 'Agent', termsAcceptedAt);

      console.log('[FORENSIC][RESERVATION_SUCCESS]', {
        standId: selectedStand.id,
        termsAcceptedAt,
        expiresIn: '48 hours',
        timestamp: new Date().toISOString()
      });

      await loadStands();
      setIsReserving(false);
      setSelectedStand(null);

      console.log('[FORENSIC][DRAWER_CLOSED]', {
        reason: 'Reservation complete',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[FORENSIC][RESERVATION_FAILED]', {
        standId: selectedStand.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      setIsReserving(false);
    }
  };

  // Handler for "Sell Now" button
  const handleSellNow = (stand: Stand) => {
    console.log('[MOBILE_INVENTORY][SELL_NOW]', {
      standId: stand.id,
      standNumber: stand.number,
      price: stand.priceUsd,
      timestamp: new Date().toISOString()
    });
    setSelectedStandForSale(stand);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async () => {
    setShowPaymentModal(false);
    setSelectedStandForSale(null);
    await loadStands(); // Refresh inventory after payment
  };

  // Expose handler globally for BottomDrawer to access
  useEffect(() => {
    (window as any).mobileInventory_handleSellNow = handleSellNow;
    return () => {
      delete (window as any).mobileInventory_handleSellNow;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full min-w-0 min-h-screen bg-white pt-4 pb-24">
        <div className="mb-6 px-4">
          <div className="h-8 bg-slate-200 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-slate-100 rounded w-32" />
        </div>
        <InventorySkeleton />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50">
        <h1 className="text-2xl font-black text-fcSlate tracking-tight font-sans mb-1">
          Stand Inventory
        </h1>
        <p className="text-sm font-semibold text-gray-600 font-sans">
          {activeBranch} Regional Node
        </p>
      </div>

      {/* Summary Cards */}
      <div className="px-4 py-6 grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 font-sans">
            Available
          </div>
          <div className="text-3xl font-black text-[#22C55E] font-mono">
            {summary.AVAILABLE || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 font-sans">
            Reserved
          </div>
          <div className="text-3xl font-black text-[#F59E0B] font-mono">
            {summary.RESERVED || 0}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
          <input
            type="text"
            placeholder="Search stand number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-semibold focus:border-fcGold focus:ring-2 focus:ring-fcGold/20 outline-none transition-all font-sans"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {(['ALL', 'AVAILABLE', 'RESERVED', 'SOLD'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`
                px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap
                transition-all touch-manipulation active:scale-95 font-sans
                ${statusFilter === filter
                  ? 'bg-fcGold text-white shadow-lg'
                  : 'bg-white text-gray-600 border-2 border-slate-100'
                }
              `}
            >
              {filter === 'ALL' ? 'All Stands' : filter}
            </button>
          ))}
        </div>

        {/* Development Selector */}
        <select
          value={selectedDev?.id || 'ALL'}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'ALL') {
              setSelectedDev(null);
            } else {
              const d = developments.find(dev => dev.id === val);
              if (d) setSelectedDev(d);
            }
          }}
          className="w-full h-12 px-4 bg-fcSlate text-white text-xs font-bold uppercase tracking-wider rounded-2xl border-none outline-none appearance-none font-sans"
        >
          <option value="ALL">All Developments</option>
          {developments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Stand List */}
      <div className="px-4 space-y-3">
        {filteredStands.length === 0 ? (
          <div className="py-20 text-center">
            <Search size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-sm font-bold text-gray-600 uppercase tracking-wider font-sans">
              No stands found
            </p>
          </div>
        ) : (
          filteredStands.map(stand => (
            <TouchStandCard
              key={stand.id}
              stand={stand}
              onClick={() => {
                console.log('[FORENSIC][STAND_TAP]', {
                  standId: stand.id,
                  standNumber: stand.number,
                  status: stand.status,
                  isAvailable: stand.status === 'AVAILABLE',
                  timestamp: new Date().toISOString(),
                  touchDevice: 'ontouchstart' in window
                });

                // Only allow selection of Available stands
                if (stand.status === 'AVAILABLE') {
                  setSelectedStand(stand);
                  console.log('[FORENSIC][DRAWER_OPEN]', {
                    standId: stand.id,
                    standNumber: stand.number,
                    price: stand.priceUsd,
                    area: stand.areaSqm,
                    timestamp: new Date().toISOString()
                  });
                } else {
                  console.warn('[FORENSIC][BLOCKED_TAP]', {
                    standId: stand.id,
                    status: stand.status,
                    reason: 'Stand not available',
                    timestamp: new Date().toISOString()
                  });
                }
              }}
              isSelected={selectedStand?.id === stand.id}
            />
          ))
        )}
      </div>

      {/* Bottom Drawer */}
      {selectedStand && (
        <BottomDrawer
          stand={selectedStand}
          development={selectedDev}
          onClose={() => setSelectedStand(null)}
          onReserve={handleReserve}
          isReserving={isReserving}
        />
      )}

      {/* Payment Modal for "Sell Now" */}
      {showPaymentModal && selectedStandForSale && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full h-full max-w-full max-h-full overflow-hidden shadow-2xl">
            <div className="px-4 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-fcGold/10 to-amber-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-fcGold/20 rounded-lg">
                  <DollarSign size={20} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Sell Stand {selectedStandForSale.number}</h3>
                  <p className="text-xs text-gray-600">
                    ${selectedStandForSale.priceUsd.toLocaleString()} • {selectedStandForSale.areaSqm}m²
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedStandForSale(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-80px)]">
              <PaymentModule
                activeBranch={activeBranch}
                prefilledStand={{
                  id: selectedStandForSale.id,
                  number: selectedStandForSale.number,
                  developmentName: selectedDev?.name || 'Unknown',
                  status: selectedStandForSale.status,
                  priceUsd: selectedStandForSale.priceUsd,
                  areaSqm: selectedStandForSale.areaSqm
                }}
                onPaymentComplete={handlePaymentComplete}
                embeddedMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
