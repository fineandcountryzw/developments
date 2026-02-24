/**
 * Apply Automation Tables Migration
 * 
 * Runs the SQL migration to create automation tables
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Pool } from 'pg';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}
if (existsSync(envPath)) {
  config({ path: envPath });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

// Clean DATABASE_URL
const dbUrl = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');

async function applyMigration() {
  const pool = new Pool({ connectionString: dbUrl });
  
  try {
    console.log('🔄 Applying automation tables migration...\n');
    
    // Read SQL file
    const sqlPath = resolve(process.cwd(), 'prisma/migrations/add_automation_tables/migration.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✅ Automation tables created successfully!\n');
    console.log('Tables created:');
    console.log('  - automations');
    console.log('  - automation_runs');
    console.log('  - automation_event_logs\n');
    
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
