/**
 * Run Financial Tracking Migration
 * Executes 006_financial_tracking.sql migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to database...');
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '006_financial_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration: 006_financial_tracking.sql');
    console.log('=' .repeat(80));
    
    // Execute migration
    const result = await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('=' .repeat(80));
    
    // Verify tables
    console.log('\n🔍 Verifying tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('financial_summaries', 'agent_commissions', 'developer_payments')
      ORDER BY table_name
    `);
    
    console.log(`\nCreated ${tables.rows.length} new tables:`);
    tables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    // Verify contracts columns
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contracts' 
      AND column_name IN ('commission_type', 'base_price', 'vat_amount')
      ORDER BY column_name
    `);
    
    console.log(`\n✅ Added ${columns.rows.length} financial columns to contracts table`);
    
    // Verify trigger
    const triggers = await pool.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'contracts' 
      AND trigger_name = 'trg_update_financial_summaries'
    `);
    
    if (triggers.rows.length > 0) {
      console.log('✅ Auto-update trigger created');
    }
    
    console.log('\n🎉 Financial tracking system is ready!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
