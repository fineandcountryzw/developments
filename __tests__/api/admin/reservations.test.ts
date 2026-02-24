/**
 * API Tests: Admin Reservations
 * 
 * Tests for /api/admin/reservations endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));
jest.mock('@/lib/validation/middleware', () => ({
  validateRequest: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    reservation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    stand: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/logger');
jest.mock('@/lib/reservation-emails');

describe('GET /api/admin/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { GET } = await import('@/app/api/admin/reservations/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/reservations');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return reservations for admin user', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/reservations/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'Admin', branch: 'Harare' },
    });

    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'res-1',
        standId: 'stand-1',
        clientId: 'client-1',
        status: 'PENDING',
        createdAt: new Date(),
        stand: { standNumber: 'A1', development: { name: 'Test Dev' } },
        client: { name: 'Test Client' },
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/reservations');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.reservations).toHaveLength(1);
  });
});

describe('POST /api/admin/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/admin/reservations/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/reservations', {
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

  it('should return 404 if stand not found', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/reservations/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'Admin' },
    });

    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        standId: 'non-existent',
        clientId: 'client-1',
      },
    });

    (prisma.stand.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/reservations', {
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
});
