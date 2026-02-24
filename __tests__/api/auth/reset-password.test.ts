/**
 * API Tests: Reset Password
 * 
 * Tests for /api/auth/reset-password endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
    },
  },
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');
jest.mock('@/lib/password-history', () => ({
  updateUserPasswordWithHistory: jest.fn(),
}));

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if token is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'NewPass123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 if password is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 for weak password', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'weak' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 for password without uppercase', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 for invalid/expired token', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/auth/reset-password/route');

    // Mock findFirst to return null (no valid user found)
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid-token', password: 'NewPass123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid or expired');
  });

  it('should reset password successfully with valid token', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { updateUserPasswordWithHistory } = await import('@/lib/password-history');
    const { POST } = await import('@/app/api/auth/reset-password/route');
    
    // Mock findFirst to return a user
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });

    (updateUserPasswordWithHistory as jest.Mock).mockResolvedValue({ ok: true });

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPass123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateUserPasswordWithHistory).toHaveBeenCalled();
  });

  it('should return 400 for expired token', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/auth/reset-password/route');

    // Mock findFirst to return null (token expired/not found)
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'expired-token', password: 'NewPass123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid or expired');
  });

  it('should return 400 when password was recently used', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { updateUserPasswordWithHistory } = await import('@/lib/password-history');
    const { POST } = await import('@/app/api/auth/reset-password/route');

    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });

    (updateUserPasswordWithHistory as jest.Mock).mockResolvedValue({
      ok: false,
      code: 'PASSWORD_REUSE',
      message: 'You cannot reuse a recently used password',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPass123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('PASSWORD_REUSE');
  });
});
