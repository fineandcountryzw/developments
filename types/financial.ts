/**
 * Financial System Type Definitions
 * Commission tracking, developer statements, and financial breakdowns
 */

// ============================================================================
// Commission Types
// ============================================================================

export type CommissionType = 'percentage' | 'fixed';
export type CommissionStatus = 'PENDING' | 'PAID' | 'DISPUTED' | 'CANCELLED';
export type PaymentMethod = 'Bank Transfer' | 'RTGS' | 'Cash' | 'EcoCash' | 'OneMoney' | 'Other';

export interface CommissionConfig {
  type: CommissionType;
  rate?: number; // For percentage: e.g., 5
  fixedAmount?: number; // For fixed: e.g., 1000
  agentShare?: number; // For fixed: custom agent split
  companyShare?: number; // For fixed: custom company split
}

export interface AgentCommission {
  id: string;
  agent_id: string;
  agent_name?: string;
  sale_id: string;
  development_id: string;
  development_name?: string;
  stand_number: string;
  client_name?: string;
  
  // Commission details
  commission_type: CommissionType;
  base_price: number;
  commission_rate?: number; // e.g., 2.5 for agent's share
  commission_amount: number; // Agent's share
  
  // Payment status
  status: CommissionStatus;
  paid_date?: string;
  payment_reference?: string;
  payment_method?: PaymentMethod;
  notes?: string;
  
  // Dates
  sale_date: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Financial Breakdown Types
// ============================================================================

export interface SaleFinancialBreakdown {
  // Commission
  commission_type: CommissionType;
  commission_rate?: number;
  commission_fixed_amount?: number;
  commission_total: number;
  commission_agent_share: number;
  commission_company_share: number;
  
  // Pricing
  base_price: number;
  vat_amount: number;
  aos_fee: number;
  cession_fee: number;
  endowment_fee: number;
  total_client_payment: number;
  developer_net_amount: number;
  
  // Fee toggles
  vat_enabled: boolean;
  vat_rate: number;
  aos_enabled: boolean;
  cession_enabled: boolean;
  endowment_enabled: boolean;
}

export interface FinancialSummary {
  id: string;
  development_id: string;
  development_name?: string;
  month_year: string; // 'YYYY-MM'
  
  // Sales metrics
  total_sales_count: number;
  total_sales_value: number; // Total client payments
  
  // Developer finances
  developer_gross: number; // Sum of base prices
  developer_commission_deducted: number;
  developer_net: number; // Amount owed to developer
  developer_paid_amount: number; // Payments made
  developer_outstanding: number; // Still owed
  
  // Commission breakdown
  total_commission: number;
  agent_commission_total: number;
  company_commission_total: number;
  
  // Fee components
  vat_collected: number;
  aos_fees_collected: number;
  cession_fees_collected: number;
  endowment_fees_collected: number;
  total_fees_collected: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Developer Statement Types
// ============================================================================

export interface DeveloperPayment {
  id: string;
  development_id: string;
  developer_email?: string;
  
  // Payment details
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  reference_number?: string;
  
  // Period covered
  period_start?: string;
  period_end?: string;
  month_year?: string;
  
  // Related sales
  sale_ids?: string[];
  
  // Metadata
  notes?: string;
  processed_by?: string;
  created_at: string;
}

export interface DeveloperStatement {
  development_id: string;
  development_name: string;
  developer_name?: string;
  developer_email?: string;
  
  // Period
  period: string; // e.g., 'January 2026'
  month_year: string; // 'YYYY-MM'
  
  // Sales summary
  total_stands_sold: number;
  
  // Financial breakdown
  gross_sales: number; // Sum of base prices
  total_commission: number; // Commission deducted
  net_amount: number; // What developer receives
  
  // Informational (not owed to developer)
  vat_collected: number;
  fees_collected: {
    aos: number;
    cession: number;
    endowment: number;
    total: number;
  };
  
  // Payment tracking
  payments_received: number;
  outstanding_balance: number;
  
  // Transaction list
  transactions: DeveloperTransaction[];
  
  // Payment history
  payment_history: DeveloperPayment[];
}

export interface DeveloperTransaction {
  sale_id: string;
  stand_number: string;
  client_name: string;
  sale_date: string;
  base_price: number;
  commission: number;
  net_to_developer: number;
  status: string;
}

// ============================================================================
// Agent Commission Summary Types
// ============================================================================

export interface AgentCommissionSummary {
  agent_id: string;
  agent_name: string;
  
  // Summary stats
  total_earned: number; // Lifetime
  pending_amount: number; // Unpaid
  paid_this_month: number;
  paid_lifetime: number;
  sales_count: number;
  
  // Detailed commissions
  commissions: AgentCommission[];
  
  // Period filter
  period?: string;
  month_year?: string;
}

// ============================================================================
// Accounts Dashboard Types
// ============================================================================

export interface AccountsFinancialOverview {
  // Summary totals
  total_sales_value: number; // All client payments
  developer_owed_total: number; // Total net owed to all developers
  vat_collected_total: number;
  commissions_earned_total: number; // Company share
  agent_commissions_total: number;
  
  // Breakdown by development
  developments: {
    id: string;
    name: string;
    sales_count: number;
    gross_revenue: number; // Base prices
    commission_deducted: number;
    net_to_developer: number;
    outstanding_balance: number;
    vat_component: number;
    fees_breakdown: {
      aos: number;
      cession: number;
      endowment: number;
      total: number;
    };
  }[];
  
  // Commission analytics
  commission_breakdown: {
    agents_total: number;
    company_total: number;
    percentage_model_count: number;
    fixed_model_count: number;
  };
  
  // Payment status
  payments_made: number;
  payments_pending: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface FinancialSummaryRequest {
  development_id?: string;
  start_date?: string; // YYYY-MM
  end_date?: string; // YYYY-MM
}

export interface AgentCommissionRequest {
  agent_id: string;
  status?: CommissionStatus;
  start_date?: string;
  end_date?: string;
}

export interface MarkCommissionPaidRequest {
  commission_id: string;
  payment_date: string;
  payment_reference: string;
  payment_method: PaymentMethod;
  notes?: string;
}

export interface RecordDeveloperPaymentRequest {
  development_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  period_start?: string;
  period_end?: string;
  sale_ids?: string[];
  notes?: string;
}

// ============================================================================
// Calculation Helper Types
// ============================================================================

export interface FeeConfiguration {
  vat_enabled: boolean;
  vat_rate: number; // Default 15.5
  aos_enabled: boolean;
  aos_fee: number; // Variable
  cession_enabled: boolean;
  cession_fee: number; // Variable
  endowment_enabled: boolean;
  endowment_fee: number; // Variable
}

export interface CalculatedFinancials {
  base_price: number;
  commission_total: number;
  agent_share: number;
  company_share: number;
  vat_amount: number;
  fees_total: number;
  client_total: number;
  developer_net: number;
}
