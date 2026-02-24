/**
 * API Tests: Stands By Development
 * 
 * Tests for /api/stands/by-development endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/authOptions', () => ({
  authOptions: {},
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    stand: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');

describe('GET /api/stands/by-development', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { getServerSession } = await import('next-auth');
    const { GET } = await import('@/app/api/stands/by-development/route');
    
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/stands/by-development?developmentId=dev-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if developmentId is missing', async () => {
    const { getServerSession } = await import('next-auth');
    const { GET } = await import('@/app/api/stands/by-development/route');
    
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });

    const request = new NextRequest('http://localhost:3000/api/stands/by-development');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('developmentId');
  });

  it('should return stands for valid development', async () => {
    const { getServerSession } = await import('next-auth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/stands/by-development/route');
    
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });

    (prisma.stand.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'stand-1',
        standNumber: 'A1',
        sizeSqm: 500,
        price: 100000,
        status: 'AVAILABLE',
        developmentId: 'dev-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'stand-2',
        standNumber: 'A2',
        sizeSqm: 600,
        price: 120000,
        status: 'RESERVED',
        developmentId: 'dev-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/stands/by-development?developmentId=dev-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].standNumber).toBe('A1');
    expect(prisma.stand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { developmentId: 'dev-1' },
        orderBy: { standNumber: 'asc' },
      })
    );
  });

  it('should return empty array if no stands found', async () => {
    const { getServerSession } = await import('next-auth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/stands/by-development/route');
    
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });

    (prisma.stand.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/stands/by-development?developmentId=dev-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    const { getServerSession } = await import('next-auth');
    const prisma = (await import('@/lib/prisma')).default;
    const { GET } = await import('@/app/api/stands/by-development/route');
    
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });

    (prisma.stand.findMany as jest.Mock).mockRejectedValue(new Error('Database connection error'));

    const request = new NextRequest('http://localhost:3000/api/stands/by-development?developmentId=dev-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
