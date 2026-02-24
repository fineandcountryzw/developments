
export type Role = 'Admin' | 'Manager' | 'Agent' | 'Account' | 'Client' | 'Developer';
export type Branch = 'Harare' | 'Bulawayo';

export interface Agent {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanySettings {
  branch: Branch;
  address: string;
  phone: string;
  email: string;
  receipt_prefix: string;
  logo_url: string;
  legal_name: string;
  registration_number: string;
  vat_number: string;
  paynow_integration_key?: string;
  principalAgentName?: string;
  principalAgentEmail?: string;
}

// --- Email Module Types ---
export type EmailProviderType = 'SENDGRID' | 'SMTP';

export interface EmailConfig {
  id: string;
  providerType: EmailProviderType;
  apiKey?: string; // For SendGrid
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  senderName: string;
  senderEmail: string;
  isActive: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: 'Transactional' | 'Marketing' | 'Statutory';
  lastUpdated: string;
  version: number;
}

export interface CommunicationLog {
  id: string;
  recipientEmail: string;
  subject: string;
  templateId: string;
  provider: EmailProviderType;
  status: 'DELIVERED' | 'FAILED' | 'QUEUED';
  sentAt: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type NotificationRecipient = 'Agent' | 'Client';

export interface Notification {
  id: string;
  recipientType: NotificationRecipient;
  recipientId: string; // agent name or client id
  message: string;
  branch: Branch;
  timestamp: string;
  metadata?: {
    developmentName?: string;
    standNumber?: string;
    newStage?: DetailedPipelineStage;
    standId?: string;
  };
}

export interface SystemHealth {
  apiConnected: boolean;
  latencyMs: number;
  userAuthenticated: boolean;
  dbResponsive: boolean;
  storageAccessible: boolean;
  timestamp: string;
}

/**
 * Admin Diagnostics View
 * Aggregated metrics from the database admin_diagnostics view
 */
export interface AdminDiagnostics {
  totalProjects: number;
  totalInventory: number;
  totalRevenueUsd: number;
  totalLegalFiles: number;
  timestamp: string;
}

export type AuditActionType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditLog {
  id: string;
  changedAt: string;
  changedBy: string;
  changedByEmail: string;
  ipAddress: string;
  branchContext: Branch;
  tableName: string;
  recordId: string;
  actionType: AuditActionType;
  actionSummary: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
}

export type ProfileStatus = 'Active' | 'Pending' | 'Revoked';

export interface Profile {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  assignedBranch: Branch;
  avatarUrl?: string;
  status: ProfileStatus;
  lastLogin?: string;
  employmentDocs?: KYCStatus[];
  totalSalesCount?: number;
  totalRealizedCommission?: number;
}

export type ReconStatus = 'PENDING' | 'PAID' | 'DISBURSED';

export interface ReconRecord {
  id: string;
  paymentId?: string;
  clientName: string;
  assetRef: string;
  totalPaidUsd: number;
  standPricePortion?: number;
  totalFees?: number;
  vatAmount?: number;
  cessionAmount?: number;
  endowmentAmount?: number;
  aosAmount?: number;
  commissionRate?: number;
  commissionUsd: number;
  adminFeeUsd?: number;
  developerNetUsd: number;
  agentId?: string;
  agentName?: string;
  status: ReconStatus;
  verifiedAt: string;
  disbursedAt?: string;
  branch?: Branch;
  developmentId?: string;
  developmentName?: string;
  bankReference?: string;
}

export type DevelopmentPhase = 'SERVICING' | 'READY_TO_BUILD';

export type VATStatus = 'Exempt' | 'Inclusive' | 'Exclusive';

export type MarketingBadgeType = 'Coming Soon' | 'On Promotion' | 'Sold Out' | 'None';

export interface InfrastructureFeatures {
  water: string[];
  sewer: string[];
  power: string[];
  roads: string[];
  security: string[];
  connectivity: string[];
}

export interface DevelopmentDocument {
  id: string;
  name: string;
  url: string;
  version: number;
  uploadedAt: string;
  category?: 'Approval' | 'Clearance' | 'Title' | 'Certificate';
}

export interface Development {
  id: string;
  name: string;
  locationName: string;
  description: string;
  overview?: string;  // Development overview/vision text from new wizard
  vision?: string;
  statistics?: string[];
  investmentHighlights?: string[];
  basePrice: number;
  vatPercentage: number;
  vatStatus: VATStatus;
  endowmentFee: number;
  paymentTermsDescription: string;
  phase: DevelopmentPhase;
  depositRequired: number;
  maxInstallments: number;
  minDepositPercentage: number;
  defaultInstallmentPeriod: number;
  interestRate: number;
  allowBankTransferSurcharge: boolean;
  latitude?: number | null;
  longitude?: number | null;
  imageUrls: string[];
  logoUrl?: string;
  documentUrls: DevelopmentDocument[];
  siteMapUrl?: string;
  subdivisionPermitUrl?: string;
  moaTemplateUrl?: string;
  refundPolicyUrl?: string;
  paymentTermsUrl?: string;
  status: 'Active' | 'Draft' | 'Archived';
  createdAt: string;
  branch: Branch;
  infrastructureJson: InfrastructureFeatures;
  infrastructureProgress?: {
    roads: number;
    water: number;
    power: number;
  };
  amenities?: {
    water: boolean;
    sewer: boolean;
    power: boolean;
    roads: boolean;
  };
  completionStatus: number;
  geometry?: any;
  developerEmail?: string;
  listingAgentId?: string;
  // Developer contact info (internal use - for reports)
  developerName?: string;
  developerPhone?: string;
  // Premium Listing Features
  pricePerSqm?: number;
  totalAreaSqm?: number;
  totalStands?: number;
  availableStands?: number;
  marketingBadgeType?: MarketingBadgeType;
  promoStandsCount?: number;
  // New Wizard Fields
  features?: string[];  // Estate features/amenities array
  standSizes?: { small: number; medium: number; large: number };
  standTypes?: ('Residential' | 'Commercial' | 'Institutional')[];
  commissionModel?: { type: 'fixed' | 'percentage'; fixedAmount: number; percentage: number };
  geoJsonData?: any;  // Raw GeoJSON data for map
  // Estate Progress - Infrastructure milestones
  estateProgress?: {
    roads: 'not_started' | 'planned' | 'in_progress' | 'completed';
    water: 'not_started' | 'planned' | 'in_progress' | 'completed';
    sewer: 'not_started' | 'planned' | 'in_progress' | 'completed';
    electricity: 'not_started' | 'planned' | 'in_progress' | 'completed';
    compliance: 'pending' | 'submitted' | 'approved' | 'rejected';
  };
  // Fee Configuration (toggles)
  vatEnabled?: boolean;      // Apply 15.5% VAT
  endowmentEnabled?: boolean; // Apply endowment fee
  aosEnabled?: boolean;       // Apply Agreement of Sale fee
  aosFee?: number;            // AOS fixed fee amount
  cessionsEnabled?: boolean;  // Apply cession fees
  cessionFee?: number;        // Cession fixed fee amount
  // Payment Terms (from wizard)
  installmentPeriods?: number[];  // Allowed installment periods in months (e.g., [12, 24, 48])
  depositPercentage?: number;     // Required deposit percentage (e.g., 10 for 10%)

  // NEW: Service Station Configuration
  hasServiceStation?: boolean;
  serviceStationType?: 'full' | 'fuel_only' | 'shop_only' | 'custom';
  fuelBrands?: ('Petrotrade' | 'Engen' | 'Total' | 'Shell' | 'Zuva')[];
  serviceStationHoursOpen?: string;
  serviceStationHoursClose?: string;
  serviceStationIs24Hour?: boolean;
  serviceStationNotes?: string;

  // NEW: Bio Digester Configuration
  hasBioDigester?: boolean;
  bioDigesterType?: 'household' | 'community' | 'industrial' | 'custom';
  bioDigesterCapacityLiters?: number;
  bioDigesterInstallDate?: string;
  bioDigesterIsCertified?: boolean;
  bioDigesterIsMunicipalApproved?: boolean;
  bioDigesterIsEpaRegistered?: boolean;
  bioDigesterHasMaintenanceContract?: boolean;
  bioDigesterMaintenanceExpiry?: string;

  // NEW: Build Compliance Tracking
  buildComplianceStatus?: 'pending_review' | 'partial_applied' | 'full_applied' | 'approved';
  compliancePlansSubmittedDate?: string;
  complianceEnvironmentalDate?: string;
  complianceWaterSewerageDate?: string;
  complianceElectricalDate?: string;
  complianceFireSafetyDate?: string;
  complianceStructuralDate?: string;
  complianceApprovalRefNumber?: string;
  complianceFinalApprovalDate?: string;

  // Visibility & Ordering
  isPublic?: boolean;
  featuredRank?: number | null;
  displayRank?: number | null;
}

export interface DealNote {
  id: string;
  saleId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  emailSent: boolean;
}

export interface PipelineNote {
  id: string;
  standId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  branchContext: Branch;
  category: 'MoA' | 'Addendum' | 'Cession';
}

export type ContractStatus = 'DRAFTING' | 'SENT FOR SIGNATURE' | 'EXECUTED' | 'STAMPED';

export interface GeneratedContract {
  id: string;
  clientId: string;
  standId: string;
  templateId: string;
  status: ContractStatus;
  pdfUrl?: string;
  createdAt: string;
  annexures?: string[];
  category: 'MoA' | 'Addendum' | 'Cession';
}

export interface KYCStatus {
  id: string;
  documentType: 'ID' | 'Residence' | 'AML' | 'Contract';
  status: 'Pending' | 'Verified' | 'Rejected';
  uploadedAt: string;
  url?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationalId?: string;
  isPortalUser?: boolean;
  kyc: KYCStatus[];
  ownedStands: string[];
  branch: Branch;
}

export interface Invoice {
  id: string;
  saleId: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: 'Unpaid' | 'Partial' | 'Paid';
}

export type PaynowStatus = 'Pending' | 'Paid' | 'Cancelled';

export type PaymentMethod = 'Cash' | 'Bank';

export type PaymentType = 'Deposit' | 'Installment' | 'Agreement of Sale Fee' | 'Endowment Fees' | 'VAT Fees';

export interface Payment {
  id: string;
  clientId: string;
  clientName?: string;
  standId?: string; // Foreign key to Stand model
  standNumber?: string; // Display field (deprecated - use stand.standNumber)
  stand?: {
    id: string;
    standNumber: string;
    status: StandStatus;
    price: number;
    development?: {
      id: string;
      name: string;
      location: string;
    };
  };
  invoiceId?: string;
  amount?: number; // Alias for amountUsd for compatibility
  amountUsd: number;
  surchargeAmount: number; // 5% for Bank payments
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  officeLocation: Branch;
  reference: string;
  manualReceiptNo: string; // Required field
  description: string;
  createdAt: string;
  verificationStatus?: 'Pending' | 'Verified' | 'Flagged';
  paynowStatus?: PaynowStatus;
  paynowReference?: string;
  receivedByName?: string; // Free text field for cash receiver name
}

export type StandStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
export type DetailedPipelineStage = 'RESERVATION' | 'OFFER LETTER' | 'AGREEMENT OF SALE' | 'PAYMENT TRACKING' | 'TRANSFER';

export interface Stand {
  id: string;
  number: string;
  developmentId: string;
  developmentName: string;
  price?: number; // Alias for priceUsd
  priceUsd: number;
  areaSqm: number;
  status: StandStatus;
  pipelineStage?: DetailedPipelineStage;
  coordinates: [number, number][];
  reservationExpiresAt?: string;
  reservedBy?: string;
  branch: Branch;
  agentName?: string;
}

export type AttributionSource = 'Company' | 'Agent';

export interface Sale {
  id: string;
  standId: string;
  clientId: string;
  agentId?: string;
  attributionSource: AttributionSource;
  totalPrice: number;
  deposit: number;
  interest: number;
  stage: 'Offer' | 'Deposit' | 'Installment' | 'Legal' | 'Paid';
  notes: string;
  createdAt: string;
  branch: Branch;
}
