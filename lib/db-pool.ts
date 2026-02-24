/**
 * Shared Database Connection Pool
 * 
 * Provides a singleton Pool instance for efficient connection reuse across API routes.
 * This prevents creating new pools for each request, which is inefficient and can lead to connection leaks.
 */

import { Pool } from 'pg';
import { logger } from './logger';

// Global pool instance (singleton pattern)
let poolInstance: Pool | null = null;

/**
 * Get or create the shared database connection pool
 */
export function getDbPool(): Pool {
  if (poolInstance) {
    return poolInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.error('DATABASE_URL not set', undefined, { module: 'db-pool' });
    throw new Error('DATABASE_URL environment variable is not configured');
  }

  logger.info('Creating shared database connection pool', { module: 'db-pool' });

  poolInstance = new Pool({
    connectionString: databaseUrl,
    
    // Pool size configuration
    max: 20,                    // Maximum connections in pool
    min: 2,                     // Minimum idle connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Connection attempt timeout (10s)
    
    // Statement timeout (per query) - 30 seconds
    statement_timeout: 30000,
    
    // Application name (visible in pg_stat_activity)
    application_name: 'developmentsfc-erp',
  });

  // Connection error handling
  poolInstance.on('error', (err) => {
    logger.error('Unexpected database connection pool error', err, { module: 'db-pool' });
    // Don't recreate pool on error - let it handle reconnection automatically
  });

  poolInstance.on('connect', () => {
    logger.debug('New database connection established', { module: 'db-pool' });
  });

  poolInstance.on('remove', () => {
    logger.debug('Database connection removed from pool', { module: 'db-pool' });
  });

  return poolInstance;
}

/**
 * Close the database pool (for cleanup during shutdown)
 * Note: In serverless environments, this may not be called
 */
export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    logger.info('Closing database connection pool', { module: 'db-pool' });
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Execute a query using the shared pool
 * This is a convenience wrapper that handles connection lifecycle
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getDbPool();
  const startTime = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        module: 'db-pool',
        duration: `${duration}ms`,
        query: text.substring(0, 100),
      });
    }
    
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } catch (error: any) {
    logger.error('Database query error', error, {
      module: 'db-pool',
      query: text.substring(0, 100),
      params: params?.length || 0,
    });
    throw error;
  }
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats() {
  if (!poolInstance) {
    return {
      totalConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      status: 'not_initialized',
    };
  }

  return {
    totalConnections: poolInstance.totalCount,
    idleConnections: poolInstance.idleCount,
    waitingRequests: poolInstance.waitingCount,
    status: 'active',
  };
}
