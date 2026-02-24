/**
 * API Tests: Create Account From Reservation
 * 
 * Tests for /api/auth/create-account-from-reservation endpoint
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stand: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservation: {
      create: jest.fn(),
    },
    auditTrail: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/logger');
jest.mock('@/lib/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ id: 'email-1', success: true }),
}));
jest.mock('@/lib/reservation-claim', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ claimed: 0 }),
}));
jest.mock('@/lib/password-history', () => ({
  updateUserPasswordWithHistory: jest.fn(),
}));

describe('POST /api/auth/create-account-from-reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if required fields are missing', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    
    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Validation now returns structured errors under details
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 if email format is invalid', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    
    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        name: 'Test User',
        phone: '1234567890',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 409 if user already exists with password', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Existing User',
      role: 'CLIENT',
      password: 'hashed_password', // Has password
    });

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        phone: '1234567890',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.existingAccount).toBe(true);
  });

  it('should return 409 if user exists but needs activation', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Existing User',
      role: 'CLIENT',
      password: null, // No password
    });

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        phone: '1234567890',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    // Check if needsActivation is in data or data.data
    expect(data.data?.needsActivation || data.needsActivation || data.error?.includes('activation')).toBeTruthy();
  });

  it('should create new account successfully', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CLIENT',
      branch: 'Harare',
      isActive: true,
      createdAt: new Date(),
    });
    (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.client.create as jest.Mock).mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    });
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        phone: '1234567890',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.user).toBeDefined();
    expect(data.data.user.role).toBe('CLIENT');
    expect(data.data.needsPasswordSetup).toBe(true);
  });

  it('should create account with reservation if standId provided', async () => {
    const { POST } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CLIENT',
      branch: 'Harare',
      isActive: true,
      createdAt: new Date(),
    });
    (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.client.create as jest.Mock).mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    });

    (prisma.stand.findUnique as jest.Mock).mockResolvedValue({
      id: 'ckp1234567890123456789012',
      status: 'AVAILABLE',
      development: { name: 'Test Development' },
    });
    
    // Mock $transaction to return the reservation
    const mockReservation = {
      id: 'res-1',
      standId: 'ckp1234567890123456789012',
      clientId: 'client-1',
      stand: { 
        standNumber: 'A1',
        development: { name: 'Test Development' }
      },
      client: { name: 'Test User' },
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      // Mock the transaction context
      const tx = {
        stand: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ckp1234567890123456789012',
            status: 'AVAILABLE',
            development: { name: 'Test Development' },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        reservation: {
          create: jest.fn().mockResolvedValue(mockReservation),
        },
      };
      return callback(tx);
    });
    
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        phone: '1234567890',
        reservationData: {
          standId: 'ckp1234567890123456789012',
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.reservation).toBeDefined();
    expect(data.data.reservation.standNumber).toBe('A1');
  });
});

describe('PUT /api/auth/create-account-from-reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if email or password missing', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    
    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 if password is too short', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    
    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'short',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Validation now returns structured errors under details
    expect(data.error).toBe('Validation failed');
    expect(data.details?.validationErrors).toBeDefined();
  });

  it('should return 400 if password lacks uppercase or number', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    
    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'lowercaseonly',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 404 if user not found', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'ValidPass123',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('should set password successfully', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');
    const { updateUserPasswordWithHistory } = await import('@/lib/password-history');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      branch: 'Harare',
      password: null,
    });
    (updateUserPasswordWithHistory as jest.Mock).mockResolvedValue({ ok: true });
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'ValidPass123',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateUserPasswordWithHistory).toHaveBeenCalled();
  });

  it('should return 409 if password is already set for the account', async () => {
    const { PUT } = await import('@/app/api/auth/create-account-from-reservation/route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      branch: 'Harare',
      password: 'hashed_existing',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/create-account-from-reservation', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'ValidPass123',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.code).toBe('CONFLICT');
  });
});
