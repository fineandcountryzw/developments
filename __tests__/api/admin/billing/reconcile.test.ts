/**
 * API Tests: Admin Billing Reconcile
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/billing', () => ({
  BillingAllocationService: {
    reconcile: jest.fn(),
  },
}));

jest.mock('@/lib/logger');

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    installmentPlan: {
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/admin/billing/reconcile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns reconciliation reports for a payment', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { BillingAllocationService } = await import('@/lib/billing');
    const { GET } = await import('@/app/api/admin/billing/reconcile/route');

    (requireAdmin as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
    (BillingAllocationService.reconcile as jest.Mock).mockResolvedValue([
      {
        paymentId: 'pay-1',
        paymentAmount: 500,
        totalAllocated: 250,
        discrepancy: 250,
        status: 'UNDER_ALLOCATED',
        installmentPlanId: 'plan-1',
        planTotalPaid: null,
        sumOfInstallmentPayments: null,
        planDiscrepancy: null,
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/billing/reconcile?paymentId=pay-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.reports).toHaveLength(1);
  });
});
