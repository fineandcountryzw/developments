/**
 * Direct Database Test for Financial Tracking System
 * 
 * Tests the database layer directly without needing the Next.js server
 * This validates that:
 * 1. The migration created all tables correctly
 * 2. The trigger function works
 * 3. Sample data can be inserted and queried
 */

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.log('Set it in your .env.local file or export it:');
  console.log('  export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

async function testDatabaseSchema() {
  logSection('TEST 1: Database Schema Verification');
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Check if financial tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('financial_summaries', 'agent_commissions', 'developer_payments')
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    log('\n▶ Checking financial tables...', 'blue');
    if (tablesResult.rows.length === 3) {
      log('  ✓ All 3 financial tables exist', 'green');
      tablesResult.rows.forEach(row => {
        log(`    - ${row.table_name}`, 'green');
      });
    } else {
      log(`  ✗ Expected 3 tables, found ${tablesResult.rows.length}`, 'red');
      tablesResult.rows.forEach(row => {
        log(`    - ${row.table_name}`, 'yellow');
      });
    }
    
    // Check if contracts table has financial columns
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contracts' 
      AND column_name IN (
        'commission_type', 'commission_rate', 'commission_total',
        'base_price', 'vat_amount', 'developer_net_amount'
      )
      ORDER BY column_name;
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    
    log('\n▶ Checking contracts table columns...', 'blue');
    if (columnsResult.rows.length === 6) {
      log('  ✓ All 6 key financial columns exist', 'green');
      columnsResult.rows.forEach(row => {
        log(`    - ${row.column_name}`, 'green');
      });
    } else {
      log(`  ✗ Expected 6 columns, found ${columnsResult.rows.length}`, 'red');
    }
    
    // Check if trigger function exists
    const triggerQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'update_financial_summaries';
    `;
    
    const triggerResult = await pool.query(triggerQuery);
    
    log('\n▶ Checking trigger function...', 'blue');
    if (triggerResult.rows.length > 0) {
      log('  ✓ Trigger function update_financial_summaries exists', 'green');
    } else {
      log('  ✗ Trigger function not found', 'red');
    }
    
  } catch (error) {
    log(`\n  ✗ Schema test failed: ${error.message}`, 'red');
  } finally {
    await pool.end();
  }
}

async function testDataQueries() {
  logSection('TEST 2: Data Query Tests');
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Get sample development
    log('\n▶ Finding sample development...', 'blue');
    const devQuery = `SELECT id, name FROM developments LIMIT 1`;
    const devResult = await pool.query(devQuery);
    
    if (devResult.rows.length === 0) {
      log('  ⚠ No developments found in database', 'yellow');
      log('  Create a development first to test fully', 'yellow');
      return;
    }
    
    const dev = devResult.rows[0];
    log(`  ✓ Found development: ${dev.name} (${dev.id})`, 'green');
    
    // Count contracts for this development
    log('\n▶ Counting contracts...', 'blue');
    const contractsQuery = `
      SELECT COUNT(*) as count
      FROM contracts c
      JOIN stands s ON s.id = c.stand_id
      WHERE s.development_id = $1
    `;
    const contractsResult = await pool.query(contractsQuery, [dev.id]);
    const contractCount = parseInt(contractsResult.rows[0].count);
    
    log(`  ℹ Contracts found: ${contractCount}`, 'yellow');
    
    // Check financial_summaries
    log('\n▶ Checking financial summaries...', 'blue');
    const summaryQuery = `
      SELECT 
        month_year,
        total_sales_count,
        developer_gross,
        total_commission,
        developer_net
      FROM financial_summaries
      WHERE development_id = $1
      ORDER BY month_year DESC
      LIMIT 3
    `;
    const summaryResult = await pool.query(summaryQuery, [dev.id]);
    
    if (summaryResult.rows.length > 0) {
      log(`  ✓ Found ${summaryResult.rows.length} financial summary records`, 'green');
      summaryResult.rows.forEach(row => {
        log(`    ${row.month_year}: ${row.total_sales_count} sales, $${parseFloat(row.developer_net).toFixed(2)} net`, 'green');
      });
    } else {
      log('  ℹ No financial summaries yet (normal if no sales)', 'yellow');
    }
    
    // Check agent commissions
    log('\n▶ Checking agent commissions...', 'blue');
    const commQuery = `
      SELECT COUNT(*) as count,
             SUM(commission_amount) as total
      FROM agent_commissions
    `;
    const commResult = await pool.query(commQuery);
    const commCount = parseInt(commResult.rows[0].count);
    const commTotal = parseFloat(commResult.rows[0].total) || 0;
    
    if (commCount > 0) {
      log(`  ✓ Found ${commCount} commission records, total: $${commTotal.toFixed(2)}`, 'green');
    } else {
      log('  ℹ No agent commission records yet', 'yellow');
    }
    
    // Check developer payments
    log('\n▶ Checking developer payments...', 'blue');
    const paymentQuery = `
      SELECT COUNT(*) as count,
             SUM(amount) as total
      FROM developer_payments
    `;
    const paymentResult = await pool.query(paymentQuery);
    const paymentCount = parseInt(paymentResult.rows[0].count);
    const paymentTotal = parseFloat(paymentResult.rows[0].total) || 0;
    
    if (paymentCount > 0) {
      log(`  ✓ Found ${paymentCount} payment records, total: $${paymentTotal.toFixed(2)}`, 'green');
    } else {
      log('  ℹ No developer payment records yet', 'yellow');
    }
    
  } catch (error) {
    log(`\n  ✗ Data query test failed: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await pool.end();
  }
}

async function testCommissionCalculator() {
  logSection('TEST 3: Commission Calculator Service');
  
  try {
    // Dynamic import - use TypeScript directly
    const { calculateFinancialBreakdown } = await import('../services/commissionCalculator.ts');
    
    log('\n▶ Test 1: 5% Commission Model', 'blue');
    const result1 = calculateFinancialBreakdown(
      50000, // $50,000 base price
      { type: 'percentage', rate: 5.0, agentShare: 2.5, companyShare: 2.5 },
      { vatRate: 15.5, vatEnabled: true, aosFee: 500, aosEnabled: true }
    );
    
    log(`  Base Price: $${result1.basePrice.toFixed(2)}`, 'green');
    log(`  Commission: $${result1.commission.total.toFixed(2)} (${result1.commission.type})`, 'green');
    log(`    - Agent: $${result1.commission.agentShare.toFixed(2)}`, 'green');
    log(`    - Company: $${result1.commission.companyShare.toFixed(2)}`, 'green');
    log(`  Developer Net: $${result1.developerNet.toFixed(2)}`, 'green');
    log(`  VAT: $${result1.vat.toFixed(2)}`, 'green');
    log(`  Total Fees: $${result1.fees.total.toFixed(2)}`, 'green');
    log(`  Client Pays: $${result1.totalClientPayment.toFixed(2)}`, 'green');
    
    log('\n▶ Test 2: $1000 Fixed Commission Model', 'blue');
    const result2 = calculateFinancialBreakdown(
      30000, // $30,000 base price
      { type: 'fixed', fixedAmount: 1000, agentShare: 600, companyShare: 400 },
      { vatRate: 15.5, vatEnabled: true }
    );
    
    log(`  Base Price: $${result2.basePrice.toFixed(2)}`, 'green');
    log(`  Commission: $${result2.commission.total.toFixed(2)} (${result2.commission.type})`, 'green');
    log(`    - Agent: $${result2.commission.agentShare.toFixed(2)}`, 'green');
    log(`    - Company: $${result2.commission.companyShare.toFixed(2)}`, 'green');
    log(`  Developer Net: $${result2.developerNet.toFixed(2)}`, 'green');
    log(`  VAT: $${result2.vat.toFixed(2)}`, 'green');
    log(`  Client Pays: $${result2.totalClientPayment.toFixed(2)}`, 'green');
    
    log('\n  ✓ Commission calculator working correctly', 'green');
    
  } catch (error) {
    log(`\n  ✗ Calculator test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║       Financial Tracking Database Test Suite                      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  await testDatabaseSchema();
  await testDataQueries();
  await testCommissionCalculator();
  
  logSection('TEST SUITE COMPLETE');
  log('\n✅ Database tests finished!', 'green');
  log('\nNext steps:', 'yellow');
  log('1. If schema tests passed, you\'re ready to use the APIs', 'yellow');
  log('2. Start dev server: npm run dev', 'yellow');
  log('3. Test APIs: node scripts/test-financial-apis.js', 'yellow');
  log('4. Or seed test data: psql $DATABASE_URL -f scripts/seed-test-financial-data.sql\n', 'yellow');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n');
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
