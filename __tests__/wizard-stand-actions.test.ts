/**
 * Tests for Wizard Stand Actions Service
 * Tests the mark-sold and apply-discount operations.
 */

import { markStandsAsSold, applyStandDiscount, WizardActor } from '../lib/services/wizard-stand-actions';

// Mock Prisma
const mockPrismaStand = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
};

const mockPrismaDevelopment = {
  findUnique: jest.fn(),
};

const mockPrismaStandActionLog = {
  create: jest.fn(),
};

const mockPrismaReservation = {
  updateMany: jest.fn(),
};

const mockPrismaInstallment = {
  update: jest.fn(),
};

const mockPrismaInstallmentPlan = {
  update: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    stand: mockPrismaStand,
    development: mockPrismaDevelopment,
    standActionLog: mockPrismaStandActionLog,
    reservation: mockPrismaReservation,
    installment: mockPrismaInstallment,
    installmentPlan: mockPrismaInstallmentPlan,
    $transaction: jest.fn((fn) => fn({
      stand: mockPrismaStand,
      standActionLog: mockPrismaStandActionLog,
      reservation: mockPrismaReservation,
      installment: mockPrismaInstallment,
      installmentPlan: mockPrismaInstallmentPlan,
    })),
  },
}));

// Mock audit trail
jest.mock('@/lib/auditTrail', () => ({
  logAuditTrail: jest.fn(),
}));

// Mock email service
jest.mock('@/lib/wizard-email-service', () => ({
  sendWizardActionEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockActor: WizardActor = {
  id: 'user-123',
  email: 'admin@example.com',
  name: 'Test Admin',
  role: 'ADMIN',
  branch: 'Harare',
};

describe('Wizard Stand Actions Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('markStandsAsSold', () => {
    const mockDevelopment = {
      id: 'dev-001',
      name: 'Test Development',
      developerEmail: 'dev@example.com',
      developerName: 'Developer Name',
      branch: 'Harare',
    };

    it('should return error for non-existent development', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(null);

      await expect(
        markStandsAsSold(
          {
            developmentId: 'non-existent',
            standNumbers: ['A1'],
            reason: 'Test reason',
          },
          mockActor
        )
      ).rejects.toThrow('Development not found');
    });

    it('should return not-found for stands not in development', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([]);

      const result = await markStandsAsSold(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1', 'A2'],
          reason: 'Test reason',
        },
        mockActor
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('not found');
    });

    it('should skip already sold stands', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'SOLD',
          reservations: [],
          installmentPlans: [],
        },
      ]);

      const result = await markStandsAsSold(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          reason: 'Test reason',
        },
        mockActor
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('already SOLD');
    });

    it('should deduplicate stand numbers', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([]);

      const result = await markStandsAsSold(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1', 'a1', 'A1 ', ' a1'],
          reason: 'Test reason',
        },
        mockActor
      );

      // Should only have 1 unique result (deduplicated)
      expect(result.results).toHaveLength(1);
    });

    it('should successfully mark available stand as sold', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'AVAILABLE',
          reservations: [],
          installmentPlans: [],
        },
      ]);
      mockPrismaStand.findUnique.mockResolvedValue({
        status: 'AVAILABLE',
        updatedAt: new Date(),
      });
      mockPrismaStand.update.mockResolvedValue({ id: 'stand-1' });
      mockPrismaStandActionLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await markStandsAsSold(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          reason: 'Customer payment received',
        },
        mockActor
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].oldStatus).toBe('AVAILABLE');
      expect(result.results[0].newStatus).toBe('SOLD');
    });

    it('should reject blocked/withdrawn stands', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'WITHDRAWN',
          reservations: [],
          installmentPlans: [],
        },
      ]);

      const result = await markStandsAsSold(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          reason: 'Test reason',
        },
        mockActor
      );

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('cannot be marked as sold');
    });
  });

  describe('applyStandDiscount', () => {
    const mockDevelopment = {
      id: 'dev-001',
      name: 'Test Development',
      developerEmail: 'dev@example.com',
      developerName: 'Developer Name',
      branch: 'Harare',
    };

    it('should reject discount percentage out of range', async () => {
      await expect(
        applyStandDiscount(
          {
            developmentId: 'dev-001',
            standNumbers: ['A1'],
            discountPercent: 150,
            reason: 'Test reason',
          },
          mockActor
        )
      ).rejects.toThrow('Discount percentage must be between 0 and 100');
    });

    it('should reject negative discount', async () => {
      await expect(
        applyStandDiscount(
          {
            developmentId: 'dev-001',
            standNumbers: ['A1'],
            discountPercent: -10,
            reason: 'Test reason',
          },
          mockActor
        )
      ).rejects.toThrow('Discount percentage must be between 0 and 100');
    });

    it('should skip stands with same discount already applied (idempotent)', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'AVAILABLE',
          price: { toNumber: () => 50000 },
          discountPercent: { toNumber: () => 15 },
          installmentPlans: [],
        },
      ]);

      const result = await applyStandDiscount(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          discountPercent: 15,
          reason: 'Test reason',
        },
        mockActor
      );

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('already has a 15% discount');
    });

    it('should successfully apply discount to available stand', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'AVAILABLE',
          price: 50000,
          sizeSqm: 500,
          pricePerSqm: 100,
          discountPercent: null,
          discountAmount: null,
          discountedPrice: null,
          installmentPlans: [],
        },
      ]);
      mockPrismaStand.findUnique.mockResolvedValue({
        price: 50000,
        discountPercent: null,
        status: 'AVAILABLE',
      });
      mockPrismaStand.update.mockResolvedValue({ id: 'stand-1' });
      mockPrismaStandActionLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await applyStandDiscount(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          discountPercent: 10,
          reason: 'Promotional discount',
        },
        mockActor
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].oldPrice).toBe(50000);
      expect(result.results[0].newPrice).toBe(45000); // 50000 - 10%
      expect(result.results[0].discountPercent).toBe(10);
      expect(result.results[0].discountAmount).toBe(5000);
    });

    it('should reject discount on withdrawn stands', async () => {
      mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);
      mockPrismaStand.findMany.mockResolvedValue([
        {
          id: 'stand-1',
          standNumber: 'A1',
          status: 'WITHDRAWN',
          price: 50000,
          installmentPlans: [],
        },
      ]);

      const result = await applyStandDiscount(
        {
          developmentId: 'dev-001',
          standNumbers: ['A1'],
          discountPercent: 10,
          reason: 'Test reason',
        },
        mockActor
      );

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('cannot be discounted');
    });
  });
});

describe('Input Validation', () => {
  it('should handle empty stand numbers gracefully', async () => {
    const mockDevelopment = {
      id: 'dev-001',
      name: 'Test Development',
      developerEmail: null,
      developerName: null,
      branch: 'Harare',
    };

    mockPrismaDevelopment.findUnique.mockResolvedValue(mockDevelopment);

    const result = await markStandsAsSold(
      {
        developmentId: 'dev-001',
        standNumbers: ['', '  ', '\n'],
        reason: 'Test',
      },
      mockActor
    );

    // All empty, so 0 results after filtering
    expect(result.results).toHaveLength(0);
  });
});
