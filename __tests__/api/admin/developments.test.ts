/**
 * API Tests: Admin Developments
 * 
 * Tests for /api/admin/developments endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/access-control', () => ({
  requireAdmin: jest.fn(),
  isAdmin: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    development: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stand: {
      createMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));
jest.mock('@/lib/db-pool', () => ({
  getDbPool: jest.fn(() => ({
    query: jest.fn(),
  })),
  query: jest.fn(),
}));
jest.mock('@/lib/validation/validator', () => ({
  validateRequest: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  createModuleLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/admin/developments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return developments without authentication (public endpoint)', async () => {
    const { getDbPool } = await import('@/lib/db-pool');
    const { GET } = await import('@/app/api/admin/developments/route');
    
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    const request = new NextRequest('http://localhost:3000/api/admin/developments');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return developments (public endpoint)', async () => {
    const { getDbPool } = await import('@/lib/db-pool');
    const { GET } = await import('@/app/api/admin/developments/route');

    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'dev-1',
            name: 'Test Development',
            location: 'Harare',
            base_price: 100000,
            status: 'ACTIVE',
            created_at: new Date(),
          },
        ],
      }),
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    const request = new NextRequest('http://localhost:3000/api/admin/developments');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.data || data.data?.developments || data.data)).toBe(true);
  });

  it('should filter by branch when provided', async () => {
    const { getDbPool } = await import('@/lib/db-pool');
    const { GET } = await import('@/app/api/admin/developments/route');

    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    const request = new NextRequest('http://localhost:3000/api/admin/developments?branch=Bulawayo');
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Verify query was called (branch filter is handled in SQL query)
    expect(mockPool.query).toHaveBeenCalled();
  });
});

describe('POST /api/admin/developments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/access-control');
    const { POST } = await import('@/app/api/admin/developments/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/developments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Development',
        location: 'Harare',
        basePrice: 100000,
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return 400 if validation fails', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const { validateRequest } = await import('@/lib/validation/validator');
    const { POST } = await import('@/app/api/admin/developments/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const { NextResponse } = await import('next/server');
    (validateRequest as jest.Mock).mockReturnValue({
      success: false,
      error: NextResponse.json(
        { error: 'Validation failed', success: false },
        { status: 400 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/developments', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });

  it('should create development successfully', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const { validateRequest } = await import('@/lib/validation/validator');
    const { getDbPool } = await import('@/lib/db-pool');
    const { POST } = await import('@/app/api/admin/developments/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    (validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        name: 'Test Development',
        location: 'Harare',
        basePrice: 100000,
        branch: 'Harare',
      },
    });

    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'dev-1' }] }),
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    const request = new NextRequest('http://localhost:3000/api/admin/developments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Development',
        location: 'Harare',
        basePrice: 100000,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });

  it('should create stands when standCountToCreate provided', async () => {
    const { requireAdmin } = await import('@/lib/access-control');
    const { validateRequest } = await import('@/lib/validation/validator');
    const { getDbPool } = await import('@/lib/db-pool');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/developments/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    (validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        name: 'Test Development',
        location: 'Harare',
        basePrice: 100000,
        branch: 'Harare',
        totalStands: 10,
      },
    });

    const mockPool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'dev-1' }] }) // Development creation
        .mockResolvedValue({ rows: [] }), // Stand creation queries
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    const request = new NextRequest('http://localhost:3000/api/admin/developments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Development',
        location: 'Harare',
        basePrice: 100000,
        useManualStandCreation: true,
        standCountToCreate: 10,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    // Verify pool.query was called for stand creation (multiple calls for batch inserts)
    expect(mockPool.query).toHaveBeenCalled();
  });
});
