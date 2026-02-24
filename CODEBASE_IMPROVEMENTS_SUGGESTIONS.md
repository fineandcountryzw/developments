# Codebase Improvement Suggestions

**Date:** January 26, 2026  
**Codebase Analysis:** Fine & Country Zimbabwe ERP  
**Framework:** Next.js 15.5.9, TypeScript, Prisma 7.2.0, PostgreSQL (Neon)

---

## Executive Summary

After comprehensive analysis of the codebase, I've identified **8 major improvement areas** with **40+ specific recommendations**. The codebase is production-ready but has opportunities for enhanced maintainability, performance, security, and developer experience.

**Priority Levels:**
- 🔴 **Critical** - Security, data integrity, production stability
- 🟡 **High** - Performance, maintainability, developer experience
- 🟢 **Medium** - Code quality, best practices, optimization

---

## 1. 🔴 Type Safety & Code Quality

### Issues Found
- **569 instances** of `any` type usage across 145 files
- **613 TODO/FIXME comments** indicating incomplete work
- **557 console.log/error statements** (should use structured logging)
- TypeScript strict mode enabled but not fully utilized

### Recommendations

#### 1.1 Replace `any` Types with Proper Types
**Priority:** High  
**Impact:** Type safety, fewer runtime errors, better IDE support

```typescript
// ❌ Current (app/api/admin/reservations/route.ts:100)
const transformedReservations = reservations.map((res: any) => ({...}));

// ✅ Improved
interface ReservationWithRelations {
  id: string;
  standId: string;
  stand?: {
    number: string;
    development?: { id: string; name: string };
  };
  // ... proper types
}
const transformedReservations = reservations.map((res: ReservationWithRelations) => ({...}));
```

**Action Items:**
- Create shared type definitions in `types/` directory
- Replace `any` in API routes with proper Prisma types
- Use TypeScript utility types (`Pick`, `Omit`, `Partial`)

#### 1.2 Implement Structured Logging
**Priority:** High  
**Impact:** Better debugging, production monitoring, log aggregation

```typescript
// ❌ Current
console.log('[FORENSIC][API] Development created:', { id, name });
console.error('[API] Error:', error);

// ✅ Improved (use existing logger.ts)
import { logger } from '@/lib/logger';
logger.info('Development created', { module: 'API', id, name });
logger.error('Development creation failed', error, { module: 'API' });
```

**Action Items:**
- Replace all `console.*` with `logger.*` from `lib/logger.ts`
- Ensure consistent log format across all modules
- Add correlation IDs for request tracing

#### 1.3 Remove TODO/FIXME Comments
**Priority:** Medium  
**Impact:** Code clarity, reduce technical debt

**Action Items:**
- Audit all TODO/FIXME comments
- Create GitHub issues for each
- Remove or implement pending items

---

## 2. 🔴 Security Enhancements

### Issues Found
- Direct SQL queries with string concatenation (potential SQL injection)
- Inconsistent authorization checks
- Missing input validation in some endpoints
- CORS set to `*` (too permissive)

### Recommendations

#### 2.1 SQL Injection Prevention
**Priority:** Critical  
**Impact:** Data security, prevent SQL injection attacks

```typescript
// ✅ Good (already using parameterized queries in most places)
await pool.query('SELECT * FROM developments WHERE id = $1', [id]);

// ⚠️ Review these patterns
// Check all raw SQL queries use parameterized queries
// No string concatenation in SQL
```

**Action Items:**
- Audit all SQL queries for parameterization
- Use Prisma ORM where possible (type-safe)
- Add SQL injection tests

#### 2.2 Input Validation
**Priority:** High  
**Impact:** Data integrity, prevent invalid data

```typescript
// ✅ Use existing validation schemas
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';

const schema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  amount: z.number().positive()
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = schema.safeParse(body);
  if (!validation.success) {
    return apiError('Validation failed', 400, 'VALIDATION_ERROR', validation.error);
  }
  // ... rest of handler
}
```

**Action Items:**
- Create Zod schemas for all API inputs
- Validate all POST/PUT/PATCH requests
- Add validation middleware

#### 2.3 CORS Configuration
**Priority:** Medium  
**Impact:** Security, prevent unauthorized access

```typescript
// ❌ Current (next.config.mjs:82)
{ key: 'Access-Control-Allow-Origin', value: '*' }

// ✅ Improved
{ key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || 'https://fineandcountryerp.com' }
```

**Action Items:**
- Configure specific allowed origins
- Use environment variables for CORS
- Remove wildcard CORS in production

---

## 3. 🟡 Performance Optimizations

### Issues Found
- No database query result caching
- Multiple database connections per request
- Large component files (1400+ lines)
- No code splitting for heavy components

### Recommendations

#### 3.1 Database Query Optimization
**Priority:** High  
**Impact:** Faster response times, reduced database load

```typescript
// ✅ Implement query result caching
import { cachedFetch } from '@/lib/api-cache';

// Cache frequently accessed data
const cacheKey = `developments:${branch}:${page}`;
const cached = await cachedFetch(`/api/admin/developments?branch=${branch}&page=${page}`, {
  ttl: 300 // 5 minutes
});
```

**Action Items:**
- Use existing `api-cache.ts` for GET endpoints
- Add Redis for production caching (optional)
- Implement query result memoization

#### 3.2 Connection Pooling
**Priority:** High  
**Impact:** Better resource utilization, prevent connection exhaustion

```typescript
// ✅ Already using Pool, but ensure proper configuration
// lib/db-pool.ts should have:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  min: 2,  // Minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

**Action Items:**
- Verify pool configuration is optimal
- Monitor connection pool usage
- Add connection pool metrics

#### 3.3 Code Splitting & Lazy Loading
**Priority:** Medium  
**Impact:** Faster initial page load, better bundle size

```typescript
// ✅ Use dynamic imports for heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false // If client-only
});
```

**Action Items:**
- Split large dashboard components
- Lazy load charts and heavy libraries
- Use React.lazy for route-based splitting

---

## 4. 🟡 Error Handling & Resilience

### Issues Found
- Inconsistent error handling patterns
- Some errors return HTML instead of JSON
- Missing error boundaries in some areas
- No retry logic for transient failures

### Recommendations

#### 4.1 Standardize Error Handling
**Priority:** High  
**Impact:** Better error messages, easier debugging

```typescript
// ✅ Use existing apiError helper consistently
import { apiError } from '@/lib/api-response';

try {
  // ... operation
} catch (error: unknown) {
  logger.error('Operation failed', error, { module: 'API', context });
  
  if (error instanceof ValidationError) {
    return apiError(error.message, 400, 'VALIDATION_ERROR');
  }
  if (error instanceof DatabaseError) {
    return apiError('Database error', 500, 'DB_ERROR', { hint: 'Check connection' });
  }
  return apiError('Internal server error', 500, 'INTERNAL_ERROR');
}
```

**Action Items:**
- Create custom error classes
- Use `apiError` consistently across all routes
- Add error boundary components

#### 4.2 Retry Logic for Transient Failures
**Priority:** Medium  
**Impact:** Better resilience, handle network issues

```typescript
// ✅ Use existing retry.ts
import { retry } from '@/lib/retry';

const result = await retry(
  async () => await fetchExternalAPI(),
  { maxRetries: 3, delay: 1000 }
);
```

**Action Items:**
- Apply retry logic to external API calls
- Add retry for database connection failures
- Configure appropriate retry strategies

---

## 5. 🟢 Testing & Quality Assurance

### Issues Found
- **No test files** found (`.test.ts`, `.spec.ts`)
- No automated testing setup
- Manual testing only

### Recommendations

#### 5.1 Add Unit Tests
**Priority:** High  
**Impact:** Catch bugs early, enable refactoring confidence

```typescript
// Example: lib/feeCalculator.test.ts
import { calculateFees } from '@/lib/feeCalculator';

describe('calculateFees', () => {
  it('should calculate VAT correctly', () => {
    const result = calculateFees({ amount: 1000, vatEnabled: true });
    expect(result.vat).toBe(150);
  });
});
```

**Action Items:**
- Set up Jest/Vitest
- Add tests for utility functions
- Test API route handlers
- Add tests for business logic

#### 5.2 Integration Tests
**Priority:** Medium  
**Impact:** Verify API contracts, database operations

```typescript
// Example: app/api/admin/developments/route.test.ts
describe('POST /api/admin/developments', () => {
  it('should create development with valid data', async () => {
    const response = await POST(mockRequest);
    expect(response.status).toBe(201);
    expect(response.data.name).toBe('Test Development');
  });
});
```

**Action Items:**
- Test API endpoints end-to-end
- Test database operations
- Test authentication/authorization

---

## 6. 🟢 Code Organization & Architecture

### Issues Found
- Large component files (1400+ lines)
- Mixed concerns in some components
- Duplicate code patterns
- Inconsistent file naming

### Recommendations

#### 6.1 Component Refactoring
**Priority:** Medium  
**Impact:** Maintainability, reusability

```typescript
// ❌ Current: DeveloperDashboard.tsx (1400+ lines)

// ✅ Improved: Split into smaller components
// components/dashboards/DeveloperDashboard/
//   ├── index.tsx (main component, 200 lines)
//   ├── OverviewTab.tsx
//   ├── DevelopmentsTab.tsx
//   ├── PaymentsTab.tsx
//   ├── BackupTab.tsx
//   ├── hooks/
//   │   ├── useDeveloperData.ts
//   │   └── usePayments.ts
//   └── components/
//       ├── DevelopmentCard.tsx
//       └── PaymentList.tsx
```

**Action Items:**
- Split large dashboard components
- Extract reusable sub-components
- Create custom hooks for data fetching

#### 6.2 API Route Organization
**Priority:** Medium  
**Impact:** Better structure, easier to find routes

**Current Structure:** Good (organized by role/feature)  
**Improvements:**
- Add route documentation comments
- Create route index files for grouping
- Standardize error handling per route group

#### 6.3 Shared Utilities
**Priority:** Low  
**Impact:** Reduce duplication

```typescript
// ✅ Create shared utilities
// lib/utils/
//   ├── formatting.ts (formatCurrency, formatDate)
//   ├── validation.ts (common validators)
//   └── data-transforms.ts (common transformations)
```

---

## 7. 🟢 Documentation & Developer Experience

### Issues Found
- Many markdown documentation files (good!)
- Some API routes lack JSDoc comments
- No API documentation (OpenAPI/Swagger)
- Missing inline code comments in complex logic

### Recommendations

#### 7.1 API Documentation
**Priority:** Medium  
**Impact:** Developer onboarding, API discoverability

```typescript
/**
 * POST /api/admin/developments
 * 
 * Creates a new development with optional stand creation.
 * 
 * @param {Object} body - Development data
 * @param {string} body.name - Development name (required)
 * @param {string} body.location - Location (required)
 * @param {number} body.basePrice - Base price in USD (required)
 * @param {Object} [body.geoJsonData] - GeoJSON for stand creation
 * @param {number} [body.standCountToCreate] - Manual stand count
 * 
 * @returns {Object} Created development with stand creation results
 * @throws {400} Validation error
 * @throws {401} Unauthorized
 * @throws {500} Server error
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/developments', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'New Estate', location: 'Harare', basePrice: 50000 })
 * });
 * ```
 */
export async function POST(request: NextRequest) {
  // ...
}
```

**Action Items:**
- Add JSDoc to all API routes
- Generate OpenAPI spec
- Create API documentation site

#### 7.2 Code Comments
**Priority:** Low  
**Impact:** Code understanding, onboarding

**Action Items:**
- Add comments to complex business logic
- Document non-obvious decisions
- Explain "why" not "what"

---

## 8. 🟡 Build & Dependencies

### Issues Found
- TypeScript errors ignored in build (`ignoreBuildErrors: true`)
- ESLint disabled in build (`ignoreDuringBuilds: true`)
- 13 npm vulnerabilities (3 low, 5 moderate, 3 high, 2 critical)
- No dependency update strategy

### Recommendations

#### 8.1 Enable Type Checking
**Priority:** High  
**Impact:** Catch type errors before production

```typescript
// ❌ Current (next.config.mjs:14)
typescript: {
  ignoreBuildErrors: true,
}

// ✅ Improved
typescript: {
  ignoreBuildErrors: false, // Fix type errors
}
```

**Action Items:**
- Fix all TypeScript errors
- Enable strict type checking
- Remove `any` types gradually

#### 8.2 Fix Security Vulnerabilities
**Priority:** Critical  
**Impact:** Security, prevent exploits

```bash
# Run audit
npm audit

# Fix automatically (if safe)
npm audit fix

# Review critical/high vulnerabilities manually
npm audit --audit-level=high
```

**Action Items:**
- Review and fix all vulnerabilities
- Update dependencies regularly
- Use Dependabot for automated updates

#### 8.3 Enable ESLint
**Priority:** Medium  
**Impact:** Code quality, consistency

```typescript
// ❌ Current
eslint: {
  ignoreDuringBuilds: true,
}

// ✅ Improved
eslint: {
  ignoreDuringBuilds: false,
}
```

**Action Items:**
- Fix ESLint errors
- Configure ESLint rules
- Add pre-commit hooks

---

## 9. 🟢 Performance Monitoring & Observability

### Recommendations

#### 9.1 Add Performance Monitoring
**Priority:** Medium  
**Impact:** Identify bottlenecks, optimize slow queries

```typescript
// ✅ Add performance tracking
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    // ... operation
    const duration = Date.now() - startTime;
    logger.info('API request completed', { 
      module: 'API', 
      duration, 
      endpoint: '/api/admin/developments' 
    });
    return response;
  } catch (error) {
    logger.error('API request failed', error, { 
      module: 'API', 
      duration: Date.now() - startTime 
    });
    throw error;
  }
}
```

**Action Items:**
- Add timing to all API routes
- Track slow queries (>1s)
- Set up monitoring dashboard

#### 9.2 Database Query Monitoring
**Priority:** Medium  
**Impact:** Optimize slow queries, prevent N+1 problems

**Action Items:**
- Use Prisma query logging
- Monitor query execution times
- Add database query analytics

---

## 10. 🟢 Developer Experience

### Recommendations

#### 10.1 Environment Variable Validation
**Priority:** Medium  
**Impact:** Catch configuration errors early

```typescript
// ✅ Use existing validate-env.js
// Add runtime validation on app startup
import { validateEnv } from '@/lib/env-validation';

validateEnv(); // Throws if required vars missing
```

**Action Items:**
- Validate all required env vars on startup
- Provide clear error messages
- Document all environment variables

#### 10.2 Development Tools
**Priority:** Low  
**Impact:** Faster development, better debugging

**Action Items:**
- Add React DevTools configuration
- Set up debugging configuration
- Add development-only features (query inspector, etc.)

---

## Implementation Priority

### Phase 1: Critical (Week 1-2)
1. ✅ Fix security vulnerabilities (npm audit)
2. ✅ Replace `any` types in critical paths
3. ✅ Add input validation to all POST/PUT endpoints
4. ✅ Standardize error handling

### Phase 2: High Priority (Week 3-4)
5. ✅ Implement structured logging (replace console.*)
6. ✅ Add unit tests for utilities
7. ✅ Enable TypeScript strict checking
8. ✅ Optimize database queries

### Phase 3: Medium Priority (Month 2)
9. ✅ Refactor large components
10. ✅ Add API documentation
11. ✅ Implement caching strategy
12. ✅ Add performance monitoring

### Phase 4: Nice to Have (Ongoing)
13. ✅ Code splitting optimization
14. ✅ Developer experience improvements
15. ✅ Additional test coverage

---

## Quick Wins (Can Do Immediately)

1. **Replace console.log with logger** (2-3 hours)
   - Find and replace across codebase
   - Use existing `lib/logger.ts`

2. **Add JSDoc to API routes** (1-2 hours)
   - Document request/response formats
   - Add examples

3. **Fix npm vulnerabilities** (30 minutes)
   - Run `npm audit fix`
   - Review critical issues

4. **Add input validation** (4-6 hours)
   - Use existing Zod schemas
   - Validate all POST/PUT requests

5. **Standardize error responses** (2-3 hours)
   - Use `apiError` consistently
   - Remove HTML error responses

---

## Metrics to Track

### Code Quality
- TypeScript strict mode compliance: **Target 100%**
- `any` type usage: **Target < 50 instances**
- Test coverage: **Target > 70%**
- ESLint errors: **Target 0**

### Performance
- API response time (p95): **Target < 500ms**
- Database query time: **Target < 200ms**
- Page load time: **Target < 2s**

### Security
- Security vulnerabilities: **Target 0 critical/high**
- Input validation coverage: **Target 100%**
- SQL injection risks: **Target 0**

---

## Tools & Libraries to Consider

1. **Testing**
   - Vitest (faster than Jest)
   - React Testing Library
   - MSW (Mock Service Worker) for API mocking

2. **Monitoring**
   - Sentry (error tracking)
   - Vercel Analytics (performance)
   - PostHog (product analytics)

3. **Documentation**
   - Swagger/OpenAPI (API docs)
   - Storybook (component docs)

4. **Code Quality**
   - Husky (pre-commit hooks)
   - lint-staged (staged file linting)
   - Prettier (code formatting)

---

## Conclusion

The codebase is **production-ready** with solid architecture and good patterns. The improvements suggested will:

- ✅ **Enhance security** (input validation, SQL injection prevention)
- ✅ **Improve maintainability** (type safety, code organization)
- ✅ **Boost performance** (caching, query optimization)
- ✅ **Enable testing** (unit tests, integration tests)
- ✅ **Better developer experience** (documentation, tooling)

**Estimated Effort:**
- Critical items: **2-3 weeks**
- High priority: **1-2 months**
- Full implementation: **3-4 months**

**ROI:** High - These improvements will reduce bugs, improve performance, and make the codebase easier to maintain and extend.
