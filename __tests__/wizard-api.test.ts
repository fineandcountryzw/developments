/**
 * Integration Tests for Wizard API Endpoints
 * Tests the /api/wizard/stands/* endpoints.
 */

import { NextRequest } from 'next/server';
import { POST as markSoldHandler } from '../app/api/wizard/stands/mark-sold/route';
import { POST as applyDiscountHandler } from '../app/api/wizard/stands/apply-discount/route';
import { POST as validateHandler } from '../app/api/wizard/stands/validate/route';

// Mock auth
jest.mock('../lib/access-control', () => ({
  requireManager: jest.fn(),
}));

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    development: {
      findUnique: jest.fn(),
    },
    stand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    standActionLog: {
      create: jest.fn(),
    },
    reservation: {
      updateMany: jest.fn(),
    },
    installment: {
      update: jest.fn(),
    },
    installmentPlan: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock audit
jest.mock('../lib/auditTrail', () => ({
  logAuditTrail: jest.fn(),
}));

// Mock email
jest.mock('../lib/wizard-email-service', () => ({
  sendWizardActionEmail: jest.fn().mockResolvedValue(undefined),
}));

import { requireManager } from '../lib/access-control';
import prisma from '../lib/prisma';

const mockRequireManager = requireManager as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function createRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/wizard/stands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/wizard/stands/mark-sold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireManager.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    });
  });

  it('should return 401 if not authenticated', async () => {
    mockRequireManager.mockResolvedValue({
      error: { status: 401 },
    });

    const request = createRequest({});
    const response = await markSoldHandler(request);

    expect(response.status).toBe(401);
  });

  it('should return 400 if developmentId is missing', async () => {
    const request = createRequest({
      standNumbers: ['A1'],
      reason: 'Test',
    });

    const response = await markSoldHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('developmentId');
  });

  it('should return 400 if standNumbers is empty', async () => {
    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: [],
      reason: 'Test',
    });

    const response = await markSoldHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('standNumbers');
  });

  it('should return 400 if reason is too short', async () => {
    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      reason: 'ab',
    });

    const response = await markSoldHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('reason');
  });

  it('should return 400 if more than 100 stands', async () => {
    const manyStands = Array.from({ length: 101 }, (_, i) => `A${i + 1}`);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: manyStands,
      reason: 'Test reason',
    });

    const response = await markSoldHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('100');
  });
});

describe('POST /api/wizard/stands/apply-discount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireManager.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    });
  });

  it('should return 400 for invalid discount percentage', async () => {
    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      discountPercent: 150,
      reason: 'Test reason',
    });

    const response = await applyDiscountHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('discountPercent');
  });

  it('should return 400 for negative discount', async () => {
    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      discountPercent: -5,
      reason: 'Test reason',
    });

    const response = await applyDiscountHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('discountPercent');
  });

  it('should return 400 for invalid effectiveAt date', async () => {
    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      discountPercent: 10,
      reason: 'Test reason',
      effectiveAt: 'not-a-date',
    });

    const response = await applyDiscountHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('effectiveAt');
  });

  it('should accept valid effectiveAt ISO date', async () => {
    mockPrisma.development.findUnique.mockResolvedValue({
      id: 'dev-1',
      name: 'Test Dev',
      branch: 'Harare',
    } as any);
    mockPrisma.stand.findMany.mockResolvedValue([]);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      discountPercent: 10,
      reason: 'Test reason',
      effectiveAt: '2025-06-15T00:00:00.000Z',
    });

    const response = await applyDiscountHandler(request);
    // Should pass validation (may fail on finding stands, but that's fine)
    expect(response.status).not.toBe(400);
  });
});

describe('POST /api/wizard/stands/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireManager.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    });
  });

  it('should return validation summary for stand numbers', async () => {
    mockPrisma.stand.findMany.mockResolvedValue([
      {
        id: 'stand-1',
        standNumber: 'A1',
        status: 'AVAILABLE',
        price: 50000,
        pricePerSqm: 100,
        sizeSqm: 500,
        discountPercent: null,
        discountAmount: null,
        discountedPrice: null,
        discountActive: true,
        soldAt: null,
        reservedBy: null,
      },
      {
        id: 'stand-2',
        standNumber: 'A2',
        status: 'SOLD',
        price: 60000,
        pricePerSqm: 120,
        sizeSqm: 500,
        discountPercent: null,
        discountAmount: null,
        discountedPrice: null,
        discountActive: true,
        soldAt: new Date(),
        reservedBy: null,
      },
    ] as any);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1', 'A2', 'A3'],
    });

    const response = await validateHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stands).toHaveLength(2);
    expect(data.data.notFound).toEqual(['A3']);
    expect(data.data.summary.found).toBe(2);
    expect(data.data.summary.notFound).toBe(1);
  });

  it('should mark canSell correctly based on status', async () => {
    mockPrisma.stand.findMany.mockResolvedValue([
      { id: '1', standNumber: 'A1', status: 'AVAILABLE' },
      { id: '2', standNumber: 'A2', status: 'RESERVED' },
      { id: '3', standNumber: 'A3', status: 'SOLD' },
      { id: '4', standNumber: 'A4', status: 'WITHDRAWN' },
    ] as any);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1', 'A2', 'A3', 'A4'],
    });

    const response = await validateHandler(request);
    const data = await response.json();

    const stands = data.data.stands;
    expect(stands.find((s: any) => s.standNumber === 'A1').canSell).toBe(true);
    expect(stands.find((s: any) => s.standNumber === 'A2').canSell).toBe(true);
    expect(stands.find((s: any) => s.standNumber === 'A3').canSell).toBe(false);
    expect(stands.find((s: any) => s.standNumber === 'A4').canSell).toBe(false);
  });

  it('should mark canDiscount correctly based on status', async () => {
    mockPrisma.stand.findMany.mockResolvedValue([
      { id: '1', standNumber: 'A1', status: 'AVAILABLE' },
      { id: '2', standNumber: 'A2', status: 'SOLD' },
      { id: '3', standNumber: 'A3', status: 'WITHDRAWN' },
      { id: '4', standNumber: 'A4', status: 'CANCELLED' },
    ] as any);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1', 'A2', 'A3', 'A4'],
    });

    const response = await validateHandler(request);
    const data = await response.json();

    const stands = data.data.stands;
    expect(stands.find((s: any) => s.standNumber === 'A1').canDiscount).toBe(true);
    expect(stands.find((s: any) => s.standNumber === 'A2').canDiscount).toBe(true);
    expect(stands.find((s: any) => s.standNumber === 'A3').canDiscount).toBe(false);
    expect(stands.find((s: any) => s.standNumber === 'A4').canDiscount).toBe(false);
  });
});

describe('Authorization', () => {
  it('should reject MANAGER accessing other branch developments', async () => {
    mockRequireManager.mockResolvedValue({
      user: { id: 'user-1', email: 'mgr@test.com', name: 'Manager', role: 'MANAGER', branch: 'Harare' },
    });

    mockPrisma.development.findUnique.mockResolvedValue({
      id: 'dev-1',
      branch: 'Bulawayo',
    } as any);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      reason: 'Test reason',
    });

    const response = await markSoldHandler(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('branch');
  });

  it('should allow ADMIN to access any branch', async () => {
    mockRequireManager.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    });

    mockPrisma.development.findUnique.mockResolvedValue({
      id: 'dev-1',
      name: 'Test',
      branch: 'Bulawayo',
      developerEmail: null,
      developerName: null,
    } as any);

    mockPrisma.stand.findMany.mockResolvedValue([]);

    const request = createRequest({
      developmentId: 'dev-1',
      standNumbers: ['A1'],
      reason: 'Test reason',
    });

    const response = await markSoldHandler(request);
    // Should not be 403
    expect(response.status).not.toBe(403);
  });
});
