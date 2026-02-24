/**
 * Run Financial Tracking Migration
 * Executes the 006_financial_tracking.sql migration
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Running Financial Tracking Migration...\n');
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '006_financial_tracking.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log(`   Path: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} characters\n`);
    
    // Execute migration
    console.log('⚡ Executing migration...\n');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('financial_summaries', 'agent_commissions', 'developer_payments')
      ORDER BY table_name;
    `;
    
    const result = await pool.query(verifyQuery);
    
    console.log('📊 Verification:');
    if (result.rows.length === 3) {
      console.log('   ✓ All 3 tables created successfully:');
      result.rows.forEach(row => {
        console.log(`     - ${row.table_name}`);
      });
    } else {
      console.log(`   ⚠ Only ${result.rows.length}/3 tables found`);
    }
    
    console.log('\n🎉 Financial tracking system is ready!');
    console.log('\nNext steps:');
    console.log('1. Run tests: node scripts/test-financial-database.js');
    console.log('2. Seed data: node scripts/seed-test-data.js (create this)');
    console.log('3. Start server: npm run dev');
    console.log('4. Test APIs: node scripts/test-financial-apis.js\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
