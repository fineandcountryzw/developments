/**
 * API Tests: Admin Installments
 * 
 * Tests for /api/admin/installments endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
  requireManager: jest.fn(),
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    installmentPlan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    installment: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    stand: {
      findUnique: jest.fn(),
    },
    development: {
      findUnique: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/logger');

describe('GET /api/admin/installments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { getAuthenticatedUser } = await import('@/lib/adminAuth');
    const { GET } = await import('@/app/api/admin/installments/route');
    
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/installments');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Authentication required');
  });

  it('should return 403 for unauthorized role', async () => {
    const { getAuthenticatedUser } = await import('@/lib/adminAuth');
    const { GET } = await import('@/app/api/admin/installments/route');
    
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'CLIENT',
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments');
    const response = await GET(request);
    
    expect(response.status).toBe(403);
  });

  it('should return installment plans for admin', async () => {
    const { getAuthenticatedUser } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/installments/route');

    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
    });

    const mockPlans = [
      {
        id: 'plan-1',
        clientId: 'client-1',
        standId: 'stand-1',
        developmentId: 'dev-1',
        totalAmount: 50000,
        depositAmount: 15000,
        depositPaid: true,
        balanceAmount: 35000,
        periodMonths: 24,
        monthlyAmount: 1458.33,
        totalPaid: 15000,
        remainingBalance: 35000,
        paidInstallments: 0,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
        client: { id: 'client-1', name: 'Test Client', email: 'test@test.com', phone: '123', branch: 'Harare' },
        development: { id: 'dev-1', name: 'Test Dev', location: 'Harare', basePrice: 50000 },
        stand: { id: 'stand-1', standNumber: 'A1', price: 50000 },
        installments: [
          { id: 'inst-1', installmentNo: 1, amountDue: 1458.33, amountPaid: 0, dueDate: new Date(), status: 'PENDING', receipt: null },
        ],
      },
    ];

    (prisma.installmentPlan.findMany as jest.Mock).mockResolvedValue(mockPlans);

    const request = new NextRequest('http://localhost:3000/api/admin/installments');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data).toHaveLength(1);
    expect(data.data.stats.totalPlans).toBe(1);
    expect(data.data.stats.activePlans).toBe(1);
  });

  it('should filter by branch via client relation', async () => {
    const { getAuthenticatedUser } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/installments/route');

    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
    });

    (prisma.installmentPlan.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/admin/installments?branch=Bulawayo');
    await GET(request);

    expect(prisma.installmentPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client: { branch: 'Bulawayo' },
        }),
      })
    );
  });

  it('should allow ACCOUNT role access', async () => {
    const { getAuthenticatedUser } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/installments/route');

    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'accountant-1',
      role: 'ACCOUNT',
    });

    (prisma.installmentPlan.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/admin/installments');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

describe('POST /api/admin/installments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not admin', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/admin/installments/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing required fields', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/admin/installments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        // Missing other required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 404 if stand not found', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/installments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.stand.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        standId: 'non-existent',
        developmentId: 'dev-1',
        totalAmount: 50000,
        periodMonths: 24,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Stand not found');
  });

  it('should return 400 if total amount does not match stand price', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/installments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'stand-1',
      price: 50000,
      standNumber: 'A1',
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        standId: 'stand-1',
        developmentId: 'dev-1',
        totalAmount: 40000, // Mismatch!
        periodMonths: 24,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('does not match stand price');
  });
});

describe('DELETE /api/admin/installments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not manager or admin', async () => {
    const { NextResponse } = await import('next/server');
    const { requireManager } = await import('@/lib/adminAuth');
    const { DELETE } = await import('@/app/api/admin/installments/route');
    
    (requireManager as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized", code: "MANAGER_REQUIRED" },
        { status: 403 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'plan-1' }),
    });

    const response = await DELETE(request);
    
    expect(response.status).toBe(403);
  });

  it('should return 400 if plan ID is missing', async () => {
    const { requireManager } = await import('@/lib/adminAuth');
    const { DELETE } = await import('@/app/api/admin/installments/route');

    (requireManager as jest.Mock).mockResolvedValue({
      user: { id: 'manager-1', role: 'MANAGER', email: 'manager@test.com' },
    });

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ID is required');
  });

  it('should return 404 if plan not found', async () => {
    const { requireManager } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { DELETE } = await import('@/app/api/admin/installments/route');

    (requireManager as jest.Mock).mockResolvedValue({
      user: { id: 'manager-1', role: 'MANAGER' },
    });

    (prisma.installmentPlan.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/installments', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'non-existent' }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });
});
