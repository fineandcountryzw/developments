/**
 * Execute migration to add lawyer fields to developments table
 * Run with: npx tsx scripts/execute-lawyer-fields-migration.ts
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
    logger.info('Starting lawyer fields migration', { module: 'MIGRATION' });
    
    // Read migration SQL file
    const migrationPath = join(process.cwd(), 'prisma/migrations/add_lawyer_fields_to_developments.sql');
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
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'developments' 
      AND column_name IN ('lawyer_name', 'lawyer_email', 'lawyer_phone')
      ORDER BY column_name;
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const columns = verifyResult.rows.map((r: any) => r.column_name);
    
    logger.info('Migration verification', { 
      module: 'MIGRATION',
      columnsFound: columns,
      expectedColumns: ['lawyer_email', 'lawyer_name', 'lawyer_phone']
    });
    
    if (columns.length === 3) {
      console.log('✅ Migration successful! All lawyer fields added to developments table.');
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
