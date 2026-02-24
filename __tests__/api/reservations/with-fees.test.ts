/**
 * API Tests: Reservations With Fees
 * 
 * Tests for /api/reservations/with-fees endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/adminAuth', () => ({
  requireAgent: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    stand: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservation: {
      create: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
  },
}));
jest.mock('@/lib/feeCalculator', () => ({
  FeeCalculator: {
    calculateComplete: jest.fn(() => ({
      totalAmount: 100000,
      depositAmount: 30000,
      installmentAmount: 70000,
      monthlyPayment: 2916.67,
    })),
  },
}));
jest.mock('@/lib/logger');

describe('POST /api/reservations/with-fees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAgent } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'stand-1',
        clientId: 'client-1',
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return 400 if required fields are missing', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'Agent' },
    });

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'stand-1',
        // Missing clientId
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('should return 404 if stand not found', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'Agent' },
    });
    (prisma.stand.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'non-existent',
        clientId: 'client-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Stand not found');
  });

  it('should return 404 if development not found', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'Agent' },
    });
    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'stand-1',
      price: 100000,
      development: null, // No development
    });

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'stand-1',
        clientId: 'client-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Development not found');
  });

  it('should create reservation with fee breakdown successfully', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'Agent' },
    });
    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'stand-1',
      standNumber: 'A1',
      price: 100000,
      development: {
        id: 'dev-1',
        name: 'Test Development',
        depositPercentage: 30,
        installmentPeriods: [12, 24, 48],
      },
    });
    (prisma.reservation.create as jest.Mock).mockResolvedValue({
      id: 'res-1',
      standId: 'stand-1',
      clientId: 'client-1',
      agentId: 'agent-1',
      status: 'PENDING',
      stand: { standNumber: 'A1' },
      client: { name: 'Test Client' },
      agent: { name: 'Test Agent' },
    });
    (prisma.activity.create as jest.Mock).mockResolvedValue({});
    (prisma.stand.update as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'stand-1',
        clientId: 'client-1',
        depositPercent: 30,
        installmentMonths: 24,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.reservation).toBeDefined();
    expect(data.data.feeBreakdown).toBeDefined();
    expect(data.data.feeBreakdown.totalAmount).toBe(100000);
    expect(data.data.feeBreakdown.depositAmount).toBe(30000);
  });

  it('should use development defaults if depositPercent not provided', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/reservations/with-fees/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'Agent' },
    });
    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'stand-1',
      standNumber: 'A1',
      price: 100000,
      development: {
        id: 'dev-1',
        name: 'Test Development',
        depositPercentage: 25, // Development default
        installmentPeriods: [12, 24, 48],
      },
    });
    (prisma.reservation.create as jest.Mock).mockResolvedValue({
      id: 'res-1',
      standId: 'stand-1',
      clientId: 'client-1',
      agentId: 'agent-1',
      status: 'PENDING',
      stand: { standNumber: 'A1' },
      client: { name: 'Test Client' },
      agent: { name: 'Test Agent' },
    });
    (prisma.activity.create as jest.Mock).mockResolvedValue({});
    (prisma.stand.update as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/reservations/with-fees', {
      method: 'POST',
      body: JSON.stringify({
        standId: 'stand-1',
        clientId: 'client-1',
        // No depositPercent - should use development default
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // FeeCalculator should be called with development default (25%)
  });
});
