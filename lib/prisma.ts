// lib/prisma.ts
// Prisma Client Singleton for Fine & Country Zimbabwe ERP
// Prisma 7 requires driverAdapters for database connections

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { logger } from './logger';

// Use global singleton for serverless
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Slow query threshold (1 second)
const SLOW_QUERY_THRESHOLD = 1000;

function createPrismaClient(): PrismaClient {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    logger.warn('DATABASE_URL is not set', { module: 'prisma' });
    connectionString = "postgresql://localhost:5432/placeholder_missing_env";
  }

  // Create Neon adapter for Prisma 7 - pass connection string as PoolConfig
  const adapter = new PrismaNeon({ connectionString });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"] 
      : ["error"],
  });

  // Note: $use middleware is not available when using Prisma adapters (Prisma 7+)
  // Query monitoring is handled via the log configuration above
  logger.debug('Prisma client created with Neon adapter', { module: 'prisma' });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
