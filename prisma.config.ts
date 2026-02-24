// Prisma Configuration for Prisma v7+ with Neon
// Used for migrations and schema push commands
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file explicitly (Prisma CLI doesn't auto-load it)
config({ path: resolve(process.cwd(), '.env') });

// Use the DATABASE_URL from environment
const databaseUrl = process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  'postgresql://placeholder:placeholder@placeholder:5432/placeholder?sslmode=require';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
