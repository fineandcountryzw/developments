
import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Target, Maximize2, Users, MapPin, Filter, Search,
  LayoutGrid, Map as MapIcon, ShieldCheck, CheckCircle2,
  Clock, AlertCircle, TrendingUp, ArrowRight, Loader2, X, DollarSign
} from 'lucide-react';
import { Stand, StandStatus, Branch, Development } from '../types.ts';
import { reserveStand } from '../lib/db';
import { LegalConsentModal } from './LegalConsentModal.tsx';
import { PaymentModule } from './PaymentModule.tsx';
import { PageContainer, SectionHeader } from '@/components/layouts';

interface InventoryProps {
  activeBranch: Branch;
}

export const Inventory: React.FC<InventoryProps> = ({ activeBranch }) => {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | StandStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isReserving, setIsReserving] = useState<string | null>(null);
  const [reservationTarget, setReservationTarget] = useState<Stand | null>(null);
  const [showLegalConsent, setShowLegalConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Payment modal state for "Sell Now" feature
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStandForSale, setSelectedStandForSale] = useState<Stand | null>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any | null>(null);

  // Fetch all stands and developments for the branch on load
  useEffect(() => {
    loadAllStands();
    fetchDevelopments();
  }, [activeBranch]);

  const fetchDevelopments = async () => {
    try {
      const res = await fetch('/api/stands/developments');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDevelopments(data.developments || []);
        }
      }
    } catch (error) {
      console.error('[INVENTORY] Failed to fetch developments:', error);
    }
  };

  const loadAllStands = async () => {
    setIsLoading(true);
    try {
      // Fetch ALL stands for this branch (no development filter)
      const apiUrl = `/api/admin/stands?branch=${activeBranch}`;
      console.log('[INVENTORY] Fetching all stands for branch:', {
        branch: activeBranch,
        url: apiUrl
      });

      const standsResponse = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!standsResponse.ok) {
        let errorData: any = {};
        let errorText = '';
        try {
          const contentType = standsResponse.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            errorData = await standsResponse.json();
          } else {
            errorText = await standsResponse.text();
          }
        } catch (e) {
          console.error('[INVENTORY] Failed to parse error:', e);
        }

        const errorMsg = errorData.error || errorText || `API Error ${standsResponse.status}`;
        console.error('[INVENTORY] API Error:', { status: standsResponse.status, error: errorMsg });
        throw new Error(errorMsg);
      }

      const standsResult = await standsResponse.json();
      const apiStands = standsResult.data?.stands || [];

      console.log('[INVENTORY] Fetched all stands:', {
        totalStands: apiStands.length,
        branch: activeBranch
      });

      // Transform API response
      const transformedStands = apiStands.map((stand: any) => ({
        id: stand.id,
        number: stand.standNumber,
        status: stand.status,
        areaSqm: Number(stand.sizeSqm || 0),
        priceUsd: Number(stand.price || 0),
        pricePerSqm: Number(stand.pricePerSqm || 0),
        coordinates: stand.geoJsonData?.geometry?.coordinates || [],
        developmentId: stand.developmentId,
        branch: stand.branch,
        reservedBy: stand.reservedBy,
        createdAt: stand.createdAt,
        updatedAt: stand.updatedAt,
        development: stand.development ? {
          id: stand.development.id,
          name: stand.development.name,
          location: stand.development.location
        } : null
      }));

      setStands(transformedStands);

      // Calculate comprehensive summary
      const summary = {
        TOTAL: transformedStands.length,
        AVAILABLE: transformedStands.filter((s: Stand) => s.status === 'AVAILABLE').length,
        RESERVED: transformedStands.filter((s: Stand) => s.status === 'RESERVED').length,
        SOLD: transformedStands.filter((s: Stand) => s.status === 'SOLD').length,
        WITHDRAWN: transformedStands.filter((s: Stand) => s.status === 'WITHDRAWN').length,
      };
      setSummary(summary);
      setLastUpdateTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      console.log('[INVENTORY] Summary:', summary);
    } catch (error) {
      console.error('[INVENTORY] Error loading stands:', error instanceof Error ? error.message : String(error));
      setStands([]);
      setSummary({
        TOTAL: 0,
        AVAILABLE: 0,
        RESERVED: 0,
        SOLD: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStands = useMemo(() => {
    return stands
      .filter(s => statusFilter === 'ALL' || s.status === statusFilter)
      .filter(s => !selectedDev || s.developmentId === selectedDev.id)
      .filter(s => s.number.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stands, statusFilter, selectedDev, searchQuery]);

  // Update summary when filtered stands change
  useEffect(() => {
    const newSummary = {
      TOTAL: filteredStands.length,
      AVAILABLE: filteredStands.filter((s: Stand) => s.status === 'AVAILABLE').length,
      RESERVED: filteredStands.filter((s: Stand) => s.status === 'RESERVED').length,
      SOLD: filteredStands.filter((s: Stand) => s.status === 'SOLD').length,
      WITHDRAWN: filteredStands.filter((s: Stand) => s.status === 'WITHDRAWN').length,
    };
    setSummary(newSummary);
  }, [filteredStands]);

  // Map Initialization logic
  useEffect(() => {
    if (viewMode === 'map' && mapContainerRef.current && !mapRef.current) {
      const defaultCenter: L.LatLngExpression = selectedDev
        ? [selectedDev.latitude ?? -17.8248, selectedDev.longitude ?? 31.0530]
        : [-17.8248, 31.0530];

      mapRef.current = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: selectedDev ? 17 : 13,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Position zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
      }).addTo(mapRef.current);

      // Create a bounds object to collect all stand boundaries
      const allBounds = L.latLngBounds([]);

      filteredStands.forEach(stand => {
        if (stand.coordinates.length > 0) {
          const color = stand.status === 'AVAILABLE' ? '#22C55E' :
            stand.status === 'RESERVED' ? '#F59E0B' : '#EF4444';

          const poly = L.polygon(stand.coordinates as L.LatLngExpression[], {
            color: color,
            weight: 2,
            fillOpacity: 0.5,
            fillColor: color,
            className: 'cursor-pointer hover:fill-opacity-70 transition-all'
          }).addTo(mapRef.current!);

          // Extend bounds to include this polygon
          allBounds.extend(poly.getBounds());

          // Add stand number label in center
          const center = poly.getBounds().getCenter();
          const displayStatus = stand.status === 'SOLD' ? 'TAKEN' : stand.status;
          const label = L.divIcon({
            html: `<div style="
              background: ${color};
              color: white;
              padding: 3px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              border: 1px solid rgba(255,255,255,0.4);
            ">${stand.number}</div>`,
            className: 'stand-label',
            iconSize: [60, 20],
            iconAnchor: [30, 10]
          });
          L.marker(center, { icon: label, interactive: false }).addTo(mapRef.current!);

          poly.bindTooltip(`Stand ${stand.number} - ${displayStatus}`, { permanent: false, direction: 'top' });
          poly.on('click', () => {
            if (stand.status === 'AVAILABLE') setReservationTarget(stand);
          });
        }
      });

      // Fit map to show all stands with padding
      if (allBounds.isValid() && mapRef.current) {
        mapRef.current.fitBounds(allBounds, {
          padding: [40, 40],
          maxZoom: 18,
          animate: true
        });
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [viewMode, selectedDev, filteredStands]);

  const handleReserve = async (stand: Stand) => {
    // Show legal consent modal first
    setReservationTarget(stand);
    setShowLegalConsent(true);
  };

  const handleLegalConsentConfirm = async () => {
    if (!reservationTarget) return;

    setShowLegalConsent(false);
    setIsReserving(reservationTarget.id);

    try {
      // Record terms acceptance timestamp
      const termsAcceptedAt = new Date().toISOString();
      console.log('[FORENSIC][LEGAL CONSENT]', {
        standId: reservationTarget.id,
        developmentId: selectedDev?.id,
        termsAcceptedAt,
        clientTimestamp: termsAcceptedAt
      });

      await reserveStand(reservationTarget.id, 'admin-1', 'Agent', termsAcceptedAt);
      await loadAllStands();

      // Success notification
      console.log('✅ Stand reserved successfully:', reservationTarget.number);
      alert(`✅ Stand ${reservationTarget.number} reserved successfully!`);
    } catch (error) {
      console.error('❌ Failed to reserve stand:', error);
      alert(`❌ Failed to reserve stand. Please try again.`);
    } finally {
      setIsReserving(null);
      setReservationTarget(null);
    }
  };

  // Handler for "Sell Now" button
  const handleSellNow = (stand: Stand, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[INVENTORY][SELL_NOW]', {
      standId: stand.id,
      standNumber: stand.number,
      price: stand.priceUsd,
      timestamp: new Date().toISOString()
    });
    setSelectedStandForSale(stand);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async () => {
    const standNumber = selectedStandForSale?.number;
    setShowPaymentModal(false);
    setSelectedStandForSale(null);
    await loadAllStands(); // Refresh inventory after payment

    // Success notification
    console.log('✅ Stand sold successfully:', standNumber);
    alert(`✅ Stand ${standNumber} sold successfully! Payment recorded.`);
  };

  const getStatusColor = (status: StandStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20';
      case 'RESERVED': return 'text-[#85754E] bg-[#85754E]/10 border-[#85754E]/20';
      case 'SOLD': return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
      default: return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  const getStandIndicator = (status: StandStatus) => {
    switch (status) {
      case 'AVAILABLE': return '#22C55E';
      case 'RESERVED': return '#85754E';
      case 'SOLD': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 opacity-30">
        <Loader2 className="animate-spin text-fcGold" size={32} />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-sans">Synchronizing Inventory Manifest...</p>
      </div>
    );
  }

  return (
    <PageContainer className="space-y-6 lg:space-y-8 animate-in fade-in duration-700">

      {/* Top Section: Header + Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-fcSlate font-montserrat">{selectedDev ? selectedDev.name : 'Branch Inventory'}</h2>
            <p className="text-sm text-gray-600 mt-1">{activeBranch} - {selectedDev ? 'Project Node' : 'All Developments'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[8px] px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              API v2.0
            </div>
            {lastUpdateTime && (
              <div className="text-[8px] px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 font-mono">
                {lastUpdateTime}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Summary Dashboard - Redesigned */}
      {stands.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Stands', val: summary.TOTAL || 0, bg: 'bg-slate-50', color: 'text-slate-700', icon: Target },
            { label: 'Available Now', val: summary.AVAILABLE || 0, bg: 'bg-green-50', color: 'text-green-700', icon: CheckCircle2 },
            { label: 'Reserved', val: summary.RESERVED || 0, bg: 'bg-amber-50', color: 'text-amber-700', icon: Clock },
            { label: 'Sold', val: summary.SOLD || 0, bg: 'bg-red-50', color: 'text-red-700', icon: ShieldCheck }
          ].map((item, i) => (
            <div key={i} className={`${item.bg} p-6 rounded-2xl border border-gray-100 shadow-sm`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{item.label}</span>
                <item.icon className={item.color} size={18} />
              </div>
              <div className={`text-3xl font-black ${item.color} font-mono`}>{item.val}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-blue-50 p-8 rounded-2xl border border-blue-200 text-center">
          <Target className="mx-auto mb-3 text-blue-600" size={32} />
          <p className="text-blue-900 font-bold text-sm">Loading inventory data...</p>
          <p className="text-blue-700 text-xs mt-1">Synchronizing {activeBranch} branch</p>
        </div>
      )}

      {/* Controls & View Options */}
      {stands.length > 0 && (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl border border-fcDivider shadow-sm">
          <div className="flex items-center space-x-4 w-full lg:w-auto flex-wrap">
            {/* Development Selector */}
            <div className="relative">
              <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={selectedDev?.id || 'ALL'}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === 'ALL') {
                    setSelectedDev(null);
                  } else {
                    const dev = developments.find(d => d.id === id);
                    if (dev) setSelectedDev(dev);
                  }
                }}
                className="pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-700 focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none appearance-none cursor-pointer transition-all hover:border-fcGold/50 font-montserrat min-w-[220px]"
              >
                <option value="ALL">All Projects</option>
                {developments.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ArrowRight size={14} className="rotate-90" />
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['ALL', 'AVAILABLE', 'RESERVED', 'SOLD'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${statusFilter === f ? 'bg-white text-fcGold shadow-sm border border-fcGold/20' : 'text-gray-600'
                    }`}
                >
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="relative flex-1 lg:flex-initial lg:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search stand number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white text-fcGold shadow-sm' : 'text-gray-600'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-2.5 rounded transition-all ${viewMode === 'map' ? 'bg-white text-fcGold shadow-sm' : 'text-gray-600'}`}
              >
                <MapIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div className="min-h-[600px] relative">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-in slide-in-from-bottom-2 duration-500">
            {filteredStands.map((stand) => (
              <div
                key={stand.id}
                onClick={() => stand.status === 'AVAILABLE' && setReservationTarget(stand)}
                className={`group relative bg-white rounded-2xl border border-fcDivider p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden ${stand.status === 'AVAILABLE' ? 'hover:border-[#22C55E]/30' :
                  stand.status === 'RESERVED' ? 'hover:border-[#85754E]/30' : 'hover:border-[#EF4444]/30'
                  }`}
              >
                <div
                  className="absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 transition-opacity group-hover:opacity-20"
                  style={{ backgroundColor: getStandIndicator(stand.status) }}
                ></div>

                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white rounded-xl text-fcGold group-hover:bg-fcGold group-hover:text-white transition-all">
                      <MapPin size={18} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.2em] border font-montserrat ${getStatusColor(stand.status)}`}>
                        {stand.status}
                      </span>
                      <div className="text-[7px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold uppercase tracking-wider">API</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xl font-bold text-fcSlate tracking-tightest group-hover:text-fcGold transition-colors font-montserrat">Stand {stand.number}</h4>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">{stand.areaSqm.toLocaleString()} m² Plot</p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">Asking Price (USD)</div>
                      <div className="text-lg font-bold text-fcSlate font-mono">${stand.priceUsd.toLocaleString()}</div>
                    </div>
                    {(stand as any).pricePerSqm > 0 && (
                      <div className="flex justify-between items-baseline text-[8px]">
                        <div className="text-gray-500 uppercase tracking-widest font-montserrat">Price/m²</div>
                        <div className="text-gray-700 font-mono font-bold">${Number((stand as any).pricePerSqm).toFixed(2)}</div>
                      </div>
                    )}
                  </div>

                  {stand.status === 'AVAILABLE' && (
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReservationTarget(stand);
                        }}
                        className="w-full bg-white text-gray-600 text-[9px] font-bold uppercase tracking-widest py-2.5 rounded-lg group-hover:bg-fcGold group-hover:text-white transition-all font-montserrat"
                      >
                        Instant Hold
                      </button>
                      <button
                        onClick={(e) => handleSellNow(stand, e)}
                        className="w-full bg-fcGold text-white text-[9px] font-bold uppercase tracking-widest py-2.5 rounded-lg hover:bg-fcGold/90 transition-all font-montserrat flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
                      >
                        <DollarSign size={12} strokeWidth={3} />
                        Sell Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredStands.length === 0 && (
              <div className="col-span-full py-40 text-center opacity-30 space-y-4">
                <Search size={48} className="mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] font-montserrat">No matching inventory found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[700px] rounded-[32px] overflow-hidden border border-fcDivider shadow-xl animate-in fade-in zoom-in-95 duration-700">
            <div ref={mapContainerRef} className="h-full w-full" />
            <div className="absolute top-8 left-8 z-[1000] bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-fcDivider space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fcGold/10 rounded-lg text-fcGold"><Maximize2 size={18} /></div>
                <div>
                  <div className="text-sm font-bold text-fcSlate font-montserrat">{selectedDev?.name}</div>
                  <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">{activeBranch} Regional Node</div>
                </div>
              </div>
              <div className="flex items-center space-x-4 pt-2">
                <div className="flex items-center space-x-1.5 font-montserrat"><div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></div><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Available</span></div>
                <div className="flex items-center space-x-1.5 font-montserrat"><div className="w-2 h-2 rounded-full bg-[#85754E]"></div><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Reserved</span></div>
                <div className="flex items-center space-x-1.5 font-montserrat"><div className="w-2 h-2 rounded-full bg-[#EF4444]"></div><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Sold</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Intent Modal */}
      {reservationTarget && !showLegalConsent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-fcSlate/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setReservationTarget(null)} />
          <div className="relative bg-white w-full max-w-full sm:max-w-md rounded-xl sm:rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-fcGold p-10 text-white space-y-4 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <button
                onClick={() => setReservationTarget(null)}
                className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-2xl"><ShieldCheck size={28} /></div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tightest leading-none font-montserrat">Instant Hold</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1 font-montserrat">Forensic Reservation Protocol</p>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-fcDivider">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest font-montserrat">Inventory Ref</span>
                  <span className="text-base font-bold text-fcSlate font-mono">Stand {reservationTarget.number}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-fcDivider">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest font-montserrat">Asking Price</span>
                  <span className="text-base font-bold text-fcGold font-mono">${reservationTarget.priceUsd.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest font-montserrat">Hold Duration</span>
                  <span className="text-base font-bold text-fcSlate font-mono">48 Hours</span>
                </div>
              </div>

              <div className="bg-fcCream p-6 rounded-2xl border border-fcGold/20 flex items-start space-x-4">
                <AlertCircle size={20} className="text-fcGold shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-600 font-medium leading-relaxed tracking-tight font-montserrat">
                  This action will immediately trigger an immutable entry in the forensic audit trail. This hold prevents other agents from realizing transactions on this parcel for 48 hours.
                </p>
              </div>

              <button
                onClick={() => handleReserve(reservationTarget)}
                disabled={isReserving === reservationTarget.id}
                className="w-full bg-fcSlate text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-white transition-all flex items-center justify-center space-x-3 disabled:opacity-50 font-montserrat"
              >
                {isReserving === reservationTarget.id ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Syncing Vault...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Execute Hold Protocol</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Consent Modal */}
      {showLegalConsent && selectedDev && (
        <LegalConsentModal
          development={selectedDev}
          onClose={() => {
            setShowLegalConsent(false);
            setReservationTarget(null);
          }}
          onConfirm={handleLegalConsentConfirm}
        />
      )}

      {/* Payment Modal for "Sell Now" */}
      {showPaymentModal && selectedStandForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-full sm:max-w-2xl xl:max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-fcGold/10 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/20 rounded-lg">
                  <DollarSign size={24} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Sell Stand {selectedStandForSale.number}</h3>
                  <p className="text-sm text-gray-600">
                    Stand #{selectedStandForSale.number} • ${selectedStandForSale.priceUsd.toLocaleString()} • {selectedStandForSale.areaSqm}m²
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
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <PaymentModule
                activeBranch={activeBranch}
                prefilledStand={{
                  id: selectedStandForSale.id,
                  number: selectedStandForSale.number,
                  developmentName: 'Development',
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
    </PageContainer>
  );
};
