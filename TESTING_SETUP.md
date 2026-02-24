# Testing Setup Guide

## ✅ Testing Infrastructure Complete

Basic API testing infrastructure has been set up for your Next.js application.

## 📋 What Was Configured

### 1. **Testing Dependencies**
- ✅ `jest` - Test runner
- ✅ `@types/jest` - TypeScript types for Jest
- ✅ `ts-jest` - TypeScript support for Jest
- ✅ `supertest` - HTTP assertion library (for API testing)
- ✅ `@types/supertest` - TypeScript types

### 2. **Configuration Files**
- ✅ `jest.config.js` - Jest configuration
- ✅ `jest.setup.js` - Global test setup and mocks

### 3. **Test Files Created**
- ✅ `__tests__/api/admin/reservations.test.ts` - Reservation API tests
- ✅ `__tests__/api/admin/users.test.ts` - User management API tests
- ✅ `__tests__/api/auth/request-access.test.ts` - Public access request tests
- ✅ `__tests__/api/utils/test-helpers.ts` - Test utility functions

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in CI Mode
```bash
npm run test:ci
```

## 📝 Test Structure

### Test File Naming
- Test files should be named `*.test.ts` or `*.spec.ts`
- Place tests in `__tests__` directory or next to source files

### Example Test Structure
```typescript
describe('GET /api/admin/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    // Test implementation
  });
});
```

## 🧪 Current Test Coverage

### ✅ Tests Implemented

1. **Admin Reservations API**
   - ✅ Authentication check
   - ✅ Admin access
   - ✅ Agent role filtering
   - ✅ Stand validation
   - ✅ Availability checks

2. **Admin Users API**
   - ✅ Authentication check
   - ✅ User listing
   - ✅ Branch filtering

3. **Request Access API**
   - ✅ User creation
   - ✅ Duplicate email check
   - ✅ Required field validation

## 📊 Coverage Goals

Current coverage thresholds (can be adjusted):
- Branches: 30%
- Functions: 30%
- Lines: 30%
- Statements: 30%

## 🔧 Mocking Strategy

### Prisma Mock
```typescript
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));
```

### Auth Mock
```typescript
jest.mock('@/lib/adminAuth');
const { requireAdmin } = require('@/lib/adminAuth');
requireAdmin.mockResolvedValue({
  user: { id: 'admin-1', role: 'Admin' },
});
```

## 📈 Next Steps

### Priority 1: Expand Test Coverage
- [ ] Add tests for payment API endpoints
- [ ] Add tests for client API endpoints
- [ ] Add tests for commission calculations
- [ ] Add tests for email sending logic

### Priority 2: Integration Tests
- [ ] Test complete reservation flow
- [ ] Test payment verification flow
- [ ] Test user invitation flow

### Priority 3: E2E Tests (Future)
- [ ] Set up Playwright or Cypress
- [ ] Test complete user journeys
- [ ] Test critical business flows

## 🎯 Best Practices

### 1. **Test Structure**
- Use `describe` blocks to group related tests
- Use `beforeEach` to reset mocks
- Use descriptive test names

### 2. **Mocking**
- Mock external dependencies (database, auth, email)
- Keep mocks simple and focused
- Reset mocks between tests

### 3. **Assertions**
- Test both success and error cases
- Verify status codes
- Verify response structure
- Verify side effects (database calls, etc.)

### 4. **Test Data**
- Use realistic test data
- Create test fixtures for common scenarios
- Use factories for generating test data

## 🔍 Example Test

```typescript
describe('POST /api/admin/reservations', () => {
  it('should create reservation successfully', async () => {
    // Setup mocks
    const prisma = require('@/lib/prisma').default;
    prisma.stand.findUnique.mockResolvedValue({
      id: 'stand-1',
      status: 'AVAILABLE',
    });
    prisma.$transaction.mockResolvedValue([{
      id: 'res-1',
      status: 'PENDING',
    }]);

    // Make request
    const request = createMockRequest('/api/admin/reservations', {
      method: 'POST',
      body: { standId: 'stand-1', clientId: 'client-1' },
    });
    const response = await POST(request);
    const data = await extractJson(response);

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
```

## 🐛 Debugging Tests

### Run Single Test File
```bash
npm test reservations.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should return 401"
```

### Verbose Output
```bash
npm test -- --verbose
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

---

**Status:** ✅ Basic testing infrastructure ready

**Next:** Expand test coverage for critical endpoints
