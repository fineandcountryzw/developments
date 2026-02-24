/**
 * Neon Database Service (Browser-Safe Version)
 * 
 * This file provides mock functions for development.
 * Real database operations should use API routes with Prisma on the server.
 * 
 * Architecture:
 * - Browser (Frontend) -> lib/db.ts (mocks) OR API routes
 * - API Routes (Backend) -> Direct Prisma Client calls
 */

import { DEFAULT_LOGO } from './constants';

// This file provides mock/stub functions for browser compatibility.
// Real database operations should use API routes with Prisma on the server.
// db is always null - use API routes for actual data access.

export const db = null;

// Helper to check if DB is available (always false in this browser-safe module)
const isDbAvailable = (): boolean => {
  console.warn('[DB] Database not available - running in browser mode with mock data');
  return false;
};

// Branch settings (migrated from Supabase)
export const BRANCH_SETTINGS = {
  Harare: {
    branch: 'Harare' as const,
    name: 'Harare',
    address: '1 Borrowdale Road, Harare',
    phone: '+263 242 123 456',
    email: '[email protected]',
    receipt_prefix: 'FC-HRE',
    logo_url: DEFAULT_LOGO, // Shared logo for all branches
    legal_name: 'Fine & Country Zimbabwe (Harare)',
    registration_number: 'REG-001',
    vat_number: 'VAT-001',
    principalAgentName: '',
    principalAgentEmail: '',
  },
  Bulawayo: {
    branch: 'Bulawayo' as const,
    name: 'Bulawayo',
    address: '6 Kingsley Crescent, Malindela, Bulawayo',
    phone: '+263 29 123 456',
    email: '[email protected]',
    receipt_prefix: 'FC-BYO',
    logo_url: DEFAULT_LOGO, // Shared logo for all branches
    legal_name: 'Fine & Country Zimbabwe (Bulawayo)',
    registration_number: 'REG-002',
    vat_number: 'VAT-002',
    principalAgentName: '',
    principalAgentEmail: '',
  },
};

// Load settings from localStorage on startup
function loadSettingsFromStorage() {
  try {
    const harareStored = localStorage.getItem('branch_settings_Harare');
    const bulawayoStored = localStorage.getItem('branch_settings_Bulawayo');

    if (harareStored) {
      BRANCH_SETTINGS.Harare = JSON.parse(harareStored);
      console.log('[FORENSIC][DB] Loaded Harare settings from localStorage');
    }
    if (bulawayoStored) {
      BRANCH_SETTINGS.Bulawayo = JSON.parse(bulawayoStored);
      console.log('[FORENSIC][DB] Loaded Bulawayo settings from localStorage');
    }
  } catch (err) {
    console.warn('[FORENSIC][DB] Could not load settings from localStorage:', err);
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  loadSettingsFromStorage();
}

// Helper functions for common operations

/**
 * Log audit event to activities table
 */
export async function logAudit(data: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
}) {
  console.log('[FORENSIC][AUDIT_LOG]', data);
  // DB operations only available in API routes - this is a browser-safe stub
}

/**
 * Log communication event
 */
export async function logCommunication(data: {
  userId: string;
  type: 'EMAIL' | 'SMS' | 'CALL';
  recipient: string;
  subject?: string;
  body?: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
}) {
  console.log('[FORENSIC][COMMUNICATION_LOG]', data);
  // DB operations only available in API routes - this is a browser-safe stub
}

/**
 * Get system health metrics from Neon
 */
export async function getSystemHealth() {
  // DB not available in browser - return offline status
  return {
    database: { status: 'offline' as const, latency: 0, connected: false },
    users: { total: 0 },
    reservations: { active: 0 },
  };
}

// Lightweight event emitter for realtime updates
type EventHandler = (payload?: any) => void;
const emitter: Record<string, Set<EventHandler>> = {};

export const on = (event: string, handler: EventHandler) => {
  if (!emitter[event]) emitter[event] = new Set();
  emitter[event].add(handler);
  return () => off(event, handler);
};

export const off = (event: string, handler: EventHandler) => {
  if (emitter[event]) emitter[event].delete(handler);
};

export const emit = (event: string, payload?: any) => {
  if (emitter[event]) emitter[event].forEach(h => {
    try { h(payload); } catch (e) { console.error('[FORENSIC][REALTIME_ERROR]', e); }
  });
};

/**
 * Get reconciliation ledger (from payments with verified status)
 */
export async function getReconLedger(branch?: any): Promise<any[]> {
  console.log('[FORENSIC][DB] getReconLedger called', { branch });

  if (!isDbAvailable()) {
    // Fetch from API for browser context
    try {
      const url = branch
        ? `/api/admin/payments?branch=${branch}&status=CONFIRMED`
        : `/api/admin/payments?status=CONFIRMED`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      const payments = data.payments || data.data || [];

      // Import SettlementCalculator for accurate calculations
      const { SettlementCalculator } = await import('./settlement-calculator');

      // Transform payments into recon records format with accurate fee breakdown (camelCase)
      return payments.map((p: any) => {
        const settlement = SettlementCalculator.calculateSettlement(p);

        return {
          id: p.id,
          verifiedAt: p.confirmedAt || p.createdAt,
          clientName: p.clientName || p.client?.name || 'Unknown',
          assetRef: p.standId || p.stand?.standNumber || 'N/A',
          developmentName: p.stand?.development?.name || 'Unknown',
          totalPaidUsd: settlement.totalPayment,
          standPricePortion: settlement.standPricePortion,
          vatAmount: settlement.vatAmount,
          cessionAmount: settlement.cessionAmount,
          endowmentAmount: settlement.endowmentAmount,
          aosAmount: settlement.aosAmount,
          totalFees: settlement.totalFees,
          commissionUsd: settlement.commission,
          developerNetUsd: settlement.developerNet,
          status: p.settlementStatus || 'PENDING',
          bankReference: p.reference || null,
        };
      });
    } catch (error) {
      console.error('[FORENSIC][DB] getReconLedger fetch error:', error);
      return [];
    }
  }
  // API call handles data - no direct db access in browser
  return [];
}

/**
 * Get developments by branch
 */
export async function getDevelopments(branch?: any): Promise<any[]> {
  // Return mock developments for browser context
  return [
    {
      id: 'dev-1',
      name: 'Borrowdale Heights',
      location: 'Borrowdale, Harare',
      branch: 'Harare',
      status: 'Active',
      phase: 'Phase 1',
      stands: [],
    },
    {
      id: 'dev-2',
      name: 'Hillside Gardens',
      location: 'Hillside, Bulawayo',
      branch: 'Bulawayo',
      status: 'Active',
      phase: 'Phase 2',
      stands: [],
    },
  ].filter(d => !branch || d.branch === branch);
}

/**
 * Get development by ID
 */
export async function getDevelopmentById(id: string): Promise<any> {
  // DB not available in browser - return null
  return null;
}

/**
 * Create development
 */
export async function createDevelopment(data: any): Promise<{ data: any; error: any; status: number }> {
  try {
    console.log('[FORENSIC][DB] createDevelopment called with:', {
      name: data.name,
      branch: data.branch,
      fields: Object.keys(data)
    });

    // Call Express backend API
    const response = await fetch(`/api/admin/developments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    console.log('[FORENSIC][DB] API response status:', response.status);

    if (!response.ok) {
      try {
        const result = await response.json();
        console.error('[FORENSIC][DB] API error:', result);
        return { data: null, error: result.error || 'Creation failed', status: response.status };
      } catch (parseErr) {
        const text = await response.text();
        return { data: null, error: text || `HTTP ${response.status}`, status: response.status };
      }
    }

    try {
      const result = await response.json();
      console.log('[FORENSIC][DB] Create successful:', { id: result.data?.id });
      emit('developments:created', result.data);
      return { data: result.data, error: null, status: response.status };
    } catch (parseErr) {
      const text = await response.text();
      if (!text) {
        return { data: null, error: 'Empty response from server', status: 500 };
      }
      return { data: null, error: `Invalid JSON: ${text}`, status: 500 };
    }
  } catch (error: any) {
    console.error('[FORENSIC][DB] createDevelopment error:', error.message);
    return { data: null, error: error.message || 'Network error', status: 500 };
  }
}

/**
 * Update development
 */
export async function updateDevelopment(id: string, data: any): Promise<{ data: any; error: any; status: number }> {
  try {
    console.log('[FORENSIC][DB] updateDevelopment called with:', {
      id,
      fields: Object.keys(data)
    });

    // Call Express backend API
    const response = await fetch(`/api/admin/developments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    });

    console.log('[FORENSIC][DB] API response status:', response.status);

    if (!response.ok) {
      try {
        const result = await response.json();
        console.error('[FORENSIC][DB] API error:', result);
        return { data: null, error: result.error || 'Update failed', status: response.status };
      } catch (parseErr) {
        const text = await response.text();
        return { data: null, error: text || `HTTP ${response.status}`, status: response.status };
      }
    }

    try {
      const result = await response.json();
      console.log('[FORENSIC][DB] Update successful:', { id: result.data?.id });
      emit('developments:updated', result.data);
      return { data: result.data, error: null, status: response.status };
    } catch (parseErr) {
      const text = await response.text();
      if (!text) {
        return { data: null, error: 'Empty response from server', status: 500 };
      }
      return { data: null, error: `Invalid JSON: ${text}`, status: 500 };
    }
  } catch (error: any) {
    console.error('[FORENSIC][DB] updateDevelopment error:', error.message);
    return { data: null, error: error.message || 'Network error', status: 500 };
  }
}

/**
 * Delete development
 */
export async function deleteDevelopment(id: string): Promise<{ error: any; status: number }> {
  try {
    console.log('[FORENSIC][DB] deleteDevelopment called with id:', id);

    // Call Express backend API
    const response = await fetch(`/api/admin/developments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    console.log('[FORENSIC][DB] API response status:', response.status);

    if (!response.ok) {
      try {
        const result = await response.json();
        console.error('[FORENSIC][DB] API error:', result);
        return { error: result.error || 'Deletion failed', status: response.status };
      } catch (parseErr) {
        const text = await response.text();
        return { error: text || `HTTP ${response.status}`, status: response.status };
      }
    }

    try {
      const result = await response.json();
      console.log('[FORENSIC][DB] Delete successful:', { id });
      emit('developments:deleted', { id });
      return { error: null, status: response.status };
    } catch (parseErr) {
      const text = await response.text();
      if (!text) {
        return { error: 'Empty response from server', status: 500 };
      }
      return { error: `Invalid JSON: ${text}`, status: 500 };
    }
  } catch (error: any) {
    console.error('[FORENSIC][DB] deleteDevelopment error:', error.message);
    return { error: error.message || 'Network error', status: 500 };
  }
}

/**
 * Get development metrics
 */
export async function getDevelopmentMetrics(developmentId: string): Promise<any> {
  // DB not available in browser - return empty metrics
  return { total: 0, available: 0, reserved: 0, sold: 0, totalValue: 0 };
}

/**
 * Get stands by development - uses API route for browser compatibility
 */
export async function getStandsByDevelopment(developmentId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getStandsByDevelopment - calling API', { developmentId });

    const response = await fetch(`/api/stands/by-development?developmentId=${developmentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch stands:', response.status);
      return [];
    }

    const stands = await response.json();
    console.log('[FORENSIC][DB] getStandsByDevelopment - fetched from API', {
      count: stands?.length || 0,
      developmentId
    });
    return stands || [];
  } catch (error) {
    console.error('[FORENSIC][DB] getStandsByDevelopment error:', error);
    return [];
  }
}

/**
 * Get stands by client - uses API route for browser compatibility
 */
export async function getStandsByClient(clientId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getStandsByClient - calling API', { clientId });

    const response = await fetch(`/api/admin/stands?clientId=${clientId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch client stands:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getStandsByClient - fetched from API', {
      count: result.data?.stands?.length || 0,
      clientId
    });
    return result.data?.stands || [];
  } catch (error) {
    console.error('[FORENSIC][DB] getStandsByClient error:', error);
    return [];
  }
}

/**
 * Update stand stage - uses API route for browser compatibility
 */
export async function updateStandStage(standId: string, stage: string, agentId?: string): Promise<void> {
  try {
    console.log('[FORENSIC][DB] updateStandStage - calling API', { standId, stage });

    const response = await fetch('/api/admin/stands', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: standId,
        status: stage
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[FORENSIC][DB] Failed to update stand stage:', error);
      throw new Error(error.error || 'Failed to update stand');
    }

    console.log('[FORENSIC][DB] updateStandStage - updated via API', { standId, stage });
  } catch (error) {
    console.error('[FORENSIC][DB] updateStandStage error:', error);
  }
}

/**
 * Get clients from the client table
 */
export async function getClients(agentId?: string): Promise<any[]> {
  if (!isDbAvailable()) {
    // Fetch from API for browser context
    try {
      const url = agentId
        ? `/api/admin/clients?agentId=${agentId}`
        : `/api/admin/clients`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[FORENSIC][DB] getClients fetch error:', error);
      return [];
    }
  }
  // API handles data - no direct db access
  return [];
}

/**
 * Create client
 */
export async function createClient(data: any): Promise<any> {
  // DB not available in browser - return null
  console.warn('[DB] createClient not available in browser - use API route');
  return null;
}

/**
 * Get client reservations - fetches reservations for this client
 */
export async function getClientReservations(clientId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getClientReservations - calling API', { clientId });

    const response = await fetch(`/api/client/reservations?clientId=${clientId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch client reservations:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getClientReservations - fetched from API', {
      count: result.data?.length || 0,
      clientId
    });
    return result.data || result.reservations || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getClientReservations error:', error.message);
    return [];
  }
}

/**
 * Get client payments (mock - payments table not yet in schema)
 */
export async function getClientPayments(clientId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/admin/payments?clientId=${clientId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch client payments:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getClientPayments - fetched from API', {
      count: result.data?.length || 0,
      clientId
    });
    return result.data || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getClientPayments error:', error.message);
    return [];
  }
}

/**
 * Get client owned properties - fetches sold stands owned by this client
 */
export async function getClientOwnedProperties(clientId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getClientOwnedProperties - calling API', { clientId });

    const response = await fetch(`/api/admin/stands?clientId=${clientId}&status=SOLD`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch client properties:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getClientOwnedProperties - fetched from API', {
      count: result.data?.length || 0,
      clientId
    });
    return result.data || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getClientOwnedProperties error:', error.message);
    return [];
  }
}

/**
 * Get client dashboard data
 */
export async function getClientDashboardData(clientId: string): Promise<any> {
  try {
    const [portfolio, payments, contracts, reservations] = await Promise.all([
      getClientOwnedProperties(clientId),
      getClientPayments(clientId),
      [], // contracts table pending migration
      getClientReservations(clientId),
    ]);

    return { portfolio, payments, contracts, reservations };
  } catch (error) {
    console.error('[FORENSIC][DB] getClientDashboardData error:', error);
    return { portfolio: [], payments: [], contracts: [], reservations: [] };
  }
}

/**
 * Get payments (using new Unified API)
 */
export async function getPayments(clientId?: string): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    params.append('limit', '100'); // Fetch more for legacy list compatibility

    // Call new unified API
    const response = await fetch(`/api/payments?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch payments from Unified API:', response.status);
      return [];
    }

    const result = await response.json();
    // Support both new API format { items: [] } and potentially legacy if mixed
    const items = result.items || result.data || [];

    console.log('[FORENSIC][DB] getPayments - fetched from Unified API', { count: items.length, clientId });

    // Map PaymentTransaction to legacy Payment format for UI compatibility
    return items.map((pt: any) => ({
      id: pt.id,
      clientId: pt.client?.id || pt.clientId,
      clientName: pt.client?.name || 'Unknown',
      standId: pt.stand?.id || pt.standId,
      standNumber: pt.stand?.standNumber,
      amount: Number(pt.amount),
      amountUsd: Number(pt.amount), // Legacy field
      surchargeAmount: 0,
      paymentMethod: pt.method === 'CASH' ? 'Cash' :
        pt.method === 'BANK' ? 'Bank' :
          (pt.method ? pt.method.charAt(0) + pt.method.slice(1).toLowerCase() : 'Other'),
      paymentType: 'Deposit', // Default or derive from somewhere? pt.memo?
      officeLocation: 'Harare', // Default or derive
      reference: pt.reference || '',
      manualReceiptNo: pt.externalId || pt.reference || '',
      description: pt.memo || 'Payment',
      createdAt: pt.postedAt || pt.createdAt,
      verificationStatus: pt.status === 'COMPLETED' ? 'Verified' : 'Pending',
      receivedByName: pt.receivedByName
    }));
  } catch (error: any) {
    console.error('[FORENSIC][DB] getPayments error:', error.message);
    return [];
  }
}

/**
 * Save payment - calls new Unified API endpoint
 */
export async function savePayment(payment: any): Promise<void> {
  try {
    // Generate idempotency key if not provided (client-side generation preferred)
    const idempotencyKey = payment.idempotencyKey || `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const payloadToSend = {
      amount: payment.amount_usd || payment.amount,
      currency: 'USD',
      method: (payment.payment_method || payment.method || 'CASH').toUpperCase(),
      reference: payment.reference,
      externalId: payment.manual_receipt_no, // Use receipt number as external ID/key
      idempotencyKey,
      memo: payment.description || payment.payment_type || 'Payment',
      clientId: payment.clientId,
      standId: payment.standId,
      postedAt: new Date().toISOString(),
      // Mappings
      source: 'MANUAL',
      createdByUserId: 'LegacyAdapter'
    };

    console.log('[FORENSIC][DB] savePayment - calling POST /api/payments', {
      clientId: payment.clientId,
      amount: payloadToSend.amount,
      method: payloadToSend.method
    });

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSend)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[FORENSIC][DB] Failed to save payment:', { status: response.status, error });
      throw new Error(`Failed to save payment: ${error.error}`);
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] Payment saved successfully (Unified):', { id: result.id });
  } catch (error: any) {
    console.error('[FORENSIC][DB] savePayment error:', error.message);
    throw error;
  }
}

/**
 * Get invoices (mock - invoices table not yet in schema)
 */
export async function getInvoices(saleId: string): Promise<any[]> {
  console.log('[FORENSIC][DB] getInvoices - invoices table pending migration', { saleId });
  return [];
}

/**
 * Get agent pipeline - fetches deals/reservations attributed to this agent
 */
export async function getAgentPipeline(agentId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getAgentPipeline - calling API', { agentId });

    const response = await fetch(`/api/admin/reservations?agentId=${agentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch agent pipeline:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getAgentPipeline - fetched from API', {
      count: result.data?.length || 0,
      agentId
    });
    return result.data || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getAgentPipeline error:', error.message);
    return [];
  }
}

/**
 * Get agent commissions (mock - commissions table not yet in schema)
 */
export async function getAgentCommissions(agentId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/admin/commissions?agentId=${agentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch agent commissions:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getAgentCommissions - fetched from API', {
      count: result.data?.length || 0,
      agentId,
      summary: result.summary
    });
    return result.data || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getAgentCommissions error:', error.message);
    return [];
  }
}

/**
 * Get agent clients - fetches clients associated with this agent's reservations
 */
export async function getAgentClients(agentId: string): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getAgentClients - calling API', { agentId });

    const response = await fetch(`/api/admin/clients?agentId=${agentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch agent clients:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getAgentClients - fetched from API', {
      count: result.data?.length || 0,
      agentId
    });
    return result.data || [];
  } catch (error: any) {
    console.error('[FORENSIC][DB] getAgentClients error:', error.message);
    return [];
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(): Promise<any[]> {
  // DB not available in browser
  return [];
}

/**
 * Get commit manifest (mock - for development tracking)
 */
export async function getCommitManifest(): Promise<any[]> {
  return [
    { id: 'git-1', type: 'feat', scope: 'migration', msg: 'Complete Supabase to Neon migration', author: 'System', time: 'Just now' }
  ];
}

/**
 * Get admin diagnostics
 */
export async function getAdminDiagnostics(): Promise<any> {
  // DB not available in browser
  return {};
}

/**
 * Get email templates (mock - templates table not yet in schema)
 */
export async function getEmailTemplates(): Promise<any[]> {
  console.log('[FORENSIC][DB] getEmailTemplates - templates table pending migration');
  return [];
}

/**
 * Get communication logs
 */
export async function getCommunicationLogs(): Promise<any[]> {
  // DB not available in browser
  return [];
}

/**
 * Get email config (mock - config table not yet in schema)
 */
export async function getEmailConfig(): Promise<any> {
  console.log('[FORENSIC][DB] getEmailConfig - config table pending migration');
  return { provider: 'resend', from: 'noreply@fineandcountryerp.com' };
}

/**
 * Save email template (mock - templates table not yet in schema)
 */
export async function saveEmailTemplate(template: any): Promise<void> {
  console.log('[FORENSIC][DB] saveEmailTemplate - templates table pending migration', template);
}

/**
 * Save settings (mock - persists to localStorage)
 */
export async function saveSettings(settings: any): Promise<{ error: any }> {
  try {
    console.log('[FORENSIC][DB] saveSettings - persisting to localStorage:', { branch: settings.branch, logo_url: settings.logo_url });

    // Persist to localStorage
    const key = `branch_settings_${settings.branch}`;
    localStorage.setItem(key, JSON.stringify(settings));

    // Also update in-memory BRANCH_SETTINGS
    (BRANCH_SETTINGS as Record<string, typeof settings>)[settings.branch] = settings;

    console.log('[FORENSIC][DB] Settings saved successfully:', { branch: settings.branch, stored_in_localStorage: true });
    return { error: null };
  } catch (err: any) {
    console.error('[FORENSIC][DB] Error saving settings:', err);
    return { error: err };
  }
}

/**
 * Update recon status (mock - recon table not yet in schema)
 */
export async function updateReconStatus(id: string, status: any, bankRef?: string): Promise<{ success: boolean }> {
  console.log('[FORENSIC][DB] updateReconStatus - recon table pending migration', { id, status, bankRef });
  return { success: true };
}

/**
 * Storage using UploadThing
 * For real file uploads with URLs
 */
export const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, file: File) => {
      console.log('[FORENSIC][DB] Use UploadButton/UploadDropzone from lib/uploadthing.ts', { bucket, path });
      // This is a placeholder - components should use UploadButton/UploadDropzone directly
      return {
        data: { path: `${bucket}/${path}` },
        error: 'Use UploadButton component for uploads'
      };
    },
    getPublicUrl: (path: string) => ({
      data: { publicUrl: path } // UploadThing returns full URLs
    })
  })
};

/**
 * Realtime mock for backward compatibility
 */
export const realtime = {
  on,
  off,
};

/**
 * Additional helper functions for remaining components
 */

// Profiles/Users
export async function getProfiles(): Promise<any[]> {
  // DB not available in browser
  return [];
}

export async function updateProfile(id: string, data: any): Promise<void> {
  // DB not available in browser
  console.warn('[DB] updateProfile not available in browser - use API route');
}

export async function inviteUser(email: string, role: any, branch: any): Promise<void> {
  console.log('[FORENSIC][DB] inviteUser - pending email integration', { email, role, branch });
  // TODO: Integrate with Resend for invitation emails
}

// Agents
export async function getAgents(branch?: any): Promise<any[]> {
  try {
    console.log('[FORENSIC][DB] getAgents - calling API', { branch });

    const url = branch
      ? `/api/admin/agents?branch=${branch}`
      : `/api/admin/agents`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('[FORENSIC][DB] Failed to fetch agents:', response.status);
      // Return mock agents as fallback
      return [
        {
          id: 'agent-1',
          name: 'Sarah Moyo',
          email: 'sarah@fineandcountry.co.zw',
          phone: '+263 77 444 4444',
          branch: 'Harare',
          created_at: new Date(),
        },
        {
          id: 'agent-2',
          name: 'Michael Ncube',
          email: 'michael@fineandcountry.co.zw',
          phone: '+263 77 333 3333',
          branch: 'Bulawayo',
          created_at: new Date(),
        },
      ].filter(agent => !branch || agent.branch === branch);
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] getAgents - fetched from API', { count: result.data?.length || 0 });
    return result.data || [];
  } catch (error) {
    console.error('[FORENSIC][DB] getAgents error:', error);
    return [];
  }
}

export async function updateAgentProfile(id: string, data: any): Promise<void> {
  try {
    console.log('[FORENSIC][DB] updateAgentProfile - calling API', { id });

    const response = await fetch('/api/admin/agents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, ...data })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[FORENSIC][DB] Failed to update agent:', error);
      throw new Error(error.error || 'Failed to update agent');
    }

    console.log('[FORENSIC][DB] updateAgentProfile - updated via API', { id });
  } catch (error) {
    console.error('[FORENSIC][DB] updateAgentProfile error:', error);
  }
}

// Inventory/Summary
export async function getInventorySummary(developmentId: string): Promise<any> {
  try {
    const metrics = await getDevelopmentMetrics(developmentId);
    return {
      total: metrics.total,
      available: metrics.available,
      reserved: metrics.reserved,
      sold: metrics.sold,
    };
  } catch (error) {
    console.error('[FORENSIC][DB] getInventorySummary error:', error);
    return { total: 0, available: 0, reserved: 0, sold: 0 };
  }
}

// Reservations - uses API route for browser compatibility
export async function reserveStand(standId: string, clientId: string, userType: string, termsAcceptedAt: string): Promise<void> {
  try {
    console.log('[FORENSIC][DB] reserveStand - calling API', { standId, clientId, userType });

    const response = await fetch('/api/admin/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include session cookie for auth
      body: JSON.stringify({
        standId,
        clientId,  // API expects clientId
        userId: clientId,  // Also send as userId for backwards compatibility
        userType,
        termsAcceptedAt,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[FORENSIC][DB] Failed to create reservation:', error);
      throw new Error(error.error || 'Failed to reserve stand');
    }

    const result = await response.json();
    console.log('[FORENSIC][DB] reserveStand - reservation created via API', {
      reservationId: result.data?.id,
      standId
    });
  } catch (error) {
    console.error('[FORENSIC][DB] reserveStand error:', error);
    throw error;
  }
}

// Notifications
export async function getNotificationsForRecipient(type: string, id: string): Promise<any[]> {
  console.log('[FORENSIC][DB] getNotificationsForRecipient - notifications table pending', { type, id });
  return [];
}

export async function getNotificationsForBranch(branch: string): Promise<any[]> {
  console.log('[FORENSIC][DB] getNotificationsForBranch - notifications table pending', { branch });
  return [];
}

// Templates & Contracts
export async function getTemplates(branch: any): Promise<any[]> {
  console.log('[FORENSIC][DB] getTemplates - using mock data', { branch });
  return [
    {
      id: 'tmpl-1',
      name: 'Standard Sale Agreement',
      content: `MEMORANDUM OF AGREEMENT

This Agreement is entered into between {{legal_name}} and {{client_name}}.

PROPERTY DETAILS:
Development: {{development_name}}
Stand Number: {{stand_number}}
Purchase Price: USD {{purchase_price}}

{{installment_plan_text}}

CLIENT INFORMATION:
Client ID: {{client_id}}

Both parties agree to abide by the terms set forth herein.`,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      branch_context: branch,
      category: 'MoA'
    },
    {
      id: 'tmpl-2',
      name: 'Addendum Template',
      content: `ADDENDUM TO AGREEMENT

This Addendum modifies the original agreement for {{client_name}}.

Development: {{development_name}}
Stand: {{stand_number}}

Terms and conditions apply.`,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      branch_context: branch,
      category: 'Addendum'
    }
  ];
}

export async function getContracts(): Promise<any[]> {
  console.log('[FORENSIC][DB] getContracts - using mock data');
  return [
    {
      id: 'cont-1',
      client_id: 'client-1',
      stand_id: 'stand-1',
      template_id: 'tmpl-1',
      status: 'EXECUTED',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'MoA',
      annexures: []
    },
    {
      id: 'cont-2',
      client_id: 'client-2',
      stand_id: 'stand-2',
      template_id: 'tmpl-1',
      status: 'DRAFTING',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'MoA',
      annexures: []
    }
  ];
}

export async function saveTemplate(template: any): Promise<void> {
  console.log('[FORENSIC][DB] saveTemplate - templates table pending', template);
}

export async function saveContract(contract: any): Promise<void> {
  console.log('[FORENSIC][DB] saveContract - contracts table pending', contract);
}

// Documents
export async function downloadDocument(path: string, name: string): Promise<void> {
  console.log('[FORENSIC][DB] downloadDocument - pending UploadThing integration', { path, name });
}

export async function saveDevelopmentMedia(devId: string, type: string, url: string, bucket: string, path: string): Promise<any> {
  console.log('[FORENSIC][DB] saveDevelopmentMedia - media table pending', { devId, type, url });
  return { success: true };
}

// Kanban/Pipeline
export async function getConveyancePipeline(branch?: any): Promise<any[]> {
  if (!isDbAvailable()) {
    // Browser mode - fetch from API
    try {
      const params = new URLSearchParams();
      if (branch && branch !== 'ALL') {
        params.append('branch', branch);
      }
      // Pass multiple statuses as comma-separated
      params.append('status', 'RESERVED,SOLD');

      const response = await fetch(`/api/admin/stands?${params.toString()}`);
      if (!response.ok) {
        console.error('[DB] Failed to fetch conveyance pipeline:', response.statusText);
        return [];
      }

      const result = await response.json();
      console.log('[DB] Fetched conveyance pipeline:', result.data?.length || 0, 'stands');
      return result.data || [];
    } catch (error) {
      console.error('[DB] Error fetching conveyance pipeline:', error);
      return [];
    }
  }
  // API handles data - no direct db access
  return [];
}

export async function notifyConveyanceStageChange(stand: any, status: string): Promise<void> {
  console.log('[FORENSIC][DB] notifyConveyanceStageChange - notifications pending', { stand, status });
  await logAudit({
    userId: 'system',
    action: 'STAGE_CHANGE',
    entity: 'stands',
    entityId: stand.id,
    metadata: { newStatus: status }
  });
}

export async function getPipelineNotes(standId: string): Promise<any[]> {
  console.log('[FORENSIC][DB] getPipelineNotes - notes table pending', { standId });
  return [];
}

export async function addPipelineNote(standId: string, content: string, author: string): Promise<any> {
  console.log('[FORENSIC][DB] addPipelineNote - notes table pending', { standId, content, author });
  return { id: Date.now().toString(), content, author, timestamp: new Date().toISOString() };
}

export async function deletePipelineNote(noteId: string): Promise<boolean> {
  console.log('[FORENSIC][DB] deletePipelineNote - notes table pending', { noteId });
  return true;
}




// Export db as default for convenience
export default db;
