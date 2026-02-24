/**
 * Commission & Financial Calculator Service
 * 
 * Calculates financial breakdown for stand sales including:
 * - Commission splits (percentage or fixed)
 * - VAT (15.5%)
 * - Various fees (AOS, Cession, Endowment)
 * - Developer net amounts
 * 
 * CALCULATION ORDER: Base Price → Commission → VAT & Fees
 */

export interface CommissionConfig {
  type: 'percentage' | 'fixed';
  rate?: number; // e.g., 5 for 5%
  fixedAmount?: number; // e.g., 1000
  agentShare?: number; // For fixed: custom agent share (default 500)
  companyShare?: number; // For fixed: custom company share (default 500)
}

export interface FeeConfig {
  // VAT Configuration
  vatEnabled: boolean;
  vatRate: number; // Default: 15.5
  
  // Agreement of Sale Fee (variable)
  aosEnabled: boolean;
  aosFee: number; // Variable per development
  
  // Cession Fee (variable)
  cessionEnabled: boolean;
  cessionFee: number; // Variable per development
  
  // Endowment Fee (variable)
  endowmentEnabled: boolean;
  endowmentFee: number; // Variable per development
}

export interface FinancialBreakdown {
  // Base pricing
  basePrice: number;
  
  // Commission (calculated on base price BEFORE fees)
  commissionType: 'percentage' | 'fixed';
  commissionTotal: number;
  agentShare: number; // 2.5% of base OR custom fixed amount
  companyShare: number; // 2.5% of base OR custom fixed amount
  
  // Fees (added AFTER commission calculation)
  vatAmount: number;
  aosFee: number;
  cessionFee: number;
  endowmentFee: number;
  totalFees: number; // Sum of all fees including VAT
  
  // Totals
  totalClientPayment: number; // What client pays: base + fees
  developerGross: number; // Base price (before commission)
  developerNet: number; // Base - commission (what developer receives)
  
  // Summary
  breakdown: {
    clientPays: number;
    developerGets: number;
    agentGets: number;
    companyGets: number;
    vatComponent: number;
    otherFees: number;
  };
}

/**
 * Calculate complete financial breakdown for a stand sale
 * 
 * @param basePrice - Stand base price (before any additions)
 * @param commissionConfig - Commission configuration (5% or $1000 with custom splits)
 * @param feeConfig - Fee configuration (VAT, AOS, Cession, Endowment)
 * @returns Complete financial breakdown
 */
export function calculateFinancialBreakdown(
  basePrice: number,
  commissionConfig: CommissionConfig,
  feeConfig: FeeConfig
): FinancialBreakdown {
  // Validate inputs
  if (basePrice <= 0) {
    throw new Error('Base price must be greater than 0');
  }
  
  // ========================================================================
  // STEP 1: Calculate Commission on BASE PRICE (before VAT/fees)
  // ========================================================================
  let commissionTotal = 0;
  let agentShare = 0;
  let companyShare = 0;
  
  if (commissionConfig.type === 'percentage') {
    // PERCENTAGE MODEL: 5% total split as 2.5% agent + 2.5% company
    const rate = commissionConfig.rate || 5;
    commissionTotal = basePrice * (rate / 100);
    agentShare = basePrice * 2.5 / 100;
    companyShare = basePrice * 2.5 / 100;
  } else {
    // FIXED MODEL: $1000 (or custom) with VARIABLE split
    commissionTotal = commissionConfig.fixedAmount || 1000;
    agentShare = commissionConfig.agentShare || 500; // Default $500 if not specified
    companyShare = commissionConfig.companyShare || 500; // Default $500 if not specified
  }
  
  // ========================================================================
  // STEP 2: Calculate Fees (added to base, NOT included in commission calc)
  // ========================================================================
  const vatAmount = feeConfig.vatEnabled 
    ? basePrice * (feeConfig.vatRate / 100) 
    : 0;
    
  const aosFee = feeConfig.aosEnabled 
    ? feeConfig.aosFee 
    : 0;
    
  const cessionFee = feeConfig.cessionEnabled 
    ? feeConfig.cessionFee 
    : 0;
    
  const endowmentFee = feeConfig.endowmentEnabled 
    ? feeConfig.endowmentFee 
    : 0;
  
  const totalFees = vatAmount + aosFee + cessionFee + endowmentFee;
  
  // ========================================================================
  // STEP 3: Calculate Totals
  // ========================================================================
  const totalClientPayment = basePrice + totalFees; // Client pays: base + all fees
  const developerGross = basePrice; // Gross = base price
  const developerNet = basePrice - commissionTotal; // Net = base - commission
  
  // ========================================================================
  // STEP 4: Build Summary Breakdown
  // ========================================================================
  const breakdown = {
    clientPays: totalClientPayment,
    developerGets: developerNet,
    agentGets: agentShare,
    companyGets: companyShare,
    vatComponent: vatAmount,
    otherFees: aosFee + cessionFee + endowmentFee
  };
  
  // Validation: Ensure numbers reconcile
  const totalDistributed = developerNet + commissionTotal + totalFees;
  const expectedTotal = basePrice + totalFees;
  
  if (Math.abs(totalDistributed - expectedTotal) > 0.01) {
    console.warn('[CommissionCalculator] Reconciliation mismatch:', {
      totalDistributed,
      expectedTotal,
      difference: totalDistributed - expectedTotal
    });
  }
  
  return {
    basePrice,
    commissionType: commissionConfig.type,
    commissionTotal,
    agentShare,
    companyShare,
    vatAmount,
    aosFee,
    cessionFee,
    endowmentFee,
    totalFees,
    totalClientPayment,
    developerGross,
    developerNet,
    breakdown
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Calculate agent commission for a specific sale
 * Used for agent commission tracking
 */
export function calculateAgentCommission(
  basePrice: number,
  commissionConfig: CommissionConfig
): {
  amount: number;
  type: 'percentage' | 'fixed';
  rate?: number;
} {
  if (commissionConfig.type === 'percentage') {
    return {
      amount: basePrice * 2.5 / 100, // Agent gets 2.5%
      type: 'percentage',
      rate: 2.5
    };
  } else {
    return {
      amount: commissionConfig.agentShare || 500, // Default $500
      type: 'fixed'
    };
  }
}

/**
 * Example usage and test cases
 */
export function runCalculationExamples() {
  console.log('='.repeat(80));
  console.log('COMMISSION CALCULATOR - EXAMPLES');
  console.log('='.repeat(80));
  
  // Example 1: 5% Commission Model
  console.log('\n📊 Example 1: 5% Commission Model');
  console.log('-'.repeat(80));
  const example1 = calculateFinancialBreakdown(
    15000, // $15,000 base price
    {
      type: 'percentage',
      rate: 5
    },
    {
      vatEnabled: true,
      vatRate: 15.5,
      aosEnabled: true,
      aosFee: 500,
      cessionEnabled: true,
      cessionFee: 250,
      endowmentEnabled: true,
      endowmentFee: 1800
    }
  );
  
  console.log('Base Price:', formatCurrency(example1.basePrice));
  console.log('Commission (5%):', formatCurrency(example1.commissionTotal));
  console.log('  → Agent Share (2.5%):', formatCurrency(example1.agentShare));
  console.log('  → Company Share (2.5%):', formatCurrency(example1.companyShare));
  console.log('VAT (15.5%):', formatCurrency(example1.vatAmount));
  console.log('AOS Fee:', formatCurrency(example1.aosFee));
  console.log('Cession Fee:', formatCurrency(example1.cessionFee));
  console.log('Endowment Fee:', formatCurrency(example1.endowmentFee));
  console.log('─'.repeat(40));
  console.log('Client Pays:', formatCurrency(example1.totalClientPayment));
  console.log('Developer Gets:', formatCurrency(example1.developerNet));
  
  // Example 2: $1000 Fixed Commission with Custom Split
  console.log('\n\n📊 Example 2: $1000 Fixed Commission (Custom Split)');
  console.log('-'.repeat(80));
  const example2 = calculateFinancialBreakdown(
    20000, // $20,000 base price
    {
      type: 'fixed',
      fixedAmount: 1000,
      agentShare: 600, // Agent gets $600
      companyShare: 400 // Company gets $400
    },
    {
      vatEnabled: true,
      vatRate: 15.5,
      aosEnabled: false,
      aosFee: 0,
      cessionEnabled: false,
      cessionFee: 0,
      endowmentEnabled: true,
      endowmentFee: 2000
    }
  );
  
  console.log('Base Price:', formatCurrency(example2.basePrice));
  console.log('Commission ($1000 fixed):', formatCurrency(example2.commissionTotal));
  console.log('  → Agent Share:', formatCurrency(example2.agentShare));
  console.log('  → Company Share:', formatCurrency(example2.companyShare));
  console.log('VAT (15.5%):', formatCurrency(example2.vatAmount));
  console.log('Endowment Fee:', formatCurrency(example2.endowmentFee));
  console.log('─'.repeat(40));
  console.log('Client Pays:', formatCurrency(example2.totalClientPayment));
  console.log('Developer Gets:', formatCurrency(example2.developerNet));
  
  console.log('\n' + '='.repeat(80));
}
