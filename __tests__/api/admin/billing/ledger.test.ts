/**
 * API Tests: Admin Billing Ledger
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/billing', () => ({
  BillingAllocationService: {
    getLedger: jest.fn(),
  },
}));

jest.mock('@/lib/logger');

describe('GET /api/admin/billing/ledger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ledger entries and summary', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { BillingAllocationService } = await import('@/lib/billing');
    const { GET } = await import('@/app/api/admin/billing/ledger/route');

    (requireAdmin as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
    (BillingAllocationService.getLedger as jest.Mock).mockResolvedValue([
      {
        id: 'pay-1',
        paymentId: 'pay-1',
        paymentRef: 'PAY-001',
        paymentDate: new Date('2024-01-01T00:00:00Z'),
        paymentAmount: 500,
        paymentStatus: 'CONFIRMED',
        clientId: 'client-1',
        clientName: 'Test Client',
        standId: null,
        developmentName: null,
        allocations: [],
        totalAllocated: 200,
        unallocatedAmount: 300,
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/billing/ledger');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.ledger).toHaveLength(1);
    expect(data.data.summary.totalPayments).toBe(1);
    expect(data.data.summary.totalAllocated).toBe(200);
  });
});
