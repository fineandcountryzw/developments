# Senior Backend Engineer Guide - Neon + Prisma Optimization

**Date**: January 1, 2026  
**Stack**: Next.js 15.5.9, Prisma 7.2.0, Neon PostgreSQL, pg (Direct SQL)  
**Status**: Production Ready ✅  

---

## Executive Summary

This guide provides comprehensive backend engineering practices for the Fine & Country Zimbabwe ERP, covering:

1. **Database Schema Optimization** - Normalization, indexing, query patterns
2. **Query Performance Optimization** - N+1 elimination, batch processing, caching
3. **Connection Management** - Pooling, retries, Neon-specific configurations
4. **Error Handling & Troubleshooting** - Common patterns and solutions
5. **Scalability & Monitoring** - Metrics, logging, performance tracking

---

## 1. Database Schema Optimization

### Current Architecture

**Technology**: Neon PostgreSQL (Managed, serverless-ready)  
**Connection**: Pooled endpoint with pg library  
**Migration**: SQL-based with schema versioning  

### Schema Design Principles

#### 1.1 Normalization

The system uses 3rd Normal Form (3NF) to eliminate data redundancy:

```sql
-- ❌ BAD: Denormalized (redundant data)
CREATE TABLE developments (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  agent_name VARCHAR(255),      -- Redundant if agent exists in agents table
  agent_email VARCHAR(255),     -- Redundant if agent exists
  agent_phone VARCHAR(20)       -- Redundant if agent exists
);

-- ✅ GOOD: Normalized (relationships)
CREATE TABLE developments (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  listing_agent_id UUID REFERENCES agents(id) -- Single reference
);

CREATE TABLE agents (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20)
);
```

**Benefits**:
- Eliminates update anomalies (change once, not N times)
- Reduces storage footprint
- Maintains data consistency
- Easier to enforce constraints

#### 1.2 Key Relationships

```
developments ──1─────∞── stands ──1────∞── reservations
         │                              │
         │                              └──→ users
         │
         └──→ agents (listing_agent_id)
```

**Relationship Examples**:

```sql
-- One development has many stands
CREATE TABLE stands (
  id UUID PRIMARY KEY,
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  plot_number VARCHAR(50),
  area_sqm DECIMAL(10, 2),
  price DECIMAL(12, 2),
  status VARCHAR(50), -- AVAILABLE, RESERVED, SOLD
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One development can have one primary listing agent
CREATE TABLE developments (
  -- ... other fields
  listing_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL
);

-- Many-to-many relationship (if needed)
CREATE TABLE development_agents (
  development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  role VARCHAR(50), -- PRIMARY, SECONDARY, MARKETER
  PRIMARY KEY (development_id, agent_id)
);
```

#### 1.3 Data Types

| Type | Use Case | Example |
|------|----------|---------|
| `UUID` | Primary/Foreign keys | `id: UUID PRIMARY KEY` |
| `VARCHAR(n)` | Short text | `name VARCHAR(255)` |
| `TEXT` | Long text/descriptions | `description TEXT` |
| `DECIMAL(12, 2)` | Currency | `price DECIMAL(12, 2)` |
| `INTEGER` | Counts | `total_stands INTEGER` |
| `BOOLEAN` | Flags | `is_published BOOLEAN DEFAULT false` |
| `TIMESTAMP` | Audit trail | `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |
| `JSONB` | Flexible data | `metadata JSONB` (indexed) |
| `UUID[]` | Arrays | `image_ids UUID[]` (indexed with @>) |

**Best Practices**:
```sql
-- ✅ Always include audit columns
CREATE TABLE developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Audit trail
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Soft delete
  deleted_at TIMESTAMP,
  
  -- Version tracking
  version_number INTEGER DEFAULT 1
);

-- ✅ Create index on commonly queried fields
CREATE INDEX idx_developments_created_at ON developments(created_at DESC);
CREATE INDEX idx_developments_status ON developments(status);
CREATE INDEX idx_developments_created_by ON developments(created_by);
```

### 1.4 Constraints & Validation

```sql
-- ❌ Application-level only = data inconsistency
-- ✅ Database-level constraints ensure consistency

CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  stand_id UUID NOT NULL REFERENCES stands(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- NOT NULL constraints
  reservation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- CHECK constraints
  CONSTRAINT valid_dates CHECK (
    expiration_date > reservation_date AND
    expiration_date <= CURRENT_TIMESTAMP + INTERVAL '30 days'
  ),
  
  -- UNIQUE constraints for one-to-one relationships
  CONSTRAINT one_reservation_per_stand UNIQUE (stand_id),
  
  -- Compound uniqueness
  CONSTRAINT one_reservation_per_user_per_dev UNIQUE (user_id, stand_id),
  
  -- Foreign key with cascade
  FOREIGN KEY (stand_id) REFERENCES stands(id) ON DELETE CASCADE
);
```

---

## 2. Query Performance Optimization

### 2.1 Indexing Strategy

**Rule of Thumb**: Index columns you `WHERE`, `JOIN`, `ORDER BY`, or aggregate on.

```sql
-- ❌ BAD: No indexes
SELECT * FROM stands WHERE development_id = $1; -- Full table scan (slow)
SELECT * FROM reservations WHERE status = 'ACTIVE'; -- Full table scan

-- ✅ GOOD: Proper indexes
CREATE INDEX idx_stands_development_id ON stands(development_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_user_id_status ON reservations(user_id, status); -- Composite

-- ❌ BAD: Too many indexes (storage cost, slower writes)
CREATE INDEX idx_name ON developments(name);
CREATE INDEX idx_description ON developments(description);
CREATE INDEX idx_location ON developments(location);

-- ✅ GOOD: Selective indexing
CREATE INDEX idx_developments_listing_agent_id ON developments(listing_agent_id);
CREATE INDEX idx_developments_status ON developments(status);
```

#### Index Selection Criteria

| Column Type | Index Type | Priority |
|-------------|-----------|----------|
| Foreign keys | B-tree | 🔴 High |
| Status/Phase | B-tree | 🔴 High |
| Dates (created, updated) | B-tree | 🟡 Medium |
| Search fields | BRIN or GiST | 🟡 Medium |
| Arrays/JSON | GiST or GIN | 🟢 Low |
| Name/Description | Full-text (tsvector) | 🟢 Low |

#### Index Types in PostgreSQL

```sql
-- B-tree (default, most common)
CREATE INDEX idx_name ON table_name(column_name);

-- BRIN (Block Range Index) - large tables, ordered data
CREATE INDEX idx_created_at_brin ON developments USING BRIN (created_at);

-- GiST (Generalized Search Tree) - geospatial, ranges
CREATE INDEX idx_location_gist ON stands USING GIST (location_point);

-- GIN (Generalized Inverted Index) - arrays, JSONB
CREATE INDEX idx_metadata_gin ON developments USING GIN (metadata);

-- Partial index (smaller, faster for filtered queries)
CREATE INDEX idx_active_reservations ON reservations(user_id) WHERE status = 'ACTIVE';

-- Composite index (multiple columns)
CREATE INDEX idx_user_status ON reservations(user_id, status);

-- Index expressions (for derived values)
CREATE INDEX idx_lower_email ON users(LOWER(email)); -- Case-insensitive search
```

### 2.2 Query Optimization Patterns

#### Pattern 1: N+1 Query Problem

```typescript
// ❌ BAD: N+1 queries (1 query for developments + N queries for agents)
const developments = await pool.query(
  'SELECT * FROM developments LIMIT 10'
);
for (const dev of developments.rows) {
  const agent = await pool.query(
    'SELECT * FROM agents WHERE id = $1',
    [dev.listing_agent_id]
  ); // N additional queries!
  dev.agent = agent.rows[0];
}

// ✅ GOOD: Single query with JOIN
const result = await pool.query(`
  SELECT 
    d.id, d.name, d.location,
    a.id as agent_id, a.name as agent_name, a.email
  FROM developments d
  LEFT JOIN agents a ON d.listing_agent_id = a.id
  LIMIT 10
`);

// ✅ GOOD ALTERNATIVE: Batch query
const devIds = developments.map(d => d.id);
const agents = await pool.query(
  'SELECT * FROM agents WHERE id = ANY($1)',
  [devIds]
);
const agentMap = new Map(agents.rows.map(a => [a.id, a]));
developments.rows.forEach(d => {
  d.agent = agentMap.get(d.listing_agent_id);
});
```

#### Pattern 2: Efficient Pagination

```typescript
// ❌ BAD: OFFSET (O(n) complexity)
const result = await pool.query(
  'SELECT * FROM developments ORDER BY id LIMIT 10 OFFSET 1000'
  // Reads 1010 rows, discards 1000, returns 10
);

// ✅ GOOD: Keyset pagination (Seek method, O(1))
const result = await pool.query(`
  SELECT * FROM developments 
  WHERE id > $1  -- Last ID from previous page
  ORDER BY id
  LIMIT 10
`, [lastId]);

// ✅ GOOD: Cursor-based pagination
const result = await pool.query(`
  SELECT * FROM developments 
  WHERE created_at < $1
  ORDER BY created_at DESC
  LIMIT 11  -- Get 1 extra to check if more pages exist
`, [cursorDate]);
```

#### Pattern 3: Aggregation Optimization

```typescript
// ❌ BAD: Multiple queries
const totalStands = await pool.query('SELECT COUNT(*) FROM stands WHERE development_id = $1', [devId]);
const availableStands = await pool.query('SELECT COUNT(*) FROM stands WHERE development_id = $1 AND status = "AVAILABLE"', [devId]);
const reservedStands = await pool.query('SELECT COUNT(*) FROM stands WHERE development_id = $1 AND status = "RESERVED"', [devId]);

// ✅ GOOD: Single aggregation query
const result = await pool.query(`
  SELECT 
    COUNT(*) as total_stands,
    COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END) as available_stands,
    COUNT(CASE WHEN status = 'RESERVED' THEN 1 END) as reserved_stands,
    COUNT(CASE WHEN status = 'SOLD' THEN 1 END) as sold_stands
  FROM stands
  WHERE development_id = $1
`, [devId]);
```

#### Pattern 4: Batch Insert/Update

```typescript
// ❌ BAD: Multiple inserts
for (const stand of stands) {
  await pool.query(
    'INSERT INTO stands (development_id, plot_number, area_sqm) VALUES ($1, $2, $3)',
    [stand.development_id, stand.plot_number, stand.area_sqm]
  );
}

// ✅ GOOD: Single batch insert
const values = stands.map((s, i) => 
  `($${i*3+1}, $${i*3+2}, $${i*3+3})`
).join(',');
const params = stands.flatMap(s => [s.development_id, s.plot_number, s.area_sqm]);
await pool.query(
  `INSERT INTO stands (development_id, plot_number, area_sqm) VALUES ${values}`,
  params
);

// ✅ BETTER: Use VALUES clause
await pool.query(`
  INSERT INTO stands (development_id, plot_number, area_sqm)
  SELECT 
    d.id, 
    jsonb_array_elements(d.plot_data)->>'plot_number',
    (jsonb_array_elements(d.plot_data)->>'area_sqm')::decimal
  FROM developments d
  WHERE d.id = $1
`, [developmentId]);
```

### 2.3 Query Analysis

```sql
-- Analyze query execution plan
EXPLAIN ANALYZE
SELECT * FROM developments 
WHERE listing_agent_id = '123' AND status = 'Active'
ORDER BY created_at DESC;

-- Result example:
-- Seq Scan on developments  (cost=0.00..35.50 rows=10 width=500)
--   Filter: (status = 'Active')
--   Planning Time: 0.123 ms
--   Execution Time: 2.456 ms

-- With index:
-- Index Scan using idx_developments_status on developments  (cost=0.29..8.31 rows=10)
--   Index Cond: (status = 'Active')
--   Planning Time: 0.089 ms
--   Execution Time: 0.234 ms

-- 10x faster! ✅
```

**Key Metrics**:
- **Cost**: Estimated arbitrary units (lower = better)
- **Rows**: Estimated rows returned
- **Width**: Estimated average row size in bytes
- **Planning Time**: Query planning overhead
- **Execution Time**: Actual runtime

---

## 3. Connection Management

### 3.1 Neon Connection Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Application (Vercel Serverless)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │ API Route 1 │  │ API Route 2   │  │ Cron Job     │   │
│ └──────┬──────┘  └────────┬──────┘  └──────┬───────┘   │
│        │                 │                 │           │
│        └─────────────────┼─────────────────┘           │
│                          │                             │
│              ┌───────────▼──────────┐                 │
│              │  pg.Pool             │                │
│              │ (Connections: 1-5)   │                │
│              └───────────┬──────────┘                 │
└──────────────────────────┼────────────────────────────┘
                           │
                    ┌──────▼──────────┐
                    │ Neon Connection │
                    │ Pool (Managed)  │
                    └──────┬──────────┘
                           │
              ┌────────────▼─────────────┐
              │ PostgreSQL (Neon Cluster)│
              └──────────────────────────┘
```

### 3.2 Connection Pool Configuration

```typescript
// app/lib/db.ts

import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // Pool size configuration
  max: 20,                    // Maximum connections in pool
  min: 2,                     // Minimum idle connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Connection attempt timeout
  
  // Statement timeout (per query)
  statement_timeout: 30000,   // 30 second query timeout
  
  // Application name (visible in pg_stat_activity)
  application_name: 'developmentsfc-erp',
});

// Connection error handling
pool.on('error', (err) => {
  console.error('[DB] Unexpected connection error:', err);
  // Trigger alert/monitoring
});

pool.on('connect', () => {
  console.log('[DB] New connection established');
});

pool.on('remove', () => {
  console.log('[DB] Connection removed from pool');
});

export async function query(sql: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } catch (error) {
    console.error('[DB] Query error:', { sql, error });
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3.3 Retry Logic & Circuit Breaker

```typescript
// app/lib/dbRetry.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 100,      // 100ms
  maxDelay: 5000,      // 5 seconds
  backoffFactor: 2,
};

export async function queryWithRetry<T>(
  sql: string,
  params?: any[],
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = finalConfig.baseDelay;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await pool.query(sql, params);
      
      if (attempt > 1) {
        console.log(`[DB] Query succeeded on attempt ${attempt}`);
      }
      
      return result as T;
    } catch (error: any) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      
      console.warn(`[DB] Query failed (attempt ${attempt}/${finalConfig.maxAttempts}):`, {
        code: error.code,
        message: error.message,
        retryable: isRetryable,
      });

      if (!isRetryable || attempt === finalConfig.maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.1 * delay;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * finalConfig.backoffFactor, finalConfig.maxDelay);
    }
  }

  throw lastError || new Error('Query failed after all retries');
}

function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'ECONNREFUSED',  // Connection refused
    'ENOTFOUND',     // DNS lookup failed
    'ETIMEDOUT',     // Timeout
    'EHOSTUNREACH',  // Host unreachable
    '40P01',         // Deadlock detected
    '42P04',         // Connection lost
    'PROTOCOL_CONNECTION_LOST',
  ];

  return retryableCodes.includes(error.code) || 
         retryableCodes.includes(error.sqlState);
}
```

### 3.4 Monitoring Connection Health

```typescript
// app/lib/dbHealth.ts

export async function getConnectionPoolStats() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
    utilizationPercentage: (pool.totalCount - pool.idleCount) / pool.totalCount * 100,
  };
}

// Call periodically
setInterval(async () => {
  const stats = await getConnectionPoolStats();
  if (stats.utilizationPercentage > 80) {
    console.warn('[DB] Connection pool utilization high:', stats);
    // Trigger alert
  }
}, 60000); // Every minute
```

---

## 4. Error Handling & Troubleshooting

### 4.1 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database unreachable | Check connection string, Neon status |
| `timeout` | Query too slow | Add index, optimize query, increase timeout |
| `deadlock detected` | Transaction conflict | Use appropriate isolation level, retry |
| `column "X" does not exist` | Schema mismatch | Check schema, run migrations |
| `duplicate key value` | Unique constraint violation | Check existing data, handle gracefully |
| `out of memory` | Query too large | Use pagination, streaming, or aggregation |

### 4.2 Structured Logging

```typescript
// app/lib/logger.ts

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  duration?: number;
  [key: string]: any;
}

export function log(
  level: LogLevel,
  message: string,
  context?: LogContext
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };

  console.log(JSON.stringify(logEntry));

  // Send to monitoring service
  if (level === LogLevel.ERROR) {
    sendToSentry(logEntry);
  }
}

// Usage
log(LogLevel.INFO, 'Development fetched', {
  requestId: req.id,
  developmentId: devId,
  duration: 125,
});

log(LogLevel.ERROR, 'Query failed', {
  requestId: req.id,
  query: 'SELECT * FROM developments',
  error: error.message,
  duration: 5000,
});
```

### 4.3 Error Boundaries in API Routes

```typescript
// app/api/admin/developments/route.ts

export async function GET(request: NextRequest) {
  try {
    // Check connection first
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        { status: 503 }
      );
    }

    // Query with retry
    const result = await queryWithRetry(
      'SELECT * FROM developments WHERE status = $1 LIMIT 50',
      ['Active']
    );

    return NextResponse.json({ data: result.rows, error: null });
  } catch (error: any) {
    const statusCode = getStatusCode(error);
    const message = sanitizeErrorMessage(error.message);

    log(LogLevel.ERROR, 'GET /api/admin/developments failed', {
      error: error.message,
      code: error.code,
      statusCode,
    });

    return NextResponse.json(
      { 
        error: message,
        code: error.code || 'INTERNAL_SERVER_ERROR'
      },
      { status: statusCode }
    );
  }
}

function getStatusCode(error: any): number {
  if (error.code === 'DB_UNAVAILABLE') return 503;
  if (error.code?.startsWith('23')) return 409; // Constraint violation
  if (error.code?.startsWith('42')) return 400; // SQL syntax error
  return 500;
}

function sanitizeErrorMessage(message: string): string {
  // Don't expose internal details to clients
  const isSensitive = message.includes('password') || 
                      message.includes('connection string') ||
                      message.includes('host');
  return isSensitive ? 'Database error' : message;
}
```

---

## 5. Scalability & Performance Monitoring

### 5.1 Monitoring Dashboard

**Tool**: Neon Console + Custom Logging

```typescript
// app/lib/metrics.ts

interface QueryMetrics {
  query: string;
  duration: number;
  rowsAffected: number;
  success: boolean;
  timestamp: Date;
}

const metricsBuffer: QueryMetrics[] = [];

export function trackQuery(
  query: string,
  duration: number,
  rowsAffected: number,
  success: boolean
) {
  metricsBuffer.push({
    query: sanitizeQuery(query),
    duration,
    rowsAffected,
    success,
    timestamp: new Date(),
  });

  // Flush every 100 queries or 10 seconds
  if (metricsBuffer.length >= 100) {
    flushMetrics();
  }
}

async function flushMetrics() {
  if (metricsBuffer.length === 0) return;

  const metrics = metricsBuffer.splice(0);
  const summary = {
    totalQueries: metrics.length,
    avgDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
    slowQueries: metrics.filter(m => m.duration > 1000).length,
    failedQueries: metrics.filter(m => !m.success).length,
    timestamp: new Date(),
  };

  console.log('[METRICS]', JSON.stringify(summary));
  // Send to monitoring service
}

// Flush periodically
setInterval(flushMetrics, 10000);
```

### 5.2 Query Performance Thresholds

| Threshold | Action |
|-----------|--------|
| < 10ms | Excellent |
| 10-100ms | Good |
| 100-1000ms | Acceptable |
| 1-5s | Investigate |
| > 5s | Critical - optimize immediately |

### 5.3 Scaling Strategies

#### Strategy 1: Read Replicas

```typescript
// Use read replica for non-critical queries
const readPool = new Pool({
  connectionString: process.env.DATABASE_URL_READ_REPLICA,
  max: 10,
});

// Critical writes go to primary
async function createReservation(data: any) {
  return query('INSERT INTO reservations (...)', data); // Primary
}

// Read-heavy queries can use replica
async function getDevelopments() {
  return readPool.query('SELECT * FROM developments'); // Replica
}
```

#### Strategy 2: Caching Layer

```typescript
// app/lib/cache.ts

import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({
  max: 500,           // Max items
  ttl: 1000 * 60 * 5, // 5 minute TTL
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

export async function getCachedDevelopments() {
  const cacheKey = 'developments:list:active';
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[CACHE] Hit:', cacheKey);
    return cached;
  }

  // Query database
  console.log('[CACHE] Miss:', cacheKey);
  const result = await pool.query('SELECT * FROM developments WHERE status = $1', ['Active']);
  
  // Cache result
  cache.set(cacheKey, result.rows);
  
  return result.rows;
}

export function invalidateCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      console.log('[CACHE] Invalidated:', key);
    }
  }
}
```

#### Strategy 3: Batch Processing

```typescript
// For bulk operations, use batch inserts not loops
async function importStands(stands: any[]) {
  const batchSize = 1000;
  
  for (let i = 0; i < stands.length; i += batchSize) {
    const batch = stands.slice(i, i + batchSize);
    
    const values = batch.map((s, j) => 
      `($${j*3+1}, $${j*3+2}, $${j*3+3})`
    ).join(',');
    
    const params = batch.flatMap(s => [
      s.development_id,
      s.plot_number,
      s.area_sqm
    ]);
    
    await pool.query(
      `INSERT INTO stands (development_id, plot_number, area_sqm) VALUES ${values}`,
      params
    );
    
    console.log(`[IMPORT] Processed ${Math.min(i + batchSize, stands.length)}/${stands.length}`);
  }
}
```

### 5.4 Capacity Planning

**Current Setup**:
- Neon connection pool: 20 max connections
- Vercel serverless: ~4 concurrent instances
- Estimated capacity: 200 concurrent queries

**Growth Plan**:

| Users | Queries/sec | Connection Pool | Action |
|-------|------------|-----------------|--------|
| 100 | 1-2 | 20 | Current setup fine |
| 1,000 | 10-20 | 20 | Monitor CPU |
| 10,000 | 100-200 | 30-50 | Increase pool size |
| 100,000 | 1000+ | 100+ | Add read replicas |

---

## 6. Migration & Deployment Strategy

### 6.1 Schema Migrations

```typescript
// scripts/runMigration.ts

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function runMigrations() {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`[MIGRATION] Running ${file}...`);

    try {
      await pool.query(sql);
      console.log(`[MIGRATION] ✓ ${file}`);

      // Record in migrations table
      await pool.query(
        'INSERT INTO migrations (name, ran_at) VALUES ($1, CURRENT_TIMESTAMP)',
        [file]
      );
    } catch (error: any) {
      console.error(`[MIGRATION] ✗ ${file}:`, error.message);
      throw error;
    }
  }
}

// Create migrations table if not exists
async function initMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
```

### 6.2 Deployment Checklist

- [ ] Run `npm run build` locally - build succeeds
- [ ] Run `npm run lint` - no errors
- [ ] Test API endpoints locally
- [ ] Database backups created
- [ ] Connection string valid in .env.production
- [ ] Migrations run successfully on staging
- [ ] Monitor logs during deployment
- [ ] Verify endpoints working on production
- [ ] Database connection pool healthy

---

## Summary & Recommendations

### Current State (✅ Production Ready)
- Neon PostgreSQL connection working
- pg Pool direct queries functioning
- Basic error handling in place
- Lazy loading and image optimization done

### Next Priority Tasks
1. **Add Query Caching** - Implement LRU cache for GET endpoints
2. **Add Batch Operations** - Implement efficient bulk import/export
3. **Add Monitoring** - Set up query duration tracking
4. **Performance Profiling** - Run EXPLAIN ANALYZE on slow queries
5. **Connection Pool Tuning** - Monitor utilization, adjust max/min

### Performance Targets
- **API Response Time**: < 100ms for 95th percentile
- **Database Query Time**: < 50ms for 95th percentile
- **Connection Pool**: < 80% utilization at peak
- **Error Rate**: < 0.1%

---

**Last Updated**: January 1, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
