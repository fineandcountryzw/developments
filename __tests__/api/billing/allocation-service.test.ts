/**
 * Service Tests: Billing Allocation Service
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    payment: {
      findUnique: jest.fn(),
    },
    paymentAllocation: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    installment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    installmentPlan: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/logger');

describe('BillingAllocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an allocation with transactional checks', async () => {
    const prisma = (await import('@/lib/prisma')).default as any;
    const { BillingAllocationService } = await import('@/lib/billing');

    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({ id: 'pay-1', amount: 500 });
    (prisma.paymentAllocation.findMany as jest.Mock).mockResolvedValue([{ amount: 100 }]);
    (prisma.installment.findUnique as jest.Mock).mockResolvedValue({
      id: 'inst-1',
      amountPaid: 0,
      amountDue: 300,
      paidDate: null,
      planId: 'plan-1',
    });
    (prisma.paymentAllocation.create as jest.Mock).mockResolvedValue({ id: 'alloc-1' });
    (prisma.installment.update as jest.Mock).mockResolvedValue({});
    (prisma.installmentPlan.findUnique as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      totalPaid: 100,
      totalAmount: 1000,
    });
    (prisma.installment.count as jest.Mock).mockResolvedValue(0);
    (prisma.installmentPlan.update as jest.Mock).mockResolvedValue({});

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));

    const result = await BillingAllocationService.createAllocation({
      paymentId: 'pay-1',
      installmentId: 'inst-1',
      amount: 200,
      allocationType: 'MANUAL',
      allocatedBy: 'admin',
    });

    expect(result.success).toBe(true);
    expect(result.allocationId).toBe('alloc-1');
    expect(prisma.paymentAllocation.create).toHaveBeenCalled();
  });

  it('reverses an allocation and updates plan totals', async () => {
    const prisma = (await import('@/lib/prisma')).default as any;
    const { BillingAllocationService } = await import('@/lib/billing');

    (prisma.paymentAllocation.findUnique as jest.Mock).mockResolvedValue({
      id: 'alloc-1',
      amount: 200,
      allocationStatus: 'APPLIED',
      installmentId: 'inst-1',
      installmentPlanId: 'plan-1',
      installment: {
        id: 'inst-1',
        amountPaid: 200,
        amountDue: 300,
        paidDate: null,
        planId: 'plan-1',
      },
    });
    (prisma.paymentAllocation.update as jest.Mock).mockResolvedValue({});
    (prisma.installment.update as jest.Mock).mockResolvedValue({});
    (prisma.installmentPlan.findUnique as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      totalPaid: 500,
      totalAmount: 1000,
    });
    (prisma.installment.count as jest.Mock).mockResolvedValue(0);
    (prisma.installmentPlan.update as jest.Mock).mockResolvedValue({});

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));

    const result = await BillingAllocationService.reverseAllocation('alloc-1', 'admin', 'test');

    expect(result.success).toBe(true);
    expect(prisma.paymentAllocation.update).toHaveBeenCalled();
    expect(prisma.installmentPlan.update).toHaveBeenCalled();
  });
});
