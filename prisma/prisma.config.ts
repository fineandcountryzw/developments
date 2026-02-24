// Prisma Configuration for Prisma v7+ with Neon
// Used for migrations and schema push commands
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file explicitly (Prisma CLI doesn't auto-load it)
config({ path: resolve(process.cwd(), '.env') });

// Use the unpooled URL for migrations (direct connection)
// Fallback to placeholder if not set (allows schema validation without real DB)
const directUrl = process.env.DATABASE_URL_UNPOOLED || 
                  process.env.DATABASE_URL || 
                  'postgresql://placeholder:placeholder@placeholder:5432/placeholder?sslmode=require';

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: directUrl,
  },
});
