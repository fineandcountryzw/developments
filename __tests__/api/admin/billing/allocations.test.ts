/**
 * API Tests: Admin Billing Allocations
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    paymentAllocation: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/billing', () => ({
  BillingAllocationService: {
    createAllocation: jest.fn(),
    autoAllocatePayment: jest.fn(),
  },
}));

jest.mock('@/lib/logger');

describe('GET /api/admin/billing/allocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns allocations for admin', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default as any;
    const { GET } = await import('@/app/api/admin/billing/allocations/route');

    (requireAdmin as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
    (prisma.paymentAllocation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'alloc-1',
        paymentId: 'pay-1',
        installmentId: 'inst-1',
        installmentPlanId: 'plan-1',
        amount: 250,
        allocationType: 'MANUAL',
        allocationStatus: 'APPLIED',
        allocatedAt: new Date('2024-01-01T00:00:00Z'),
        allocatedBy: 'admin@example.com',
        notes: 'Test allocation',
        payment: {
          reference: 'PAY-001',
          amount: 250,
          clientName: 'Test Client',
          status: 'CONFIRMED',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        installment: {
          installmentNo: 1,
          amountDue: 500,
          amountPaid: 250,
          status: 'PARTIAL',
          dueDate: new Date('2024-02-01T00:00:00Z'),
        },
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/billing/allocations');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.allocations).toHaveLength(1);
  });
});

describe('POST /api/admin/billing/allocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses manual allocation amounts', async () => {
    const { requireAdmin, getAuthenticatedUser } = await import('@/lib/adminAuth');
    const { BillingAllocationService } = await import('@/lib/billing');
    const { POST } = await import('@/app/api/admin/billing/allocations/route');

    (requireAdmin as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ email: 'admin@example.com' });
    (BillingAllocationService.createAllocation as jest.Mock).mockResolvedValue({
      success: true,
      allocationId: 'alloc-1',
    });

    const request = new NextRequest('http://localhost:3000/api/admin/billing/allocations', {
      method: 'POST',
      body: JSON.stringify({
        paymentId: 'pay-1',
        installmentId: 'inst-1',
        amount: '100.50',
        allocationType: 'MANUAL',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(BillingAllocationService.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100.5 })
    );
  });
});
