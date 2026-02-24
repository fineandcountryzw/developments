
'use client';

import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  Search, Plus, MapPin, Save, Eye, EyeOff, TrendingUp, Layers, Percent,
  Calendar, FileText, ChevronRight, Image as ImageIcon, ShieldCheck,
  DollarSign, Check, AlertTriangle, X, ChevronDown, ChevronUp,
  MoreVertical, User, ArrowUp, ArrowDown, Move, GripVertical,
  Activity, ClipboardCheck, Edit2, Trash2, Wallet, CreditCard, CheckCircle2,
  Sparkles, Globe, Loader2, AlertCircle, ChevronLeft
} from 'lucide-react';
import { GalleryVerticalEnd as GalleryIcon, Droplets, Hammer, Zap, Route, Lock, Wifi } from 'lucide-react';
import { Development, DevelopmentPhase, Branch, InfrastructureFeatures } from '../types';
import { getDevelopments, createDevelopment, updateDevelopment, deleteDevelopment, getDevelopmentMetrics, getReconLedger, realtime, BRANCH_SETTINGS, getDevelopmentById } from '../lib/db';
import { supabaseMock } from '../services/supabase.ts';
import { generateDevelopmentOverview } from '../services/overviewAIService.ts';
import { generateReadinessChecklist } from '../services/checklistService.ts';
import {
  sanitizeInput,
  isValidNumber,
  isValidLength,
  validateObject
} from '../lib/validation/input-sanitizer';
import { MediaManager } from './MediaManager.tsx';
import DevelopmentWizard from './DevelopmentWizardV2.tsx';
import { DevelopmentFormData } from './DevelopmentWizardTypes.ts';
import { DevelopmentsOverview } from './DevelopmentsOverview.tsx';
import { GeoJSONImportPanel } from './GeoJSONImportPanel.tsx';
import { authenticatedFetch } from '../lib/api-client';

interface AdminDevelopmentsProps {
  activeBranch: Branch;
  userRole?: 'Admin' | 'Agent' | 'Manager';
}

const Shimmer = () => (
  <div className="animate-pulse space-y-4 w-full">
    <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
    <div className="h-32 bg-slate-100 rounded-2xl w-full"></div>
    <div className="grid grid-cols-2 gap-4">
      <div className="h-20 bg-slate-100 rounded-2xl"></div>
      <div className="h-20 bg-slate-100 rounded-2xl"></div>
    </div>
  </div>
);

const INFRA_CATEGORIES: { id: keyof InfrastructureFeatures; label: string; icon: any; options: string[] }[] = [
  { id: 'water', label: 'Water Reticulation', icon: Droplets, options: ['Borehole', 'Council', 'Water Tanks'] },
  { id: 'sewer', label: 'Sewer Reticulation', icon: Hammer, options: ['Septic Tanks', 'Council Connection'] },
  { id: 'power', label: 'Power Grid', icon: Zap, options: ['Solar Street Lighting', 'ZESA Grid'] },
  { id: 'roads', label: 'Access Roads', icon: Route, options: ['Tarred', 'Gravel', 'Paved'] },
  { id: 'security', label: 'Estate Security', icon: Lock, options: ['Gated Community', 'Perimeter Wall', '24/7 Forensic Security'] },
  { id: 'connectivity', label: 'Regional Connectivity', icon: Wifi, options: ['Fiber-to-the-home', 'Mobile Coverage'] },
];

// Add new interface for ReorderModal
interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  developments: Development[];
  onSave: (featured: Development[], list: Development[]) => Promise<void>;
}

// Simple Reorder Modal Component
const ReorderModal: React.FC<ReorderModalProps> = ({ isOpen, onClose, developments, onSave }) => {
  const [featuredList, setFeaturedList] = useState<Development[]>([]);
  const [mainList, setMainList] = useState<Development[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize lists
      // Featured: has featuredRank, sorted by rank
      const featured = developments
        .filter(d => (d as any).featuredRank !== null && (d as any).featuredRank !== undefined)
        .sort((a, b) => ((a as any).featuredRank || 0) - ((b as any).featuredRank || 0));

      // Main: sorted by displayRank
      const main = [...developments].sort((a, b) => {
        const rankA = (a as any).displayRank !== null && (a as any).displayRank !== undefined ? (a as any).displayRank : 999999;
        const rankB = (b as any).displayRank !== null && (b as any).displayRank !== undefined ? (b as any).displayRank : 999999;
        return rankA - rankB;
      });

      setFeaturedList(featured);
      setMainList(main);
    }
  }, [isOpen, developments]);

  const moveItem = (list: Development[], setList: (l: Development[]) => void, index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    if (direction === 'up' && index > 0) {
      [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
    } else if (direction === 'down' && index < newList.length - 1) {
      [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    }
    setList(newList);
  };

  const toggleFeatured = (dev: Development) => {
    // If in featured, remove it. If not, add it.
    const isFeatured = featuredList.some(d => d.id === dev.id);
    if (isFeatured) {
      setFeaturedList(featuredList.filter(d => d.id !== dev.id));
    } else {
      setFeaturedList([...featuredList, dev]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(featuredList, mainList);
      onClose();
    } catch (e) {
      console.error('Failed to save order', e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Landing Page Order</h2>
            <p className="text-sm text-gray-500">Arrange developments significantly for the public site</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Featured Row Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-fcGold" />
                Featured Row (Top Horizontal Scroll)
              </h3>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                {featuredList.length} Selected
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 min-h-[100px]">
              {featuredList.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No developments featured. Select from the list below to feature them.</p>
              ) : (
                <div className="space-y-2">
                  {featuredList.map((dev, idx) => (
                    <div key={dev.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-mono font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-700">{dev.name}</span>
                        {!(dev as any).isPublic && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveItem(featuredList, setFeaturedList, idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => moveItem(featuredList, setFeaturedList, idx, 'down')}
                          disabled={idx === featuredList.length - 1}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => toggleFeatured(dev)}
                          className="p-1 hover:bg-red-50 text-red-500 rounded ml-2"
                          title="Remove from featured"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Layers size={18} className="text-fcSlate" />
                All Developments List Order
              </h3>
              <p className="text-xs text-gray-500">Check box to add to "Featured"</p>
            </div>
            <div className="space-y-2">
              {mainList.map((dev, idx) => {
                const isFeatured = featuredList.some(d => d.id === dev.id);
                return (
                  <div key={dev.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between group hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1 mr-2 text-gray-300">
                        <button onClick={() => moveItem(mainList, setMainList, idx, 'up')} disabled={idx === 0} className="hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                        <button onClick={() => moveItem(mainList, setMainList, idx, 'down')} disabled={idx === mainList.length - 1} className="hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                      </div>
                      <span className="w-8 text-xs font-mono text-gray-400">{idx + 1}</span>
                      <div>
                        <p className="font-medium text-gray-800">{dev.name}</p>
                        <p className="text-xs text-gray-500">{dev.locationName}</p>
                      </div>
                      {!(dev as any).isPublic && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 ml-2">Hidden</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={() => toggleFeatured(dev)}
                          className="rounded border-gray-300 text-fcGold focus:ring-fcGold"
                        />
                        <span>Feature</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-bold text-white bg-fcGold hover:bg-fcGold/90 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

import { ReconciliationReport as ReconRecord } from '../lib/billing';

export const AdminDevelopments: React.FC<AdminDevelopmentsProps> = ({ activeBranch, userRole = 'Admin' }) => {
  // View Mode State - toggle between overview and detail view
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');

  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'financials' | 'infrastructure' | 'media' | 'spatial'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [reconData, setReconData] = useState<ReconRecord[]>([]);
  // AI Overview State
  const [aiOverview, setAiOverview] = useState('');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [developmentToDelete, setDevelopmentToDelete] = useState<Development | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Wizard State (New Clean Wizard)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardEditId, setWizardEditId] = useState<string | null>(null);
  const [wizardInitialData, setWizardInitialData] = useState<Partial<DevelopmentFormData> | undefined>(undefined);

  // Legacy wizard state removed - new DevelopmentWizard component handles all wizard state

  const spatialMapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LMapRef = useRef<any | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  // FORENSIC: Real-time data fetch on mount - ensures cross-browser visibility
  useEffect(() => {
    console.log('[FORENSIC][MOUNT] Fetching developments from API', { branch: activeBranch });

    // Fetch from API instead of server function
    fetch('/api/admin/developments')
      .then(res => res.json())
      .then(data => {
        const allDevs = data.data || [];
        // Developments don't have branch field, show all
        console.log('[FORENSIC][MOUNT] Developments loaded from API', { count: allDevs.length, branch: activeBranch });
        setDevelopments(allDevs);
      })
      .catch(err => {
        console.error('[FORENSIC][MOUNT] Error fetching developments:', err);
        setDevelopments([]);
      });

    // Subscribe to realtime events for immediate cross-tab/cloud sync
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(async () => {
        try {
          const res = await fetch('/api/admin/developments');
          const data = await res.json();
          const allDevs = data.data || [];
          const devs = allDevs; // Developments don't have branch field
          setDevelopments(devs);
          console.log('[FORENSIC][REALTIME] Debounced refresh executed', { total: devs.length });
        } catch (err) {
          console.error('[FORENSIC][REALTIME] Refresh failed:', err);
        }
      }, 250);
    };
    const offCreated = realtime.on('developments:created', scheduleRefresh);
    const offUpdated = realtime.on('developments:updated', scheduleRefresh);
    return () => {
      offCreated?.();
      offUpdated?.();
    };
  }, [activeBranch]);

  useEffect(() => {
    if (selectedDev) {
      setTabLoading(true);
      Promise.all([
        getDevelopmentMetrics(selectedDev.id).then(setMetrics),
        getReconLedger(activeBranch).then(data =>
          setReconData(data.filter(r => r.developmentId === selectedDev.id))
        )
      ]).finally(() => {
        setTabLoading(false);
      });
    }
  }, [selectedDev?.id, activeTab]);
  // Legacy load effect removed - DevelopmentWizard handles its own state via initialData prop

  useEffect(() => {
    if (activeTab === 'spatial' && spatialMapRef.current && selectedDev) {
      let isMounted = true;

      // Ensure latitude and longitude are valid numbers before initializing map
      const lat = selectedDev.latitude ?? -17.8292; // Default to Harare if null/undefined
      const lng = selectedDev.longitude ?? 31.0522;

      // Use dynamic import to avoid SSR issues with leaflet
      (async () => {
        if (!spatialMapRef.current) return;
        if (LMapRef.current) return;

        const leaflet = await import('leaflet');
        const L: any = (leaflet as any).default ?? leaflet;

        if (!isMounted) return;

        LMapRef.current = L.map(spatialMapRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(LMapRef.current);

        if (selectedDev.geometry && selectedDev.geometry.features && LMapRef.current) {
          try {
            const geoLayer = L.geoJSON(selectedDev.geometry, {
              style: { color: '#85754E', weight: 2, fillOpacity: 0.2 }
            }).addTo(LMapRef.current);
            LMapRef.current.fitBounds(geoLayer.getBounds());
          } catch (e) {
            console.warn("Invalid GeoJSON stored in master entry.");
          }
        }
      })();

      return () => {
        isMounted = false;
        if (LMapRef.current) {
          try { LMapRef.current.remove(); } catch {}
          LMapRef.current = null;
        }
      };
    }
    // Return cleanup when condition is not met
    return undefined;
  }, [activeTab, selectedDev]);

  // Defensive filter - ensure developments is always an array
  const filteredDevs = (Array.isArray(developments) ? developments : []).filter(d => {
    if (!d || !d.name || !d.locationName) return false;
    try {
      const name = (d.name || '').toString().toLowerCase();
      const location = (d.locationName || '').toString().toLowerCase();
      const query = (searchQuery || '').toString().toLowerCase();
      return name.includes(query) || location.includes(query);
    } catch (err) {
      console.error('[AdminDevelopments] Error filtering development:', err, d);
      return false;
    }
  });

  // New Clean Wizard: Create New Development
  const handleCreateNew = () => {
    setWizardEditId(null);
    setWizardInitialData(undefined);
    setIsWizardOpen(true);
  };

  // New Clean Wizard: Edit Existing Development
  const handleEditDevelopment = (dev: Development) => {
    setWizardEditId(dev.id);
    // Cast to any to access dynamic fields that might exist in the API response
    const devAny = dev as any;

    // Parse stand_sizes from database (stored as JSON)
    let parsedStandSizes = { small: 300, medium: 500, large: 800 };
    try {
      if (devAny.stand_sizes) {
        const sizes = typeof devAny.stand_sizes === 'string'
          ? JSON.parse(devAny.stand_sizes)
          : devAny.stand_sizes;
        parsedStandSizes = {
          small: sizes.small || 300,
          medium: sizes.medium || 500,
          large: sizes.large || 800,
        };
      }
    } catch (e) {
      console.warn('[FORENSIC] Failed to parse stand_sizes:', e);
    }

    // Parse stand_types from database (stored as TEXT[])
    let parsedStandTypes: ('Residential' | 'Commercial' | 'Institutional')[] = ['Residential'];
    try {
      if (devAny.stand_types && Array.isArray(devAny.stand_types)) {
        parsedStandTypes = devAny.stand_types.filter((t: string) =>
          ['Residential', 'Commercial', 'Institutional'].includes(t)
        ) as ('Residential' | 'Commercial' | 'Institutional')[];
      }
      if (parsedStandTypes.length === 0) parsedStandTypes = ['Residential'];
    } catch (e) {
      console.warn('[FORENSIC] Failed to parse stand_types:', e);
    }

    // Parse commission_model from database (stored as JSON)
    let parsedCommission: { type: 'fixed' | 'percentage'; fixedAmount: number; percentage: number } = {
      type: 'fixed',
      fixedAmount: 1000,
      percentage: 5
    };
    try {
      if (devAny.commission_model) {
        const comm = typeof devAny.commission_model === 'string'
          ? JSON.parse(devAny.commission_model)
          : devAny.commission_model;
        parsedCommission = {
          type: (comm.type === 'percentage' ? 'percentage' : 'fixed') as 'fixed' | 'percentage',
          fixedAmount: comm.fixedAmount || comm.fixed_amount || 1000,
          percentage: comm.percentage || 5,
        };
      }
    } catch (e) {
      console.warn('[FORENSIC] Failed to parse commission_model:', e);
    }

    // Parse geo_json_data from database
    let parsedGeoJSON = null;
    let rawGeoJSON = '';
    try {
      if (devAny.geo_json_data) {
        parsedGeoJSON = typeof devAny.geo_json_data === 'string'
          ? JSON.parse(devAny.geo_json_data)
          : devAny.geo_json_data;
        rawGeoJSON = JSON.stringify(parsedGeoJSON, null, 2);
      } else if (devAny.geo_json_url) {
        rawGeoJSON = devAny.geo_json_url;
      }
    } catch (e) {
      console.warn('[FORENSIC] Failed to parse geo_json_data:', e);
    }

    // Parse image_urls and document_urls from database
    const imageUrls = Array.isArray(devAny.image_urls)
      ? devAny.image_urls
      : (typeof devAny.image_urls === 'string' ? JSON.parse(devAny.image_urls || '[]') : []);

    const documentUrls = Array.isArray(devAny.document_urls)
      ? devAny.document_urls.map((d: any) => typeof d === 'string' ? d : d.url)
      : (typeof devAny.document_urls === 'string' ? JSON.parse(devAny.document_urls || '[]') : []);

    // Parse features array
    const features = Array.isArray(devAny.features)
      ? devAny.features
      : (typeof devAny.features === 'string' ? JSON.parse(devAny.features || '[]') : []);

    // Map phase to estateProgress
    const estateProgress = devAny.phase || 'SERVICING';

    const parsedEstateProgress: any = (() => {
      const raw = devAny.estate_progress;
      if (!raw) return undefined;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      }
      return raw;
    })();

    console.log('[FORENSIC][EDIT_DEVELOPMENT] Loading development for edit:', {
      id: dev.id,
      name: dev.name,
      hasOverview: !!devAny.overview,
      standTypes: parsedStandTypes,
      featuresCount: features.length,
      estateProgress,
      pricePerSqm: devAny.price_per_sqm,
      commissionType: parsedCommission.type,
      hasGeoJSON: !!parsedGeoJSON,
      imageCount: imageUrls.length,
      documentCount: documentUrls.length,
    });

    setWizardInitialData({
      name: dev.name,
      location: dev.locationName || '',
      branch: dev.branch as 'Harare' | 'Bulawayo' || 'Harare', // Load existing branch
      developmentId: dev.id || '', // Load existing development ID
      totalStands: Number(devAny.total_stands || devAny.totalStands) || 0,
      pricePerStand: Number(dev.basePrice) || 0,
      pricePerSqm: Number(devAny.price_per_sqm) || 0, // NEW
      estateProgress: estateProgress as any, // NEW: Map phase to estateProgress
      estateProgressDetails: parsedEstateProgress,
      // Checkbox-driven extras (stored inside estate_progress JSON)
      hasBioDigester: Boolean(parsedEstateProgress?.sanitation?.bioDigester ?? false),
      hasSepticTanks: Boolean(parsedEstateProgress?.sanitation?.septicTanks ?? false),
      compliancePartialApplied: Boolean(parsedEstateProgress?.buildCompliance?.partialApplied ?? false),
      compliancePartialApproved: Boolean(parsedEstateProgress?.buildCompliance?.partialApproved ?? false),
      complianceFullApplied: Boolean(parsedEstateProgress?.buildCompliance?.fullApplied ?? false),
      complianceFullApproved: Boolean(parsedEstateProgress?.buildCompliance?.fullApproved ?? false),
      hasServiceStation: Boolean(parsedEstateProgress?.serviceStation?.available ?? devAny.has_service_station ?? false),
      serviceStationType: parsedEstateProgress?.serviceStation?.type ?? devAny.service_station_type ?? undefined,
      serviceStationHoursOpen: parsedEstateProgress?.serviceStation?.hoursOpen ?? devAny.service_station_hours_open ?? undefined,
      serviceStationHoursClose: parsedEstateProgress?.serviceStation?.hoursClose ?? devAny.service_station_hours_close ?? undefined,
      serviceStationIs24Hour: Boolean(parsedEstateProgress?.serviceStation?.is24Hour ?? devAny.service_station_is_24_hour ?? false),
      serviceStationNotes: parsedEstateProgress?.serviceStation?.notes ?? devAny.service_station_notes ?? undefined,
      standSizes: parsedStandSizes,
      standTypes: parsedStandTypes,
      features: features, // NEW: Load features
      imageUrls: imageUrls,
      documentUrls: documentUrls,
      commission: parsedCommission,
      geojsonData: parsedGeoJSON,
      geojsonRaw: rawGeoJSON,
      overview: devAny.overview || '',
      // Developer info fields
      developerName: devAny.developer_name || '',
      developerEmail: devAny.developer_email || '',
      developerPhone: devAny.developer_phone || '',
      // Lawyer info fields
      lawyerName: devAny.lawyer_name || '',
      lawyerEmail: devAny.lawyer_email || '',
      lawyerPhone: devAny.lawyer_phone || '',
    });
    setIsWizardOpen(true);
  };

  // Refresh development data after import
  const handleRefreshDevelopment = async (developmentId: string) => {
    try {
      const updatedDev = await getDevelopmentById(developmentId);
      if (updatedDev) {
        setSelectedDev(updatedDev);
        // Also refresh the developments list
        const res = await fetch('/api/admin/developments');
        const data = await res.json();
        const allDevs = data.data || [];
        setDevelopments(allDevs);
      }
    } catch (error) {
      console.error('[AdminDevelopments] Failed to refresh development:', error);
    }
  };

  // New Clean Wizard: Submit Handler
  const handleNewWizardSubmit = async (formData: DevelopmentFormData) => {
    setIsSaving(true);

    try {
      const isEdit = !!wizardEditId;

      // SURGICAL FIX: Proper development ID logic
      // 1. If editing, ALWAYS use wizardEditId (existing development's ID)
      // 2. If creating new, use formData.developmentId if provided
      // 3. Otherwise, auto-generate
      let developmentId: string;
      if (isEdit && wizardEditId) {
        developmentId = wizardEditId; // Keep existing ID when editing
      } else {
        developmentId = formData.developmentId?.trim() || '';
        if (!developmentId) {
          developmentId = `dev-${formData.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;
        }
      }

      // Build API payload from new wizard form data
      // IMPORTANT: Only use one key per database column to avoid duplicate assignment errors

      // Calculate base_price as "Starting From" price
      // Use smallest stand size Ã— price per sqm for realistic minimum price
      const smallestStandSize = formData.standSizes ? Math.min(...Object.values(formData.standSizes)) : 500;
      const calculatedBasePrice = formData.pricePerSqm > 0
        ? Math.round(smallestStandSize * formData.pricePerSqm)
        : 0;

      const payload = {
        id: developmentId,
        name: formData.name,
        location: formData.location, // Single location field (maps to location column)
        branch: formData.branch || activeBranch, // Use branch from form or fallback to activeBranch
        total_stands: formData.totalStands,
        base_price: calculatedBasePrice, // Calculated from smallest stand Ã— price per sqm
        status: 'Active',
        // Estate progress â†’ phase column
        phase: formData.estateProgress || 'SERVICING',
        // Price per square metre
        price_per_sqm: formData.pricePerSqm,
        // Overview text
        overview: formData.overview,
        // Media
        image_urls: formData.imageUrls,
        document_urls: formData.documentUrls,
        // Commission configuration
        commission_model: formData.commission,
        // Stand configuration
        stand_sizes: formData.standSizes,
        stand_types: formData.standTypes,
        // Features/amenities
        features: formData.features,
        // GeoJSON data
        geo_json_data: formData.geojsonData,
        has_geo_json_map: !!formData.geojsonData,
        disable_map_view: formData.disableMapView || false,
        // Developer info (for reports)
        developer_name: formData.developerName || null,
        developer_email: formData.developerEmail || null,
        developer_phone: formData.developerPhone || null,
        // Lawyer info (for DocuSeal signing workflows)
        lawyer_name: formData.lawyerName || null,
        lawyer_email: formData.lawyerEmail || null,
        lawyer_phone: formData.lawyerPhone || null,
        // Fee Configuration (toggles)
        vatEnabled: formData.vatEnabled,
        endowmentEnabled: formData.endowmentEnabled,
        aosEnabled: formData.aosEnabled,
        aosFee: formData.aosFee,
        cessionsEnabled: formData.cessionsEnabled,
        cessionFee: formData.cessionFee,
        adminFeeEnabled: formData.adminFeeEnabled,
        adminFee: formData.adminFee,
        // Estate progress details (infrastructure progress)
        estate_progress: {
          ...(formData.estateProgressDetails || {}),
          sanitation: {
            bioDigester: Boolean(formData.hasBioDigester),
            septicTanks: Boolean(formData.hasSepticTanks)
          },
          buildCompliance: {
            partialApplied: Boolean(formData.compliancePartialApplied),
            partialApproved: Boolean(formData.compliancePartialApproved),
            fullApplied: Boolean(formData.complianceFullApplied),
            fullApproved: Boolean(formData.complianceFullApproved)
          },
          serviceStation: {
            available: Boolean(formData.hasServiceStation),
            type: formData.serviceStationType || null,
            hoursOpen: formData.serviceStationHoursOpen || null,
            hoursClose: formData.serviceStationHoursClose || null,
            is24Hour: Boolean(formData.serviceStationIs24Hour),
            notes: formData.serviceStationNotes || null
          }
        },
      };

      // âœ… SAFETY CHECK: Ensure we ALWAYS have a valid developmentId
      if (!payload.id || payload.id.trim() === '') {
        throw new Error('Development ID generation failed. Please try again.');
      }

      console.log('[FORENSIC][NEW_WIZARD_SUBMIT]', {
        isEdit,
        developmentId,
        branch: payload.branch,
        name: payload.name,
        totalStands: payload.total_stands,
        basePrice: payload.base_price,
        pricePerSqm: payload.price_per_sqm,
        calculationNote: `${smallestStandSize}mÂ² Ã— $${formData.pricePerSqm}/mÂ² = $${calculatedBasePrice}`,
        phase: payload.phase,
        featuresCount: payload.features?.length,
        hasOverview: !!payload.overview,
        standTypesCount: payload.stand_types?.length,
        hasGeoJSON: !!payload.geo_json_data,
        hasDeveloperInfo: !!(payload.developer_name || payload.developer_email || payload.developer_phone)
      });

      const method = isEdit ? 'PUT' : 'POST';
      console.log('[AdminDevelopments][SUBMIT] Making API request:', { method, url: '/api/admin/developments' });
      console.log('[AdminDevelopments][SUBMIT] Payload:', JSON.stringify(payload, null, 2));

      const response = await authenticatedFetch('/api/admin/developments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[AdminDevelopments][SUBMIT] Response received:', { status: response.status, ok: response.ok });

      const result = await response.json();
      console.log('[AdminDevelopments][SUBMIT] Response body:', result);

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEdit ? 'update' : 'create'} development`);
      }

      // âœ… NEW: Manual Stand Creation
      // Check: Manual mode enabled, stand count > 0, and either no GeoJSON or GeoJSON is empty
      const hasGeoJSON = formData.geojsonData && formData.geojsonData.features?.length > 0;
      if (formData.useManualStandCreation && formData.standCountToCreate > 0 && !hasGeoJSON) {
        console.log('[STAND_CREATION] Initiating manual bulk stand creation:', {
          developmentId,
          count: formData.standCountToCreate,
          format: formData.standNumberingFormat,
          prefix: formData.standNumberPrefix,
          startNumber: formData.standNumberStart
        });

        try {
          const standsPayload = {
            developmentId,
            standCount: formData.standCountToCreate,
            numberingFormat: formData.standNumberingFormat,
            standNumberPrefix: formData.standNumberPrefix,
            standNumberStart: formData.standNumberStart,
            defaultStandSize: formData.defaultStandSize,
            pricePerSqm: formData.pricePerSqm,
            manualStandSizes: formData.manualStandSizes
          };

          const standsResponse = await authenticatedFetch('/api/admin/stands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(standsPayload),
          });

          const standsResult = await standsResponse.json();

          if (!standsResponse.ok) {
            console.warn('[STAND_CREATION] Failed:', standsResult.error);
            // Don't fail the entire operation, just warn
            setNotification({
              msg: `âš ï¸ Development ${isEdit ? 'updated' : 'created'} but stand creation failed: ${standsResult.error}`,
              type: 'error'
            });
          } else {
            console.log('[STAND_CREATION] Success:', standsResult.data);
            setNotification({
              msg: `âœ“ Development ${isEdit ? 'updated' : 'created'} with ${standsResult.data.created} stands`,
              type: 'success'
            });
          }
        } catch (standsError: any) {
          console.error('[STAND_CREATION] Error:', standsError);
          // Don't fail the entire operation, just warn
          setNotification({
            msg: `âš ï¸ Development ${isEdit ? 'updated' : 'created'} but stand creation failed`,
            type: 'error'
          });
        }
      } else {
        setNotification({
          msg: `âœ“ Development ${isEdit ? 'updated' : 'created'} successfully`,
          type: 'success'
        });
      }

      // Close wizard and refresh data
      setIsWizardOpen(false);
      setWizardEditId(null);
      setWizardInitialData(undefined);

      // Refresh developments list
      const res = await fetch('/api/admin/developments');
      const apiData = await res.json();
      setDevelopments(apiData.data || []);

      setTimeout(() => setNotification(null), 4000);

    } catch (error: any) {
      console.error('[FORENSIC][NEW_WIZARD_ERROR]', error);
      setNotification({ msg: error.message || 'Operation failed', type: 'error' });
      throw error; // Re-throw to let wizard handle it
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel wizard handler
  const handleWizardCancel = () => {
    setIsWizardOpen(false);
    setWizardEditId(null);
    setWizardInitialData(undefined);
  };

  const handleDownloadChecklist = () => {
    generateReadinessChecklist(activeBranch, selectedDev || undefined);
  };

  // Legacy wizard removed - using new DevelopmentWizard component

  /**
   * Image Upload Handler
   * Images should be uploaded through MediaManager after development creation.
   */
  // Legacy wizard helper functions removed - now using DevelopmentWizard component

  const handleToggleOption = (category: keyof InfrastructureFeatures, option: string) => {
    if (!selectedDev || !selectedDev.infrastructureJson) return;
    const currentList = selectedDev.infrastructureJson[category] || [];
    const updatedList = currentList.includes(option)
      ? currentList.filter(o => o !== option)
      : [...currentList, option];

    setSelectedDev({
      ...selectedDev,
      infrastructureJson: {
        ...selectedDev.infrastructureJson,
        [category]: updatedList
      }
    });
  };

  const handleSave = async () => {
    if (!selectedDev) return;

    const dev = selectedDev as any;

    // Validation
    if (!dev.name || !dev.branch || !dev.base_price || !dev.total_stands) {
      setNotification({ msg: 'All mandatory fields (Title, Region, Total Stands, Starting Price) are required.', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    setIsSaving(true);

    try {
      // FORENSIC: Log payload before database transmission
      const payload = {
        id: dev.id,
        name: dev.name,
        branch: dev.branch,
        base_price: dev.base_price,
        total_stands: dev.total_stands,
        vision: dev.vision,
        infrastructure_progress: dev.infrastructure_progress,
        completion_status: dev.completion_status,
        logo_url: dev.logo_url || dev.logoUrl,
        timestamp: new Date().toISOString()
      };

      console.log('[FORENSIC] SENDING_TO_API:', payload);
      console.log('[FORENSIC] Full dev object:', dev);

      // Call API with automatic auth header via authenticatedFetch
      console.log('[FORENSIC] Using authenticatedFetch for PUT request');

      const response = await authenticatedFetch('/api/admin/developments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dev),
      });

      const result = await response.json();

      // FORENSIC: Log response from database
      console.log('[FORENSIC] RECEIVED_FROM_API:', {
        data: result.data,
        error: result.error,
        status: response.status,
        statusCode: result.status
      });
      console.log('[FORENSIC] Logo from API response:', result.data?.logoUrl || result.data?.logo_url);

      // FORENSIC: Handle API errors - check both response.status and result.status
      if (!response.ok || result.error) {
        const errorMsg = result.error?.message || result.error || 'Unknown error';
        const errorCode = result.error?.code || response.status;

        console.error('[API_ERROR]', {
          code: errorCode,
          message: errorMsg,
          development_id: selectedDev.id,
          httpStatus: response.status
        });

        // Provide specific error messages
        let alertMsg = `Save Failed: ${errorMsg}`;
        if (response.status === 401) alertMsg = 'Unauthorized: Admin access required';
        else if (response.status === 404) alertMsg = 'Development not found in database';
        else if (response.status === 501) alertMsg = 'Save feature is not yet available on the server';
        else if (response.status === 503) alertMsg = 'Database connection unavailable';
        else if (errorCode === '23502') alertMsg = 'Required field missing in database';
        else if (errorCode === '23505') alertMsg = 'Duplicate development name detected';

        console.error('DB_ERROR', { code: errorCode, message: alertMsg });

        // Show persistent alert
        alert(alertMsg);
        setNotification({ msg: alertMsg, type: 'error' });
        setIsSaving(false);
        return;
      }

      // FORENSIC: Log database confirmation
      console.log('DB_CONFIRMED', {
        development_id: selectedDev.id,
        name: result.data?.name,
        status: response.status,
        timestamp: new Date().toISOString(),
        rows_affected: 1
      });

      // Success: Update state and show confirmation
      setSelectedDev(result.data);
      setNotification({ msg: `âœ“ "${result.data.name}" saved successfully`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);

      // REAL-TIME REFRESH: Fetch fresh data from database to ensure cross-browser sync
      const res = await fetch('/api/admin/developments');
      const data = await res.json();
      const allDevs = data.data || [];
      const updatedDevs = allDevs; // Developments don't have branch field
      setDevelopments(updatedDevs);
      const freshDev = updatedDevs.find((d: Development) => d.id === selectedDev.id) || null;
      console.log('[FORENSIC] Refreshed dev from API:', freshDev);
      console.log('[FORENSIC] Refreshed logo_url:', freshDev?.logoUrl || freshDev?.logo_url);
      setSelectedDev(freshDev);
      console.log('[FORENSIC][STATE SYNC] Development list refreshed from database:', { total: updatedDevs.length });

      setNotification({ msg: `âœ“ Development saved - Synced with cloud!`, type: 'success' });
      setTimeout(() => setNotification(null), 4000);
    } catch (e: any) {
      console.error('[FORENSIC][CRITICAL ERROR]', e);
      const criticalMsg = `Critical Error: ${e.message || 'Update operation failed'}`;
      alert(criticalMsg);
      setNotification({ msg: criticalMsg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (dev: Development) => {
    console.log('[FORENSIC][DELETE REQUEST]', { id: dev.id, name: dev.name, userRole });
    if (userRole !== 'Admin') {
      console.error('[FORENSIC][SECURITY GATE] Delete action blocked - insufficient permissions', { userRole });
      setNotification({ msg: 'Access Denied: Only Admin users can delete developments.', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setDevelopmentToDelete(dev);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!developmentToDelete) return;

    // Admin security gate
    if (userRole !== 'Admin') {
      console.error('[FORENSIC][SECURITY BREACH ATTEMPT]', { userRole, developmentId: developmentToDelete.id });
      alert('Security Alert: Unauthorized deletion attempt detected.');
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      console.log('[FORENSIC] SENDING_DELETE_TO_API:', { id: developmentToDelete.id, name: developmentToDelete.name });

      // Call API with authentication
      const response = await authenticatedFetch('/api/admin/developments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: developmentToDelete.id }),
      });

      const result = await response.json();

      console.log('[FORENSIC] RECEIVED_DELETE_RESPONSE:', { error: result.error, status: result.status });

      if (result.error || (result.status && result.status >= 400)) {
        console.error('[FORENSIC][DELETE ERROR]', { message: result.error });
        const alertMsg = `Delete Failed: ${result.error || 'Unknown error'}`;
        alert(alertMsg);
        setNotification({ msg: alertMsg, type: 'error' });
        setIsDeleting(false);
        return;
      }

      console.log('[FORENSIC][DELETE CONFIRMED]', { id: developmentToDelete.id, timestamp: new Date().toISOString() });

      // STATE SYNC: Remove from local state immediately
      setDevelopments(prev => prev.filter(d => d.id !== developmentToDelete.id));

      // Close detail view if deleting currently selected dev
      if (selectedDev?.id === developmentToDelete.id) {
        setSelectedDev(null);
      }

      // Optional: Cleanup media (already handled in backend)
      console.log('[FORENSIC][MEDIA CLEANUP] Associated media deleted from bucket');

      setNotification({ msg: `âœ“ "${developmentToDelete.name}" permanently deleted from ${developmentToDelete.branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch'}`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);

      setIsDeleteModalOpen(false);
      setDevelopmentToDelete(null);
    } catch (e: any) {
      console.error('[FORENSIC][CRITICAL DELETE ERROR]', e);
      const criticalMsg = `Critical Error: ${e.message || 'Delete operation failed'}`;
      alert(criticalMsg);
      setNotification({ msg: criticalMsg, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Show Premium Overview or Detail View */}
      {viewMode === 'overview' ? (
        <DevelopmentsOverview
          activeBranch={activeBranch}
          userRole={userRole}
          onDevelopmentClick={(dev) => {
            setSelectedDev(dev);
            setViewMode('detail');
          }}
          onReserveClick={(dev) => {
            // TODO: Implement reservation flow
            console.log('[AdminDevelopments] Reserve clicked for:', dev.name);
            alert(`Reserve unit in ${dev.name} - Coming soon!`);
          }}
        />
      ) : (
        <div className="min-h-screen overflow-auto bg-gradient-to-br from-slate-50 via-gray-50 to-white animate-in fade-in duration-700 relative">

          {/* Delete Confirmation Modal */}
          {isDeleteModalOpen && developmentToDelete && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
              <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-forensic-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-red-100">

                <div className="bg-gradient-to-br from-red-50 to-white p-10 border-b border-red-100">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                      <AlertCircle size={28} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-fcSlate tracking-tight font-sans uppercase">Confirm Permanent Deletion</h3>
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-widest mt-2 font-sans">This action is forensic and cannot be undone</p>
                    </div>
                  </div>
                </div>

                <div className="p-10 space-y-6">
                  <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed font-sans">
                      Are you sure you want to delete <span className="text-fcGold font-black">"{developmentToDelete.name}"</span>?
                    </p>
                    <p className="text-xs text-gray-600 font-medium mt-3 font-sans">
                      All associated data including stands, media, and documents will be permanently removed from {developmentToDelete.branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch'}.
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={isDeleting}
                      className="flex-1 bg-slate-100 text-slate-700 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50 font-sans"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 text-white px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 font-sans flex items-center justify-center space-x-2"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          <span>Delete Development</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Clean Development Wizard */}
          {isWizardOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleWizardCancel}
              />
              <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
                <DevelopmentWizard
                  activeBranch={activeBranch}
                  initialData={wizardInitialData}
                  isEditing={!!wizardEditId}
                  developmentId={wizardEditId || undefined}
                  onSubmit={handleNewWizardSubmit}
                  onCancel={handleWizardCancel}
                />
              </div>
            </div>
          )}

          {/* Legacy wizard removed - now using DevelopmentWizard component */}

          <div className="max-w-[1900px] mx-auto px-8 py-10 space-y-12">

            {/* Premium Header Section with Enhanced Visuals */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 pb-6">
              <div className="space-y-4 flex-1">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-fcGold/10 to-amber-50 rounded-full border border-fcGold/20">
                  <Activity size={16} className="text-fcGold animate-pulse" />
                  <span className="text-xs font-bold text-fcGold uppercase tracking-widest">Property Portfolio</span>
                </div>
                <h1 className="text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 tracking-tight leading-tight">
                  Development Overview
                </h1>
                <p className="text-lg text-slate-600 max-w-3xl leading-relaxed font-medium">
                  Manage and monitor all property developments across branches with comprehensive specifications, real-time insights, and advanced analytics
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDownloadChecklist}
                  className="group flex items-center gap-3 px-6 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:border-fcGold hover:bg-gradient-to-r hover:from-fcGold/5 hover:to-amber-50 hover:text-fcGold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] backdrop-blur-sm"
                  title="Download Development Checklist"
                >
                  <ClipboardCheck size={20} className="text-slate-400 group-hover:text-fcGold transition-colors duration-300" />
                  <span>Checklist</span>
                </button>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-fcGold via-amber-500 to-[#9A8B5F] text-white rounded-2xl text-sm font-black uppercase tracking-wide hover:shadow-2xl hover:shadow-fcGold/30 hover:scale-[1.03] transition-all duration-300 shadow-xl relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Plus size={20} strokeWidth={3} className="relative z-10" />
                  <span className="relative z-10">New Development</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-8 lg:gap-10 items-start">

              {/* Premium Navigation Sidebar with Glassmorphism */}
              <div className="col-span-12 lg:col-span-4 xl:col-span-3">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 shadow-2xl shadow-slate-300/20 overflow-hidden sticky top-6 transition-all duration-500 hover:shadow-3xl hover:shadow-slate-300/30 hover:border-fcGold/30">

                  {/* Sidebar Header with Gradient */}
                  <div className="px-7 py-8 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 via-white to-amber-50/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-fcGold/5 to-transparent opacity-50" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-gradient-to-br from-fcGold to-amber-500 rounded-xl shadow-lg shadow-fcGold/20">
                          <Layers size={18} className="text-white" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                          Developments
                        </h3>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">{filteredDevs.length}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Properties</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Search Bar */}
                  <div className="p-6 border-b border-slate-200/60 bg-gradient-to-br from-slate-50/50 to-white">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-fcGold transition-all duration-300 group-focus-within:scale-110" size={20} />
                      <input
                        type="text"
                        placeholder="Search developments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-medium placeholder:text-slate-400 focus:border-fcGold focus:ring-4 focus:ring-fcGold/20 outline-none transition-all duration-300 shadow-sm focus:shadow-lg"
                      />
                    </div>
                  </div>

                  {/* Premium Development List with Enhanced Design */}
                  <div className="max-h-[650px] overflow-y-auto overscroll-contain custom-scrollbar">
                    {filteredDevs.length > 0 ? (
                      <div className="divide-y divide-slate-100/80">
                        {filteredDevs.map((dev, idx) => (
                          <div
                            key={dev.id}
                            onClick={() => setSelectedDev(dev)}
                            className={`px-7 py-6 cursor-pointer transition-all duration-300 group relative overflow-hidden ${selectedDev?.id === dev.id
                              ? 'bg-gradient-to-r from-fcGold/15 via-amber-50/50 to-transparent border-l-[5px] border-l-fcGold shadow-inner'
                              : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-white hover:border-l-[5px] hover:border-l-slate-300 hover:shadow-sm'
                              }`}
                          >
                            {selectedDev?.id === dev.id && (
                              <div className="absolute inset-0 bg-gradient-to-r from-fcGold/5 to-transparent opacity-50" />
                            )}
                            <div className="flex items-start justify-between gap-4 relative z-10">
                              <div className="flex-1 min-w-0 space-y-3">
                                <h4 className={`text-lg font-black truncate transition-all duration-300 ${selectedDev?.id === dev.id ? 'text-fcGold' : 'text-slate-900 group-hover:text-fcGold group-hover:translate-x-1'
                                  }`}>
                                  {dev.name}
                                </h4>
                                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                  <MapPin size={16} className="shrink-0 text-slate-400" />
                                  <span className="truncate font-medium">{dev.locationName || 'Location Not Set'}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <span className={`inline-flex items-center text-xs font-bold px-3.5 py-2 rounded-xl uppercase tracking-wider shadow-sm ${dev.phase === 'READY_TO_BUILD'
                                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25'
                                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/25'
                                    }`}>
                                    {dev.phase === 'READY_TO_BUILD' ? 'âœ“ Ready' : 'âš¡ Servicing'}
                                  </span>
                                </div>
                              </div>
                              {userRole === 'Admin' && (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditDevelopment(dev);
                                    }}
                                    className="p-2.5 text-fcGold bg-fcGold/10 hover:bg-fcGold hover:text-white rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg shadow-fcGold/25"
                                    title="Edit Development"
                                  >
                                    <Edit2 size={18} strokeWidth={2.5} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteRequest(dev);
                                    }}
                                    className="p-2.5 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg shadow-red-500/25"
                                    title="Delete Development"
                                  >
                                    <Trash2 size={18} strokeWidth={2.5} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center space-y-4">
                        <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto">
                          <MapPin size={32} className="text-gray-300" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900">No developments found</p>
                          <p className="text-xs text-gray-500">Try adjusting your search criteria</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Premium Content Panel with Enhanced Design */}
              <div className="col-span-12 lg:col-span-8 xl:col-span-9">
                {selectedDev ? (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 shadow-2xl shadow-slate-300/20 overflow-hidden transition-all duration-500 hover:shadow-3xl hover:shadow-slate-300/30">

                    {/* Modern Tab Navigation with Pills */}
                    <div className="px-8 py-6 border-b border-slate-200/60 flex flex-wrap items-center gap-3 bg-gradient-to-r from-slate-50/50 via-white to-amber-50/30 relative overflow-visible">
                      <div className="absolute inset-0 bg-gradient-to-r from-fcGold/3 to-transparent opacity-40" />
                      {[
                        { id: 'general', label: 'General', icon: FileText },
                        { id: 'financials', label: 'Financials', icon: DollarSign },
                        { id: 'infrastructure', label: 'Features', icon: ShieldCheck },
                        { id: 'media', label: 'Media', icon: GalleryIcon },
                        { id: 'spatial', label: 'Location', icon: Globe }
                      ].map((t) => {
                        const TabIcon = t.icon;
                        const isActive = activeTab === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`relative z-10 flex items-center gap-2.5 px-5 py-3 text-sm font-bold rounded-2xl transition-all duration-300 group ${isActive
                              ? 'bg-gradient-to-r from-fcGold via-amber-500 to-[#9A8B5F] text-white shadow-xl shadow-fcGold/30 scale-105'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-lg hover:scale-105 border border-slate-200/50'
                              }`}
                          >
                            <TabIcon size={18} className={isActive ? '' : 'group-hover:scale-110 transition-transform duration-300'} strokeWidth={2.5} />
                            <span className="uppercase tracking-wide">{t.label}</span>
                            {isActive && <Sparkles size={14} className="animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Premium Action Bar */}
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-gray-900">{selectedDev.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={14} />
                          <span>{selectedDev.locationName || 'Location not specified'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={handleDownloadChecklist}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-semibold border border-gray-200 hover:border-fcGold hover:bg-fcGold/5 hover:text-fcGold transition-all duration-200 group"
                        >
                          <ClipboardCheck size={16} className="text-gray-400 group-hover:text-fcGold transition-colors" />
                          <span>Checklist</span>
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-fcGold to-[#9A8B5F] text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none justify-center"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save Changes</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Premium Content Area */}
                    <div className="p-8 min-h-[500px]">
                      {tabLoading ? (
                        <div className="space-y-6 animate-pulse">
                          <div className="h-14 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl"></div>
                          <div className="h-40 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl"></div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl"></div>
                            <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl"></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in duration-300">

                              {/* Project Title */}
                              <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                  <FileText size={14} className="text-fcGold" />
                                  Project Title
                                </label>
                                <input
                                  type="text"
                                  value={selectedDev.name}
                                  onChange={(e) => setSelectedDev({ ...selectedDev, name: e.target.value })}
                                  className="w-full px-5 py-4 text-lg font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none transition-all duration-200 placeholder:text-gray-400"
                                  placeholder="Enter development name"
                                />
                              </div>

                              {/* Logo Upload */}
                              <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                  <ImageIcon size={14} className="text-fcGold" />
                                  Project Logo
                                </label>
                                <div className="p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl hover:border-fcGold transition-colors duration-200">
                                  <MediaManager
                                    development={selectedDev}
                                    activeBranch={activeBranch}
                                    onUpdate={setSelectedDev}
                                    category="LOGO"
                                  />
                                </div>
                              </div>

                              {/* Location & Status Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                    <Activity size={14} className="text-fcGold" />
                                    Development Status
                                  </label>
                                  <select
                                    value={selectedDev.phase}
                                    onChange={(e) => setSelectedDev({ ...selectedDev, phase: e.target.value as DevelopmentPhase })}
                                    className="w-full px-5 py-4 text-sm font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none transition-all duration-200 cursor-pointer"
                                  >
                                    <option value="SERVICING">ðŸ”„ Servicing Phase</option>
                                    <option value="READY_TO_BUILD">âœ… Ready to Build</option>
                                  </select>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin size={14} className="text-fcGold" />
                                    Location
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedDev.locationName}
                                    onChange={(e) => setSelectedDev({ ...selectedDev, locationName: e.target.value })}
                                    className="w-full px-5 py-4 text-sm font-medium text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none transition-all duration-200 placeholder:text-gray-400"
                                    placeholder="e.g., Borrowdale, Harare"
                                  />
                                </div>
                              </div>

                              {/* Description */}
                              <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                  <FileText size={14} className="text-fcGold" />
                                  Description
                                </label>
                                <textarea
                                  rows={6}
                                  value={selectedDev.description}
                                  onChange={(e) => setSelectedDev({ ...selectedDev, description: e.target.value })}
                                  className="w-full px-5 py-4 text-sm leading-relaxed text-gray-700 bg-white border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none transition-all duration-200 resize-none placeholder:text-gray-400"
                                  placeholder="Provide a detailed description of the development, its features, and key selling points..."
                                />
                              </div>

                              {/* AI Overview Section - Premium */}
                              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/60 rounded-xl space-y-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2.5">
                                    <div className="p-1.5 bg-blue-100 rounded-lg">
                                      <Sparkles size={16} className="text-blue-600" />
                                    </div>
                                    AI-Powered Overview Generator
                                  </h4>
                                  <button
                                    type="button"
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isGeneratingOverview}
                                    onClick={async () => {
                                      setIsGeneratingOverview(true);
                                      const overview = await generateDevelopmentOverview(selectedDev);
                                      setAiOverview(overview);
                                      setIsGeneratingOverview(false);
                                    }}
                                  >
                                    {isGeneratingOverview ? 'Generating...' : 'Generate'}
                                  </button>
                                </div>
                                {aiOverview && (
                                  <div className="p-4 bg-white border border-blue-100 rounded-lg space-y-3 shadow-sm animate-in fade-in duration-300">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Generated Content</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{aiOverview}</p>
                                    <div className="flex items-center gap-2 pt-2">
                                      <button
                                        className="px-4 py-2 bg-fcGold text-white rounded-lg text-xs font-bold hover:shadow-md transition-all duration-200"
                                        onClick={() => setSelectedDev({ ...selectedDev, description: aiOverview })}
                                      >
                                        Use This Description
                                      </button>
                                      <button
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-all duration-200"
                                        onClick={() => setAiOverview('')}
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeTab === 'financials' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                              <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2.5">
                                  <div className="p-2 bg-fcGold/10 rounded-lg">
                                    <Wallet size={18} className="text-fcGold" />
                                  </div>
                                  Payment Records
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-600">{reconData.length}</span>
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</span>
                                </div>
                              </div>

                              {reconData.length > 0 ? (
                                <div className="space-y-3">
                                  {reconData.map(r => (
                                    <div key={r.id} className="group p-5 bg-gradient-to-r from-white to-gray-50/50 rounded-xl border-2 border-gray-200 hover:border-fcGold/30 hover:shadow-md transition-all duration-200">
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                          <div className="p-3 bg-gradient-to-br from-fcGold/10 to-fcGold/5 rounded-xl group-hover:from-fcGold/20 group-hover:to-fcGold/10 transition-colors duration-200">
                                            <DollarSign size={20} className="text-fcGold" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{r.clientName}</p>
                                            <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-2">
                                              <span className="font-medium">{r.assetRef}</span>
                                              <span className="text-gray-400">â€¢</span>
                                              <span>{r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString() : '-'}</span>
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right space-y-2">
                                          <p className="text-lg font-bold text-gray-900">${(r.totalPaidUsd || 0).toLocaleString()}</p>
                                          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${(r.status as string) === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                            {r.status}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="py-16 text-center space-y-5">
                                  <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full w-fit mx-auto">
                                    <CreditCard size={40} className="text-gray-300" />
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-base font-bold text-gray-900">No Transactions Yet</p>
                                    <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">Payment records will appear here once transactions are verified for this development</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'infrastructure' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-fcGold/10 rounded-lg">
                                  <TrendingUp size={18} className="text-fcGold" />
                                </div>
                                <h4 className="text-base font-bold text-gray-900">Infrastructure & Features</h4>
                              </div>

                              <div className="space-y-8">
                                {INFRA_CATEGORIES.map(category => {
                                  const Icon = category.icon;
                                  const currentList = (selectedDev?.infrastructureJson?.[category.id]) || [];

                                  return (
                                    <div key={category.id} className="space-y-4">
                                      <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2.5">
                                          <div className="p-1.5 bg-fcGold/10 rounded-lg">
                                            <Icon size={16} className="text-fcGold" />
                                          </div>
                                          <label className="text-sm font-bold text-gray-900">{category.label}</label>
                                        </div>
                                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                                          {currentList.length} / {category.options.length}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {category.options.map(option => {
                                          const isActive = currentList.includes(option);
                                          return (
                                            <button
                                              key={option}
                                              onClick={() => handleToggleOption(category.id, option)}
                                              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${isActive
                                                ? 'bg-gradient-to-r from-fcGold to-[#9A8B5F] text-white border-fcGold shadow-md hover:shadow-lg'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                              <CheckCircle2 size={18} className={isActive ? 'visible' : 'opacity-20'} />
                                              <span className="flex-1 text-left">{option}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {activeTab === 'media' && (
                            <div className="animate-in fade-in duration-300 space-y-6">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-fcGold/10 rounded-lg">
                                  <GalleryIcon size={18} className="text-fcGold" />
                                </div>
                                <h4 className="text-base font-bold text-gray-900">Media Gallery</h4>
                              </div>
                              <div className="p-6 bg-gray-50/50 border-2 border-dashed border-gray-300 rounded-xl hover:border-fcGold transition-colors duration-200">
                                <MediaManager
                                  development={selectedDev}
                                  activeBranch={activeBranch}
                                  onUpdate={setSelectedDev}
                                  category="RENDER"
                                />
                              </div>
                            </div>
                          )}

                          {activeTab === 'spatial' && (
                            <div className="animate-in fade-in duration-300">
                              <GeoJSONImportPanel
                                developmentId={selectedDev.id}
                                developmentName={selectedDev.name}
                                onImportComplete={() => {
                                  // Refresh the development data to get updated stands
                                  handleRefreshDevelopment(selectedDev.id);
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200/80 shadow-lg shadow-gray-200/50 py-32 text-center space-y-6">
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full w-fit mx-auto">
                      <MapPin size={56} className="text-gray-300" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">Select a Development</h3>
                      <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                        Choose a development from the sidebar to view and edit comprehensive details, financials, features, and media
                      </p>
                    </div>
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-fcGold to-[#9A8B5F] text-white rounded-xl text-sm font-bold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 shadow-md mx-auto"
                    >
                      <Plus size={18} />
                      <span>Create New Development</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Back to Overview Button */}
              <button
                onClick={() => {
                  setSelectedDev(null);
                  setViewMode('overview');
                }}
                className="fixed bottom-8 left-8 z-50 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all duration-200 flex items-center gap-2 shadow-2xl"
              >
                <ChevronLeft size={18} />
                Back to Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-6 py-4 rounded-xl text-white font-semibold shadow-lg animate-in slide-in-from-bottom duration-300 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
            {notification.msg}
          </div>
        </div>
      )}
    </>
  );
};


