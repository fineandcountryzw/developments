export type ServiceStationType = 'full' | 'fuel_only' | 'shop_only' | 'custom';

export interface StandSizes {
  small: number;
  medium: number;
  large: number;
}

export type StandType = 'Residential' | 'Commercial' | 'Institutional';

export interface CommissionModel {
  type: 'fixed' | 'percentage';
  fixedAmount: number;
  percentage: number;
}

export type GeoJSONGeometryType =
  | 'Polygon'
  | 'MultiPolygon'
  | 'LineString'
  | 'MultiLineString'
  | 'Point'
  | 'MultiPoint';

export interface GeoJSONGeometry {
  type: GeoJSONGeometryType;
  coordinates: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties?: {
    stand_number?: string;
    [key: string]: any;
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type EstateProgress = 'SERVICING' | 'READY_TO_BUILD' | 'COMPLETED';

export type InfraProgressStatus = 'not_started' | 'planned' | 'in_progress' | 'completed';

export interface EstateProgressDetails {
  roads: InfraProgressStatus;
  water: InfraProgressStatus;
  sewer: InfraProgressStatus;
  electricity: InfraProgressStatus;
  compliance: 'pending' | 'submitted' | 'approved' | 'rejected';
}

export const DEFAULT_ESTATE_PROGRESS_DETAILS: EstateProgressDetails = {
  roads: 'not_started',
  water: 'not_started',
  sewer: 'not_started',
  electricity: 'not_started',
  compliance: 'pending'
};

export interface DevelopmentFormData {
  name: string;
  location: string;
  branch: 'Harare' | 'Bulawayo';
  developmentId: string;
  featuredTag: 'none' | 'promo' | 'hot';
  totalStands: number;
  pricePerStand: number;
  pricePerSqm: number;
  estateProgress: EstateProgress;
  estateProgressDetails: EstateProgressDetails;

  // Service Station
  hasServiceStation: boolean;
  serviceStationType?: ServiceStationType;
  serviceStationHoursOpen?: string;
  serviceStationHoursClose?: string;
  serviceStationIs24Hour?: boolean;
  serviceStationNotes?: string;

  // Sustainability / Sanitation
  hasBioDigester: boolean;
  hasSepticTanks: boolean;

  // Build Compliance (checkbox-driven)
  compliancePartialApplied: boolean;
  compliancePartialApproved: boolean;
  complianceFullApplied: boolean;
  complianceFullApproved: boolean;
  standSizes: StandSizes;
  standTypes: StandType[];
  features: string[];
  imageUrls: string[];
  documentUrls: string[];
  commission: CommissionModel;
  geojsonData: GeoJSONData | null;
  geojsonRaw: string;
  useManualStandCreation: boolean;
  standNumberingFormat: 'sequential' | 'custom';
  standNumberPrefix: string;
  standNumberStart: number;
  standCountToCreate: number;
  defaultStandSize: number;
  defaultStandPrice: number;
  manualStandSizes: string; // CSV string of stand sizes for manual creation
  csvStandsData: string; // Raw CSV data for import
  parsedCsvStands: Array<{ standNumber: string; size: number; price?: number }>; // Parsed CSV stands
  disableMapView: boolean; // Toggle to disable map view and use table view only
  overview: string;
  developerName: string;
  developerEmail: string;
  developerPhone: string;
  lawyerName: string;
  lawyerEmail: string;
  lawyerPhone: string;
  vatEnabled: boolean;
  endowmentEnabled: boolean;
  aosEnabled: boolean;
  aosFee: number;
  cessionsEnabled: boolean;
  cessionFee: number;
  adminFeeEnabled: boolean;
  adminFee: number;
  installmentPeriods: number[];
  depositPercentage: number;
}

