/**
 * Browser-Compatible Demo Data Generator
 * 
 * This provides mock demo data that can be used directly in the browser
 * without database access. Perfect for development and testing.
 */

import type { 
  Profile, 
  Development, 
  Stand, 
  Client, 
  Sale, 
  Payment,
  Notification 
} from '../types';

// Generate unique IDs
const generateId = () => `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// DEMO USERS
// ============================================

export const demoProfiles: Profile[] = [
  {
    id: 'user-admin-1',
    role: 'Admin',
    name: 'Admin User',
    email: '[email protected]',
    phone: '+263 242 123 456',
    assignedBranch: 'Harare',
    status: 'Active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'user-agent-1',
    role: 'Agent',
    name: 'John Moyo',
    email: '[email protected]',
    phone: '+263 77 123 4567',
    assignedBranch: 'Harare',
    status: 'Active',
    lastLogin: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    totalSalesCount: 12,
    totalRealizedCommission: 24500,
  },
  {
    id: 'user-agent-2',
    role: 'Agent',
    name: 'Sarah Ncube',
    email: '[email protected]',
    phone: '+263 77 234 5678',
    assignedBranch: 'Bulawayo',
    status: 'Active',
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    totalSalesCount: 8,
    totalRealizedCommission: 18200,
  },
];

export const demoClients: Client[] = [
  {
    id: 'client-1',
    name: 'Michael Chikwanha',
    email: '[email protected]',
    phone: '+263 77 345 6789',
    nationalId: '63-123456A78',
    isPortalUser: true,
    kyc: [
      { id: 'kyc-1', documentType: 'ID', status: 'Verified', uploadedAt: '2025-12-20' },
      { id: 'kyc-2', documentType: 'Residence', status: 'Verified', uploadedAt: '2025-12-21' },
    ],
    ownedStands: ['stand-bb-001'],
    branch: 'Harare',
  },
  {
    id: 'client-2',
    name: 'Grace Mutasa',
    email: '[email protected]',
    phone: '+263 77 456 7890',
    nationalId: '63-234567B89',
    isPortalUser: true,
    kyc: [
      { id: 'kyc-3', documentType: 'ID', status: 'Verified', uploadedAt: '2025-12-22' },
    ],
    ownedStands: ['stand-vf-003'],
    branch: 'Harare',
  },
  {
    id: 'client-3',
    name: 'David Sibanda',
    email: '[email protected]',
    phone: '+263 77 567 8901',
    nationalId: '63-345678C90',
    isPortalUser: false,
    kyc: [
      { id: 'kyc-4', documentType: 'ID', status: 'Pending', uploadedAt: '2025-12-27' },
    ],
    ownedStands: [],
    branch: 'Bulawayo',
  },
];

// ============================================
// DEMO DEVELOPMENTS
// ============================================

export const demoDevelopments: Development[] = [
  {
    id: 'dev-1',
    name: 'Borrowdale Brooke Estate',
    locationName: 'Borrowdale, Harare',
    description: 'Premium residential estate in the heart of Borrowdale featuring serviced stands with water, electricity, and tarred roads.',
    vision: 'Creating Zimbabwe\'s premier residential community',
    statistics: ['45 Total Stands', '100% Serviced', 'Gated Security', 'Underground Cables'],
    investmentHighlights: [
      'Prime Location in Borrowdale',
      'Full Municipal Services',
      'Capital Appreciation Potential',
      'Flexible Payment Terms',
    ],
    basePrice: 85000,
    vatPercentage: 15,
    vatStatus: 'Inclusive',
    endowmentFee: 2500,
    paymentTermsDescription: '20% deposit, balance over 24 months',
    phase: 'READY_TO_BUILD',
    depositRequired: 17000,
    maxInstallments: 24,
    minDepositPercentage: 20,
    defaultInstallmentPeriod: 30,
    interestRate: 0,
    allowBankTransferSurcharge: true,
    latitude: -17.78825,
    longitude: 31.05389,
    imageUrls: [
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
    ],
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400',
    documentUrls: [],
    status: 'Active',
    createdAt: '2025-10-01',
    branch: 'Harare',
    infrastructureJson: {
      water: ['Municipal water', 'Backup borehole'],
      sewer: ['Municipal sewer'],
      power: ['ZESA grid', 'Underground cables'],
      roads: ['Tarred roads', 'Street lighting'],
      security: ['Gated entrance', '24/7 security'],
      connectivity: ['Fiber ready'],
    },
    infrastructureProgress: { roads: 100, water: 100, power: 100 },
    completionStatus: 100,
    pricePerSqm: 125,
    totalAreaSqm: 36000,
    marketingBadgeType: 'On Promotion',
  },
  {
    id: 'dev-2',
    name: 'Victoria Falls View',
    locationName: 'Victoria Falls',
    description: 'Exclusive residential development with panoramic views of Victoria Falls mist.',
    phase: 'SERVICING',
    basePrice: 125000,
    vatPercentage: 15,
    vatStatus: 'Inclusive',
    endowmentFee: 3500,
    paymentTermsDescription: '25% deposit, balance over 36 months',
    depositRequired: 31250,
    maxInstallments: 36,
    minDepositPercentage: 25,
    defaultInstallmentPeriod: 30,
    interestRate: 0,
    allowBankTransferSurcharge: true,
    latitude: -17.9243,
    longitude: 25.8572,
    imageUrls: ['https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800'],
    documentUrls: [],
    status: 'Active',
    createdAt: '2025-09-15',
    branch: 'Harare',
    infrastructureJson: {
      water: ['Borehole', 'Municipal backup'],
      sewer: ['Septic tanks'],
      power: ['ZESA grid'],
      roads: ['Gravel roads - tarring in progress'],
      security: ['Perimeter fence'],
      connectivity: ['Mobile coverage'],
    },
    infrastructureProgress: { roads: 65, water: 80, power: 90 },
    completionStatus: 65,
    pricePerSqm: 175,
    totalAreaSqm: 60000,
    marketingBadgeType: 'Coming Soon',
  },
  {
    id: 'dev-3',
    name: 'Bulawayo Heights',
    locationName: 'Burnside, Bulawayo',
    description: 'Modern estate in Bulawayo\'s premier suburb with gated security.',
    phase: 'READY_TO_BUILD',
    basePrice: 55000,
    vatPercentage: 15,
    vatStatus: 'Inclusive',
    endowmentFee: 1800,
    paymentTermsDescription: '20% deposit, balance over 18 months',
    depositRequired: 11000,
    maxInstallments: 18,
    minDepositPercentage: 20,
    defaultInstallmentPeriod: 30,
    interestRate: 0,
    allowBankTransferSurcharge: false,
    latitude: -20.1500,
    longitude: 28.5833,
    imageUrls: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'],
    documentUrls: [],
    status: 'Active',
    createdAt: '2025-11-01',
    branch: 'Bulawayo',
    infrastructureJson: {
      water: ['Municipal water', 'Borehole backup'],
      sewer: ['Municipal sewer'],
      power: ['ZESA grid'],
      roads: ['Tarred roads'],
      security: ['Gated entrance', 'Electric fence'],
      connectivity: ['Fiber available'],
    },
    infrastructureProgress: { roads: 90, water: 100, power: 95 },
    completionStatus: 90,
    pricePerSqm: 95,
    totalAreaSqm: 30400,
    marketingBadgeType: 'None',
  },
  {
    id: 'dev-4',
    name: 'Greendale Gardens',
    locationName: 'Greendale, Harare',
    description: 'Affordable housing project perfect for first-time homeowners.',
    phase: 'READY_TO_BUILD',
    basePrice: 42000,
    vatPercentage: 15,
    vatStatus: 'Inclusive',
    endowmentFee: 1200,
    paymentTermsDescription: '15% deposit, balance over 24 months',
    depositRequired: 6300,
    maxInstallments: 24,
    minDepositPercentage: 15,
    defaultInstallmentPeriod: 30,
    interestRate: 0,
    allowBankTransferSurcharge: false,
    latitude: -17.8252,
    longitude: 31.0545,
    imageUrls: ['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'],
    documentUrls: [],
    status: 'Active',
    createdAt: '2025-08-10',
    branch: 'Harare',
    infrastructureJson: {
      water: ['Municipal water'],
      sewer: ['Municipal sewer'],
      power: ['ZESA grid'],
      roads: ['Gravel roads'],
      security: ['Perimeter wall'],
      connectivity: ['Mobile coverage'],
    },
    infrastructureProgress: { roads: 100, water: 100, power: 100 },
    completionStatus: 100,
    pricePerSqm: 70,
    totalAreaSqm: 28600,
    marketingBadgeType: 'None',
  },
];

// ============================================
// DEMO STANDS
// ============================================

export const demoStands: Stand[] = [
  // Borrowdale Brooke Estate
  {
    id: 'stand-bb-001',
    number: 'BB001',
    developmentId: 'dev-1',
    developmentName: 'Borrowdale Brooke Estate',
    priceUsd: 85000,
    areaSqm: 800,
    status: 'SOLD',
    coordinates: [[-17.78825, 31.05389], [-17.78835, 31.05389], [-17.78835, 31.05399], [-17.78825, 31.05399]],
    branch: 'Harare',
    agentName: 'John Moyo',
  },
  {
    id: 'stand-bb-002',
    number: 'BB002',
    developmentId: 'dev-1',
    developmentName: 'Borrowdale Brooke Estate',
    priceUsd: 86000,
    areaSqm: 810,
    status: 'RESERVED',
    pipelineStage: 'RESERVATION',
    reservationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    reservedBy: 'Michael Chikwanha',
    coordinates: [[-17.78825, 31.05400], [-17.78835, 31.05400], [-17.78835, 31.05410], [-17.78825, 31.05410]],
    branch: 'Harare',
    agentName: 'John Moyo',
  },
  {
    id: 'stand-bb-003',
    number: 'BB003',
    developmentId: 'dev-1',
    developmentName: 'Borrowdale Brooke Estate',
    priceUsd: 87000,
    areaSqm: 820,
    status: 'AVAILABLE',
    coordinates: [[-17.78825, 31.05411], [-17.78835, 31.05411], [-17.78835, 31.05421], [-17.78825, 31.05421]],
    branch: 'Harare',
  },
  // Victoria Falls View
  {
    id: 'stand-vf-001',
    number: 'VF001',
    developmentId: 'dev-2',
    developmentName: 'Victoria Falls View',
    priceUsd: 125000,
    areaSqm: 1000,
    status: 'AVAILABLE',
    coordinates: [[-17.9243, 25.8572], [-17.9253, 25.8572], [-17.9253, 25.8582], [-17.9243, 25.8582]],
    branch: 'Harare',
  },
  {
    id: 'stand-vf-002',
    number: 'VF002',
    developmentId: 'dev-2',
    developmentName: 'Victoria Falls View',
    priceUsd: 126500,
    areaSqm: 1015,
    status: 'RESERVED',
    pipelineStage: 'OFFER LETTER',
    reservedBy: 'Grace Mutasa',
    coordinates: [[-17.9243, 25.8583], [-17.9253, 25.8583], [-17.9253, 25.8593], [-17.9243, 25.8593]],
    branch: 'Harare',
    agentName: 'Sarah Ncube',
  },
  // Bulawayo Heights
  {
    id: 'stand-bh-001',
    number: 'BH001',
    developmentId: 'dev-3',
    developmentName: 'Bulawayo Heights',
    priceUsd: 55000,
    areaSqm: 650,
    status: 'AVAILABLE',
    coordinates: [[-20.1500, 28.5833], [-20.1510, 28.5833], [-20.1510, 28.5843], [-20.1500, 28.5843]],
    branch: 'Bulawayo',
  },
];

// ============================================
// DEMO NOTIFICATIONS
// ============================================

export const demoNotifications: Notification[] = [
  {
    id: 'notif-1',
    recipientType: 'Agent',
    recipientId: 'John Moyo',
    message: 'New reservation expiring in 2 hours for Borrowdale Brooke Estate',
    branch: 'Harare',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    metadata: {
      developmentName: 'Borrowdale Brooke Estate',
      standNumber: 'BB002',
      standId: 'stand-bb-002',
    },
  },
  {
    id: 'notif-2',
    recipientType: 'Client',
    recipientId: 'client-2',
    message: 'Your reservation has been confirmed for Victoria Falls View',
    branch: 'Harare',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metadata: {
      developmentName: 'Victoria Falls View',
      standNumber: 'VF002',
      newStage: 'OFFER LETTER',
    },
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all demo data
 */
export function getAllDemoData() {
  return {
    profiles: demoProfiles,
    clients: demoClients,
    developments: demoDevelopments,
    stands: demoStands,
    notifications: demoNotifications,
  };
}

/**
 * Get development by ID
 */
export function getDemoDevelopmentById(id: string) {
  return demoDevelopments.find(d => d.id === id);
}

/**
 * Get stands by development
 */
export function getDemoStandsByDevelopment(developmentId: string) {
  return demoStands.filter(s => s.developmentId === developmentId);
}

/**
 * Get available stands count
 */
export function getDemoAvailableStandsCount(developmentId: string) {
  return demoStands.filter(
    s => s.developmentId === developmentId && s.status === 'AVAILABLE'
  ).length;
}

/**
 * Initialize demo data in browser storage
 */
export function initDemoData() {
  if (typeof window === 'undefined') return;
  
  const demoData = getAllDemoData();
  localStorage.setItem('demo_data', JSON.stringify(demoData));
  localStorage.setItem('demo_mode', 'true');
  
  console.log('[DEMO] Demo data initialized:', {
    profiles: demoData.profiles.length,
    clients: demoData.clients.length,
    developments: demoData.developments.length,
    stands: demoData.stands.length,
  });
}

/**
 * Check if in demo mode
 */
export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('demo_mode') === 'true';
}

/**
 * Clear demo data
 */
export function clearDemoData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('demo_data');
  localStorage.removeItem('demo_mode');
  console.log('[DEMO] Demo data cleared');
}
