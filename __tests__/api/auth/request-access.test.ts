/**
 * API Tests: Request Access
 * 
 * Tests for /api/auth/request-access endpoint (public endpoint)
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/request-access/route';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
  default: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');

describe('POST /api/auth/request-access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create access request with valid data', async () => {
    const prisma = (await import('@/lib/prisma')).prisma;

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // User doesn't exist
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CLIENT',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/request-access', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        accountType: 'CLIENT',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should return 409 if email already exists', async () => {
    const prisma = (await import('@/lib/prisma')).prisma;

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user',
      email: 'test@example.com',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/request-access', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        accountType: 'CLIENT',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain('already exists');
  });

  it('should return 400 if required fields are missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/request-access', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        // Missing email and accountType
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
