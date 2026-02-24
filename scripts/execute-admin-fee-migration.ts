/**
 * Execute migration to add admin fee fields to developments table
 * Run with: npx tsx scripts/execute-admin-fee-migration.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function executeMigration() {
  try {
    logger.info('Starting admin fee migration', { module: 'MIGRATION' });

    const migrationPath = join(process.cwd(), 'prisma/migrations/add_admin_fee_fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    const pool = getDbPool();
    await pool.query(migrationSQL);

    const verify = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'developments'
        AND column_name IN ('admin_fee_enabled', 'admin_fee')
      ORDER BY column_name;
    `);

    const cols = verify.rows.map((r: any) => r.column_name);
    if (cols.length >= 2) {
      console.log('✅ Migration successful! Admin fee fields added:', cols.join(', '));
    } else {
      console.warn('⚠️  Migration ran but verification did not find expected columns:', cols);
    }

    process.exit(0);
  } catch (error: any) {
    logger.error('Admin fee migration failed', error, { module: 'MIGRATION' });
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

executeMigration();

