/**
 * Execute migration to add discount fields to stands and price snapshot fields to reservations
 * Run with: npx tsx scripts/execute-stand-discount-migration.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function executeMigration() {
  try {
    logger.info('Starting stand discount migration', { module: 'MIGRATION' });
    
    // Read migration SQL file
    const migrationPath = join(process.cwd(), 'prisma/migrations/add_stand_discount_fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    logger.debug('Migration SQL loaded', { module: 'MIGRATION', path: migrationPath });
    
    // Get database pool
    const pool = getDbPool();
    
    // Execute migration
    logger.info('Executing migration SQL', { module: 'MIGRATION' });
    const result = await pool.query(migrationSQL);
    
    logger.info('Migration executed successfully', { 
      module: 'MIGRATION',
      command: result.command,
      rowCount: result.rowCount 
    });
    
    // Verify columns exist
    const verifyQuery = `
      SELECT column_name, table_name
      FROM information_schema.columns 
      WHERE (table_name = 'stands' AND column_name IN ('discount_percent', 'discount_active'))
         OR (table_name = 'reservations' AND column_name IN ('base_price_at_reservation', 'discount_percent_at_reservation', 'final_price_at_reservation'))
      ORDER BY table_name, column_name;
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const columns = verifyResult.rows.map((r: any) => `${r.table_name}.${r.column_name}`);
    
    logger.info('Migration verification', { 
      module: 'MIGRATION',
      columnsFound: columns,
      expectedColumns: [
        'stands.discount_active',
        'stands.discount_percent',
        'reservations.base_price_at_reservation',
        'reservations.discount_percent_at_reservation',
        'reservations.final_price_at_reservation'
      ]
    });
    
    if (columns.length >= 5) {
      console.log('✅ Migration successful! All discount and price snapshot fields added.');
      console.log('   Columns added:', columns.join(', '));
    } else {
      console.warn('⚠️  Migration completed but verification found unexpected columns:', columns);
    }
    
    // Don't close pool - it's shared and reused
    process.exit(0);
    
  } catch (error: any) {
    logger.error('Migration failed', error, { module: 'MIGRATION' });
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  }
}

executeMigration();
