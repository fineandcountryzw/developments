/**
 * API Tests: Admin Users
 * 
 * Tests for /api/admin/users endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/adminAuth', () => ({
  requireAdmin: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    const { requireAdmin } = await import('@/lib/adminAuth');
    const { GET } = await import('@/app/api/admin/users/route');
    
    (requireAdmin as jest.Mock).mockResolvedValue({
      error: NextResponse.json(
        { error: "Unauthorized - Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return users for admin user', async () => {
    const { requireAdmin } = await import('@/lib/adminAuth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/admin/users/route');

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'Admin', branch: 'Harare' },
    });

    (prisma.user.count as jest.Mock).mockResolvedValue(1);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'Agent',
        branch: 'Harare',
        isActive: true,
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.users)).toBe(true);
  });
});
