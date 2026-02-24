'use client';

import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  Plus, Search, Trash2, Edit2, MapPin, Building2, Loader2, AlertCircle,
  DollarSign, Home, ChevronLeft, Filter
} from 'lucide-react';
import { Development, Branch, type Role } from '../types.ts';
import { deleteDevelopment } from '../lib/db';
import { authenticatedFetch } from '../lib/api-client';
import { logger } from '@/lib/logger';
import { cachedFetch } from '@/lib/api-cache';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonCard } from './SkeletonLoader.tsx';
import { PageContainer, SectionHeader } from '@/components/layouts';

// Lazy load DevelopmentWizard for code splitting (only loads when wizard is opened)
// DevelopmentWizard has a default export, so we can use lazy directly
const DevelopmentWizard = lazy(() => import('./DevelopmentWizardV2.tsx'));

// Import type separately (types are not code-split)
import type { DevelopmentFormData } from './DevelopmentWizardTypes.ts';

interface AdminDevelopmentsDashboardProps {
  activeBranch: Branch;
  userRole?: Role;
}

/**
 * AdminDevelopmentsDashboard
 * 
 * Minimal admin dashboard for managing developments.
 * Uses DevelopmentWizard as the SOLE form tool for create/edit.
 * Handles:
 * - List all developments
 * - Search developments
 * - Create new development (opens Wizard)
 * - Edit development (opens Wizard)
 * - Delete development (with confirmation)
 * - Filter by branch
 */
export const AdminDevelopmentsDashboard: React.FC<AdminDevelopmentsDashboardProps> = ({
  activeBranch,
  userRole = 'Admin'
}) => {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardEditId, setWizardEditId] = useState<string | null>(null);
  const [wizardInitialData, setWizardInitialData] = useState<Partial<DevelopmentFormData> | undefined>();

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Load developments on mount or when branch changes
  useEffect(() => {
    loadDevelopments();
  }, [activeBranch]);

  const loadDevelopments = async () => {
    setIsLoading(true);
    try {
      logger.debug('Fetching developments from API', { module: 'AdminDevelopmentsDashboard', activeBranch });
      
      // Clear cache to ensure fresh data
      const { apiCache } = await import('@/lib/api-cache');
      apiCache.clear('/api/admin/developments');
      
      // Fetch directly without cache to see raw response
      const response = await fetch('/api/admin/developments');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      // Log full response structure for debugging
      console.log('[AdminDevelopmentsDashboard] Full API Response:', JSON.stringify(result, null, 2));
      
      logger.debug('Raw API response received', { 
        module: 'AdminDevelopmentsDashboard',
        hasSuccess: 'success' in (result || {}),
        hasData: !!result?.data,
        hasDevelopments: !!result?.developments,
        dataType: Array.isArray(result?.data) ? 'array' : typeof result?.data,
        resultKeys: Object.keys(result || {}),
        resultString: JSON.stringify(result).substring(0, 500)
      });
      
      // Handle API response format: { success: true, data: { data: [...], developments: [...] } }
      // The apiSuccess helper wraps data as: { success: true, data: { data: [...], developments: [...] } }
      let rawData: Development[] = [];
      
      // Debug: Log the exact structure
      console.log('[AdminDevelopmentsDashboard] Response structure:', {
        hasSuccess: result?.success,
        hasData: !!result?.data,
        dataType: typeof result?.data,
        isDataArray: Array.isArray(result?.data),
        dataKeys: result?.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
        hasNestedData: result?.data && typeof result.data === 'object' && 'data' in result.data,
        hasNestedDevelopments: result?.data && typeof result.data === 'object' && 'developments' in result.data
      });
      
      // First check: result.success && result.data exists
      if (result?.success === true && result?.data) {
        const dataObj = result.data;
        
        // Case 1: result.data is directly an array
        if (Array.isArray(dataObj)) {
          rawData = dataObj;
          console.log('[AdminDevelopmentsDashboard] âœ… Found array directly in result.data', rawData.length);
        }
        // Case 2: result.data is an object with nested data/developments
        else if (typeof dataObj === 'object' && dataObj !== null) {
          // Explicitly check and log nested arrays
          const nestedData = (dataObj as any).data;
          const nestedDevelopments = (dataObj as any).developments;
          
          console.log('[AdminDevelopmentsDashboard] Checking nested arrays:', {
            hasNestedData: !!nestedData,
            nestedDataType: typeof nestedData,
            isNestedDataArray: Array.isArray(nestedData),
            nestedDataLength: Array.isArray(nestedData) ? nestedData.length : 'N/A',
            nestedDataValue: nestedData ? JSON.stringify(nestedData).substring(0, 200) : 'null/undefined',
            hasNestedDevelopments: !!nestedDevelopments,
            nestedDevelopmentsType: typeof nestedDevelopments,
            isNestedDevelopmentsArray: Array.isArray(nestedDevelopments),
            nestedDevelopmentsLength: Array.isArray(nestedDevelopments) ? nestedDevelopments.length : 'N/A',
            nestedDevelopmentsValue: nestedDevelopments ? JSON.stringify(nestedDevelopments).substring(0, 200) : 'null/undefined',
            allDataObjKeys: Object.keys(dataObj)
          });
          
          // Try result.data.data first (most common structure from apiSuccess)
          if (Array.isArray(nestedData) && nestedData.length > 0) {
            rawData = nestedData;
            console.log('[AdminDevelopmentsDashboard] âœ… Found array in result.data.data', rawData.length);
          }
          // Then try result.data.developments
          else if (Array.isArray(nestedDevelopments) && nestedDevelopments.length > 0) {
            rawData = nestedDevelopments;
            console.log('[AdminDevelopmentsDashboard] âœ… Found array in result.data.developments', rawData.length);
          }
          // Also try if arrays exist but are empty (might be valid)
          else if (Array.isArray(nestedData)) {
            rawData = nestedData;
            console.log('[AdminDevelopmentsDashboard] âš ï¸ Found empty array in result.data.data', rawData.length);
          }
          else if (Array.isArray(nestedDevelopments)) {
            rawData = nestedDevelopments;
            console.log('[AdminDevelopmentsDashboard] âš ï¸ Found empty array in result.data.developments', rawData.length);
          }
          else {
            console.error('[AdminDevelopmentsDashboard] âŒ result.data is object but no array found', {
              keys: Object.keys(dataObj),
              nestedDataType: typeof nestedData,
              nestedDevelopmentsType: typeof nestedDevelopments,
              sample: JSON.stringify(dataObj).substring(0, 500)
            });
          }
        }
      }
      // Fallback: Check if result.data is directly an array (no success flag)
      else if (Array.isArray(result?.data)) {
        rawData = result.data;
        console.log('[AdminDevelopmentsDashboard] âœ… Found array in result.data (no success flag)', rawData.length);
      }
      // Fallback: Check result.developments
      else if (Array.isArray(result?.developments)) {
        rawData = result.developments;
        console.log('[AdminDevelopmentsDashboard] âœ… Found array in result.developments', rawData.length);
      }
      // Fallback: Result is direct array
      else if (Array.isArray(result)) {
        rawData = result;
        console.log('[AdminDevelopmentsDashboard] âœ… Result is direct array', rawData.length);
      }
      else {
        console.error('[AdminDevelopmentsDashboard] âŒ Could not parse response - no array found', {
          resultType: typeof result,
          resultKeys: Object.keys(result || {}),
          resultSample: JSON.stringify(result).substring(0, 500)
        });
      }
      
      console.log('[AdminDevelopmentsDashboard] Final parsed developments count:', rawData.length);
      if (rawData.length > 0) {
        console.log('[AdminDevelopmentsDashboard] Sample development:', {
          id: rawData[0]?.id,
          name: rawData[0]?.name,
          branch: (rawData[0] as any)?.branch
        });
      }
      
      // Ensure we have an array - if still empty, try one more fallback
      let developmentsData = Array.isArray(rawData) ? rawData : [];
      
      // Last resort: Try to find any array in the response recursively
      if (developmentsData.length === 0 && result) {
        const findArray = (obj: any): any[] => {
          if (Array.isArray(obj)) return obj;
          if (typeof obj !== 'object' || obj === null) return [];
          for (const value of Object.values(obj)) {
            const found = findArray(value);
            if (found.length > 0) return found;
          }
          return [];
        };
        const foundArray = findArray(result);
        if (foundArray.length > 0) {
          developmentsData = foundArray;
          console.log('[AdminDevelopmentsDashboard] âœ… Found array via recursive search', foundArray.length);
        }
      }
      
      logger.info('Developments loaded successfully', { 
        module: 'AdminDevelopmentsDashboard', 
        count: developmentsData.length,
        sampleIds: developmentsData.slice(0, 3).map(d => ({ 
          id: d?.id, 
          name: d?.name, 
          branch: (d as any)?.branch || 'N/A', 
          status: (d as any)?.status || 'N/A' 
        }))
      });
      
      if (developmentsData.length === 0) {
        logger.warn('No developments returned from API', { 
          module: 'AdminDevelopmentsDashboard',
          resultKeys: Object.keys(result || {}),
          resultStructure: {
            hasSuccess: 'success' in (result || {}),
            hasData: !!result?.data,
            hasDevelopments: !!result?.developments,
            dataType: Array.isArray(result?.data) ? 'array' : typeof result?.data,
            dataKeys: result?.data && typeof result.data === 'object' && result.data !== null ? Object.keys(result.data) : [],
            fullResult: JSON.stringify(result).substring(0, 1000)
          }
        });
        console.error('[AdminDevelopmentsDashboard] âŒ No developments parsed. Full response:', JSON.stringify(result, null, 2));
      } else {
        console.log('[AdminDevelopmentsDashboard] âœ… Successfully parsed', developmentsData.length, 'developments');
      }
      
      // Final safety check - ensure we always set an array
      if (!Array.isArray(developmentsData)) {
        console.error('[AdminDevelopmentsDashboard] âŒ developmentsData is not an array, forcing to empty array');
        developmentsData = [];
      }
      
      setDevelopments(developmentsData);
    } catch (error) {
      logger.error('Failed to load developments', error instanceof Error ? error : undefined, { module: 'AdminDevelopmentsDashboard' });
      setNotification({
        type: 'error',
        message: 'Failed to load developments'
      });
      // Ensure developments is always an array even on error
      setDevelopments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe filtering with defensive checks - EXTRA DEFENSIVE to prevent .map errors
  const filteredDevs = useMemo(() => {
    // Multiple layers of safety
    if (!developments) {
      console.warn('[AdminDevelopmentsDashboard] developments is null/undefined, returning empty array');
      return [];
    }
    if (!Array.isArray(developments)) {
      console.warn('[AdminDevelopmentsDashboard] developments is not an array:', typeof developments);
      return [];
    }
    
    try {
      const filtered = developments.filter(d => {
        if (!d || !d.id) return false;
        
        try {
          const name = (d.name || '').toString();
          const location = (d.locationName || '').toString();
          const query = (debouncedSearchQuery || '').toString().toLowerCase();
          
          if (!query) return true; // Show all if no search query
          if (!name && !location) return false; // Hide if no searchable fields
          
          return name.toLowerCase().includes(query) || location.toLowerCase().includes(query);
        } catch (err) {
          logger.warn('Error filtering development', { module: 'AdminDevelopmentsDashboard', error: err, devId: d?.id });
          return false;
        }
      });
      
      // Final safety check on the result
      if (!Array.isArray(filtered)) {
        console.error('[AdminDevelopmentsDashboard] Filter returned non-array, forcing to empty array');
        return [];
      }
      
      return filtered;
    } catch (err) {
      console.error('[AdminDevelopmentsDashboard] Error in filteredDevs useMemo:', err);
      return [];
    }
  }, [developments, debouncedSearchQuery]);

  // Create New Development
  const handleCreateNew = () => {
    setWizardEditId(null);
    setWizardInitialData(undefined);
    setIsWizardOpen(true);
  };

  // Edit Existing Development
  const handleEditDevelopment = (dev: Development) => {
    if (!dev || !dev.id) {
      logger.warn('Cannot edit development: missing id', { module: 'AdminDevelopmentsDashboard', dev });
      return;
    }
    
    setWizardEditId(dev.id);

    // Parse stand_sizes from database
    let parsedStandSizes = { small: 300, medium: 500, large: 800 };
    try {
      const devAny = dev as any;
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
      logger.warn('Failed to parse stand_sizes', { module: 'AdminDevelopmentsDashboard', error: e });
    }

    // Parse stand_types from database
    let parsedStandTypes: ('Residential' | 'Commercial' | 'Institutional')[] = ['Residential'];
    try {
      const devAny = dev as any;
      let standTypesArray: any[] = [];
      
      // Handle stand_types that could be a string (JSON) or array
      if (devAny.stand_types) {
        if (Array.isArray(devAny.stand_types)) {
          standTypesArray = devAny.stand_types;
        } else if (typeof devAny.stand_types === 'string') {
          try {
            const parsed = JSON.parse(devAny.stand_types);
            if (Array.isArray(parsed)) {
              standTypesArray = parsed;
            }
          } catch (parseErr) {
            logger.warn('Failed to parse stand_types as JSON string', { module: 'AdminDevelopmentsDashboard', error: parseErr });
          }
        }
      }
      
      if (standTypesArray.length > 0) {
        parsedStandTypes = standTypesArray.filter((t: any) =>
          typeof t === 'string' && ['Residential', 'Commercial', 'Institutional'].includes(t)
        ) as ('Residential' | 'Commercial' | 'Institutional')[];
      }
      if (parsedStandTypes.length === 0) parsedStandTypes = ['Residential'];
    } catch (e) {
      logger.warn('Failed to parse stand_types', { module: 'AdminDevelopmentsDashboard', error: e });
    }

    // Parse commission_model from database
    let parsedCommission: { type: 'fixed' | 'percentage'; fixedAmount: number; percentage: number } = {
      type: 'fixed',
      fixedAmount: 1000,
      percentage: 5
    };
    try {
      const devAny = dev as any;
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
      logger.warn('Failed to parse commission_model', { module: 'AdminDevelopmentsDashboard', error: e });
    }

    // Parse geo_json_data from database
    let parsedGeoJSON = null;
    let rawGeoJSON = '';
    try {
      const devAny = dev as any;
      if (devAny.geo_json_data) {
        parsedGeoJSON = typeof devAny.geo_json_data === 'string'
          ? JSON.parse(devAny.geo_json_data)
          : devAny.geo_json_data;
        rawGeoJSON = JSON.stringify(parsedGeoJSON, null, 2);
      } else if (devAny.geo_json_url) {
        rawGeoJSON = devAny.geo_json_url;
      }
    } catch (e) {
      logger.warn('Failed to parse GeoJSON', { module: 'AdminDevelopmentsDashboard', error: e });
    }

    // Prepare wizard data
    const devAny = dev as any;
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

    const wizardData: any = {
      name: dev.name || '',
      location: devAny.location_name || devAny.location || '',
      branch: activeBranch,
      featuredTag: devAny.featured_tag || devAny.featuredTag || 'none',
      pricePerStand: dev.basePrice || 0,
      totalStands: dev.totalStands || 0,
      standSizes: parsedStandSizes,
      standTypes: parsedStandTypes,
      infrastructure: devAny.infrastructure_json || {},
      commission: parsedCommission,
      features: devAny.features || [],
      overview: devAny.overview || '',
      geojsonData: rawGeoJSON,
      imageUrls: devAny.image_urls || [],
      documentUrls: devAny.document_urls || [],
      developerName: devAny.developer_name || '',
      developerEmail: devAny.developer_email || '',
      developerPhone: devAny.developer_phone || '',
      lawyerName: devAny.lawyer_name || '',
      lawyerEmail: devAny.lawyer_email || '',
      lawyerPhone: devAny.lawyer_phone || '',
      estateProgress: devAny.phase || 'PLANNING',
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
      // Payment terms from wizard
      installmentPeriods: devAny.installment_periods || [12, 24, 48],
      depositPercentage: devAny.deposit_percentage ?? 10,
      // Fee configuration
      vatEnabled: devAny.vat_enabled ?? true,
      endowmentEnabled: devAny.endowment_enabled ?? false,
      aosEnabled: devAny.aos_enabled ?? false,
      aosFee: devAny.aos_fee ?? 500,
      cessionsEnabled: devAny.cessions_enabled ?? false,
      cessionFee: devAny.cession_fee ?? 250,
      adminFeeEnabled: devAny.admin_fee_enabled ?? false,
      adminFee: devAny.admin_fee ?? 0,
      // Manual stand creation fields
      manualStandSizes: devAny.manual_stand_sizes || '',
      csvStandsData: devAny.csv_stands_data || '',
      parsedCsvStands: devAny.parsed_csv_stands || [],
    };

    setWizardInitialData(wizardData);
    setIsWizardOpen(true);
  };

  // Wizard Submit Handler
  const handleWizardSubmit = async (formData: DevelopmentFormData) => {
    const isEdit = !!wizardEditId;
    
    // Use existing development ID for edits, let backend generate for new developments
    let developmentId: string | undefined;
    if (isEdit && wizardEditId) {
      developmentId = wizardEditId;
    } else {
      // Don't generate ID on frontend - let backend create valid CUID
      developmentId = undefined;
    }
    
    // Skip optimistic update for new developments (we don't have valid ID yet)
    // Only do optimistic update for edits where we have the existing ID
    if (isEdit && developmentId) {
      const optimisticDev: Development = {
        id: developmentId,
        name: formData.name,
        locationName: formData.location,
        basePrice: formData.pricePerSqm > 0
          ? Math.round((formData.standSizes ? Math.min(...Object.values(formData.standSizes)) : 500) * formData.pricePerSqm)
          : 0,
        totalStands: formData.totalStands,
        availableStands: formData.totalStands,
        branch: formData.branch || activeBranch,
        status: 'Active',
        phase: (formData.estateProgress === 'COMPLETED' ? 'READY_TO_BUILD' : formData.estateProgress) || 'SERVICING',
        createdAt: new Date().toISOString(),
        description: '',
        vatPercentage: 15.5,
        vatStatus: 'Inclusive',
        endowmentFee: 0,
        paymentTermsDescription: '',
        depositRequired: 0,
        maxInstallments: 12,
        minDepositPercentage: 10,
        defaultInstallmentPeriod: 12,
        interestRate: 0,
        allowBankTransferSurcharge: false,
        latitude: 0,
        longitude: 0,
        imageUrls: [],
        documentUrls: [],
        infrastructureJson: { roads: [], water: [], power: [], sewer: [], security: [], connectivity: [] },
        completionStatus: 0,
      };
      
      // Optimistically update existing development
      setDevelopments(prev => Array.isArray(prev) ? prev.map(d => d.id === developmentId ? optimisticDev : d) : [optimisticDev]);
    }
    
    // Close wizard immediately for better UX
    setIsWizardOpen(false);
    setWizardEditId(null);
    setWizardInitialData(undefined);
    
    try {
      
      // Build API payload - include ALL wizard fields including manual stand creation
      
      // Calculate base_price as "Starting From" price
      // Use smallest stand size Ã— price per sqm for realistic minimum price
      const smallestStandSize = formData.standSizes ? Math.min(...Object.values(formData.standSizes)) : 500;
      const calculatedBasePrice = formData.pricePerSqm > 0 
        ? Math.round(smallestStandSize * formData.pricePerSqm) 
        : 0;
      
      const payload = {
        ...(developmentId ? { id: developmentId } : {}), // Only include ID for edits
        // Core required fields (camelCase to match schema)
        name: formData.name,
        location: formData.location,
        basePrice: calculatedBasePrice || 1, // Ensure positive value, minimum $1
        // Optional fields matching schema
        branch: formData.branch || activeBranch,
        featuredTag: formData.featuredTag || 'none',
        totalStands: formData.totalStands,
        status: 'Active',
        phase: formData.estateProgress || 'SERVICING',
        pricePerSqm: formData.pricePerSqm,
        overview: formData.overview,
        vatEnabled: formData.vatEnabled,
        endowmentEnabled: formData.endowmentEnabled,
        aosEnabled: formData.aosEnabled,
        aosFee: formData.aosFee,
        cessionsEnabled: formData.cessionsEnabled,
        cessionFee: formData.cessionFee,
        adminFeeEnabled: formData.adminFeeEnabled,
        adminFee: formData.adminFee,
        developerName: formData.developerName || null,
        developerEmail: formData.developerEmail || null,
        developerPhone: formData.developerPhone || null,
        lawyerName: formData.lawyerName || null,
        lawyerEmail: formData.lawyerEmail || null,
        lawyerPhone: formData.lawyerPhone || null,
        geoJsonData: formData.geojsonData,
        // Extended fields for backend processing (snake_case for database columns)
        image_urls: formData.imageUrls,
        document_urls: formData.documentUrls,
        commission_model: formData.commission,
        stand_sizes: formData.standSizes,
        stand_types: formData.standTypes,
        features: formData.features,
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
        installment_periods: formData.installmentPeriods || [12, 24, 48],
        deposit_percentage: formData.depositPercentage || 10,
        // MANUAL STAND CREATION FIELDS (for inventory population)
        useManualStandCreation: formData.useManualStandCreation || false,
        standCountToCreate: formData.standCountToCreate || 0,
        standNumberPrefix: formData.standNumberPrefix || '',
        standNumberStart: formData.standNumberStart || 1,
        defaultStandSize: formData.defaultStandSize || 0,
        defaultStandPrice: calculatedBasePrice || 1,
        manualStandSizes: formData.manualStandSizes || '',
        csvStandsData: formData.csvStandsData || '',
        parsedCsvStands: formData.parsedCsvStands || [],
      };
      
      logger.info('Submitting development', { 
        module: 'AdminDevelopmentsDashboard',
        isEdit, 
        developmentId, 
        name: payload.name,
        basePrice: payload.basePrice,
        pricePerSqm: payload.pricePerSqm,
        calculationNote: `${smallestStandSize}mÂ² Ã— $${formData.pricePerSqm}/mÂ² = $${calculatedBasePrice || 1}`,
        useManualStandCreation: payload.useManualStandCreation,
        standCountToCreate: payload.standCountToCreate
      });
      
      // Make API call
      const method = isEdit ? 'PUT' : 'POST';
      const response = await authenticatedFetch('/api/admin/developments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      logger.debug('API response received', { module: 'AdminDevelopmentsDashboard', status: response.status, ok: response.ok });
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEdit ? 'update' : 'create'} development`);
      }
      
      // Success - refresh to get server data (replaces optimistic update)
      await loadDevelopments();
      setNotification({
        type: 'success',
        message: isEdit ? 'Development updated successfully' : 'Development created successfully'
      });
    } catch (error: any) {
      logger.error('Submit error', error, { module: 'AdminDevelopmentsDashboard' });
      
      // Rollback optimistic update on error
      if (isEdit && developmentId) {
        // Reload to restore original state
        await loadDevelopments();
      }
      // Note: For new developments, we don't have ID yet so no rollback needed
      
      // Reopen wizard so user can fix and retry
      setIsWizardOpen(true);
      setWizardEditId(isEdit && developmentId ? developmentId : null);
      
      setNotification({
        type: 'error',
        message: error.message || 'Failed to save development'
      });
    }
  };

  // Wizard Cancel Handler
  const handleWizardCancel = () => {
    setIsWizardOpen(false);
    setWizardEditId(null);
    setWizardInitialData(undefined);
  };

  // Delete Development
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const deletedId = deleteConfirm.id;
    const deletedName = deleteConfirm.name;
    
    // Optimistic update: Remove from UI immediately
    setDevelopments(prev => Array.isArray(prev) ? prev.filter(d => d.id !== deletedId) : []);
    setDeleteConfirm(null);

    try {
      // âœ… SURGICAL FIX: Call API to delete from Neon
      const result = await deleteDevelopment(deletedId);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Success - refresh to ensure consistency
      await loadDevelopments();
      setNotification({
        type: 'success',
        message: `${deletedName} deleted successfully`
      });
    } catch (error: any) {
      logger.error('Delete error', error, { module: 'AdminDevelopmentsDashboard' });
      
      // Rollback optimistic update on error
      await loadDevelopments();
      
      setNotification({
        type: 'error',
        message: error.message || 'Failed to delete development'
      });
    }
  };

  // Notification auto-dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification]);

  return (
    <div className="w-full min-w-0 h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      {/* Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-full sm:max-w-2xl xl:max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-x-hidden overflow-y-auto">
            <Suspense fallback={<div className="p-8"><SkeletonCard /></div>}>
              <DevelopmentWizard
                key={`wizard-${wizardEditId || 'new'}-${Date.now()}`}
                activeBranch={activeBranch}
                initialData={wizardInitialData}
                isEditing={!!wizardEditId}
                developmentId={wizardEditId || undefined}
                onSubmit={handleWizardSubmit}
                onCancel={handleWizardCancel}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-full sm:max-w-sm">
            <h3 className="text-lg font-bold text-red-900 mb-2">Delete Development?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <PageContainer className="py-6 lg:py-8 space-y-6 lg:space-y-8">
        {/* Header */}
        <SectionHeader
          title={
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              <span>Developments</span>
            </div>
          }
          description={`${activeBranch} Branch â€¢ ${filteredDevs.length} developments`}
          actions={
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg sm:rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-sm sm:text-base"
            >
              <Plus size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">New Development</span>
              <span className="sm:hidden">New</span>
            </button>
          }
        />

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-sm sm:text-base"
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm sm:text-base whitespace-nowrap">
            <Filter size={16} className="sm:w-[18px] sm:h-[18px]" />
            Filter
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Developments List */}
        {!isLoading && Array.isArray(filteredDevs) && filteredDevs.length > 0 && (
          <div className="space-y-4">
            {(Array.isArray(filteredDevs) ? filteredDevs : []).map((dev) => {
              // Defensive checks for all properties
              if (!dev || !dev.id) return null;
              
              const devName = dev.name || 'Unnamed Development';
              const devId = dev.id;
              const location = (dev as any).locationName || 'Location';
              const totalStands = typeof dev.totalStands === 'number' ? dev.totalStands : 0;
              const basePrice = typeof dev.basePrice === 'number' ? dev.basePrice : 0;
              
              return (
                <div
                  key={devId}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <h3 className="text-lg font-bold text-slate-900">{devName}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin size={16} className="text-blue-600" />
                          {location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Home size={16} className="text-green-600" />
                          {totalStands} stands
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign size={16} className="text-amber-600" />
                          ${basePrice > 0 ? basePrice.toLocaleString() : '0'}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleEditDevelopment(dev)}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium text-sm sm:text-base"
                      >
                        <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: devId, name: devName })}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm sm:text-base"
                      >
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredDevs.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Developments</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'No developments match your search' : 'Get started by creating your first development'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Plus size={20} />
                Create Development
              </button>
            )}
          </div>
        )}
      </PageContainer>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 px-4 py-3 sm:px-6 sm:py-4 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 sm:gap-3 text-sm sm:text-base max-w-[calc(100vw-2rem)] sm:max-w-md ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span>{notification.type === 'success' ? 'âœ“' : 'âœ•'}</span>
          <span className="truncate">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDevelopmentsDashboard;
