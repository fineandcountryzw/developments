'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Map,
  Upload,
  DollarSign,
  Building2,
  ShieldCheck,
  Leaf,
  Zap,
  Settings
} from 'lucide-react';
import type { Branch } from '../types';
import type {
  DevelopmentFormData,
  GeoJSONData,
  ServiceStationType
} from './DevelopmentWizardTypes.ts';

interface DevelopmentWizardProps {
  activeBranch: Branch;
  initialData?: Partial<DevelopmentFormData>;
  isEditing?: boolean;
  developmentId?: string;
  onSubmit: (data: DevelopmentFormData) => Promise<void>;
  onCancel: () => void;
}

const LOCATION_OPTIONS = [
  // Harare Regions
  'Harare North',
  'Harare East',
  'Harare West',
  'Harare South',

  // Major Towns & Cities (Zimbabwe)
  'Bulawayo',
  'Chitungwiza',
  'Ruwa',
  'Epworth',
  'Norton',
  'Chinhoyi',
  'Kadoma',
  'Kwekwe',
  'Gweru',
  'Mutare',
  'Marondera',
  'Bindura',
  'Masvingo',
  'Victoria Falls',
  'Hwange',
  'Kariba',
  'Beitbridge',
  'Zvishavane',
  'Gwanda',
  'Lupane',
  'Chegutu',

  'Other'
];

const SERVICE_STATION_TYPES: { value: ServiceStationType; label: string }[] = [
  { value: 'full', label: 'Full Service (Fuel + Shop + Car Wash)' },
  { value: 'fuel_only', label: 'Fuel Only' },
  { value: 'shop_only', label: 'Shop Only' },
  { value: 'custom', label: 'Custom' }
];

const INFRA_STATUS_OPTIONS: { value: DevelopmentFormData['estateProgressDetails']['roads']; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

const DEFAULT_FORM_DATA: DevelopmentFormData = {
  name: '',
  location: '',
  branch: 'Harare',
  developmentId: '',
  featuredTag: 'none',
  totalStands: 1,
  pricePerStand: 5000,
  pricePerSqm: 10,
  estateProgress: 'SERVICING',
  estateProgressDetails: {
    roads: 'not_started',
    water: 'not_started',
    sewer: 'not_started',
    electricity: 'not_started',
    compliance: 'pending'
  },
  hasServiceStation: false,
  serviceStationType: undefined,
  serviceStationHoursOpen: '06:00',
  serviceStationHoursClose: '22:00',
  serviceStationIs24Hour: false,
  serviceStationNotes: '',
  hasBioDigester: false,
  hasSepticTanks: false,
  compliancePartialApplied: false,
  compliancePartialApproved: false,
  complianceFullApplied: false,
  complianceFullApproved: false,
  standSizes: { small: 300, medium: 500, large: 800 },
  standTypes: ['Residential'],
  features: [],
  imageUrls: [],
  documentUrls: [],
  commission: { type: 'fixed', fixedAmount: 1000, percentage: 5 },
  geojsonData: null,
  geojsonRaw: '',
  useManualStandCreation: false,
  standNumberingFormat: 'sequential',
  standNumberPrefix: '',
  standNumberStart: 1,
  standCountToCreate: 0,
  defaultStandSize: 500,
  defaultStandPrice: 0,
  manualStandSizes: '',
  csvStandsData: '',
  parsedCsvStands: [],
  disableMapView: false,
  overview: '',
  developerName: '',
  developerEmail: '',
  developerPhone: '',
  lawyerName: '',
  lawyerEmail: '',
  lawyerPhone: '',
  vatEnabled: true,
  endowmentEnabled: false,
  aosEnabled: false,
  aosFee: 500,
  cessionsEnabled: false,
  cessionFee: 250,
  adminFeeEnabled: false,
  adminFee: 0,
  installmentPeriods: [12, 24, 48],
  depositPercentage: 10
};

const formatCurrency = (value: number | string | null | undefined): string => {
  const num = Number(value);
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (value: number | string | null | undefined): string => {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
};

const parseGeoJSONFromText = (raw: string): { data?: GeoJSONData; error?: string; warnings?: string[] } => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
        return { error: 'GeoJSON must be a FeatureCollection with a features array.' };
      }

      const warnings: string[] = [];
      parsed.features.forEach((feature: any, index: number) => {
        if (!feature || feature.type !== 'Feature') {
          warnings.push(`Feature ${index + 1}: Expected type "Feature".`);
        }
        if (!feature.geometry) {
          warnings.push(`Feature ${index + 1}: Missing geometry.`);
        }
        if (!feature.properties?.stand_number && !feature.properties?.standNumber) {
          warnings.push(`Feature ${index + 1}: Missing stand_number; a default will be used.`);
        }
      });

      return { data: parsed as GeoJSONData, warnings: warnings.length ? warnings : undefined };
    } catch (error: any) {
      return { error: `Invalid JSON: ${error?.message || 'Unable to parse.'}` };
    }
   };

   const extractStandArea = (feature: any): number | null => {
  if (!feature?.properties) return null;
  const props = feature.properties;
  const candidates = [
    props.size_m2,
    props.sizeM2,
    props.area,
    props.area_m2,
    props.sqm,
    props.size
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
};

const normalizeInitialData = (initialData?: Partial<DevelopmentFormData>): Partial<DevelopmentFormData> | undefined => {
  if (!initialData) return undefined;
  const normalized: Partial<DevelopmentFormData> = { ...initialData };

  // Avoid overriding defaults with `undefined` (e.g., `estateProgressDetails` must always be an object).
  if (normalized.estateProgressDetails == null) {
    delete (normalized as any).estateProgressDetails;
  }

  if (typeof initialData.geojsonData === 'string') {
    normalized.geojsonRaw = initialData.geojsonData;
    const parsed = parseGeoJSONFromText(initialData.geojsonData);
    if (parsed.data) {
      normalized.geojsonData = parsed.data;
    }
  } else if (initialData.geojsonData && !initialData.geojsonRaw) {
    normalized.geojsonRaw = JSON.stringify(initialData.geojsonData, null, 2);
  }

  return normalized;
};

export const DevelopmentWizardV2: React.FC<DevelopmentWizardProps> = ({
  activeBranch,
  initialData,
  isEditing = false,
  developmentId,
  onSubmit,
  onCancel
}) => {
  // Helper function to parse CSV line properly (handles quoted values with commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // Toggle quote state, but don't include quotes in the result
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (csvText: string) => {
    // Handle different line endings (Windows \r\n, Mac \r, Unix \n)
    const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.trim().split('\n');
    
    console.log('[CSV_PARSE] Starting CSV parse, lines:', lines.length);
    console.log('[CSV_PARSE] First line (headers):', lines[0]);
    
    if (lines.length === 0) {
      setErrors(prev => ({ ...prev, csv: 'CSV file is empty.' }));
      return;
    }

    // Normalize headers - remove extra spaces and convert to lowercase
    const rawHeaders = parseCSVLine(lines[0]);
    console.log('[CSV_PARSE] Raw headers:', rawHeaders);
    
    const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    console.log('[CSV_PARSE] Normalized headers:', headers);
    
    // Find stand number column - look for various possible names
    const standNumberPatterns = ['stand_number', 'standnumber', 'stand', 'standno', 'stand_no', 'number', 'no'];
    let standNumberIndex = headers.findIndex(h => standNumberPatterns.some(p => h.includes(p)));
    
    // Find size column - look for various possible names
    const sizePatterns = ['size', 'area', 'sqm', 'm2', 'sq_metres', 'sq_metres', 'square'];
    let sizeIndex = headers.findIndex(h => sizePatterns.some(p => h.includes(p)));
    
    // Find price column (optional) - look for various possible names
    const pricePatterns = ['price', 'cost', 'amount', 'value'];
    let priceIndex = headers.findIndex(h => pricePatterns.some(p => h.includes(p)));
    
    console.log('[CSV_PARSE] Column search results:', { 
      standNumberIndex, 
      sizeIndex, 
      priceIndex,
      standNumberPattern: standNumberPatterns,
      sizePattern: sizePatterns
    });

    if (standNumberIndex === -1) {
      setErrors(prev => ({ ...prev, csv: 'CSV must have a "stand_number" column. Found headers: ' + headers.join(', ') }));
      return;
    }

    // If size column not found, try to use default but warn user
    const sizeColumnFound = sizeIndex !== -1;
    console.log('[CSV_PARSE] Size column found:', sizeColumnFound);

    const parsedStands: Array<{ standNumber: string; size: number; price?: number }> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      
      // Skip rows that don't have enough data
      if (!values[standNumberIndex] || !values[standNumberIndex].trim()) {
        continue;
      }

      const standNumber = values[standNumberIndex].trim();
      
      // Parse size - if not found, use default from form
      let size: number;
      if (sizeColumnFound && values[sizeIndex] && values[sizeIndex].trim()) {
        // Enhanced parsing: handle comma-formatted numbers ("1,500"), spaces, units (sqm, m2, etc.)
        const rawSize = values[sizeIndex].trim();
        // Remove common units and normalize (keep only digits, dots, commas)
        const cleanedSize = rawSize
          .replace(/sqm|m2|sq\.?|square\s*metres?/gi, '')
          .replace(/,/g, '')  // Remove commas first, then parse
          .trim();
        const parsedSize = parseFloat(cleanedSize);
        
        console.log('[CSV_PARSE] Raw size value:', rawSize, '-> cleaned:', cleanedSize, '-> parsed:', parsedSize);
        
        if (!isNaN(parsedSize) && parsedSize > 0) {
          size = parsedSize;
        } else {
          size = formData.defaultStandSize || 500;
          errors.push(`Row ${i + 1}: Invalid size "${values[sizeIndex]}". Using ${size}m².`);
        }
      } else {
        // Use default size from form if no size column
        size = formData.defaultStandSize || 500;
      }

      // Parse price (optional)
      let price: number | undefined;
      if (priceIndex !== -1 && values[priceIndex] && values[priceIndex].trim()) {
        // Enhanced parsing: handle comma-formatted numbers, currency symbols
        const rawPrice = values[priceIndex].trim();
        const cleanedPrice = rawPrice
          .replace(/[$,£€¥ZAR\s]/g, '')  // Remove currency symbols and whitespace
          .replace(/,/g, '')
          .trim();
        const parsedPrice = parseFloat(cleanedPrice);
        
        console.log('[CSV_PARSE] Raw price value:', rawPrice, '-> cleaned:', cleanedPrice, '-> parsed:', parsedPrice);
        
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          price = parsedPrice;
        }
      }

      parsedStands.push({ standNumber, size, price });
    }
    
    console.log('[CSV_PARSE] Parsed stands count:', parsedStands.length);
    console.log('[CSV_PARSE] Sample stands (first 5):', parsedStands.slice(0, 5));
    console.log('[CSV_PARSE] Unique sizes found:', [...new Set(parsedStands.map(s => s.size))]);

    // Show warning if sizes are all the same (likely using default)
    const uniqueSizes = [...new Set(parsedStands.map(s => s.size))];
    if (uniqueSizes.length === 1 && !sizeColumnFound) {
      setErrors(prev => ({ 
        ...prev, 
        csv: 'Warning: No size column detected in CSV. Using default size of ' + (formData.defaultStandSize || 500) + 'm² for all stands. Add a "size" column to import different sizes.' 
      }));
    }

    // Auto-populate stand size categories from CSV data
    const csvSizes = parsedStands.map(s => s.size).filter(s => s > 0);
    console.log('[CSV_PARSE] CSV sizes for categories:', csvSizes);
    const csvCategories = computeStandSizeCategories(csvSizes);
    
    console.log('[CSV_PARSE] Computed categories:', csvCategories);
    
    setFormData(prev => ({
      ...prev,
      parsedCsvStands: parsedStands,
      ...(csvCategories ? { standSizes: csvCategories } : {})
    }));
    setErrors(prev => ({ ...prev, csv: errors.length > 0 ? errors.join('; ') : undefined }));
  };

  const downloadCSVTemplate = () => {
    const templateContent = `stand_number,size,price
Stand-1,500,25000
Stand-2,600,30000
Stand-3,700,35000`;
    
    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stands-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedInitialData = useMemo(() => normalizeInitialData(initialData), [initialData]);

  const [formData, setFormData] = useState<DevelopmentFormData>(() => ({
    ...DEFAULT_FORM_DATA,
    branch: activeBranch,
    ...(normalizedInitialData || {})
  }));

  const [installmentInput, setInstallmentInput] = useState(
    (normalizedInitialData?.installmentPeriods || DEFAULT_FORM_DATA.installmentPeriods).join(', ')
  );

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDocumentUrl, setNewDocumentUrl] = useState('');
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      branch: prev.branch || activeBranch
    }));
  }, [activeBranch]);

  const standMetrics = useMemo(() => {
    // Calculate metrics based on stand creation method
    if (formData.geojsonData && Array.isArray(formData.geojsonData.features) && formData.geojsonData.features.length > 0) {
      // GeoJSON import
      const standAreas = formData.geojsonData.features
        .map(extractStandArea)
        .filter((value): value is number => typeof value === 'number' && value > 0);

      const totalArea = standAreas.reduce((sum, value) => sum + value, 0);
      const standCount = formData.geojsonData.features.length;
      const minArea = standAreas.length ? Math.min(...standAreas) : null;
      const maxArea = standAreas.length ? Math.max(...standAreas) : null;
      const avgArea = standAreas.length ? totalArea / standAreas.length : null;
      const totalValue = standAreas.length ? totalArea * formData.pricePerSqm : null;
      const avgValue = avgArea ? avgArea * formData.pricePerSqm : null;

      const previews = formData.geojsonData.features.slice(0, 3).map((feature, index) => {
        const standNumber = feature.properties?.stand_number || feature.properties?.standNumber || `Stand-${index + 1}`;
        const area = extractStandArea(feature);
        const price = area ? area * formData.pricePerSqm : null;
        return { standNumber, area, price };
      });

      return {
        standCount,
        totalArea,
        minArea,
        maxArea,
        avgArea,
        totalValue,
        avgValue,
        previews
      };
    } else if (formData.parsedCsvStands && formData.parsedCsvStands.length > 0) {
      // CSV import
      const standAreas = formData.parsedCsvStands
        .map(stand => stand.size)
        .filter((value): value is number => typeof value === 'number' && value > 0);

      const totalArea = standAreas.reduce((sum, value) => sum + value, 0);
      const standCount = formData.parsedCsvStands.length;
      const minArea = standAreas.length ? Math.min(...standAreas) : null;
      const maxArea = standAreas.length ? Math.max(...standAreas) : null;
      const avgArea = standAreas.length ? totalArea / standCount : null;
      const totalValue = standAreas.length ? totalArea * formData.pricePerSqm : null;
      const avgValue = avgArea ? avgArea * formData.pricePerSqm : null;

      const previews = formData.parsedCsvStands.slice(0, 3).map(stand => {
        const price = stand.price || (stand.size * formData.pricePerSqm);
        return { 
          standNumber: stand.standNumber, 
          area: stand.size, 
          price 
        };
      });

      return {
        standCount,
        totalArea,
        minArea,
        maxArea,
        avgArea,
        totalValue,
        avgValue,
        previews
      };
    } else if (formData.standCountToCreate > 0) {
      // Manual stand creation
      const standCount = formData.standCountToCreate;
      const standSize = formData.defaultStandSize;
      const totalArea = standCount * standSize;
      const minArea = standSize;
      const maxArea = standSize;
      const avgArea = standSize;
      const totalValue = totalArea * formData.pricePerSqm;
      const avgValue = standSize * formData.pricePerSqm;

      const previews = Array.from({ length: Math.min(3, standCount) }, (_, index) => {
        const standNumber = formData.standNumberPrefix + (formData.standNumberStart + index);
        return { 
          standNumber, 
          area: standSize, 
          price: standSize * formData.pricePerSqm 
        };
      });

      return {
        standCount,
        totalArea,
        minArea,
        maxArea,
        avgArea,
        totalValue,
        avgValue,
        previews
      };
    }

    // No stands created yet
    return null;
  }, [formData.geojsonData, formData.pricePerSqm, formData.parsedCsvStands, formData.standCountToCreate, formData.defaultStandSize, formData.standNumberPrefix, formData.standNumberStart]);

  useEffect(() => {
    if (standMetrics?.avgArea) {
      const nextPrice = Math.round(standMetrics.avgArea * formData.pricePerSqm);
      setFormData(prev => (prev.pricePerStand === nextPrice ? prev : { ...prev, pricePerStand: nextPrice }));
    }
  }, [standMetrics?.avgArea, formData.pricePerSqm]);

  useEffect(() => {
    if (standMetrics?.standCount) {
      setFormData(prev => (prev.totalStands === standMetrics.standCount ? prev : { ...prev, totalStands: standMetrics.standCount }));
    }
  }, [standMetrics?.standCount]);

  /** Compute stand size categories (small/medium/large) from an array of sizes */
  const computeStandSizeCategories = useCallback((sizes: number[]): { small: number; medium: number; large: number } | null => {
    const validSizes = sizes.filter(s => s > 0).sort((a, b) => a - b);
    if (validSizes.length === 0) return null;
    const small = validSizes[0];
    const large = validSizes[validSizes.length - 1];
    const medianIdx = Math.floor(validSizes.length / 2);
    const medium = validSizes.length % 2 === 0
      ? Math.round((validSizes[medianIdx - 1] + validSizes[medianIdx]) / 2)
      : validSizes[medianIdx];
    // Ensure small < medium < large; if all same size, spread them
    if (small === large) return { small, medium: small, large: small };
    return { small, medium: Math.max(medium, small + 1), large: Math.max(large, medium + 1) };
  }, []);

  const applyGeoJSON = useCallback((raw: string) => {
    const parsed = parseGeoJSONFromText(raw);
    if (parsed.error) {
      setErrors(prev => ({ ...prev, geojson: parsed.error || '' }));
      setFormData(prev => ({ ...prev, geojsonRaw: raw, geojsonData: null }));
      return;
    }

    setErrors(prev => {
      const next = { ...prev };
      delete next.geojson;
      return next;
    });

    // Auto-populate stand size categories from GeoJSON features
    const standSizesUpdate: Partial<DevelopmentFormData> = {};
    if (parsed.data?.features) {
      const sizes = parsed.data.features.map(extractStandArea).filter((s): s is number => s !== null && s > 0);
      const categories = computeStandSizeCategories(sizes);
      if (categories) {
        standSizesUpdate.standSizes = categories;
      }
    }

    setFormData(prev => ({
      ...prev,
      ...standSizesUpdate,
      geojsonRaw: raw,
      geojsonData: parsed.data || null,
      useManualStandCreation: false
    }));
  }, [computeStandSizeCategories]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = event => {
      const text = String(event.target?.result || '');
      applyGeoJSON(text);
    };
    reader.readAsText(file);
  }, [applyGeoJSON]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const updateBuildCompliance = useCallback(
    (patch: Partial<Pick<DevelopmentFormData,
      | 'compliancePartialApplied'
      | 'compliancePartialApproved'
      | 'complianceFullApplied'
      | 'complianceFullApproved'
    >>) => {
      setFormData(prev => {
        const next: DevelopmentFormData = { ...prev, ...patch };

        // Keep pairs consistent: "approved" implies "applied". Unchecking "applied" clears "approved".
        if (next.compliancePartialApproved) next.compliancePartialApplied = true;
        if (!next.compliancePartialApplied) next.compliancePartialApproved = false;

        if (next.complianceFullApproved) next.complianceFullApplied = true;
        if (!next.complianceFullApplied) next.complianceFullApproved = false;

        return next;
      });
    },
    []
  );

  const parseInstallmentPeriods = (value: string) => {
    const parsed = value
      .split(',')
      .map(item => parseInt(item.trim(), 10))
      .filter(item => !isNaN(item) && item > 0);

    setFormData(prev => ({
      ...prev,
      installmentPeriods: parsed.length ? parsed : prev.installmentPeriods
    }));
  };

  const addImageUrl = () => {
    const nextUrl = newImageUrl.trim();
    if (!nextUrl) return;
    setFormData(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), nextUrl] }));
    setNewImageUrl('');
  };

  const removeImageUrl = (index: number) => {
    setFormData(prev => ({ ...prev, imageUrls: (prev.imageUrls || []).filter((_, i) => i !== index) }));
  };

  const addDocumentUrl = () => {
    const nextUrl = newDocumentUrl.trim();
    if (!nextUrl) return;
    setFormData(prev => ({ ...prev, documentUrls: [...(prev.documentUrls || []), nextUrl] }));
    setNewDocumentUrl('');
  };

  const removeDocumentUrl = (index: number) => {
    setFormData(prev => ({ ...prev, documentUrls: (prev.documentUrls || []).filter((_, i) => i !== index) }));
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    // Preserve order and content as entered (no sorting/deduping).
    setFormData(prev => ({ ...prev, features: [...(prev.features || []), newFeature] }));
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({ ...prev, features: (prev.features || []).filter((_, i) => i !== index) }));
  };

  const validateStep = (step: number): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.useManualStandCreation && !formData.csvStandsData && !formData.geojsonData && !isEditing) {
        nextErrors.geojson = 'Please upload a GeoJSON file, import a CSV, or use manual stand creation.';
      }
      if (formData.useManualStandCreation) {
        if (!formData.standCountToCreate || formData.standCountToCreate <= 0) {
          nextErrors.standCount = 'Number of stands must be greater than 0.';
        }
        if (formData.standCountToCreate > 10000) {
          nextErrors.standCount = 'Number of stands cannot exceed 10,000.';
        }
        // Validate manual stand sizes if provided
        if (formData.manualStandSizes && formData.manualStandSizes.trim()) {
          const sizes = formData.manualStandSizes.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s) && s > 0);
          if (sizes.length === 0) {
            nextErrors.manualStandSizes = 'Invalid stand sizes. Please enter valid numbers separated by commas.';
          } else {
            const invalidSizes = sizes.filter(s => s < 100);
            if (invalidSizes.length > 0) {
              nextErrors.manualStandSizes = 'All stand sizes must be at least 100 sqm.';
            }
          }
        }
      }
      if (formData.csvStandsData && formData.csvStandsData !== '__csv_mode__') {
        if (!formData.parsedCsvStands || formData.parsedCsvStands.length === 0) {
          nextErrors.csv = 'CSV file must contain at least one valid stand.';
        }
      }
      if (formData.csvStandsData === '__csv_mode__') {
        nextErrors.csv = 'Please upload a CSV file with stand data.';
      }
    }

    if (step === 2) {
      if (!formData.name.trim()) nextErrors.name = 'Development name is required.';
      if (!formData.location.trim()) nextErrors.location = 'Location is required.';
      if (!formData.branch) nextErrors.branch = 'Branch is required.';
    }

    if (step === 3) {
      if (!formData.pricePerSqm || formData.pricePerSqm <= 0) {
        nextErrors.pricePerSqm = 'Price per sqm must be greater than 0.';
      }
      
      // Stand size categories are auto-populated from import data — no validation needed
    }

    return nextErrors;
  };

  const handleNext = () => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    const allErrors = {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3)
    };

    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      if (allErrors.geojson) setCurrentStep(1);
      else if (allErrors.name || allErrors.location || allErrors.branch) setCurrentStep(2);
      else setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-[32px] shadow-forensic-lg border border-brand-gold/20 font-sans">
      <div className="p-8 border-b border-brand-gold/10 bg-gradient-to-br from-brand-gold/5 to-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gold mb-2">
              Development Wizard
            </div>
            <h2 className="text-2xl font-black text-brand-black flex items-center gap-2 uppercase tracking-tight">
              <Building2 className="w-6 h-6 text-brand-gold" />
              {isEditing ? 'Edit Development' : 'Create New Development'}
            </h2>
            <p className="text-xs text-brand-grey mt-2 font-bold uppercase tracking-widest">
              Step {currentStep} of 3 · Development Setup
            </p>
          </div>
          <div className="text-[10px] text-brand-grey font-bold uppercase tracking-widest">
            {developmentId ? `ID: ${developmentId}` : ''}
          </div>
        </div>
        <div className="mt-5 h-2 rounded-full bg-brand-gold/10">
          <div
            className="h-2 rounded-full bg-brand-gold transition-all"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {currentStep === 1 && (
          <section className="space-y-6">
            <div className="flex items-start gap-3 bg-brand-light border border-brand-gold/10 p-5 rounded-2xl shadow-forensic-sm">
              <Map className="w-5 h-5 text-brand-gold" />
              <div>
                <p className="text-sm font-black text-brand-black uppercase tracking-widest">Stand Creation Method</p>
                <p className="text-xs text-brand-grey">
                  Choose how to create stands for this development.
                </p>
              </div>
            </div>

            {/* Stand Creation Method Toggle */}
            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, useManualStandCreation: false, csvStandsData: '', parsedCsvStands: [] }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  !formData.useManualStandCreation && !formData.csvStandsData
                    ? 'border-brand-gold bg-brand-gold/5'
                    : 'border-brand-gold/20 hover:border-brand-gold/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-5 h-5 text-brand-gold" />
                  <p className="text-sm font-black text-brand-black uppercase tracking-widest">GeoJSON Upload</p>
                </div>
                <p className="text-xs text-brand-grey">
                  Upload a GeoJSON file with stand boundaries and properties. Best for mapped developments.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, useManualStandCreation: true, csvStandsData: '', parsedCsvStands: [] }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  formData.useManualStandCreation && !formData.csvStandsData
                    ? 'border-brand-gold bg-brand-gold/5'
                    : 'border-brand-gold/20 hover:border-brand-gold/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-5 h-5 text-brand-gold" />
                  <p className="text-sm font-black text-brand-black uppercase tracking-widest">Manual Creation</p>
                </div>
                <p className="text-xs text-brand-grey">
                  Create stands with sequential numbering. Best for simple developments without maps.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, useManualStandCreation: false, csvStandsData: prev.csvStandsData || '__csv_mode__', geojsonData: null, geojsonRaw: '' }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  !formData.useManualStandCreation && formData.csvStandsData
                    ? 'border-brand-gold bg-brand-gold/5'
                    : 'border-brand-gold/20 hover:border-brand-gold/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-brand-gold" />
                  <p className="text-sm font-black text-brand-black uppercase tracking-widest">CSV Import</p>
                </div>
                <p className="text-xs text-brand-grey">
                  Import stand numbers and sizes from a CSV file. Best for existing data.
                </p>
              </button>
            </div>

            {/* GeoJSON Upload Section */}
            {!formData.useManualStandCreation && !formData.csvStandsData && (
              <>
                <div
                  className="border-2 border-dashed border-brand-gold/30 rounded-2xl p-6 text-center space-y-3"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <Upload className="w-8 h-8 text-brand-gold mx-auto" />
                  <p className="text-sm text-brand-grey">Drag and drop your GeoJSON file here</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest cursor-pointer shadow-forensic-sm">
                    Choose File
                    <input type="file" accept=".json,.geojson" className="hidden" onChange={handleFileInput} />
                  </label>
                  {errors.geojson && (
                    <p className="text-sm text-red-600 flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.geojson}
                    </p>
                  )}
                </div>

                {/* Map View Toggle */}
                <div className="mt-4 p-4 rounded-xl border border-brand-gold/10 bg-brand-light">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-gold/10">
                        <Map className="w-5 h-5 text-brand-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-black">Enable Map View</p>
                        <p className="text-xs text-brand-grey">Show interactive map with stand boundaries</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!formData.disableMapView}
                        onChange={(e) => setFormData(prev => ({ ...prev, disableMapView: !e.target.checked }))}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-gold/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
                    </label>
                  </div>
                  <p className="text-xs text-brand-grey mt-2">
                    Disable this to use table view only. Useful for developments without GeoJSON boundaries.
                  </p>
                </div>

                {formData.geojsonData && formData.geojsonData.features && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-xl border border-brand-gold/10">
                      <p className="text-xs text-brand-grey">Stands detected</p>
                      <p className="text-lg font-semibold text-brand-black">
                        {standMetrics?.standCount || formData.geojsonData.features?.length || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-brand-gold/10">
                      <p className="text-xs text-brand-grey">Total area</p>
                      <p className="text-lg font-semibold text-brand-black">
                        {standMetrics?.totalArea ? `${formatNumber(standMetrics.totalArea)} m2` : 'Not provided'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-brand-gold/10">
                      <p className="text-xs text-brand-grey">Preview</p>
                      <div className="text-xs text-brand-grey space-y-1">
                        {standMetrics?.previews?.length ? (
                          standMetrics.previews.map(preview => (
                            <div key={preview.standNumber} className="flex items-center justify-between">
                              <span>{preview.standNumber}</span>
                              <span>
                                {preview.area ? `${formatNumber(preview.area)} m2` : 'Area N/A'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span>No stand sizing info found</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-brand-grey mb-2">
                    Raw GeoJSON (optional view)
                  </label>
                  <textarea
                    value={formData.geojsonRaw}
                    onChange={event => setFormData(prev => ({ ...prev, geojsonRaw: event.target.value }))}
                    onBlur={event => event.target.value && applyGeoJSON(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-brand-gold/10 bg-white text-sm p-3"
                    placeholder="Paste GeoJSON here to validate"
                  />
                </div>
              </>
            )}

            {/* Manual Stand Creation Section */}
            {formData.useManualStandCreation && (
              <div className="p-4 rounded-xl border border-brand-gold/10 bg-white shadow-forensic-sm space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">Manual Stand Configuration</p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-brand-grey mb-2">
                      Number of Stands
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={formData.standCountToCreate}
                      onChange={event => setFormData(prev => ({ ...prev, standCountToCreate: Number(event.target.value) }))}
                      className={`w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 ${
                        errors.standCount ? 'border-red-500' : 'border-brand-gold/10'
                      }`}
                      placeholder="e.g., 50"
                    />
                    {errors.standCount && <p className="text-xs text-red-600 mt-1">{errors.standCount}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-grey mb-2">
                      Stand Number Prefix (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.standNumberPrefix}
                      onChange={event => setFormData(prev => ({ ...prev, standNumberPrefix: event.target.value }))}
                      className="w-full rounded-xl border border-brand-gold/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                      placeholder="e.g., BLK-A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-grey mb-2">
                      Starting Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.standNumberStart}
                      onChange={event => setFormData(prev => ({ ...prev, standNumberStart: Number(event.target.value) }))}
                      className="w-full rounded-xl border border-brand-gold/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                      placeholder="e.g., 1"
                    />
                  </div>

                </div>

                {/* Stand Sizes Input - CSV format */}
                <div>
                  <label className="block text-sm font-medium text-brand-grey mb-2">
                    Stand Sizes (m²) - Comma-separated
                  </label>
                  <input
                    type="text"
                    value={formData.manualStandSizes || ''}
                    onChange={event => setFormData(prev => ({ ...prev, manualStandSizes: event.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 ${
                      errors.manualStandSizes ? 'border-red-500' : 'border-brand-gold/10'
                    }`}
                    placeholder="e.g., 300, 350, 400, 450, 500 (or single value: 500)"
                  />
                  {errors.manualStandSizes && <p className="text-xs text-red-600 mt-1">{errors.manualStandSizes}</p>}
                  <p className="text-xs text-brand-grey mt-1">
                    Enter sizes separated by commas. Single value applies to all stands. Multiple values will be assigned sequentially.
                  </p>
                </div>

                {/* Stands Table Preview */}
                {formData.standCountToCreate > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-brand-grey">
                      Showing {Math.min(20, formData.standCountToCreate)} of {formData.standCountToCreate} stands:
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-brand-gold/10">
                      <table className="w-full text-sm">
                        <thead className="bg-brand-light">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">#</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Stand Number</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Size (m²)</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Price (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: Math.min(20, formData.standCountToCreate) }, (_, i) => {
                            const num = formData.standNumberStart + i;
                            const paddedNum = String(num).padStart(3, '0');
                            const standNumber = formData.standNumberPrefix ? `${formData.standNumberPrefix}${paddedNum}` : paddedNum;
                            
                            // Parse stand sizes
                            let standSize = formData.defaultStandSize || 500;
                            if (formData.manualStandSizes && formData.manualStandSizes.trim()) {
                              const sizes = formData.manualStandSizes.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s) && s > 0);
                              if (sizes.length > 0) {
                                standSize = sizes[i % sizes.length]; // Cycle through sizes if fewer than stands
                              }
                            }
                            
                            // Calculate price based on size and price per sqm
                            const price = formData.pricePerSqm > 0 
                              ? Math.round(standSize * formData.pricePerSqm) 
                              : formData.defaultStandPrice || 0;
                            
                            return (
                              <tr key={i} className="border-t border-brand-gold/10 hover:bg-brand-gold/5">
                                <td className="px-4 py-2 text-brand-grey">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-brand-black">{standNumber}</td>
                                <td className="px-4 py-2 text-brand-black">{formatNumber(standSize)}</td>
                                <td className="px-4 py-2 text-brand-black">{formatCurrency(price)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {formData.standCountToCreate > 20 && (
                      <p className="text-xs text-brand-grey text-center">
                        ... and {formData.standCountToCreate - 20} more stands
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CSV Import Section */}
            {!formData.useManualStandCreation && formData.csvStandsData && (
              <div className="p-4 rounded-xl border border-brand-gold/10 bg-white shadow-forensic-sm space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">CSV Import Configuration</p>
                
                <div
                  className="border-2 border-dashed border-brand-gold/30 rounded-2xl p-6 text-center space-y-3"
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file && file.name.endsWith('.csv')) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const text = String(e.target?.result || '');
                        setFormData(prev => ({ ...prev, csvStandsData: text }));
                        parseCSV(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                >
                  <Upload className="w-8 h-8 text-brand-gold mx-auto" />
                  <p className="text-sm text-brand-grey">Drag and drop your CSV file here</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest cursor-pointer shadow-forensic-sm">
                      Choose CSV File
                      <input 
                        type="file" 
                        accept=".csv" 
                        className="hidden" 
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const text = String(e.target?.result || '');
                              setFormData(prev => ({ ...prev, csvStandsData: text }));
                              parseCSV(text);
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={downloadCSVTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-brand-gold text-xs font-bold uppercase tracking-widest border border-brand-gold/30 hover:bg-brand-light transition-colors"
                    >
                      Download Template
                    </button>
                  </div>
                  {errors.csv && (
                    <p className="text-sm text-red-600 flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.csv}
                    </p>
                  )}
                </div>

                {/* CSV Preview Table */}
                {formData.parsedCsvStands && formData.parsedCsvStands.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-brand-grey">
                      Showing {Math.min(20, formData.parsedCsvStands.length)} of {formData.parsedCsvStands.length} stands:
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-brand-gold/10">
                      <table className="w-full text-sm">
                        <thead className="bg-brand-light">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">#</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Stand Number</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Size (m²)</th>
                            <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-brand-black">Price (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.parsedCsvStands.slice(0, 20).map((stand, i) => {
                            const price = stand.price || (formData.pricePerSqm > 0 ? Math.round(stand.size * formData.pricePerSqm) : 0);
                            return (
                              <tr key={i} className="border-t border-brand-gold/10 hover:bg-brand-gold/5">
                                <td className="px-4 py-2 text-brand-grey">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-brand-black">{stand.standNumber}</td>
                                <td className="px-4 py-2 text-brand-black">{formatNumber(stand.size)}</td>
                                <td className="px-4 py-2 text-brand-black">{formatCurrency(price)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {formData.parsedCsvStands.length > 20 && (
                      <p className="text-xs text-brand-grey text-center">
                        ... and {formData.parsedCsvStands.length - 20} more stands
                      </p>
                    )}
                  </div>
                )}

                {/* CSV Format Help */}
                <div className="p-3 rounded-xl bg-brand-light border border-brand-gold/10">
                  <p className="text-xs text-brand-grey mb-2 font-bold">CSV Format:</p>
                  <p className="text-xs text-brand-grey">
                    The CSV file should have columns: <code className="bg-white px-1 py-0.5 rounded border border-brand-gold/20">stand_number</code>, <code className="bg-white px-1 py-0.5 rounded border border-brand-gold/20">size</code>, <code className="bg-white px-1 py-0.5 rounded border border-brand-gold/20">price</code> (optional)
                  </p>
                  <p className="text-xs text-brand-grey mt-2">Example:</p>
                  <pre className="text-xs bg-white p-2 rounded border border-brand-gold/20 mt-1">
                    stand_number,size,price
                    BLK-A001,300,5000
                    BLK-A002,350,5500
                    BLK-A003,400,6000
                  </pre>
                </div>
              </div>
            )}
          </section>
        )}

        {currentStep === 2 && (
          <section className="space-y-6">
            <div className="flex items-start gap-3 bg-brand-light border border-brand-gold/10 p-5 rounded-2xl shadow-forensic-sm">
              <FileText className="w-5 h-5 text-brand-gold" />
              <div>
                <p className="text-sm font-black text-brand-black uppercase tracking-widest">Development Details</p>
                <p className="text-xs text-brand-grey">
                  Capture core info, additional features, and compliance status.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Development Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={event => setFormData(prev => ({ ...prev, name: event.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 ${
                    errors.name ? 'border-red-500' : 'border-brand-gold/10'
                  } focus:outline-none focus:ring-2 focus:ring-brand-gold/20`}
                  placeholder="Sunrise Gardens Estate"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Location
                </label>
                <select
                  value={formData.location}
                  onChange={event => setFormData(prev => ({ ...prev, location: event.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 ${
                    errors.location ? 'border-red-500' : 'border-brand-gold/10'
                  } focus:outline-none focus:ring-2 focus:ring-brand-gold/20`}
                >
                  <option value="">Select location</option>
                  {LOCATION_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Branch
                </label>
                <select
                  value={formData.branch}
                  onChange={event => setFormData(prev => ({ ...prev, branch: event.target.value as Branch }))}
                  className={`w-full rounded-xl border px-3 py-2 ${
                    errors.branch ? 'border-red-500' : 'border-brand-gold/10'
                  } focus:outline-none focus:ring-2 focus:ring-brand-gold/20`}
                >
                  <option value="Harare">Harare</option>
                  <option value="Bulawayo">Bulawayo</option>
                </select>
                {errors.branch && <p className="text-xs text-red-600 mt-1">{errors.branch}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Estate Status
                </label>
                <select
                  value={formData.estateProgress}
                  onChange={event => setFormData(prev => ({ ...prev, estateProgress: event.target.value as DevelopmentFormData['estateProgress'] }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                >
                  <option value="SERVICING">Under Construction / Servicing</option>
                  <option value="READY_TO_BUILD">Ready to Build</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Featured Tag
                </label>
                <select
                  value={formData.featuredTag}
                  onChange={event => setFormData(prev => ({ ...prev, featuredTag: event.target.value as 'none' | 'promo' | 'hot' }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                >
                  <option value="none">None</option>
                  <option value="promo">⚡ Promo (Show in first row)</option>
                  <option value="hot">🔥 Hot (Show in first row)</option>
                </select>
                <p className="text-xs text-brand-grey mt-1">Featured items appear first on landing page</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-grey mb-2">
                Overview
              </label>
              <textarea
                value={formData.overview}
                onChange={event => setFormData(prev => ({ ...prev, overview: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-brand-gold/10 p-3"
                placeholder="Describe the development vision"
              />
            </div>

            <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                <Zap className="w-4 h-4 text-brand-gold" />
                Features & Amenities
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFeature}
                  onChange={event => setNewFeature(event.target.value)}
                  placeholder="e.g., Gated community, Borehole, Tarred roads"
                  className="flex-1 rounded-xl border border-brand-gold/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest shadow-forensic hover:opacity-90 transition-all"
                >
                  Add
                </button>
              </div>

              {formData.features?.length ? (
                <div className="flex flex-wrap gap-2">
                  {formData.features.map((feature, idx) => (
                    <span
                      key={`${feature}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-gold/10 bg-white px-3 py-1 text-xs text-brand-black"
                    >
                      <span className="truncate max-w-[220px]" title={feature}>
                        {feature}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="text-[10px] font-black uppercase tracking-widest text-brand-grey hover:text-brand-black"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-grey">No features added yet.</p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                <ImageIcon className="w-4 h-4 text-brand-gold" />
                Media & Documents
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Images</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={event => setNewImageUrl(event.target.value)}
                      placeholder="https://.../image.jpg"
                      className="flex-1 rounded-xl border border-brand-gold/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest shadow-forensic hover:opacity-90 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  {formData.imageUrls?.length ? (
                    <div className="grid grid-cols-3 gap-2">
                      {formData.imageUrls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative rounded-xl overflow-hidden border border-brand-gold/10 bg-white">
                          <img
                            src={url}
                            alt={`Development image ${idx + 1}`}
                            className="h-20 w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => removeImageUrl(idx)}
                            className="absolute top-1 right-1 px-2 py-1 rounded-lg bg-white/90 border border-brand-gold/20 text-[10px] font-black uppercase tracking-widest text-brand-black hover:bg-white transition-all"
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-grey">No images added yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Documents</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={newDocumentUrl}
                      onChange={event => setNewDocumentUrl(event.target.value)}
                      placeholder="https://.../document.pdf"
                      className="flex-1 rounded-xl border border-brand-gold/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                    />
                    <button
                      type="button"
                      onClick={addDocumentUrl}
                      className="px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest shadow-forensic hover:opacity-90 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  {formData.documentUrls?.length ? (
                    <div className="space-y-2">
                      {formData.documentUrls.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-brand-gold/10 bg-white px-3 py-2"
                        >
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-brand-black hover:text-brand-gold transition-colors truncate"
                            title={url}
                          >
                            {url}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeDocumentUrl(idx)}
                            className="px-3 py-1 rounded-xl border border-brand-gold/20 text-brand-black text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold/5 transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-grey">No documents added yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                  <Settings className="w-4 h-4 text-brand-gold" />
                  Service Station
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-brand-grey">
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.hasServiceStation}
                    onChange={event => setFormData(prev => ({ ...prev, hasServiceStation: event.target.checked }))}
                  />
                  Service Station Available
                </label>
                {formData.hasServiceStation && (
                  <div className="space-y-3">
                    <select
                      value={formData.serviceStationType || ''}
                      onChange={event => setFormData(prev => ({ ...prev, serviceStationType: event.target.value as ServiceStationType }))}
                      className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                    >
                      <option value="">Select type</option>
                      {SERVICE_STATION_TYPES.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={formData.serviceStationHoursOpen || ''}
                        onChange={event => setFormData(prev => ({ ...prev, serviceStationHoursOpen: event.target.value }))}
                        className="rounded-xl border border-brand-gold/10 px-3 py-2"
                      />
                      <input
                        type="time"
                        value={formData.serviceStationHoursClose || ''}
                        onChange={event => setFormData(prev => ({ ...prev, serviceStationHoursClose: event.target.value }))}
                        className="rounded-xl border border-brand-gold/10 px-3 py-2"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-brand-grey">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                        checked={formData.serviceStationIs24Hour || false}
                        onChange={event => setFormData(prev => ({ ...prev, serviceStationIs24Hour: event.target.checked }))}
                      />
                      24-hour service
                    </label>
                    <textarea
                      value={formData.serviceStationNotes || ''}
                      onChange={event => setFormData(prev => ({ ...prev, serviceStationNotes: event.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-brand-gold/10 p-2 text-sm"
                      placeholder="Notes"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                  <Leaf className="w-4 h-4 text-brand-gold" />
                  Sanitation
                </div>
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 text-sm text-brand-grey">
                    <input
                      type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                      checked={formData.hasBioDigester}
                      onChange={event => setFormData(prev => ({ ...prev, hasBioDigester: event.target.checked }))}
                    />
                    Bio Digester
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-brand-grey">
                    <input
                      type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                      checked={formData.hasSepticTanks}
                      onChange={event => setFormData(prev => ({ ...prev, hasSepticTanks: event.target.checked }))}
                    />
                    Septic Tanks
                  </label>
                  <p className="text-xs text-brand-grey">
                    These selections will show in the overview summary on the next step.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                  <ShieldCheck className="w-4 h-4 text-brand-gold" />
                  Build Compliance
                </div>

                <div className="space-y-3 text-sm text-brand-grey">
                  <div className="grid gap-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                        checked={formData.compliancePartialApplied}
                        onChange={event => updateBuildCompliance({ compliancePartialApplied: event.target.checked })}
                      />
                      Partial Applied
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                        checked={formData.compliancePartialApproved}
                        onChange={event => updateBuildCompliance({ compliancePartialApproved: event.target.checked })}
                      />
                      Partial Approved
                    </label>
                  </div>

                  <div className="h-px bg-brand-gold/10" />

                  <div className="grid gap-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                        checked={formData.complianceFullApplied}
                        onChange={event => updateBuildCompliance({ complianceFullApplied: event.target.checked })}
                      />
                      Full Compliance Applied
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                        checked={formData.complianceFullApproved}
                        onChange={event => updateBuildCompliance({ complianceFullApproved: event.target.checked })}
                      />
                      Full Compliance Approved
                    </label>
                  </div>

                  <p className="text-xs text-brand-grey">
                    Tip: selecting an “Approved” option automatically selects its matching “Applied” option.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-black">
                  <Building2 className="w-4 h-4 text-brand-gold" />
                  Infrastructure Status
                </div>

                <div className="grid gap-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-brand-grey">
                    Roads
                    <select
                      value={formData.estateProgressDetails?.roads || 'not_started'}
                      onChange={event =>
                        setFormData(prev => ({
                          ...prev,
                          estateProgressDetails: {
                            ...prev.estateProgressDetails,
                            roads: event.target.value as DevelopmentFormData['estateProgressDetails']['roads']
                          }
                        }))
                      }
                      className="rounded-xl border border-brand-gold/10 px-3 py-2 text-sm bg-white"
                    >
                      {INFRA_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 text-sm text-brand-grey">
                    Water
                    <select
                      value={formData.estateProgressDetails?.water || 'not_started'}
                      onChange={event =>
                        setFormData(prev => ({
                          ...prev,
                          estateProgressDetails: {
                            ...prev.estateProgressDetails,
                            water: event.target.value as DevelopmentFormData['estateProgressDetails']['water']
                          }
                        }))
                      }
                      className="rounded-xl border border-brand-gold/10 px-3 py-2 text-sm bg-white"
                    >
                      {INFRA_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 text-sm text-brand-grey">
                    Sewer
                    <select
                      value={formData.estateProgressDetails?.sewer || 'not_started'}
                      onChange={event =>
                        setFormData(prev => ({
                          ...prev,
                          estateProgressDetails: {
                            ...prev.estateProgressDetails,
                            sewer: event.target.value as DevelopmentFormData['estateProgressDetails']['sewer']
                          }
                        }))
                      }
                      className="rounded-xl border border-brand-gold/10 px-3 py-2 text-sm bg-white"
                    >
                      {INFRA_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 text-sm text-brand-grey">
                    Electricity
                    <select
                      value={formData.estateProgressDetails?.electricity || 'not_started'}
                      onChange={event =>
                        setFormData(prev => ({
                          ...prev,
                          estateProgressDetails: {
                            ...prev.estateProgressDetails,
                            electricity: event.target.value as DevelopmentFormData['estateProgressDetails']['electricity']
                          }
                        }))
                      }
                      className="rounded-xl border border-brand-gold/10 px-3 py-2 text-sm bg-white"
                    >
                      {INFRA_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="space-y-6">
            <div className="flex items-start gap-3 bg-brand-light border border-brand-gold/10 p-5 rounded-2xl shadow-forensic-sm">
              <DollarSign className="w-5 h-5 text-brand-gold" />
              <div>
                <p className="text-sm font-black text-brand-black uppercase tracking-widest">Pricing and Commission</p>
                <p className="text-xs text-brand-grey">
                  Auto-calculated from GeoJSON sizes and price per sqm.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-brand-gold/10 bg-white shadow-forensic-sm space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-brand-black">Overview Summary</p>
              <div className="grid gap-4 md:grid-cols-2 text-sm text-brand-grey">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Build Compliance</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.compliancePartialApplied && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Partial Applied
                      </span>
                    )}
                    {formData.compliancePartialApproved && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Partial Approved
                      </span>
                    )}
                    {formData.complianceFullApplied && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Full Applied
                      </span>
                    )}
                    {formData.complianceFullApproved && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Full Approved
                      </span>
                    )}
                    {!formData.compliancePartialApplied &&
                      !formData.compliancePartialApproved &&
                      !formData.complianceFullApplied &&
                      !formData.complianceFullApproved && (
                        <span className="text-xs text-brand-grey">None selected</span>
                      )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Sanitation</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.hasBioDigester && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Bio Digester
                      </span>
                    )}
                    {formData.hasSepticTanks && (
                      <span className="px-2 py-1 rounded-full border border-brand-gold/20 bg-brand-light text-[11px] text-brand-black">
                        Septic Tanks
                      </span>
                    )}
                    {!formData.hasBioDigester && !formData.hasSepticTanks && (
                      <span className="text-xs text-brand-grey">None selected</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Service Station</p>
                  <p className="text-sm text-brand-black">
                    {formData.hasServiceStation ? 'Available' : 'Not available'}
                    {formData.hasServiceStation && formData.serviceStationType ? ` • ${formData.serviceStationType}` : ''}
                  </p>
                  {formData.hasServiceStation && (
                    <p className="text-xs text-brand-grey">
                      {formData.serviceStationIs24Hour
                        ? '24-hour'
                        : `${formData.serviceStationHoursOpen || '--:--'} to ${formData.serviceStationHoursClose || '--:--'}`}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-grey">Infrastructure</p>
                  <div className="grid gap-1 text-sm text-brand-black">
                    <span>Roads: {formData.estateProgressDetails?.roads || 'not_started'}</span>
                    <span>Water: {formData.estateProgressDetails?.water || 'not_started'}</span>
                    <span>Sewer: {formData.estateProgressDetails?.sewer || 'not_started'}</span>
                    <span>Electricity: {formData.estateProgressDetails?.electricity || 'not_started'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stand Size Categories — read-only, auto-populated from import data */}
            <div className="p-4 rounded-xl border border-brand-gold/10 bg-white shadow-forensic-sm space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-brand-black mb-1">Stand Size Categories</p>
                <p className="text-xs text-brand-grey">Auto-detected from imported stand data (min / median / max)</p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-3 rounded-xl bg-brand-gold/5 border border-brand-gold/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-grey mb-1">Smallest Stand</p>
                  <p className="text-lg font-semibold text-brand-black">{formData.standSizes.small} m²</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-gold/5 border border-brand-gold/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-grey mb-1">Median Stand</p>
                  <p className="text-lg font-semibold text-brand-black">{formData.standSizes.medium} m²</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-gold/5 border border-brand-gold/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-grey mb-1">Largest Stand</p>
                  <p className="text-lg font-semibold text-brand-black">{formData.standSizes.large} m²</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Price per sqm
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pricePerSqm}
                  onChange={event => setFormData(prev => ({ ...prev, pricePerSqm: Number(event.target.value) }))}
                  className={`w-full rounded-xl border px-3 py-2 ${
                    errors.pricePerSqm ? 'border-red-500' : 'border-brand-gold/10'
                  } focus:outline-none focus:ring-2 focus:ring-brand-gold/20`}
                />
                {errors.pricePerSqm && <p className="text-xs text-red-600 mt-1">{errors.pricePerSqm}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-grey mb-2">
                  Commission Type
                </label>
                <select
                  value={formData.commission.type}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      commission: { ...prev.commission, type: event.target.value as 'fixed' | 'percentage' }
                    }))
                  }
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              {formData.commission.type === 'fixed' ? (
                <div>
                  <label className="block text-sm font-medium text-brand-grey mb-2">
                    Commission Amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.commission.fixedAmount}
                    onChange={event =>
                      setFormData(prev => ({
                        ...prev,
                        commission: { ...prev.commission, fixedAmount: Number(event.target.value) }
                      }))
                    }
                    className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-brand-grey mb-2">
                    Commission Percentage
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.commission.percentage}
                    onChange={event =>
                      setFormData(prev => ({
                        ...prev,
                        commission: { ...prev.commission, percentage: Number(event.target.value) }
                      }))
                    }
                    className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-brand-gold/10 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-brand-black">Calculated Stand Values</p>
              <div className="grid gap-2 md:grid-cols-4 text-sm text-brand-grey">
                <div>
                  <p className="text-xs">Total stand value</p>
                  <p className="font-semibold text-brand-black">
                    {standMetrics?.totalValue ? formatCurrency(standMetrics.totalValue) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs">Average per stand</p>
                  <p className="font-semibold text-brand-black">
                    {standMetrics?.avgValue ? formatCurrency(standMetrics.avgValue) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs">Min size</p>
                  <p className="font-semibold text-brand-black">
                    {standMetrics?.minArea ? `${formatNumber(standMetrics.minArea)} m2` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs">Max size</p>
                  <p className="font-semibold text-brand-black">
                    {standMetrics?.maxArea ? `${formatNumber(standMetrics.maxArea)} m2` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">Quick Add-ons</p>
                <label className="flex items-center justify-between text-sm text-brand-grey">
                  VAT (15.5%)
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.vatEnabled}
                    onChange={event => setFormData(prev => ({ ...prev, vatEnabled: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-brand-grey">
                  Endowment Fee
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.endowmentEnabled}
                    onChange={event => setFormData(prev => ({ ...prev, endowmentEnabled: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-brand-grey">
                  Agreement of Sale (AOS)
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.aosEnabled}
                    onChange={event => setFormData(prev => ({ ...prev, aosEnabled: event.target.checked }))}
                  />
                </label>
                {formData.aosEnabled && (
                  <input
                    type="number"
                    min={0}
                    value={formData.aosFee}
                    onChange={event => setFormData(prev => ({ ...prev, aosFee: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                    placeholder="AOS fee"
                  />
                )}
                <label className="flex items-center justify-between text-sm text-brand-grey">
                  Cessions
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.cessionsEnabled}
                    onChange={event => setFormData(prev => ({ ...prev, cessionsEnabled: event.target.checked }))}
                  />
                </label>
                {formData.cessionsEnabled && (
                  <input
                    type="number"
                    min={0}
                    value={formData.cessionFee}
                    onChange={event => setFormData(prev => ({ ...prev, cessionFee: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                    placeholder="Cession fee"
                  />
                )}
                <label className="flex items-center justify-between text-sm text-brand-grey">
                  Admin Fee
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-brand-gold/40 accent-brand-gold"
                    checked={formData.adminFeeEnabled}
                    onChange={event => setFormData(prev => ({ ...prev, adminFeeEnabled: event.target.checked }))}
                  />
                </label>
                {formData.adminFeeEnabled && (
                  <input
                    type="number"
                    min={0}
                    value={formData.adminFee}
                    onChange={event => setFormData(prev => ({ ...prev, adminFee: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                    placeholder="Admin fee"
                  />
                )}
              </div>

              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">Payment Terms</p>
                <label className="block text-sm text-brand-grey">
                  Deposit Percentage
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.depositPercentage}
                    onChange={event => setFormData(prev => ({ ...prev, depositPercentage: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-brand-grey">
                  Installment Periods (months)
                  <input
                    type="text"
                    value={installmentInput}
                    onChange={event => setInstallmentInput(event.target.value)}
                    onBlur={event => parseInstallmentPeriods(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                    placeholder="12, 24, 48"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">Developer Contact</p>
                <input
                  type="text"
                  value={formData.developerName}
                  onChange={event => setFormData(prev => ({ ...prev, developerName: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={formData.developerEmail}
                  onChange={event => setFormData(prev => ({ ...prev, developerEmail: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Email"
                />
                <input
                  type="text"
                  value={formData.developerPhone}
                  onChange={event => setFormData(prev => ({ ...prev, developerPhone: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Phone"
                />
              </div>
              <div className="p-4 rounded-xl border border-brand-gold/10 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-brand-black">Lawyer Contact</p>
                <input
                  type="text"
                  value={formData.lawyerName}
                  onChange={event => setFormData(prev => ({ ...prev, lawyerName: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={formData.lawyerEmail}
                  onChange={event => setFormData(prev => ({ ...prev, lawyerEmail: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Email"
                />
                <input
                  type="text"
                  value={formData.lawyerPhone}
                  onChange={event => setFormData(prev => ({ ...prev, lawyerPhone: event.target.value }))}
                  className="w-full rounded-xl border border-brand-gold/10 px-3 py-2"
                  placeholder="Phone"
                />
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between p-6 border-t border-brand-gold/10 bg-brand-light/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-brand-gold/20 text-brand-black text-xs font-bold uppercase tracking-widest hover:bg-brand-gold/5 transition-all"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-xl border border-brand-gold/20 text-brand-black text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-brand-gold/5 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-forensic hover:opacity-90 transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-brand-gold text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-forensic hover:opacity-90 transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'Save Changes' : 'Create Development'}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevelopmentWizardV2;






