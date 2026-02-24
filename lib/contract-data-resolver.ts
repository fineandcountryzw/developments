/**
 * Contract Data Resolver
 * 
 * Fetches and resolves data for contract template variables.
 * Automatically retrieves Stand → Development → Client data with eager loading.
 * Calculates pricing values (VAT, deposit, fees) based on Development Wizard settings.
 * 
 * @module lib/contract-data-resolver
 */

import prisma from './prisma';
import type { Stand, Development, Client, Reservation } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved data for all merge tag namespaces
 */
export interface ResolvedContractData {
  /** Client information */
  client: {
    fullName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    nationalId?: string;
    address?: string;
  };
  /** Stand details */
  stand: {
    number: string;
    price: string;
    sizeSqm?: string;
    status: string;
  };
  /** Development/Estate information */
  development: {
    name: string;
    location: string;
    description?: string;
    developerName?: string;
    developerEmail?: string;
    developerPhone?: string;
    lawyerName?: string;
    lawyerEmail?: string;
    lawyerPhone?: string;
  };
  /** Payment terms from Development Wizard */
  terms: {
    depositPercentage: string;
    vatEnabled: string;
    vatPercentage: string;
    endowmentEnabled: string;
    endowmentFee: string;
    aosEnabled: string;
    aosFee: string;
    cessionsEnabled: string;
    cessionFee: string;
    adminFeeEnabled: string;
    adminFee: string;
    installmentPeriods: string;
  };
  /** Calculated pricing values */
  pricing: {
    vatAmount: string;
    depositAmount: string;
    endowmentAmount: string;
    aosAmount: string;
    cessionAmount: string;
    adminAmount: string;
    grandTotal: string;
    balanceAfterDeposit: string;
  };
  /** Contract metadata */
  contract: {
    date: string;
    timestamp: string;
    id: string;
  };
}

/**
 * Options for data resolution
 */
export interface ResolveOptions {
  /** Include calculated pricing fields */
  includePricing?: boolean;
  /** Format for currency values */
  currencyFormat?: 'USD' | 'ZWL' | 'number';
  /** Date format for contract dates */
  dateFormat?: 'long' | 'short' | 'ISO';
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ResolveOptions = {
  includePricing: true,
  currencyFormat: 'USD',
  dateFormat: 'long'
};

// ============================================================================
// Main Resolver Functions
// ============================================================================

/**
 * Resolve all contract data for a given stand ID
 * 
 * Fetches stand → development → client in a single query with eager loading.
 * Calculates all pricing values based on Development Wizard settings.
 * 
 * @param standId - The stand ID to resolve data for
 * @param options - Optional resolution configuration
 * @returns Fully resolved contract data
 * @throws Error if stand not found or missing required relations
 */
export async function resolveContractData(
  standId: string,
  options: ResolveOptions = {}
): Promise<ResolvedContractData> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Fetch stand with all relations in single query
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: {
      development: {
        select: {
          id: true,
          name: true,
          location: true,
          description: true,
          developerName: true,
          developerEmail: true,
          developerPhone: true,
          lawyerName: true,
          lawyerEmail: true,
          lawyerPhone: true,
          vatEnabled: true,
          vatPercentage: true,
          depositPercentage: true,
          endowmentEnabled: true,
          endowmentFee: true,
          aosEnabled: true,
          aosFee: true,
          cessionsEnabled: true,
          cessionFee: true,
          adminFeeEnabled: true,
          adminFee: true,
          installmentPeriods: true
        }
      },
      reservations: {
        where: {
          status: {
            in: ['CONFIRMED', 'PENDING']
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              nationalId: true
            }
          }
        }
      }
    }
  });

  if (!stand) {
    throw new Error(`Stand not found: ${standId}`);
  }

  // Get client from most recent reservation
  const client = stand.reservations[0]?.client;
  
  if (!client) {
    throw new Error(`No client found for stand: ${standId}`);
  }

  // Validate required development fields
  const development = stand.development as unknown as Development;
  const missingFields: string[] = [];
  
  if (!development.name) missingFields.push('name');
  if (!development.location) missingFields.push('location');
  if (!development.developerName) missingFields.push('developerName');
  if (!development.developerEmail) missingFields.push('developerEmail');
  
  if (missingFields.length > 0) {
    throw new Error(
      `Development is missing required fields for contract generation: ${missingFields.join(', ')}. ` +
      `Please update the development before generating contracts.`
    );
  }

  // Calculate pricing
  const pricing = mergedOptions.includePricing
    ? calculatePricing(stand.price, development)
    : null;

  // Format and return resolved data
  return {
    client: formatClientData(client),
    stand: formatStandData(stand),
    development: formatDevelopmentData(stand.development as unknown as Development),
    terms: formatTermsData(stand.development as unknown as Development),
    pricing: pricing || formatEmptyPricing(),
    contract: formatContractData()
  };
}

/**
 * Resolve data for multiple stands (batch operation)
 * 
 * @param standIds - Array of stand IDs
 * @param options - Optional resolution configuration
 * @returns Map of standId to resolved data
 */
export async function resolveContractDataBatch(
  standIds: string[],
  options: ResolveOptions = {}
): Promise<Map<string, ResolvedContractData>> {
  const results = new Map<string, ResolvedContractData>();
  
  // Fetch all stands in a single query
  const stands = await prisma.stand.findMany({
    where: {
      id: { in: standIds }
    },
    include: {
      development: {
        select: {
          id: true,
          name: true,
          location: true,
          description: true,
          developerName: true,
          developerEmail: true,
          developerPhone: true,
          lawyerName: true,
          lawyerEmail: true,
          lawyerPhone: true,
          vatEnabled: true,
          vatPercentage: true,
          depositPercentage: true,
          endowmentEnabled: true,
          endowmentFee: true,
          aosEnabled: true,
          aosFee: true,
          cessionsEnabled: true,
          cessionFee: true,
          adminFeeEnabled: true,
          adminFee: true,
          installmentPeriods: true
        }
      },
      reservations: {
        where: {
          status: {
            in: ['CONFIRMED', 'PENDING']
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              nationalId: true
            }
          }
        }
      }
    }
  });

  for (const stand of stands) {
    const client = stand.reservations[0]?.client;
    
    if (!client) {
      console.warn(`No client found for stand: ${stand.id}`);
      continue;
    }

    const pricing = options.includePricing
      ? calculatePricing(stand.price, stand.development as unknown as Development)
      : null;

    results.set(stand.id, {
      client: formatClientData(client),
      stand: formatStandData(stand),
      development: formatDevelopmentData(stand.development as unknown as Development),
      terms: formatTermsData(stand.development as unknown as Development),
      pricing: pricing || formatEmptyPricing(),
      contract: formatContractData()
    });
  }

  return results;
}

/**
 * Preview variable values without full resolution
 * 
 * @param standId - The stand ID to preview
 * @returns Object with sample values for each namespace
 */
export async function previewContractVariables(
  standId: string
): Promise<Record<string, Record<string, string>>> {
  const data = await resolveContractData(standId);
  
  return {
    client: data.client,
    stand: data.stand,
    development: data.development,
    terms: data.terms,
    pricing: data.pricing,
    contract: data.contract
  };
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate all pricing values based on Development Wizard settings
 */
function calculatePricing(
  standPrice: Stand['price'],
  dev: Development
): ResolvedContractData['pricing'] {
  const price = Number(standPrice);
  
  // VAT calculation
  const vatAmount = dev.vatEnabled 
    ? price * (Number(dev.vatPercentage) / 100)
    : 0;
  
  // Deposit calculation
  const depositAmount = price * (Number(dev.depositPercentage) / 100);
  
  // Optional fees
  const endowmentAmount = dev.endowmentEnabled ? Number(dev.endowmentFee) : 0;
  const aosAmount = dev.aosEnabled ? Number(dev.aosFee) : 0;
  const cessionAmount = dev.cessionsEnabled ? Number(dev.cessionFee) : 0;
  const adminAmount = dev.adminFeeEnabled ? Number(dev.adminFee) : 0;
  
  // Grand total (stand price + VAT + all fees)
  const grandTotal = price + vatAmount + endowmentAmount + aosAmount + cessionAmount + adminAmount;
  
  // Balance after deposit
  const balanceAfterDeposit = grandTotal - depositAmount;
  
  return {
    vatAmount: formatCurrency(vatAmount),
    depositAmount: formatCurrency(depositAmount),
    endowmentAmount: formatCurrency(endowmentAmount),
    aosAmount: formatCurrency(aosAmount),
    cessionAmount: formatCurrency(cessionAmount),
    adminAmount: formatCurrency(adminAmount),
    grandTotal: formatCurrency(grandTotal),
    balanceAfterDeposit: formatCurrency(balanceAfterDeposit)
  };
}

// ============================================================================
// Formatting Functions
// ============================================================================

function formatClientData(client: {
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  nationalId: string | null;
}): ResolvedContractData['client'] {
  return {
    fullName: client.name,
    firstName: client.firstName || undefined,
    lastName: client.lastName || undefined,
    email: client.email,
    phone: client.phone || undefined,
    nationalId: client.nationalId || undefined,
    address: undefined // Not currently stored
  };
}

function formatStandData(stand: {
  standNumber: string;
  price: Stand['price'];
  sizeSqm: Stand['sizeSqm'];
  status: string;
}): ResolvedContractData['stand'] {
  return {
    number: stand.standNumber,
    price: formatCurrency(Number(stand.price)),
    sizeSqm: stand.sizeSqm ? Number(stand.sizeSqm).toString() : undefined,
    status: stand.status
  };
}

function formatDevelopmentData(dev: Development): ResolvedContractData['development'] {
  return {
    name: dev.name,
    location: dev.location,
    description: dev.description || undefined,
    developerName: dev.developerName || undefined,
    developerEmail: dev.developerEmail || undefined,
    developerPhone: dev.developerPhone || undefined,
    lawyerName: dev.lawyerName || undefined,
    lawyerEmail: dev.lawyerEmail || undefined,
    lawyerPhone: dev.lawyerPhone || undefined
  };
}

function formatTermsData(dev: Development): ResolvedContractData['terms'] {
  return {
    depositPercentage: Number(dev.depositPercentage).toString(),
    vatEnabled: dev.vatEnabled ? 'Yes' : 'No',
    vatPercentage: Number(dev.vatPercentage).toString(),
    endowmentEnabled: dev.endowmentEnabled ? 'Yes' : 'No',
    endowmentFee: formatCurrency(Number(dev.endowmentFee)),
    aosEnabled: dev.aosEnabled ? 'Yes' : 'No',
    aosFee: formatCurrency(Number(dev.aosFee)),
    cessionsEnabled: dev.cessionsEnabled ? 'Yes' : 'No',
    cessionFee: formatCurrency(Number(dev.cessionFee)),
    adminFeeEnabled: dev.adminFeeEnabled ? 'Yes' : 'No',
    adminFee: formatCurrency(Number(dev.adminFee)),
    installmentPeriods: dev.installmentPeriods.join(', ')
  };
}

function formatContractData(): ResolvedContractData['contract'] {
  const now = new Date();
  
  return {
    date: now.toLocaleDateString('en-ZW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    timestamp: now.toISOString(),
    id: `CNT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  };
}

function formatEmptyPricing(): ResolvedContractData['pricing'] {
  return {
    vatAmount: formatCurrency(0),
    depositAmount: formatCurrency(0),
    endowmentAmount: formatCurrency(0),
    aosAmount: formatCurrency(0),
    cessionAmount: formatCurrency(0),
    adminAmount: formatCurrency(0),
    grandTotal: formatCurrency(0),
    balanceAfterDeposit: formatCurrency(0)
  };
}

/**
 * Format a number as USD currency
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-ZW', {
    style: 'currency',
    currency: 'USD'
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  resolveContractData,
  resolveContractDataBatch,
  previewContractVariables
};