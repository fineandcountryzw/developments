/**
 * Neon Serverless Adapter Configuration
 * Enables edge deployment with HTTP-based queries
 * Uses @neondatabase/serverless for Vercel compatibility
 * 
 * NOTE: For most use cases, use the Prisma client from lib/prisma.ts
 * This module is for raw SQL queries when needed.
 */

import { neon, neonConfig } from '@neondatabase/serverless';

// Configure for serverless environments
neonConfig.fetchConnectionCache = true;

/**
 * Get cleaned database URL (removes incompatible parameters)
 */
function getCleanDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required');
  }

  // Remove channel_binding parameter (not supported by HTTP adapter)
  return connectionString.replace(/[&?]channel_binding=require/g, '');
}

/**
 * Create direct SQL query client using Neon HTTP
 * Use this for raw SQL queries outside of Prisma
 */
export const createNeonClient = () => {
  return neon(getCleanDatabaseUrl());
};

/**
 * Execute raw SQL with proper error handling
 * Uses tagged template literal syntax for Neon
 * NOTE: For complex queries, prefer using Prisma's $queryRaw or $executeRaw
 * @param sql - SQL query string  
 * @returns Object with data or error
 */
export async function executeSQL<T = any>(sql: TemplateStringsArray, ...params: any[]): Promise<{ data: T | null; error: string | null }> {
  try {
    const client = createNeonClient();
    // Use tagged template literal syntax
    const result = await client(sql, ...params);
    return { data: result as T, error: null };
  } catch (error: any) {
    console.error('[NEON] SQL execution error:', error);
    return { 
      data: null, 
      error: error.message || 'Database query failed' 
    };
  }
}

/**
 * Test serverless connection
 */
export async function testServerlessConnection(): Promise<boolean> {
  try {
    const client = createNeonClient();
    await client`SELECT 1 as test`;
    console.log('[NEON] Connection test passed');
    return true;
  } catch (error: any) {
    console.error('[NEON] Connection test failed:', error.message);
    return false;
  }
}

/**
 * @deprecated Use Prisma client from lib/prisma.ts instead
 */
export const createServerlessPool = () => {
  console.warn('[DEPRECATED] createServerlessPool is deprecated. Use Prisma client from lib/prisma.ts instead.');
  return createNeonClient();
};

export default {
  createNeonClient,
  executeSQL,
  testServerlessConnection,
};
