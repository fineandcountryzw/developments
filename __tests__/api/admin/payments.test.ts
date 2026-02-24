/**
 * API Tests: Admin Payments
 * 
 * Tests for /api/admin/payments endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/access-control', () => ({
  requireAdmin: jest.fn(),
  requireAgent: jest.fn(),
}));
jest.mock('@/lib/validation/middleware', () => ({
  validateRequest: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stand: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    installmentPlan: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    installment: {
      findFirst: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');
jest.mock('@/lib/email-service');
jest.mock('@/lib/realtime', () => ({
  broadcastPaymentUpdate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/payment-success-handler', () => ({
  handlePaymentSuccess: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/lib/settlement-calculator', () => ({
  SettlementCalculator: {
    calculatePaymentFees: jest.fn().mockResolvedValue({
      stand_price_portion: 10000,
      vat_amount: 1500,
      cession_amount: 0,
      endowment_amount: 0,
      aos_amount: 0,
      fee_calculation: {},
      development_id: 'dev-1',
    }),
  },
}));

describe('GET /api/admin/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAgent } = await import('@/lib/access-control');
    const { GET } = await import('@/app/api/admin/payments/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/payments');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return payments for authenticated user', async () => {
    const { requireAgent } = await import('@/lib/access-control');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/payments/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    const mockPayments = [
      {
        id: 'pay-1',
        clientId: 'client-1',
        clientName: 'Test Client',
        amount: 5000,
        status: 'PENDING',
        method: 'Cash',
        payment_type: 'Deposit',
        office_location: 'Harare',
        reference: 'REF-001',
        createdAt: new Date(),
        client: { id: 'client-1', name: 'Test Client', email: 'test@example.com' },
        stand: { 
          id: 'stand-1', 
          standNumber: 'A1', 
          status: 'RESERVED',
          price: 10000,
          development: { id: 'dev-1', name: 'Test Dev', location: 'Harare' }
        },
      },
    ];

    (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

    const request = new NextRequest('http://localhost:3000/api/admin/payments?branch=Harare');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // API may return either an array directly (apiSuccess(array)) or a nested key
    const payments = data.data?.data || data.data?.payments || data.data;
    expect(payments).toHaveLength(1);
  });

  it('should filter by branch', async () => {
    const { requireAgent } = await import('@/lib/access-control');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/payments/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/admin/payments?branch=Bulawayo');
    await GET(request);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          officeLocation: 'Bulawayo',
        }),
      })
    );
  });
});

describe('POST /api/admin/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not admin', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/access-control');
    const { POST } = await import('@/app/api/admin/payments/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized – Admin access required", code: "ADMIN_REQUIRED" },
        { status: 403 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        amount: 5000,
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(403);
  });

  it('should return validation error for invalid data', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const { POST } = await import('@/app/api/admin/payments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const { NextResponse } = await import('next/server');
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      error: NextResponse.json(
        { error: "Validation failed", success: false },
        { status: 400 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fields
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
  });

  it('should create payment successfully', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/payments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
    });

    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        clientId: 'client-1',
        clientName: 'Test Client',
        amount: 5000,
        standId: 'stand-1',
        payment_type: 'Deposit',
        method: 'Cash',
        office_location: 'Harare',
        reference: 'REF-001',
        manual_receipt_no: 'REC-001',
      },
    });

    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'stand-1',
      standNumber: 'A1',
      status: 'AVAILABLE',
      developmentId: 'dev-1',
      development: { id: 'dev-1', name: 'Test Dev' },
    });

    const mockPayment = {
      id: 'pay-1',
      clientId: 'client-1',
      clientName: 'Test Client',
      amount: 5000,
      standId: 'stand-1',
      status: 'PENDING',
      payment_type: 'Deposit',
      method: 'Cash',
      office_location: 'Harare',
      reference: 'REF-001',
      client: { email: 'client@test.com' },
      stand: { id: 'stand-1', development: { name: 'Test Dev' } },
    };

    (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
    (prisma.stand.update as jest.Mock).mockResolvedValue({ id: 'stand-1', status: 'SOLD' });
    (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        clientName: 'Test Client',
        amount: 5000,
        standId: 'stand-1',
        payment_type: 'Deposit',
        method: 'Cash',
        office_location: 'Harare',
        reference: 'REF-001',
        manual_receipt_no: 'REC-001',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('pay-1');
  });
});

describe('PUT /api/admin/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update payment status', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const prisma = (await import('@/lib/prisma')).default;
    const { PUT } = await import('@/app/api/admin/payments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      standId: 'stand-1',
      clientId: 'client-1',
    });

    (prisma.payment.update as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      status: 'CONFIRMED',
      office_location: 'Harare',
      clientName: 'Test Client',
      reference: 'REF-001',
      client: null,
    });

    (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'pay-1',
        status: 'CONFIRMED',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('DELETE /api/admin/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should void a payment', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const prisma = (await import('@/lib/prisma')).default;
    const { DELETE } = await import('@/app/api/admin/payments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
    });

    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      office_location: 'Harare',
      clientName: 'Test',
      reference: 'REF-001',
      description: 'Test payment',
    });

    (prisma.payment.update as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      status: 'VOIDED',
      office_location: 'Harare',
    });

    (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'DELETE',
      body: JSON.stringify({
        id: 'pay-1',
        reason: 'Test void',
      }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('voided');
  });

  it('should return 404 for non-existent payment', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const prisma = (await import('@/lib/prisma')).default;
    const { DELETE } = await import('@/app/api/admin/payments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/payments', {
      method: 'DELETE',
      body: JSON.stringify({
        id: 'non-existent',
      }),
    });

    const response = await DELETE(request);
    
    expect(response.status).toBe(404);
  });
});
