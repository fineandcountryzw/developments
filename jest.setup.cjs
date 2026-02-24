/**
 * Jest Setup File
 * 
 * Global test configuration and mocks
 */

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-for-jest';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Increase timeout for API tests
jest.setTimeout(10000);

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-auth to avoid ES module issues
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock authOptions if it exists
try {
  jest.mock('@/lib/authOptions', () => ({
    authOptions: {},
  }));
} catch (e) {
  // Ignore if module doesn't exist in test context
}

// Setup React Testing Library
require('@testing-library/jest-dom');
