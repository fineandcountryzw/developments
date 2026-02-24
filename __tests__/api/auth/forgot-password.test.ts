/**
 * API Tests: Forgot Password
 * 
 * Tests for /api/auth/forgot-password endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock('@/lib/logger');
jest.mock('@/lib/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ id: 'email-1', success: true }),
}));

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if email is missing', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Validation now returns structured errors under details
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 for invalid email format', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');

    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return success even if user does not exist (security)', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { POST } = await import('@/app/api/auth/forgot-password/route');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return success for security (don't reveal if email exists)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should send reset email for existing user', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { sendEmail } = await import('@/lib/email-service');
    const { POST } = await import('@/app/api/auth/forgot-password/route');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
    });

    // Route uses $executeRaw to update reset token
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it('should send reset email even if user is inactive (they may need to reactivate)', async () => {
    const prisma = (await import('@/lib/prisma')).default;
    const { sendEmail } = await import('@/lib/email-service');
    const { POST } = await import('@/app/api/auth/forgot-password/route');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'inactive@example.com',
      name: 'Inactive User',
      isActive: false,
    });

    (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'inactive@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Return success and send email (inactive users may still need to reset password)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Email should be sent for password reset
    expect(sendEmail).toHaveBeenCalled();
  });
});
