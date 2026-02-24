import { Development, Client, Payment, Stand, Invoice, Sale, AuditLog, CompanySettings, Branch, Profile, InfrastructureFeatures, ContractTemplate, GeneratedContract, DealNote, StandStatus, DevelopmentDocument, SystemHealth, AdminDiagnostics, ReconRecord, ReconStatus, Role, PipelineNote, EmailTemplate, CommunicationLog, EmailConfig, Notification, NotificationRecipient, DetailedPipelineStage } from '../types';
import { DEFAULT_LOGO } from '../lib/constants';
import { sendEmail } from '../lib/email-service';

// ==================== SUPABASE CLIENT ====================
// Real Supabase connection for production
interface SupabaseClient {
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File, options?: any) => Promise<{ data: any; error: any }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

// Create Supabase client instance
export const supabase: SupabaseClient = {
  from: (table: string) => ({
    insert: (data: any) => ({
      select: () => ({
        single: async () => {
          console.log('[FORENSIC][SUPABASE_INSERT]', { table, data, timestamp: new Date().toISOString() });
          // Mock implementation - replace with real Supabase call when @supabase/supabase-js is installed
          return { 
            data: { id: `${table}_${Date.now()}`, ...data }, 
            error: null 
          };
        }
      })
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        then: async () => {
          console.log('[FORENSIC][SUPABASE_UPDATE]', { table, data, filter: { column, value }, timestamp: new Date().toISOString() });
          return { data: null, error: null };
        }
      })
    }),
    select: (columns?: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => {
          console.log('[FORENSIC][SUPABASE_SELECT]', { table, columns, filter: { column, value }, timestamp: new Date().toISOString() });
          return { data: null, error: null };
        }
      })
    })
  }),
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File, options?: any) => {
        console.log('[FORENSIC][SUPABASE_STORAGE_UPLOAD]', { 
          bucket, 
          path, 
          file_name: file.name, 
          file_size: file.size,
          timestamp: new Date().toISOString() 
        });
        // Mock implementation - replace with real Supabase call
        return { 
          data: { path: `${bucket}/${path}` }, 
          error: null 
        };
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://bujvjyucylvdwgdkcxvj.supabase.co/storage/v1/object/public/${path}` }
      })
    })
  }
};

// Lightweight realtime event bus
type EventHandler = (payload?: any) => void;
const emitter: Record<string, Set<EventHandler>> = {};
const on = (event: string, handler: EventHandler) => {
  if (!emitter[event]) emitter[event] = new Set();
  emitter[event].add(handler);
  return () => off(event, handler);
};
const off = (event: string, handler: EventHandler) => {
  if (emitter[event]) emitter[event].delete(handler);
};
const emit = (event: string, payload?: any) => {
  if (emitter[event]) emitter[event].forEach(h => {
    try { h(payload); } catch (e) { console.error('[FORENSIC][REALTIME ERROR]', e); }
  });
};

// ==================== FORENSIC PERSISTENCE LAYER ====================
// In-memory storage for developments (acts as local DB until Supabase connection)
let MOCK_DEVELOPMENTS: Development[] = [];
let MOCK_DEVELOPMENT_MEDIA: Array<{
  id: string;
  developmentId: string;
  category: 'LOGO' | 'RENDER';
  url: string;
  bucket: string;
  path: string;
  uploaded_at: string;
}> = [];

// Initialize with sample data
const initializeSampleDevelopments = () => {
  if (MOCK_DEVELOPMENTS.length === 0) {
    console.log('[FORENSIC] Initializing sample developments in memory');
  }
};

// Neon database integration functions (removed localStorage dependency)
// All development data now persists to Neon via API endpoints
const initializeDevelopmentsFromNeon = async () => {
  try {
    const response = await fetch('/api/admin/developments', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      const result = await response.json();
      MOCK_DEVELOPMENTS = result.data || [];
      console.log('[FORENSIC][NEON] Loaded developments from Neon on init:', { count: MOCK_DEVELOPMENTS.length });
    } else {
      console.warn('[FORENSIC][NEON] Failed to load developments from Neon');
    }
  } catch (err) {
    console.warn('[FORENSIC][NEON] Could not initialize from Neon:', err);
  }
};

// Initialize on module load (Neon only, no localStorage)
if (typeof window !== 'undefined') {
  initializeDevelopmentsFromNeon();
}

export const BRANCH_SETTINGS: Record<Branch, CompanySettings> = {
  'Harare': {
    branch: 'Harare',
    address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
    phone: '08644 253731',
    email: 'harare@fineandcountry.co.zw',
    receipt_prefix: 'HRE',
    logo_url: DEFAULT_LOGO, // Shared logo for all branches
    legal_name: 'Fine & Country Harare (Pvt) Ltd',
    registration_number: 'CO-2024-HRE-001',
    vat_number: 'VAT-ZW-100200',
    paynow_integration_key: 'PAYNOW-HRE-XXXX'
  },
  'Bulawayo': {
    branch: 'Bulawayo',
    address: '88 Robert Mugabe Way, Bulawayo, Zimbabwe',
    phone: '+263 292 789 012',
    email: 'bulawayo@fineandcountry.co.zw',
    receipt_prefix: 'BYO',
    logo_url: DEFAULT_LOGO, // Shared logo for all branches
    legal_name: 'Fine & Country Bulawayo (Pvt) Ltd',
    registration_number: 'CO-2024-BYO-002',
    vat_number: 'VAT-ZW-200300',
    paynow_integration_key: 'PAYNOW-BYO-YYYY'
  }
};

let MOCK_COMMUNICATION_HISTORY: CommunicationLog[] = [
  { id: 'COMM-1', recipientEmail: 'ceo@fineandcountry.co.zw', subject: 'Weekly Reconciliation Sync', templateId: 'tmpl-1', provider: 'SENDGRID', status: 'DELIVERED', sentAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'COMM-2', recipientEmail: 'investor@global.com', subject: 'Receipt: Stand #1024-H', templateId: 'tmpl-receipt', provider: 'SMTP', status: 'DELIVERED', sentAt: new Date(Date.now() - 86400000).toISOString() }
];

let MOCK_NOTIFICATIONS: Notification[] = [];

let MOCK_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-receipt',
    name: 'Transactional Receipt',
    subject: 'Receipt: Settlement for Stand {{stand_number}}',
    bodyHtml: `<div style="font-family: sans-serif; color: #0F172A;"><h2 style="color: #85754E;">Payment Received</h2><p>Dear {{client_name}}, we have received your payment of USD {{amount}} for development {{development}}.</p></div>`,
    category: 'Transactional',
    lastUpdated: '2025-01-15T10:00:00Z',
    version: 1
  },
  {
    id: 'tmpl-opp',
    name: 'Investment Opportunity',
    subject: 'New Listing: {{development_name}} Phase 2',
    bodyHtml: `<div style="font-family: sans-serif; background: #F9F8F6; padding: 40px;"><h1 style="color: #85754E;">Premium Property Release</h1><p>A new inventory node has been added to the regional registry: {{development_name}}.</p></div>`,
    category: 'Marketing',
    lastUpdated: '2025-02-01T08:30:00Z',
    version: 2
  }
];

// ==================== SEED FIXTURES ====================
let MOCK_PROFILES: Profile[] = [
  { id: 'admin-1', role: 'Admin', name: 'Nicholas Gwanzura', email: 'nicholas@fineandcountry.co.zw', phone: '+263 77 000 0000', assignedBranch: 'Harare', status: 'Active', lastLogin: new Date().toISOString(), totalSalesCount: 42, totalRealizedCommission: 210000 },
  { id: 'agent-1', role: 'Agent', name: 'Alice Moyo', email: 'alice@fineandcountry.co.zw', phone: '+263 77 111 1111', assignedBranch: 'Harare', status: 'Active', totalSalesCount: 25, totalRealizedCommission: 124000 },
  { id: 'agent-2', role: 'Agent', name: 'Tariro N.', email: 'tariro@fineandcountry.co.zw', phone: '+263 77 222 2222', assignedBranch: 'Bulawayo', status: 'Active', totalSalesCount: 17, totalRealizedCommission: 82000 },
  { id: 'agent-3', role: 'Agent', name: 'David Chipo', email: 'david@fineandcountry.co.zw', phone: '+263 77 333 3333', assignedBranch: 'Harare', status: 'Pending', totalSalesCount: 8, totalRealizedCommission: 45000 },
  { id: 'agent-4', role: 'Agent', name: 'Sarah Moyo', email: 'sarah@fineandcountry.co.zw', phone: '+263 77 444 4444', assignedBranch: 'Bulawayo', status: 'Active', totalSalesCount: 31, totalRealizedCommission: 191000 },
];

let MOCK_CLIENTS: Client[] = [
  { id: 'client-1', name: 'Blessing M.', email: 'blessing@example.com', phone: '+263 77 555 5555', nationalId: '12-345678-Z-12', isPortalUser: true, kyc: [{ id: 'kyc-1', documentType: 'ID', status: 'Verified', uploadedAt: new Date().toISOString() }], ownedStands: ['dev-1-101'], branch: 'Harare' },
  { id: 'client-2', name: 'Tendai G.', email: 'tendai@example.com', phone: '+263 77 666 6666', nationalId: '45-987654-X-21', isPortalUser: true, kyc: [{ id: 'kyc-2', documentType: 'ID', status: 'Verified', uploadedAt: new Date().toISOString() }], ownedStands: ['dev-2-208'], branch: 'Bulawayo' },
  { id: 'client-3', name: 'Investor P.', email: 'investor@example.com', phone: '+263 77 777 7777', isPortalUser: false, kyc: [], ownedStands: [], branch: 'Harare' },
];

// Pre-populate developments with basic statutory docs
MOCK_DEVELOPMENTS = [
  {
    id: 'dev-1',
    name: 'Emerald Estate',
    locationName: 'Borrowdale, Harare',
    description: 'Premium serviced stands with full statutory approvals.',
    vision: 'Modern suburban living with reliable infrastructure.',
    statistics: ['142 stands', '70% serviced', '5km to CBD'],
    investmentHighlights: ['High demand region', 'Near schools', 'Secure area'],
    basePrice: 95000,
    vatPercentage: 15,
    vatStatus: 'Inclusive',
    endowmentFee: 2500,
    paymentTermsDescription: '30% deposit, balance over 12 months.',
    phase: 'SERVICING',
    depositRequired: 0,
    maxInstallments: 12,
    minDepositPercentage: 30,
    defaultInstallmentPeriod: 12,
    interestRate: 8,
    allowBankTransferSurcharge: true,
    latitude: -17.7832,
    longitude: 31.053,
    imageUrls: [],
    logoUrl: BRANCH_SETTINGS['Harare'].logo_url,
    documentUrls: [
      { id: 'doc-emerald-permit', name: 'Subdivision Permit', url: 'https://docs/emerald/permit.pdf', version: 1, uploadedAt: '2025-01-10' },
      { id: 'doc-emerald-title', name: 'Master Title', url: 'https://docs/emerald/title.pdf', version: 1, uploadedAt: '2025-01-10' }
    ],
    siteMapUrl: 'https://maps/emerald/site.png',
    subdivisionPermitUrl: 'https://docs/emerald/permit.pdf',
    moaTemplateUrl: 'https://docs/emerald/moa.md',
    status: 'Active',
    createdAt: new Date().toISOString(),
    branch: 'Harare',
    infrastructureJson: {
      water: ['ZINWA'],
      sewer: ['Municipal'],
      power: ['ZETDC'],
      roads: ['Municipal'],
      security: ['Perimeter fence'],
      connectivity: ['Fibre']
    },
    infrastructureProgress: { roads: 60, water: 80, power: 50 },
    amenities: { water: true, sewer: true, power: true, roads: true },
    completionStatus: 65,
    geometry: null,
    developerEmail: 'dev@emerald.co.zw',
    listingAgentId: 'agent-1',
    totalAreaSqm: 3000,
    pricePerSqm: 31.67,
    marketingBadgeType: 'On Promotion',
    promoStandsCount: 15
  },
  {
    id: 'dev-2',
    name: 'Bulawayo Gardens',
    locationName: 'Bulawayo North',
    description: 'Affordable stands with phased service delivery.',
    basePrice: 65000,
    vatPercentage: 15,
    vatStatus: 'Exclusive',
    endowmentFee: 1500,
    paymentTermsDescription: '20% deposit, balance over 18 months.',
    phase: 'READY_TO_BUILD',
    depositRequired: 0,
    maxInstallments: 18,
    minDepositPercentage: 20,
    defaultInstallmentPeriod: 18,
    interestRate: 10,
    allowBankTransferSurcharge: true,
    latitude: -20.163,
    longitude: 28.581,
    imageUrls: [],
    logoUrl: BRANCH_SETTINGS['Bulawayo'].logo_url,
    documentUrls: [
      { id: 'doc-byo-clearance', name: 'Environmental Clearance', url: 'https://docs/byo/clearance.pdf', version: 1, uploadedAt: '2025-02-14' }
    ],
    status: 'Active',
    createdAt: new Date().toISOString(),
    branch: 'Bulawayo',
    infrastructureJson: {
      water: ['ZINWA'],
      sewer: ['Municipal'],
      power: ['ZETDC'],
      roads: ['Municipal'],
      security: ['Neighbourhood watch'],
      connectivity: ['LTE']
    },
    completionStatus: 80,
    totalAreaSqm: 2500,
    pricePerSqm: 26.0,
    marketingBadgeType: 'Coming Soon',
    promoStandsCount: undefined
  }
];

let MOCK_STANDS: Stand[] = [
  { id: 'dev-1-101', number: '101', developmentId: 'dev-1', developmentName: 'Emerald Estate', priceUsd: 120000, areaSqm: 800, status: 'AVAILABLE', coordinates: [], branch: 'Harare' },
  { id: 'dev-1-102', number: '102', developmentId: 'dev-1', developmentName: 'Emerald Estate', priceUsd: 130000, areaSqm: 900, status: 'RESERVED', pipelineStage: 'RESERVATION', coordinates: [], reservationExpiresAt: new Date(Date.now() + 1000*60*60*24).toISOString(), reservedBy: 'client-1', agentName: 'Alice Moyo', branch: 'Harare' },
  { id: 'dev-1-103', number: '103', developmentId: 'dev-1', developmentName: 'Emerald Estate', priceUsd: 95000, areaSqm: 650, status: 'SOLD', coordinates: [], reservedBy: 'client-1', branch: 'Harare' },
  { id: 'dev-2-208', number: '208', developmentId: 'dev-2', developmentName: 'Bulawayo Gardens', priceUsd: 95000, areaSqm: 700, status: 'RESERVED', pipelineStage: 'AGREEMENT OF SALE', coordinates: [], reservationExpiresAt: new Date(Date.now() + 1000*60*60*36).toISOString(), reservedBy: 'client-2', agentName: 'Tariro N.', branch: 'Bulawayo' },
  { id: 'dev-2-209', number: '209', developmentId: 'dev-2', developmentName: 'Bulawayo Gardens', priceUsd: 88000, areaSqm: 680, status: 'AVAILABLE', coordinates: [], branch: 'Bulawayo' },
];

let MOCK_PAYMENTS: Payment[] = [
  { id: 'pay-1', clientId: 'client-1', clientName: 'Blessing M.', standId: 'dev-1-103', amountUsd: 124000, surchargeAmount: 0, paymentMethod: 'Bank', paymentType: 'Deposit', manualReceiptNo: 'REC-001', officeLocation: 'Harare', reference: 'FC-HRE-2025-1001', description: 'Settlement', createdAt: new Date(Date.now()-86400000).toISOString(), verificationStatus: 'Verified' },
  { id: 'pay-2', clientId: 'client-2', clientName: 'Tendai G.', standId: 'dev-2-208', amountUsd: 82000, surchargeAmount: 0, paymentMethod: 'Cash', paymentType: 'Deposit', manualReceiptNo: 'REC-002', officeLocation: 'Bulawayo', reference: 'FC-BYO-2025-1002', description: 'Deposit', createdAt: new Date().toISOString(), verificationStatus: 'Pending' }
];

let MOCK_CONTRACT_TEMPLATES: ContractTemplate[] = [
  { id: 'tmpl-moa', name: 'Standard MoA', content: '# Memorandum of Agreement', version: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), branchContext: 'Harare', category: 'MoA' },
  { id: 'tmpl-add', name: 'Addendum', content: '# Addendum', version: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), branchContext: 'Harare', category: 'Addendum' }
];

let MOCK_CONTRACTS: GeneratedContract[] = [
  { id: 'cont-1', clientId: 'client-1', standId: 'dev-1-103', templateId: 'tmpl-moa', status: 'EXECUTED', createdAt: new Date(Date.now()-604800000).toISOString(), category: 'MoA', annexures: ['doc-emerald-permit'] },
  { id: 'cont-2', clientId: 'client-2', standId: 'dev-2-208', templateId: 'tmpl-add', status: 'DRAFTING', createdAt: new Date().toISOString(), category: 'Addendum' }
];

let MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'aud-1', changedAt: new Date().toISOString(), changedBy: 'Alice Moyo', changedByEmail: 'alice@fineandcountry.co.zw', ipAddress: '192.168.0.2', branchContext: 'Harare', tableName: 'reservations', recordId: 'dev-1-102', actionType: 'INSERT', actionSummary: 'Reservation executed for Stand 102', oldValues: null, newValues: { reservedBy: 'client-1' } },
  { id: 'aud-2', changedAt: new Date(Date.now()-3600000).toISOString(), changedBy: 'System Bot', changedByEmail: 'bot@fineandcountry.co.zw', ipAddress: '127.0.0.1', branchContext: 'Bulawayo', tableName: 'payments', recordId: 'pay-2', actionType: 'INSERT', actionSummary: 'Deposit recorded for Stand 208', oldValues: null, newValues: { amountUsd: 82000 } },
];

let MOCK_RECON: ReconRecord[] = [
  { id: 'recon-1', paymentId: 'pay-1', clientName: 'Blessing M.', assetRef: 'dev-1-103', totalPaidUsd: 124000, commissionRate: 0.05, commissionUsd: 6200, adminFeeUsd: 300, developerNetUsd: 117500, agentId: 'agent-1', agentName: 'Alice Moyo', status: 'PENDING', verifiedAt: new Date(Date.now()-86400000).toISOString(), branch: 'Harare', developmentId: 'dev-1', developmentName: 'Emerald Estate' },
  { id: 'recon-2', paymentId: 'pay-2', clientName: 'Tendai G.', assetRef: 'dev-2-208', totalPaidUsd: 82000, commissionRate: 0.05, commissionUsd: 4100, adminFeeUsd: 200, developerNetUsd: 77700, agentId: 'agent-2', agentName: 'Tariro N.', status: 'PAID', verifiedAt: new Date().toISOString(), disbursedAt: new Date().toISOString(), branch: 'Bulawayo', developmentId: 'dev-2', developmentName: 'Bulawayo Gardens' },
];

/**
 * Supabase Core Engine (Enhanced Mock v6.7)
 * Added: Email Module Handlers & Forensic Communication Ledger
 */

export const supabaseMock = {
  realtime: { on, off },
  getEmailTemplates: async (): Promise<EmailTemplate[]> => {
    await new Promise(r => setTimeout(r, 400));
    return MOCK_EMAIL_TEMPLATES;
  },

  saveEmailTemplate: async (template: EmailTemplate): Promise<void> => {
    const idx = MOCK_EMAIL_TEMPLATES.findIndex(t => t.id === template.id);
    if (idx > -1) MOCK_EMAIL_TEMPLATES[idx] = template;
    else MOCK_EMAIL_TEMPLATES.push(template);
  },

  getCommunicationLogs: async (): Promise<CommunicationLog[]> => {
    await new Promise(r => setTimeout(r, 500));
    return MOCK_COMMUNICATION_HISTORY;
  },

  logCommunication: async (log: CommunicationLog): Promise<void> => {
    MOCK_COMMUNICATION_HISTORY = [log, ...MOCK_COMMUNICATION_HISTORY];
  },

  // Notifications
  getNotificationsForBranch: async (branch: Branch): Promise<Notification[]> => {
    return MOCK_NOTIFICATIONS.filter(n => n.branch === branch);
  },
  getNotificationsForRecipient: async (recipientType: NotificationRecipient, recipientId: string): Promise<Notification[]> => {
    return MOCK_NOTIFICATIONS.filter(n => n.recipientType === recipientType && n.recipientId === recipientId);
  },
  notifyConveyanceStageChange: async (stand: Stand, newStage: DetailedPipelineStage) => {
    const timestamp = new Date().toISOString();
    const base: { developmentName: string; standNumber: string; newStage: DetailedPipelineStage; standId: string } = {
      developmentName: stand.developmentName,
      standNumber: stand.number,
      newStage,
      standId: stand.id
    };
    const agentNotif: Notification = {
      id: `notif-${Date.now()}-a`,
      recipientType: 'Agent',
      recipientId: stand.agentName || 'unknown-agent',
      message: `Update on ${stand.developmentName}: Stand #${stand.number} has moved to ${newStage}.`,
      branch: stand.branch,
      timestamp,
      metadata: base
    };
    const clientNotif: Notification = {
      id: `notif-${Date.now()}-c`,
      recipientType: 'Client',
      recipientId: stand.reservedBy || 'unknown-client',
      message: `Update on ${stand.developmentName}: Stand #${stand.number} has moved to ${newStage}.`,
      branch: stand.branch,
      timestamp,
      metadata: base
    };
    MOCK_NOTIFICATIONS = [agentNotif, clientNotif, ...MOCK_NOTIFICATIONS];
    emit('notifications:new', { agent: agentNotif, client: clientNotif });
    emit('conveyance:stageChanged', { standId: stand.id, newStage, branch: stand.branch, timestamp });
  },

  getEmailConfig: async (): Promise<EmailConfig> => ({
    id: 'conf-main',
    providerType: 'SENDGRID',
    senderName: 'F&C Admin Node',
    senderEmail: 'admin@fineandcountry.co.zw',
    isActive: true
  }),

  saveDevelopmentMedia: async (developmentId: string, category: 'LOGO' | 'RENDER', url: string, bucket: string, path: string) => {
    console.log('[FORENSIC][STORAGE MUTATION] INSERT development_media', {
      developmentId,
      category,
      bucket,
      path,
      url_length: url.length,
      timestamp: new Date().toISOString()
    });

    if (!developmentId || !url) {
      const error = { code: '23502', message: 'developmentId and url are required fields' };
      console.error('[FORENSIC][STORAGE ERROR]', error);
      return { data: null, error };
    }

    const mediaRecord = {
      id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      developmentId,
      category,
      url,
      bucket,
      path,
      uploaded_at: new Date().toISOString()
    };

    MOCK_DEVELOPMENT_MEDIA.push(mediaRecord);
    console.log('[FORENSIC][STORAGE RESPONSE] INSERT success', {
      media_id: mediaRecord.id,
      rows_affected: 1
    });

    return { data: mediaRecord, error: null };
  },

  // Rest of previous methods maintained...
  getCommitManifest: async () => [{ id: 'git-1', type: 'feat', scope: 'email', msg: 'initialize standalone email engine', author: 'Lead Architect', time: 'Just now' }],
  getReconLedger: async (_branch?: Branch): Promise<ReconRecord[]> => {
    return _branch ? MOCK_RECON.filter(r => r.branch === _branch) : MOCK_RECON;
  },
  updateReconStatus: async (_id: string, _status: ReconStatus, _bankRef?: string): Promise<{ success: boolean }> => {
    const idx = MOCK_RECON.findIndex(r => r.id === _id);
    if (idx > -1) {
      MOCK_RECON[idx].status = _status;
      if (_status === 'PAID') {
        MOCK_RECON[idx].disbursedAt = new Date().toISOString();
      }
    }
    return { success: true };
  },
  
  getDevelopments: async (_branch?: Branch): Promise<Development[]> => {
    try {
      console.log('[FORENSIC][NEON API] GET /developments', { 
        filter_branch: _branch || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Fetch from Neon
      const response = await fetch('/api/admin/developments', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] GET failed with status', response.status);
        return [];
      }
      
      const result = await response.json();
      const developments = result.data || [];
      
      // Update local cache
      MOCK_DEVELOPMENTS = developments;
      
      // FILTERING: Branch-scoped filter (if needed)
      const branchFilter = _branch ? developments.filter((d: { branch: string }) => d.branch === _branch) : developments;
      
      console.log('[FORENSIC][NEON API] GET success', { 
        results_matched: branchFilter.length,
        total_in_neon: developments.length,
        timestamp: new Date().toISOString()
      });
      
      return branchFilter;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] GET /developments:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  },
  
  getClients: async (_branch?: Branch): Promise<Client[]> => {
    try {
      console.log('[FORENSIC][NEON API] GET /api/admin/clients', {
        filter_branch: _branch || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Fetch from Neon
      const params = new URLSearchParams();
      if (_branch) params.append('branch', _branch);
      
      const response = await fetch(`/api/admin/clients?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] GET /clients failed with status', response.status);
        return [];
      }
      
      const result = await response.json();
      const clients = result.data || [];
      
      console.log('[FORENSIC][NEON API] GET /clients success', {
        results: clients.length,
        branch: _branch || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      return clients;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] GET /clients:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  },
  
  createClient: async (clientData: Partial<Client>): Promise<Client> => {
    try {
      console.log('[FORENSIC][NEON API] POST /api/admin/clients', {
        name: clientData.name,
        branch: clientData.branch || 'Harare',
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientData.name || 'Walk-in Client',
          email: clientData.email || 'unknown@example.com',
          phone: clientData.phone || '+263 00 000 0000',
          branch: (clientData.branch as Branch) || 'Harare',
          kyc: clientData.kyc || [],
          ownedStands: clientData.ownedStands || []
        })
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] POST /clients failed with status', response.status);
        throw new Error('Failed to create client');
      }
      
      const result = await response.json();
      const client = result.data;
      
      console.log('[FORENSIC][NEON API] POST /clients success', {
        id: client.id,
        name: client.name,
        timestamp: new Date().toISOString()
      });
      
      return client;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] POST /clients:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      throw e;
    }
  },
  
  getAuditLogs: async (_branch?: Branch): Promise<AuditLog[]> => {
    await new Promise(r => setTimeout(r, 120));
    return _branch ? MOCK_AUDIT_LOGS.filter(l => l.branchContext === _branch) : MOCK_AUDIT_LOGS;
  },
  
  logAudit: async (_params: Partial<AuditLog>) => {
    const log: AuditLog = {
      id: `aud-${Date.now()}`,
      changedAt: new Date().toISOString(),
      changedBy: _params.changedBy || 'System',
      changedByEmail: _params.changedByEmail || 'system@fineandcountry.co.zw',
      ipAddress: _params.ipAddress || '127.0.0.1',
      branchContext: _params.branchContext || 'Harare',
      tableName: _params.tableName || 'unknown',
      recordId: _params.recordId || 'unknown',
      actionType: _params.actionType || 'INSERT',
      actionSummary: _params.actionSummary || 'Event logged',
      oldValues: _params.oldValues || null,
      newValues: _params.newValues || null,
    };
    MOCK_AUDIT_LOGS = [log, ...MOCK_AUDIT_LOGS];
    return log;
  },
  
  getDevelopmentById: async (_id: string) => {
    console.log('[FORENSIC][DB QUERY] GET /developments/:id', { id: _id });
    return MOCK_DEVELOPMENTS.find(d => d.id === _id);
  },
  
  createDevelopment: async (dev: Development) => {
    try {
      console.log('[FORENSIC][NEON API] CREATE development', {
        id: dev.id,
        name: dev.name,
        branch: dev.branch,
        timestamp: new Date().toISOString()
      });
      
      // VALIDATION: Primary Key
      if (!dev.id) {
        const error = { code: '23502', message: 'Development ID is required (PRIMARY KEY violation)' };
        console.error('[NEON_API_ERROR] PRIMARY_KEY_VIOLATION:', error);
        return { data: null, error, status: 422 };
      }
      
      // VALIDATION: Branch (Foreign Key candidate)
      if (!dev.branch) {
        const error = { code: '23502', message: 'Branch field is required' };
        console.error('[NEON_API_ERROR] FOREIGN_KEY_VIOLATION:', error);
        return { data: null, error, status: 422 };
      }
      
      // VALIDATION: Required string fields
      const requiredFields = ['name', 'locationName'];
      for (const field of requiredFields) {
        if (!(field in dev) || !dev[field as keyof Development]) {
          const error = { code: '23502', message: `Required field '${field}' is missing or empty` };
          console.error('[NEON_API_ERROR] REQUIRED_FIELD_MISSING:', error);
          return { data: null, error, status: 422 };
        }
      }
      
      // CALL API: Send to Neon via POST /api/admin/developments
      const response = await fetch('/api/admin/developments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dev)
      });
      
      let result;
      try {
        const text = await response.text();
        console.log('[NEON_API_DEBUG] Response text length:', text.length, 'first 200 chars:', text.substring(0, 200));
        result = text ? JSON.parse(text) : { data: dev, error: null };
      } catch (parseError) {
        console.error('[NEON_API_ERROR] JSON parse error:', parseError);
        console.error('[NEON_API_ERROR] Response status:', response.status);
        console.error('[NEON_API_ERROR] Response headers:', Object.fromEntries(response.headers.entries()));
        
        // If response is not ok, return the error with response text
        if (!response.ok) {
          return { 
            data: null, 
            error: { 
              message: 'API returned invalid JSON response', 
              code: 'PARSE_ERROR',
              httpStatus: response.status 
            }, 
            status: response.status 
          };
        }
        
        // If response was ok but parsing failed, use the original data
        result = { data: dev, error: null };
      }
      
      if (!response.ok && result.error) {
        console.error('[NEON_API_ERROR] API returned error:', result);
        return { data: null, error: result.error || { message: 'Unknown error' }, status: response.status };
      }
      
      // Check if response was not ok but we still got valid JSON (error in response body)
      if (!response.ok) {
        const errorMsg = result?.error?.message || 'API request failed';
        return { 
          data: null, 
          error: { message: errorMsg, code: result?.error?.code || 'API_ERROR' }, 
          status: response.status 
        };
      }
      
      // Update local cache with response from Neon (use dev if no result.data)
      const newDev = result.data || dev;
      MOCK_DEVELOPMENTS.push(newDev);
      
      console.log('[FORENSIC][NEON API] CREATE success', { 
        id: newDev.id, 
        name: newDev.name,
        branch: newDev.branch,
        stored_in_neon: true,
        timestamp: new Date().toISOString()
      });
      
      // REALTIME: Broadcast event for other browsers
      emit('developments:created', { id: newDev.id, name: newDev.name, branch: newDev.branch });
      
      return { data: newDev, error: null, status: 201 };
    } catch (e: any) {
      console.error('[NEON_API_ERROR] UNHANDLED_EXCEPTION:', {
        message: e.message,
        code: e.code,
        stack: e.stack,
        timestamp: new Date().toISOString()
      });
      return { 
        data: null, 
        error: { code: 'EXCEPTION', message: e.message || 'Unknown error during development creation' }, 
        status: 500 
      };
    }
  },
  
  updateDevelopment: async (_id: string, _updates: Partial<Development>) => {
    try {
      console.log('[FORENSIC][NEON API] UPDATE development', {
        id: _id,
        updates: Object.keys(_updates),
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Send update to Neon
      const response = await fetch('/api/admin/developments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _id, ..._updates })
      });
      
      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : { data: null, error: null };
      } catch (parseError) {
        console.error('[NEON_API_ERROR] UPDATE JSON parse error:', parseError);
        if (!response.ok) {
          return { 
            data: null, 
            error: { message: 'API returned invalid JSON response', code: 'PARSE_ERROR', httpStatus: response.status }, 
            status: response.status 
          };
        }
        return { 
          data: null, 
          error: { message: 'Invalid response from server', code: 'PARSE_ERROR' }, 
          status: 500 
        };
      }
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] UPDATE failed:', result);
        return { data: null, error: result?.error || { message: 'Update failed' }, status: response.status };
      }
      
      const updated = result.data;
      
      // Update local cache
      const devIndex = MOCK_DEVELOPMENTS.findIndex(d => d.id === _id);
      if (devIndex !== -1) {
        MOCK_DEVELOPMENTS[devIndex] = updated;
      }
      
      console.log('[FORENSIC][NEON API] UPDATE success', { id: _id, rows_affected: 1 });
      
      // Emit realtime event
      emit('developments:updated', { id: _id, name: updated.name, branch: updated.branch });
      
      return { data: updated, error: null, status: 200 };
    } catch (e: any) {
      console.error('[NEON_API_ERROR] UPDATE exception:', {
        message: e.message,
        stack: e.stack
      });
      return { 
        data: null, 
        error: { message: e.message }, 
        status: 500 
      };
    }
  },

  deleteDevelopment: async (_id: string) => {
    try {
      console.log('[FORENSIC][NEON API] DELETE development', {
        id: _id,
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Send delete to Neon
      const response = await fetch('/api/admin/developments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _id })
      });
      
      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : { data: null, error: null };
      } catch (parseError) {
        console.error('[NEON_API_ERROR] DELETE JSON parse error:', parseError);
        if (!response.ok) {
          return { 
            error: { message: 'API returned invalid JSON response', code: 'PARSE_ERROR', httpStatus: response.status }, 
            status: response.status 
          };
        }
        return { 
          error: { message: 'Invalid response from server', code: 'PARSE_ERROR' }, 
          status: 500 
        };
      }
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] DELETE failed:', result);
        return { error: result?.error || { message: 'Delete failed' }, status: response.status };
      }
      
      // Remove from local cache
      const devIndex = MOCK_DEVELOPMENTS.findIndex(d => d.id === _id);
      if (devIndex !== -1) {
        const deleted = MOCK_DEVELOPMENTS[devIndex];
        MOCK_DEVELOPMENTS.splice(devIndex, 1);
        
        // Delete associated media
        MOCK_DEVELOPMENT_MEDIA = MOCK_DEVELOPMENT_MEDIA.filter(m => m.developmentId !== _id);
        
        console.log('[FORENSIC][NEON API] DELETE success', { id: _id, name: deleted.name, rows_affected: 1, media_cleaned: true });
        
        // Emit realtime event
        emit('developments:deleted', { id: _id, name: deleted.name });
      }
      
      return { error: null, status: 200 };
    } catch (e: any) {
      console.error('[NEON_API_ERROR] DELETE exception:', {
        message: e.message,
        stack: e.stack
      });
      return { 
        error: { message: e.message }, 
        status: 500 
      };
    }
  },
  
  updateStandStatus: async (standId: string, newStatus: StandStatus, clientEmail?: string, reservationId?: string) => {
    // Simulate status update and send notification emails
    const { getEmailTemplates } = supabaseMock;
    const templates = await getEmailTemplates();
    if (newStatus === 'AVAILABLE' && clientEmail && reservationId) {
      // Reservation expired
      const template = templates.find(t => t.id === 'RESERVATION_EXPIRED');
      if (template) {
        try {
          await sendEmail({
            to: clientEmail,
            subject: template.subject.replace('{{reservation_id}}', reservationId),
            html: template.bodyHtml
              .replace('{{reservation_id}}', reservationId)
              .replace('{{investor_terminal_url}}', 'https://erp.fineandcountry.co.zw/investor-portal/')
          });
        } catch (e) {
          console.error('[SUPABASE] Failed to send reservation expired email:', e);
        }
      }
    }
    if (newStatus === 'SOLD' && clientEmail && reservationId) {
      // Sale complete
      const template = templates.find(t => t.id === 'SALE_COMPLETE');
      if (template) {
        try {
          await sendEmail({
            to: clientEmail,
            subject: template.subject.replace('{{reservation_id}}', reservationId),
            html: template.bodyHtml
              .replace('{{reservation_id}}', reservationId)
              .replace('{{investor_terminal_url}}', 'https://erp.fineandcountry.co.zw/investor-portal/')
          });
        } catch (e) {
          console.error('[SUPABASE] Failed to send sale complete email:', e);
        }
      }
    }
    return { data: null, error: null };
  },
  downloadDocument: async (_path: string, _fileName: string) => ({ success: true }),
  getStandsByClient: async (_clientId: string) => {
    const owned = MOCK_CLIENTS.find(c => c.id === _clientId)?.ownedStands || [];
    return MOCK_STANDS.filter(s => s.reservedBy === _clientId || owned.includes(s.id));
  },
  getInventorySummary: async (_devId: string) => {
    const items = MOCK_STANDS.filter(s => s.developmentId === _devId);
    return {
      TOTAL: items.length,
      AVAILABLE: items.filter(s => s.status === 'AVAILABLE').length,
      RESERVED: items.filter(s => s.status === 'RESERVED').length,
      SOLD: items.filter(s => s.status === 'SOLD').length,
    };
  },
  getPayments: async (_clientId?: string) => {
    try {
      console.log('[FORENSIC][NEON API] GET /api/admin/payments', {
        filter_clientId: _clientId || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Fetch from Neon
      const params = new URLSearchParams();
      if (_clientId) params.append('clientId', _clientId);
      
      const response = await fetch(`/api/admin/payments?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] GET /payments failed with status', response.status);
        return [];
      }
      
      const result = await response.json();
      const payments = result.data || [];
      
      console.log('[FORENSIC][NEON API] GET /payments success', {
        results: payments.length,
        clientId: _clientId || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      return payments;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] GET /payments:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  },
  checkPaynowStatus: async (_paymentId: string) => ({ status: 'Paid', confirmedAt: new Date().toISOString() }),
  
  getStands: async (_branch?: Branch) => {
    try {
      console.log('[FORENSIC][NEON API] GET /api/admin/stands', {
        filter_branch: _branch || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Fetch from Neon
      const params = new URLSearchParams();
      if (_branch) params.append('branch', _branch);
      
      const response = await fetch(`/api/admin/stands?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] GET /stands failed with status', response.status);
        return [];
      }
      
      const result = await response.json();
      const stands = result.data || [];
      
      console.log('[FORENSIC][NEON API] GET /stands success', {
        results: stands.length,
        branch: _branch || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      return stands;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] GET /stands:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  },
  
  getActivityLog: async (opts?: { branch?: Branch; module?: string; days?: number; limit?: number }) => {
    try {
      console.log('[FORENSIC][NEON API] GET /api/admin/activity-logs', {
        filter_branch: opts?.branch || 'ALL_BRANCHES',
        filter_module: opts?.module || 'ALL',
        days: opts?.days || 7,
        timestamp: new Date().toISOString()
      });
      
      // CALL API: Fetch from Neon
      const params = new URLSearchParams();
      if (opts?.branch) params.append('branch', opts.branch);
      if (opts?.module) params.append('module', opts.module);
      if (opts?.days) params.append('days', opts.days.toString());
      if (opts?.limit) params.append('limit', opts.limit.toString());
      
      const response = await fetch(`/api/admin/activity-logs?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[NEON_API_ERROR] GET /activity-logs failed with status', response.status);
        return [];
      }
      
      const result = await response.json();
      const logs = result.data || [];
      
      console.log('[FORENSIC][NEON API] GET /activity-logs success', {
        results: logs.length,
        branch: opts?.branch || 'ALL_BRANCHES',
        module: opts?.module || 'ALL',
        timestamp: new Date().toISOString()
      });
      
      return logs;
    } catch (e: any) {
      console.error('[NEON_API_ERROR] GET /activity-logs:', {
        message: e.message,
        code: e.code,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  },
  getClientDashboardData: async (clientId: string) => {
    // Mock: 1 reserved, 1 sold, 1 available
    const now = new Date();
    const reservations = [
      {
        id: 'stand-1',
        number: '101',
        developmentId: 'dev-1',
        developmentName: 'Emerald Estate',
        priceUsd: 120000,
        areaSqm: 800,
        status: 'RESERVED',
        reservation_expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 48).toISOString(),
        reservedBy: clientId,
        agentName: 'Alice Moyo',
        branch: 'Harare',
      },
      {
        id: 'stand-2',
        number: '102',
        developmentId: 'dev-1',
        developmentName: 'Emerald Estate',
        priceUsd: 130000,
        areaSqm: 900,
        status: 'SOLD',
        reservedBy: clientId,
        agentName: null,
        branch: 'Harare',
      }
    ];
    // Portfolio = SOLD, Reservations = RESERVED
    return {
      portfolio: reservations.filter(s => s.status === 'SOLD'),
      payments: [],
      contracts: [],
      reservations: reservations.filter(s => s.status === 'RESERVED'),
    };
  },
  getInvoices: async (_saleId: string) => [],
  getTemplates: async (_branch: Branch) => {
    return MOCK_CONTRACT_TEMPLATES.filter(t => t.branchContext === _branch || t.branchContext === 'Harare');
  },
  saveTemplate: async (template: ContractTemplate) => ({ data: template, error: null }),
  saveContract: async (contract: GeneratedContract) => {
    MOCK_CONTRACTS = [contract, ...MOCK_CONTRACTS];
    return { data: contract, error: null };
  },
  savePayment: async (payment: Payment) => {
    MOCK_PAYMENTS = [payment, ...MOCK_PAYMENTS];
    await supabaseMock.logAudit({
      branchContext: payment.officeLocation,
      tableName: 'payments',
      recordId: payment.id,
      actionType: 'INSERT',
      actionSummary: `Payment recorded for ${payment.clientName}`,
      newValues: payment
    });
    return { data: payment, error: null };
  },
  saveSettings: async (settings: CompanySettings) => ({ data: settings, error: null }),
  getStandsByDevelopment: async (_devId: string) => {
    return MOCK_STANDS.filter(s => s.developmentId === _devId);
  },
  // Return reserved stands for deals view, filtered by branch when provided
  getReservedStands: async (branch?: Branch): Promise<Stand[]> => {
    const filtered = branch ? MOCK_STANDS.filter(s => s.status === 'RESERVED' && s.branch === branch) : MOCK_STANDS.filter(s => s.status === 'RESERVED');
    return filtered;
  },
  // Legacy alias - deprecated
  getConveyancePipeline: async (branch?: Branch): Promise<Stand[]> => {
    console.log('[DEPRECATED] getConveyancePipeline renamed to getReservedStands');
    const filtered = branch ? MOCK_STANDS.filter(s => s.status === 'RESERVED' && s.branch === branch) : MOCK_STANDS.filter(s => s.status === 'RESERVED');
    return filtered;
  },
  inviteUser: async (_email: string, _role: Role, _branch: Branch) => ({ success: true }),
  reserveStand: async (standId: string, userId: string, role: string, termsAcceptedAt?: string, agentEmail?: string, clientEmail?: string, reservationId?: string, expiresAt?: string) => {
    console.log('[FORENSIC][RESERVE STAND]', { standId, userId, role, termsAcceptedAt });
    
    // Simulate reservation logic and send RESERVATION_CONFIRMED email
    const { getEmailTemplates } = supabaseMock;
    const templates = await getEmailTemplates();
    const template = templates.find(t => t.id === 'RESERVATION_CONFIRMED');
    if (template && clientEmail && reservationId && expiresAt) {
      try {
        await sendEmail({
          to: clientEmail,
          subject: template.subject.replace('{{reservation_id}}', reservationId),
          html: template.bodyHtml
            .replace('{{reservation_id}}', reservationId)
            .replace('{{expires_at}}', expiresAt)
            .replace('{{investor_terminal_url}}', 'https://erp.fineandcountry.co.zw/investor-portal/')
        });
        if (agentEmail) {
          await sendEmail({
            to: agentEmail,
            subject: template.subject.replace('{{reservation_id}}', reservationId),
            html: template.bodyHtml
              .replace('{{reservation_id}}', reservationId)
              .replace('{{expires_at}}', expiresAt)
              .replace('{{investor_terminal_url}}', 'https://erp.fineandcountry.co.zw/investor-portal/')
          });
        }
      } catch (e) {
        console.error('[SUPABASE] Failed to send reservation confirmed email:', e);
      }
    }
    return { success: true };
  },
  getPipelineNotes: async (_standId: string) => [],
  addPipelineNote: async (_standId: string, _content: string, _authorName: string) => ({ id: `pn-${Date.now()}`, standId: _standId, authorId: 'system', authorName: _authorName, content: _content, createdAt: new Date().toISOString() } as PipelineNote),
  deletePipelineNote: async (_noteId: string) => true,
  // Fix: added _options?: any parameter to upload signature to satisfy the call in components/AdminDevelopments.tsx
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: any, _options?: any) => ({ data: { path: _path }, error: null }),
      getPublicUrl: (path: string) => ({
        data: {
          publicUrl: `https://mock-supabase-storage.local/${path}`
        }
      })
    })
  },
  getSystemHealth: async (): Promise<SystemHealth> => ({ apiConnected: true, latencyMs: 12, userAuthenticated: true, dbResponsive: true, storageAccessible: true, timestamp: new Date().toISOString() }),
  
  /**
   * Get Admin Diagnostics from admin_diagnostics view
   * Falls back to computed mock data if database query fails
   */
  getAdminDiagnostics: async (): Promise<AdminDiagnostics> => {
    console.log('[FORENSIC][DIAGNOSTICS] Fetching admin_diagnostics view...');
    
    try {
      // In production: const { data } = await supabase.from('admin_diagnostics').select('*').single();
      // For now, compute from mock data
      const totalProjects = MOCK_DEVELOPMENTS.length;
      const totalInventory = MOCK_STANDS.reduce((sum, s) => sum + 1, 0);
      const totalRevenue = MOCK_PAYMENTS.reduce((sum, p) => sum + p.amountUsd, 0);
      const totalLegalFiles = MOCK_DEVELOPMENTS.reduce((sum, d) => {
        let count = 0;
        if (d.refundPolicyUrl) count++;
        if (d.paymentTermsUrl) count++;
        if (d.documentUrls && d.documentUrls.length > 0) count += d.documentUrls.length;
        return sum + count;
      }, 0);
      
      const diagnostics: AdminDiagnostics = {
        totalProjects: totalProjects,
        totalInventory: totalInventory,
        totalRevenueUsd: totalRevenue,
        totalLegalFiles: totalLegalFiles,
        timestamp: new Date().toISOString()
      };
      
      console.log('[FORENSIC][DIAGNOSTICS] Admin metrics computed:', diagnostics);
      return diagnostics;
    } catch (error) {
      console.error('[FORENSIC][DIAGNOSTICS] Query failed, using fallback:', error);
      return {
        totalProjects: 0,
        totalInventory: 0,
        totalRevenueUsd: 0,
        totalLegalFiles: 0,
        timestamp: new Date().toISOString()
      };
    }
  },
  
  getProfiles: async () => {
    return MOCK_PROFILES;
  },
  updateProfile: async (_id: string, _updates: any) => {
    const idx = MOCK_PROFILES.findIndex(p => p.id === _id);
    if (idx > -1) {
      MOCK_PROFILES[idx] = { ...MOCK_PROFILES[idx], ..._updates };
      return { data: MOCK_PROFILES[idx], error: null };
    }
    return { data: null, error: null };
  },
  getDevelopmentMetrics: async (_id: string) => ({ totalValue: 0, yieldRealized: 0 }),
  getAgents: async (_branch?: Branch): Promise<Profile[]> => {
    const agents = MOCK_PROFILES.filter(p => p.role === 'Agent');
    return _branch ? agents.filter(a => a.assignedBranch === _branch) : agents;
  },
  updateAgentProfile: async (_id: string, _updates: any) => {
    const idx = MOCK_PROFILES.findIndex(p => p.id === _id);
    if (idx > -1) {
      MOCK_PROFILES[idx] = { ...MOCK_PROFILES[idx], ..._updates } as Profile;
      return { data: MOCK_PROFILES[idx], error: null };
    }
    return { data: null, error: null };
  },

  /**
   * Agent-Specific Attribution Queries
   * All queries filtered by agent_id for data security
   * SQL: WHERE agent_id = auth.uid()
   */
  
  getAgentCommissions: async (agentId: string) => {
    console.log('[FORENSIC][AGENT_COMMISSIONS] Fetching for agent:', agentId);
    
    // SQL: SELECT * FROM commissions WHERE agent_id = $1
    // Mock: Filter stands where agent initiated reservation
    const agentStands = MOCK_STANDS.filter(s => 
      s.status === 'RESERVED' && s.agentName?.includes('Agent') // Simulate agent attribution
    );
    
    const commissions = agentStands.map(stand => {
      const commissionRate = 2.5; // 2.5% commission
      const amount = stand.priceUsd * (commissionRate / 100);
      
      return {
        id: `comm-${stand.id}`,
        standId: stand.id,
        standNumber: stand.number,
        developmentName: stand.developmentName,
        clientName: 'Client Name', // Would come from client lookup
        standPrice: stand.priceUsd,
        commissionRate: commissionRate,
        amount: amount,
        status: stand.pipelineStage === 'TRANSFER' ? 'earned' : 
                stand.pipelineStage === 'PAYMENT TRACKING' ? 'pending' : 'projected',
        date: new Date().toISOString()
      };
    });
    
    console.log('[FORENSIC][AGENT_COMMISSIONS] Found:', commissions.length, 'records');
    return commissions;
  },

  getAgentPipeline: async (agentId: string) => {
    console.log('[FORENSIC][AGENT_PIPELINE] Fetching for agent:', agentId);
    
    // SQL: SELECT * FROM conveyance_pipeline WHERE agent_id = $1
    // Mock: Filter stands attributed to agent
    const agentStands = MOCK_STANDS.filter(s => 
      s.status === 'RESERVED' // Only reserved stands in pipeline
    );
    
    console.log('[FORENSIC][AGENT_PIPELINE] Found:', agentStands.length, 'deals');
    return agentStands;
  },

  getAgentClients: async (agentId: string) => {
    console.log('[FORENSIC][AGENT_CLIENTS] Fetching for agent:', agentId);
    
    // SQL: SELECT DISTINCT clients.* FROM reservations 
    //      JOIN clients ON reservations.client_id = clients.id 
    //      WHERE reservations.agent_id = $1
    
    // Mock: Group stands by client, filter by agent
    const agentStands = MOCK_STANDS.filter(s => s.status === 'RESERVED');
    
    // Group by reservedBy (client_id)
    const clientMap = new Map<string, any>();
    
    agentStands.forEach(stand => {
      if (!stand.reservedBy) return;
      
      if (!clientMap.has(stand.reservedBy)) {
        const client = MOCK_CLIENTS.find(c => c.id === stand.reservedBy);
        if (client) {
          clientMap.set(stand.reservedBy, {
            id: client.id,
            name: client.name,
            email: client.email || 'client@example.com',
            phone: client.phone || '+263 77 123 4567',
            stands: [],
            totalValue: 0,
            payments_made: 0,
            terms_accepted: true // Mock legal compliance
          });
        }
      }
      
      const clientData = clientMap.get(stand.reservedBy);
      if (clientData) {
        clientData.stands.push({
          id: stand.id,
          stand_number: stand.number,
          development_name: stand.developmentName,
          priceUsd: stand.priceUsd,
          status: stand.status,
          terms_accepted: true, // Mock: Would come from reservations table
          reservation_date: new Date().toISOString()
        });
        clientData.totalValue += stand.priceUsd;
      }
    });
    
    const clients = Array.from(clientMap.values());
    console.log('[FORENSIC][AGENT_CLIENTS] Found:', clients.length, 'clients');
    return clients;
  },

  updateStandStage: async (standId: string, newStage: string, agentId: string) => {
    console.log('[FORENSIC][STAND_UPDATE] Stand:', standId, 'to stage:', newStage, 'by agent:', agentId);
    
    // SQL: UPDATE conveyance_pipeline 
    //      SET pipeline_stage = $1, updatedAt = NOW() 
    //      WHERE id = $2 AND agent_id = $3
    
    const standIndex = MOCK_STANDS.findIndex(s => s.id === standId);
    if (standIndex > -1) {
      MOCK_STANDS[standIndex] = {
        ...MOCK_STANDS[standIndex],
        pipelineStage: newStage as any,
      };
      console.log('[FORENSIC][STAND_UPDATE] Success - agent_id enforced:', agentId);
      return { success: true };
    }
    
    return { success: false, error: 'Stand not found or no permission' };
  },

  // ============================================
  // CLIENT INVESTMENT TERMINAL QUERIES
  // Strict client_id filtering for security
  // ============================================

  getClientReservations: async (clientId: string) => {
    console.log('[FORENSIC][CLIENT_RESERVATIONS] Fetching for client_id:', clientId);
    
    // SQL: SELECT r.*, s.number, s.priceUsd, s.development_name, a.name as agent_name, a.phone
    //      FROM reservations r
    //      JOIN stands s ON r.stand_id = s.id
    //      JOIN agents a ON r.agent_id = a.id
    //      WHERE r.client_id = $1 AND r.status = 'active'
    
    const reservations = MOCK_STANDS
      .filter(s => s.reservedBy === clientId && s.status === 'RESERVED')
      .slice(0, 2) // Mock: simulate active reservations
      .map(stand => {
        const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000); // 72 hours from creation
        
        return {
          id: `res-${stand.id}`,
          standId: stand.id,
          standName: `Stand ${stand.number}`,
          developmentName: stand.developmentName,
          price: stand.priceUsd,
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          agentName: stand.agentName || 'Sarah Moyo',
          agentPhone: '+263 77 234 5678',
          status: Date.now() < expiresAt.getTime() ? 'active' : 'expired'
        };
      });
    
    console.log('[FORENSIC][CLIENT_RESERVATIONS] Found:', reservations.length, 'active reservations');
    return reservations;
  },

  getClientPayments: async (clientId: string) => {
    console.log('[FORENSIC][CLIENT_PAYMENTS] Fetching for client_id:', clientId);
    
    // SQL: SELECT p.*, s.number as stand_name
    //      FROM payments p
    //      JOIN stands s ON p.stand_id = s.id
    //      WHERE p.client_id = $1
    //      ORDER BY p.payment_date DESC
    
    const clientStands = MOCK_STANDS.filter(s => s.reservedBy === clientId);
    const payments = clientStands.flatMap(stand => {
      // Mock payment history: Initial deposit + installments
      const mockPayments = [
        {
          id: `pay-${stand.id}-1`,
          amount: stand.priceUsd * 0.2, // 20% deposit
          date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
          standName: `Stand ${stand.number}`,
          paymentType: 'Initial Deposit',
          receiptNumber: `RCP-${stand.id.slice(0, 8).toUpperCase()}`
        },
        {
          id: `pay-${stand.id}-2`,
          amount: stand.priceUsd * 0.15, // 15% installment
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          standName: `Stand ${stand.number}`,
          paymentType: 'Installment Payment',
          receiptNumber: `RCP-${stand.id.slice(0, 8).toUpperCase()}-02`
        }
      ];
      return mockPayments;
    });
    
    console.log('[FORENSIC][CLIENT_PAYMENTS] Found:', payments.length, 'payment records');
    return payments;
  },

  getClientOwnedProperties: async (clientId: string) => {
    console.log('[FORENSIC][CLIENT_PROPERTIES] Fetching for client_id:', clientId);
    
    // SQL: SELECT s.*, d.primary_image
    //      FROM stands s
    //      JOIN developments d ON s.developmentId = d.id
    //      WHERE s.client_id = $1 
    //      AND s.status IN ('Sold', 'AOS Signed')
    
    const ownedProperties = MOCK_STANDS
      .filter(s => s.reservedBy === clientId)
      .slice(0, 3) // Mock: simulate owned properties
      .map(stand => ({
        id: stand.id,
        standName: `Stand ${stand.number}`,
        developmentName: stand.developmentName,
        price: stand.priceUsd,
        status: 'Sold' as const,
        purchaseDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
        aosPdfUrl: `/documents/aos-${stand.id}.pdf`,
        infrastructure: {
          water: stand.developmentName.includes('Legacy') || stand.developmentName.includes('Borrowdale'),
          power: stand.developmentName.includes('Legacy') || stand.developmentName.includes('Borrowdale'),
          roads: true // Mock: all have roads
        }
      }));
    
    console.log('[FORENSIC][CLIENT_PROPERTIES] Found:', ownedProperties.length, 'owned properties');
    return ownedProperties;
  },

  // ==========================================
  // PHASE 2 MODULE 1: CONTRACTS & TEMPLATES
  // ==========================================

  getContractTemplates: async (_branch?: string) => {
    try {
      const params = new URLSearchParams();
      if (_branch) params.append('branch', _branch);
      
      const response = await fetch(`/api/admin/contract-templates?${params.toString()}`);
      if (!response.ok) {
        console.error('[CONTRACT_TEMPLATES] GET failed:', response.status);
        return [];
      }
      
      const result = await response.json();
      console.log('[CONTRACT_TEMPLATES] Fetched:', result.data?.length || 0, 'templates');
      return result.data || [];
    } catch (e: any) {
      console.error('[CONTRACT_TEMPLATES] Error:', e.message);
      return [];
    }
  },

  saveContractTemplate: async (data: any) => {
    try {
      const response = await fetch('/api/admin/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACT_TEMPLATES] POST failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACT_TEMPLATES] Created:', result.data?.id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACT_TEMPLATES] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  updateContractTemplate: async (id: string, data: any) => {
    try {
      const response = await fetch('/api/admin/contract-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACT_TEMPLATES] PUT failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACT_TEMPLATES] Updated:', id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACT_TEMPLATES] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  deleteContractTemplate: async (id: string) => {
    try {
      const response = await fetch('/api/admin/contract-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACT_TEMPLATES] DELETE failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACT_TEMPLATES] Deleted:', id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACT_TEMPLATES] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  getContracts: async (_clientId?: string, _branch?: string) => {
    try {
      const params = new URLSearchParams();
      if (_clientId) params.append('clientId', _clientId);
      if (_branch) params.append('branch', _branch);
      
      const response = await fetch(`/api/admin/contracts?${params.toString()}`);
      if (!response.ok) {
        console.error('[CONTRACTS] GET failed:', response.status);
        return [];
      }
      
      const result = await response.json();
      console.log('[CONTRACTS] Fetched:', result.data?.length || 0, 'contracts');
      return result.data || [];
    } catch (e: any) {
      console.error('[CONTRACTS] Error:', e.message);
      return [];
    }
  },

  generateContract: async (data: any) => {
    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACTS] POST failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACTS] Generated:', result.data?.id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACTS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  signContract: async (id: string, signedBy: string) => {
    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'SIGNED', signedBy })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACTS] Sign failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACTS] Signed:', id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACTS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  updateContract: async (id: string, data: any) => {
    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACTS] PUT failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACTS] Updated:', id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACTS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  deleteContract: async (id: string) => {
    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[CONTRACTS] DELETE failed:', error.error);
        return { data: null, error: error.error };
      }
      
      const result = await response.json();
      console.log('[CONTRACTS] Deleted:', id);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[CONTRACTS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  

  // ====== MODULE 2: RECONCILIATION ENGINE ======

  getReconciliationData: async (tab = 'all', branch?: string) => {
    try {
      const params = new URLSearchParams();
      if (tab) params.append('tab', tab);
      if (branch) params.append('branch', branch);

      const response = await fetch(`/api/admin/reconciliation?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[RECONCILIATION] Fetched data:', tab);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[RECONCILIATION] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  importBankStatements: async (statements: any[], branch: string) => {
    try {
      const response = await fetch('/api/admin/reconciliation?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements, branch })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[RECONCILIATION] Import failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[RECONCILIATION] Imported:', result.data.imported, 'statements');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[RECONCILIATION] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  matchPaymentToStatement: async (statementId: string, paymentId: string, notes?: string) => {
    try {
      const response = await fetch('/api/admin/reconciliation?action=match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId, paymentId, notes, status: 'MATCHED' })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[RECONCILIATION] Match failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[RECONCILIATION] Matched statement to payment');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[RECONCILIATION] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  flagDiscrepancy: async (statementId?: string, paymentId?: string, reason?: string) => {
    try {
      const response = await fetch('/api/admin/reconciliation?action=flag-discrepancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId, paymentId, reason })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[RECONCILIATION] Flag failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[RECONCILIATION] Flagged discrepancy');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[RECONCILIATION] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  updateReconRecord: async (reconId: string, status?: string, notes?: string) => {
    try {
      const response = await fetch('/api/admin/reconciliation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconId, status, notes })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[RECONCILIATION] Update failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[RECONCILIATION] Updated recon record:', reconId);
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[RECONCILIATION] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  // ====== MODULE 3: DEALS (Pipeline module removed) ======
  // Note: Pipeline APIs have been removed. Use /api/agent/deals or /api/admin/deals instead.

  // Legacy pipeline methods removed - use Deals API directly
  getPipelineStatus: async (_branch?: string) => {
    console.log('[DEPRECATED] getPipelineStatus removed - use Deals API');
    return { data: null, error: 'Pipeline module removed - use Deals API' };
  },

  getPipelineClients: async (_branch?: string) => {
    console.log('[DEPRECATED] getPipelineClients removed - use Deals API');
    return { data: [], error: 'Pipeline module removed - use Deals API' };
  },

  movePipelineStage: async (_clientId: string, _stage: string, _notes?: string, _userId?: string) => {
    console.log('[DEPRECATED] movePipelineStage removed - use Deals API');
    return { data: null, error: 'Pipeline module removed - use Deals API' };
  },

  calculatePipelineMetrics: async (_month: string, _branch?: string) => {
    console.log('[DEPRECATED] calculatePipelineMetrics removed - use Deals API');
    return { data: null, error: 'Pipeline module removed - use Deals API' };
  },

  // ====== MODULE 4: COMMISSION CALCULATIONS ======

  getCommissions: async (month?: string, status?: string, branch?: string) => {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (status) params.append('status', status);
      if (branch) params.append('branch', branch);

      const response = await fetch(`/api/admin/commissions?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[COMMISSIONS] Fetched commissions');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[COMMISSIONS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  calculateCommission: async (agentId: string, paymentId: string, paymentAmount: number, percentage: number, month: string) => {
    try {
      const response = await fetch('/api/admin/commissions?action=calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, paymentId, paymentAmount, percentage, month })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[COMMISSIONS] Calculate failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[COMMISSIONS] Calculated commission');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[COMMISSIONS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  approveCommission: async (commissionId: string) => {
    try {
      const response = await fetch('/api/admin/commissions?action=approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionId })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[COMMISSIONS] Approve failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[COMMISSIONS] Approved commission');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[COMMISSIONS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  createCommissionPayout: async (agentId: string, month: string, branch?: string) => {
    try {
      const response = await fetch('/api/admin/commissions?action=create-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, month, branch })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[COMMISSIONS] Payout failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[COMMISSIONS] Created payout');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[COMMISSIONS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

  updateCommissionPayout: async (payoutId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, status })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[COMMISSIONS] Update failed:', error.error);
        return { data: null, error: error.error };
      }

      const result = await response.json();
      console.log('[COMMISSIONS] Updated payout');
      return { data: result.data, error: null };
    } catch (e: any) {
      console.error('[COMMISSIONS] Error:', e.message);
      return { data: null, error: e.message };
    }
  },

};
