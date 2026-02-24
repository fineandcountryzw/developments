/**
 * API Tests: Admin Clients
 * 
 * Tests for /api/admin/clients endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
  requireAgent: jest.fn(),
  getAuthenticatedUser: jest.fn(),
  isAdmin: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    client: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));
jest.mock('@/lib/validation/middleware', () => ({
  validateRequest: jest.fn(),
}));
jest.mock('@/lib/realtime', () => ({
  broadcastClientUpdate: jest.fn(),
}));
jest.mock('@/lib/logger');

describe('GET /api/admin/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAgent } = await import('@/lib/adminAuth');
    const { GET } = await import('@/app/api/admin/clients/route');
    
    (requireAgent as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/clients');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return clients for admin user', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/clients/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    // Mock count first, then findMany
    (prisma.client.count as jest.Mock).mockResolvedValue(1);
    (prisma.client.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        branch: 'Harare',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/clients');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.data)).toBe(true);
  });

  it('should filter by branch when provided', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/clients/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/admin/clients?branch=Bulawayo');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branch: 'Bulawayo',
        }),
      })
    );
  });

  it('should enforce agent-only access for agents', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/clients/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'agent-1', role: 'AGENT', branch: 'Harare' },
    });

    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([
      { clientId: 'client-1' },
    ]);

    (prisma.client.count as jest.Mock).mockResolvedValue(1);
    (prisma.client.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'client-1',
        name: 'Test Client',
        reservations: [],
        payments: [],
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/clients');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Verify that reservation.findMany was called with agentId filter
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: 'agent-1',
        }),
      })
    );
    // Verify that client.findMany was called with filtered client IDs
    expect(prisma.client.findMany).toHaveBeenCalled();
  });

  it('should support pagination', async () => {
    const { requireAgent } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/clients/route');

    (requireAgent as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', branch: 'Harare' },
    });

    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/admin/clients?page=2&limit=20');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pagination.page).toBe(2);
    expect(data.data.pagination.limit).toBe(20);
  });
});

describe('POST /api/admin/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { POST } = await import('@/app/api/admin/clients/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Client',
        email: 'client@example.com',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return 400 if validation fails', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const { POST } = await import('@/app/api/admin/clients/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      error: NextResponse.json(
        { success: false, error: 'Validation failed' },
        { status: 400 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fields
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('should create client successfully', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/clients/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' },
    });

    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        branch: 'Harare',
      },
    });

    (prisma.client.create as jest.Mock).mockResolvedValue({
      id: 'client-1',
      name: 'Test Client',
      email: 'client@example.com',
      phone: '1234567890',
      branch: 'Harare',
      reservations: [],
      payments: [],
    });

    (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
    
    // Mock broadcastClientUpdate to resolve successfully
    const { broadcastClientUpdate } = await import('@/lib/realtime');
    (broadcastClientUpdate as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test Client');
  });

  it('should return 409 if email already exists', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { validateRequest } = await import('@/lib/validation/middleware');
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/admin/clients/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name: 'Test Client',
        email: 'existing@example.com',
        branch: 'Harare',
      },
    });

    (prisma.client.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint violation',
    });

    const request = new NextRequest('http://localhost:3000/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Client',
        email: 'existing@example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain('already exists');
  });
});
