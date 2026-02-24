'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Home,
  DollarSign,
  CheckCircle2,
  XCircle,
  Calendar,
  Phone,
  Mail,
  Building2,
  Droplet,
  Zap,
  TreePine,
  Wifi,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Info,
  Map,
  Filter
} from 'lucide-react';
import { InteractiveDevelopmentMap } from './InteractiveDevelopmentMap';
import { ReservationDrawer } from './ReservationDrawer';
import { ReservationFlowModal } from './ReservationFlowModal';
import { DevelopmentFeeSummary } from './DevelopmentFeeSummary';
import { StandFeeCalculator } from './StandFeeCalculator';

interface DevelopmentDetailViewProps {
  developmentId: string;
  userRole: string;
  onBack?: () => void;
  onReserve?: (developmentId: string, standId: string) => void;
}

interface Development {
  id: string;
  name: string;
  location: string;
  type: string;
  phase: string;
  description?: string;
  overview?: string;
  image_urls?: string[];
  price_per_sqm?: number;
  total_stands?: number;
  available_stands?: number;
  reserved_stands?: number;
  sold_stands?: number;
  amenities?: string[];
  features?: string[];
  infrastructure?: {
    water: boolean;
    electricity: boolean;
    roads: boolean;
    sewerage: boolean;
  };
  agent?: {
    name: string;
    phone: string;
    email: string;
  };
  disable_map_view?: boolean;
}

interface Stand {
  id: string;
  standNumber: string;
  size: number;
  price: number;
  basePrice?: number;
  discountPercent?: number | null;
  discountedPrice?: number | null;
  hasDiscount?: boolean;
  status: string;
  development?: {
    name: string;
  };
}

export function DevelopmentDetailView({
  developmentId,
  userRole,
  onBack,
  onReserve
}: DevelopmentDetailViewProps) {
  const [development, setDevelopment] = useState<Development | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReserving, setIsReserving] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [capturedReservationData, setCapturedReservationData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map'); // Default to map view

  useEffect(() => {
    loadDevelopmentDetails();
  }, [developmentId]);

  const loadDevelopmentDetails = async () => {
    setIsLoading(true);
    try {
      // Fetch development details
      const devResponse = await fetch(`/api/admin/developments?id=${developmentId}`);
      if (devResponse.ok) {
        const devData = await devResponse.json();
        const dev = devData.data?.[0] || null;
        setDevelopment(dev);

        // Set view mode based on development's disableMapView property
        if (dev?.disable_map_view) {
          setViewMode('grid');
        }
      }

      // Fetch all stands for map (shows available, reserved, sold)
      const standsResponse = await fetch(`/api/admin/stands?developmentId=${developmentId}`);
      if (standsResponse.ok) {
        const standsData = await standsResponse.json();
        setStands(standsData.data || []);
      }
    } catch (error) {
      console.error('[DevelopmentDetailView] Error loading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReserveClick = () => {
    if (!selectedStand) {
      alert('Please select a stand to reserve');
      return;
    }
    setShowReserveModal(true);
  };

  const handleConfirmReserve = async () => {
    if (!selectedStand || !development) return;

    setIsReserving(true);
    try {
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: selectedStand.id,
          developmentId: development.id,
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Capture reservation data from API response
        const reservationData = result.data;

        // Success! Show reservation details before redirect
        if (onReserve) {
          onReserve(development.id, selectedStand.id);
        }

        // Store reservation data for display (could be passed to a success modal)
        // For now, redirect to dashboard where reservation will be shown
        // TODO: Could show success modal with reservationData here
        window.location.href = '/dashboards/client';
      } else {
        const errorMsg = result.error || result.message || 'Failed to create reservation. Please try again.';
        alert(errorMsg);
      }
    } catch (error) {
      console.error('[DevelopmentDetailView] Reserve error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsReserving(false);
      setShowReserveModal(false);
    }
  };

  const nextImage = () => {
    if (development?.image_urls && development.image_urls.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === development.image_urls!.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (development?.image_urls && development.image_urls.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? development.image_urls!.length - 1 : prev - 1
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-fcGold mx-auto" />
          <p className="text-slate-600 font-medium">Loading development details...</p>
        </div>
      </div>
    );
  }

  if (!development) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Development Not Found</h2>
          <p className="text-slate-600">The requested development could not be found.</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-6 py-3 bg-fcGold text-white rounded-xl font-bold hover:bg-fcGold/90 transition-all"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Filter valid images - must be absolute HTTP/HTTPS URLs
  const images = (development.image_urls || []).filter(url => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed !== '' && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
  });
  const hasImages = images.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-white">
      {/* Back Button */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-700 hover:text-fcGold transition-colors font-medium"
            >
              <ChevronLeft size={20} />
              Back to Developments
            </button>
          </div>
        </div>
      )}

      {/* Hero Image Gallery */}
      <div className="relative w-full h-[250px] sm:h-[350px] md:h-[400px] lg:h-[500px] bg-slate-900">
        {hasImages ? (
          <>
            <Image
              src={images[currentImageIndex]}
              alt={development.name}
              fill
              className="object-cover"
              priority
              unoptimized={!images[currentImageIndex]?.includes('ufs.sh') && !images[currentImageIndex]?.includes('supabase.co')}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && parent.parentElement) {
                  parent.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900"><svg class="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>';
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full transition-all"
                >
                  <ChevronLeft className="text-white" size={24} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full transition-all"
                >
                  <ChevronRight className="text-white" size={24} />
                </button>

                {/* Image Indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-8' : 'bg-white/50'
                        }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Development Name Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black text-white mb-2 drop-shadow-lg">
                  {development.name}
                </h1>
                <div className="flex items-center gap-2 text-white/90">
                  <MapPin size={18} />
                  <span className="text-lg font-medium">{development.location}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="text-center space-y-4">
              <Building2 className="w-24 h-24 text-white/20 mx-auto" />
              <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
                {development.name}
              </h1>
              <div className="flex items-center justify-center gap-2 text-white/80">
                <MapPin size={18} />
                <span className="text-lg font-medium">{development.location}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-fcGold/10 rounded-xl">
                  <Info size={24} className="text-fcGold" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-3xl font-black text-fcGold mb-1">
                    {development.total_stands || 0}
                  </div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Total Stands
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <div className="text-3xl font-black text-green-600 mb-1">
                    {development.available_stands || 0}
                  </div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Available
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-xl">
                  <div className="text-3xl font-black text-orange-600 mb-1">
                    {development.reserved_stands || 0}
                  </div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Reserved
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-3xl font-black text-blue-600 mb-1">
                    {development.sold_stands || 0}
                  </div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Sold
                  </div>
                </div>
              </div>

              {development.overview && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Overview</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{development.overview}</p>
                </div>
              )}

              {development.description && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Description</h3>
                  <p className="text-slate-600 leading-relaxed">{development.description}</p>
                </div>
              )}
            </div>

            {/* Infrastructure Card */}
            {development.infrastructure && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <Building2 size={24} className="text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Infrastructure</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${development.infrastructure.water ? 'bg-blue-50' : 'bg-slate-50'
                    }`}>
                    <Droplet className={development.infrastructure.water ? 'text-blue-600' : 'text-slate-400'} size={24} />
                    <div>
                      <div className="font-bold text-sm text-slate-900">Water</div>
                      <div className={`text-xs font-medium ${development.infrastructure.water ? 'text-blue-600' : 'text-slate-400'
                        }`}>
                        {development.infrastructure.water ? 'Available' : 'Not Available'}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-xl ${development.infrastructure.electricity ? 'bg-yellow-50' : 'bg-slate-50'
                    }`}>
                    <Zap className={development.infrastructure.electricity ? 'text-yellow-600' : 'text-slate-400'} size={24} />
                    <div>
                      <div className="font-bold text-sm text-slate-900">Electricity</div>
                      <div className={`text-xs font-medium ${development.infrastructure.electricity ? 'text-yellow-600' : 'text-slate-400'
                        }`}>
                        {development.infrastructure.electricity ? 'Available' : 'Not Available'}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-xl ${development.infrastructure.roads ? 'bg-slate-100' : 'bg-slate-50'
                    }`}>
                    <TreePine className={development.infrastructure.roads ? 'text-slate-700' : 'text-slate-400'} size={24} />
                    <div>
                      <div className="font-bold text-sm text-slate-900">Roads</div>
                      <div className={`text-xs font-medium ${development.infrastructure.roads ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                        {development.infrastructure.roads ? 'Available' : 'Not Available'}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-xl ${development.infrastructure.sewerage ? 'bg-green-50' : 'bg-slate-50'
                    }`}>
                    <Wifi className={development.infrastructure.sewerage ? 'text-green-600' : 'text-slate-400'} size={24} />
                    <div>
                      <div className="font-bold text-sm text-slate-900">Sewerage</div>
                      <div className={`text-xs font-medium ${development.infrastructure.sewerage ? 'text-green-600' : 'text-slate-400'
                        }`}>
                        {development.infrastructure.sewerage ? 'Available' : 'Not Available'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features & Amenities */}
            {((development.features && development.features.length > 0) || (development.amenities && development.amenities.length > 0)) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <CheckCircle2 size={24} className="text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Features & Amenities</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {development.features && development.features.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Features</h3>
                      <ul className="space-y-3">
                        {development.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-3">
                            <CheckCircle2 size={18} className="text-fcGold shrink-0" />
                            <span className="text-slate-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {development.amenities && development.amenities.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Amenities</h3>
                      <ul className="space-y-3">
                        {development.amenities.map((amenity, idx) => (
                          <li key={idx} className="flex items-center gap-3">
                            <CheckCircle2 size={18} className="text-fcGold shrink-0" />
                            <span className="text-slate-700">{amenity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Available Stands */}
            {userRole === 'CLIENT' && stands.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-fcGold/10 rounded-xl">
                      {viewMode === 'map' ? (
                        <Map size={24} className="text-fcGold" />
                      ) : (
                        <Grid3x3 size={24} className="text-fcGold" />
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Select a Stand</h2>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() => setViewMode('map')}
                      disabled={development?.disable_map_view}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'map' && !development?.disable_map_view
                        ? 'bg-white text-fcGold shadow-sm'
                        : development?.disable_map_view
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Map size={18} />
                      Map View
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      disabled={development?.disable_map_view}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'grid'
                        ? 'bg-white text-fcGold shadow-sm'
                        : development?.disable_map_view
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Grid3x3 size={18} />
                      Grid View
                    </button>
                  </div>
                </div>

                {/* Interactive Map View */}
                {viewMode === 'map' && (
                  <InteractiveDevelopmentMap
                    developmentId={developmentId}
                    stands={stands}
                    selectedStandId={selectedStand?.id || null}
                    onStandSelect={(stand) => setSelectedStand(stand)}
                    onViewToggle={() => setViewMode('grid')}
                  />
                )}

                {/* Grid View */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {stands.map((stand: any) => {
                      const hasDiscount = stand.hasDiscount && stand.discountPercent && stand.discountPercent > 0;
                      const displayPrice = hasDiscount && stand.discountedPrice ? stand.discountedPrice : stand.price;
                      const basePrice = stand.basePrice || stand.price;

                      return (
                        <button
                          key={stand.id}
                          onClick={() => setSelectedStand(stand)}
                          className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${selectedStand?.id === stand.id
                            ? 'border-fcGold bg-fcGold/5 shadow-lg'
                            : 'border-gray-200 hover:border-fcGold/50'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-lg font-bold text-slate-900">
                              Stand {stand.standNumber}
                            </div>
                            {hasDiscount && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full uppercase tracking-wide">
                                DISCOUNT {stand.discountPercent}%
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-600 mb-2">
                            {stand.size} m²
                          </div>
                          <div className="space-y-1">
                            {hasDiscount && (
                              <div className="text-sm text-slate-400 line-through">
                                ${basePrice.toLocaleString()}
                              </div>
                            )}
                            <div className="text-xl font-black text-fcGold">
                              ${displayPrice.toLocaleString()}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            {development.price_per_sqm && (
              <div className="bg-gradient-to-br from-fcGold to-amber-500 rounded-2xl p-8 shadow-xl text-white sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <DollarSign size={32} />
                  <div>
                    <div className="text-sm font-medium opacity-90">Starting From</div>
                    <div className="text-4xl font-black">
                      ${development.price_per_sqm}/m²
                    </div>
                  </div>
                </div>

                {selectedStand && (
                  <div className="mb-6 p-4 bg-white/20 backdrop-blur-sm rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Selected Stand</div>
                      {(selectedStand as any).hasDiscount && (selectedStand as any).discountPercent && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full uppercase tracking-wide">
                          DISCOUNT {(selectedStand as any).discountPercent}%
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black mb-1">Stand {selectedStand.standNumber}</div>
                    <div className="text-lg space-y-1">
                      <div>{selectedStand.size} m²</div>
                      {(selectedStand as any).hasDiscount && (selectedStand as any).basePrice && (
                        <div className="text-sm line-through opacity-75">
                          ${((selectedStand as any).basePrice || selectedStand.price).toLocaleString()}
                        </div>
                      )}
                      <div className="text-lg font-bold">
                        ${((selectedStand as any).discountedPrice || selectedStand.price).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {userRole === 'CLIENT' && (
                  <button
                    onClick={handleReserveClick}
                    disabled={!selectedStand}
                    className={`w-full py-4 rounded-xl font-black text-lg transition-all ${selectedStand
                      ? 'bg-white text-fcGold hover:bg-slate-50 hover:scale-105 shadow-lg'
                      : 'bg-white/20 text-white/50 cursor-not-allowed'
                      }`}
                  >
                    Reserve Now
                  </button>
                )}

                {userRole !== 'CLIENT' && (
                  <div className="text-center text-white/90 text-sm">
                    <ShieldCheck size={24} className="mx-auto mb-2" />
                    Admin View Only
                  </div>
                )}
              </div>
            )}

            {/* Development Fee Summary */}
            <DevelopmentFeeSummary
              developmentId={developmentId}
              standPrice={selectedStand?.price || (development?.price_per_sqm ? selectedStand?.size || 100 * development.price_per_sqm : 100000)}
            />

            {/* Stand Fee Calculator - Show when stand is selected */}
            {selectedStand && (
              <StandFeeCalculator
                standId={selectedStand.id}
                standNumber={selectedStand.standNumber}
                developmentName={development?.name || 'Development'}
                defaultDeposit={30}
                defaultMonths={24}
              />
            )}

            {/* Agent Contact Card */}
            {development.agent && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Contact Agent</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Agent</div>
                    <div className="font-bold text-slate-900">{development.agent.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-fcGold" />
                    <a href={`tel:${development.agent.phone}`} className="text-slate-700 hover:text-fcGold">
                      {development.agent.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-fcGold" />
                    <a href={`mailto:${development.agent.email}`} className="text-slate-700 hover:text-fcGold">
                      {development.agent.email}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reserve Drawer (New Quick Flow) */}
      {showReserveModal && selectedStand && (
        <ReservationDrawer
          selectedStand={{
            id: selectedStand.id,
            number: selectedStand.standNumber,
            price_usd: selectedStand.price,
            price_per_sqm: development?.price_per_sqm,
            area_sqm: selectedStand.size,
            developmentName: development?.name,
            developmentId: developmentId,
            status: selectedStand.status
          }}
          user={{
            isLoggedIn: userRole === 'CLIENT',
            // In a real implementation, fetch actual user session here
          }}
          agents={development?.agent ? [{
            id: 'dev-agent',
            name: development.agent.name,
            phone: development.agent.phone,
            email: development.agent.email
          }] : []}
          onReserve={async (standId, data) => {
            try {
              const response = await fetch('/api/auth/create-account-from-reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email,
                  name: data.fullName,
                  phone: data.phone,
                  reservationData: {
                    standId,
                    agentId: data.agentId,
                    attributionType: data.attributionType
                  }
                })
              });

              const result = await response.json();

              if (response.ok && result.success) {
                // Success - Capture data and show success modal
                const resData = result.data?.reservation || result.data;
                setCapturedReservationData(resData);
                setShowReserveModal(false);
                setShowSuccessModal(true);

                return { success: true, reservationId: resData?.id };
              } else {
                return { success: false, error: result.error || 'Reservation failed' };
              }
            } catch (error) {
              return { success: false, error: 'An unexpected error occurred' };
            }
          }}
          onClose={() => setShowReserveModal(false)}
          onRequestCallback={(data) => {
            // Handle callback request
            console.log('Callback requested:', data);
          }}
        />
      )}

      {/* Success Modal (using Unified ReservationFlowModal) */}
      {showSuccessModal && selectedStand && capturedReservationData && (
        <ReservationFlowModal
          selectedStand={{
            id: selectedStand.id,
            number: selectedStand.standNumber,
            price_usd: selectedStand.price,
            price_per_sqm: development?.price_per_sqm,
            area_sqm: selectedStand.size,
            developmentName: development?.name,
            developmentId: developmentId,
          }}
          reservationData={capturedReservationData}
          onConfirm={() => { }} // Not needed for success state
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
}
