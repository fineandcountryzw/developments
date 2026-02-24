/**
 * Test script for Financial Tracking APIs
 * 
 * Tests all 4 endpoints:
 * 1. Financial Summary - GET /api/financial/summary
 * 2. Developer Statement - GET /api/developer/statement/[developmentId]
 * 3. Agent Commissions - GET /api/agent/commissions
 * 4. Developer Payments - POST /api/developer/payments
 * 
 * Usage:
 *   node scripts/test-financial-apis.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Colors for console output
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

function logTest(testName) {
  log(`\n▶ Test: ${testName}`, 'blue');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'yellow');
}

// Test data (replace with actual IDs from your database)
const TEST_DATA = {
  developmentId: 'dev-1', // Replace with actual development ID
  agentId: 'agent-1', // Replace with actual agent user ID
};

/**
 * Test 1: Financial Summary Endpoint
 */
async function testFinancialSummary() {
  logSection('TEST 1: Financial Summary Endpoint');
  
  try {
    // Test 1A: Get overall summary
    logTest('Get overall financial summary');
    const response1 = await fetch(`${BASE_URL}/api/financial/summary`);
    const data1 = await response1.json();
    
    if (response1.ok) {
      logSuccess('API responded successfully');
      logInfo(`Development count: ${data1.summary.development_count}`);
      logInfo(`Total sales: ${data1.summary.total_sales}`);
      logInfo(`Total sales value: $${data1.summary.total_sales_value.toFixed(2)}`);
      logInfo(`Developer outstanding: $${data1.summary.developer_outstanding_total.toFixed(2)}`);
      logInfo(`Company commissions: $${data1.summary.commissions_earned_total.toFixed(2)}`);
      logInfo(`Developments returned: ${data1.developments.length}`);
    } else {
      logError(`API error: ${data1.error}`);
      if (data1.details) logError(`Details: ${data1.details}`);
    }
    
    // Test 1B: Filter by development
    if (TEST_DATA.developmentId) {
      logTest('Get summary filtered by development');
      const response2 = await fetch(
        `${BASE_URL}/api/financial/summary?developmentId=${TEST_DATA.developmentId}`
      );
      const data2 = await response2.json();
      
      if (response2.ok) {
        logSuccess('Filtered by development successfully');
        logInfo(`Developments returned: ${data2.developments.length}`);
      } else {
        logError(`Filter error: ${data2.error}`);
      }
    }
    
    // Test 1C: Filter by date range
    logTest('Get summary filtered by date range');
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const response3 = await fetch(
      `${BASE_URL}/api/financial/summary?startDate=${currentMonth}&endDate=${currentMonth}`
    );
    const data3 = await response3.json();
    
    if (response3.ok) {
      logSuccess('Filtered by date range successfully');
      logInfo(`Current month (${currentMonth}) sales: ${data3.summary.total_sales}`);
    } else {
      logError(`Date filter error: ${data3.error}`);
    }
    
  } catch (error) {
    logError(`Exception: ${error.message}`);
  }
}

/**
 * Test 2: Developer Statement Endpoint
 */
async function testDeveloperStatement() {
  logSection('TEST 2: Developer Statement Endpoint');
  
  if (!TEST_DATA.developmentId) {
    logError('TEST_DATA.developmentId not set - skipping test');
    logInfo('Update TEST_DATA.developmentId in script with actual ID');
    return;
  }
  
  try {
    // Test 2A: Get full statement
    logTest('Get developer statement for development');
    const response1 = await fetch(
      `${BASE_URL}/api/developer/statement/${TEST_DATA.developmentId}`
    );
    const data1 = await response1.json();
    
    if (response1.ok) {
      logSuccess('Statement generated successfully');
      logInfo(`Development: ${data1.development_name}`);
      logInfo(`Developer: ${data1.developer_name} (${data1.developer_email})`);
      logInfo(`Stands sold: ${data1.total_stands_sold}`);
      logInfo(`Gross sales: $${data1.gross_sales.toFixed(2)}`);
      logInfo(`Commission: $${data1.total_commission.toFixed(2)}`);
      logInfo(`Net amount: $${data1.net_amount.toFixed(2)}`);
      logInfo(`Payments received: $${data1.payments_received.toFixed(2)}`);
      logInfo(`Outstanding: $${data1.outstanding_balance.toFixed(2)}`);
      logInfo(`VAT collected: $${data1.vat_collected.toFixed(2)}`);
      logInfo(`Transactions: ${data1.transactions.length}`);
      logInfo(`Payment history: ${data1.payment_history.length}`);
      
      // Show first transaction if available
      if (data1.transactions.length > 0) {
        const tx = data1.transactions[0];
        logInfo(`  First transaction: Stand ${tx.stand_number} - ${tx.client_name} - $${tx.net_to_developer.toFixed(2)}`);
      }
    } else {
      logError(`API error: ${data1.error}`);
      if (data1.details) logError(`Details: ${data1.details}`);
    }
    
    // Test 2B: Get statement for specific period
    logTest('Get statement for current month');
    const currentMonth = new Date().toISOString().slice(0, 7);
    const response2 = await fetch(
      `${BASE_URL}/api/developer/statement/${TEST_DATA.developmentId}?period=${currentMonth}`
    );
    const data2 = await response2.json();
    
    if (response2.ok) {
      logSuccess('Period-filtered statement generated');
      logInfo(`Period: ${data2.period}`);
      logInfo(`Stands sold this month: ${data2.total_stands_sold}`);
    } else {
      logError(`Period filter error: ${data2.error}`);
    }
    
  } catch (error) {
    logError(`Exception: ${error.message}`);
  }
}

/**
 * Test 3: Agent Commissions Endpoint
 */
async function testAgentCommissions() {
  logSection('TEST 3: Agent Commissions Endpoint');
  
  if (!TEST_DATA.agentId) {
    logError('TEST_DATA.agentId not set - skipping test');
    logInfo('Update TEST_DATA.agentId in script with actual ID');
    return;
  }
  
  try {
    // Test 3A: Get all commissions
    logTest('Get all agent commissions');
    const response1 = await fetch(
      `${BASE_URL}/api/agent/commissions?agentId=${TEST_DATA.agentId}`
    );
    const data1 = await response1.json();
    
    if (response1.ok) {
      logSuccess('Commissions retrieved successfully');
      logInfo(`Agent: ${data1.agent_name} (${data1.agent_email})`);
      logInfo(`Total earned: $${data1.summary.total_earned.toFixed(2)}`);
      logInfo(`Pending: $${data1.summary.pending_amount.toFixed(2)}`);
      logInfo(`Paid this month: $${data1.summary.paid_this_month.toFixed(2)}`);
      logInfo(`Paid lifetime: $${data1.summary.paid_lifetime.toFixed(2)}`);
      logInfo(`Sales count: ${data1.summary.sales_count}`);
      logInfo(`Commission records: ${data1.commissions.length}`);
      
      // Show first commission if available
      if (data1.commissions.length > 0) {
        const comm = data1.commissions[0];
        logInfo(`  First commission: Stand ${comm.stand_number} - ${comm.development_name}`);
        logInfo(`    Amount: $${comm.commission_amount.toFixed(2)} - Status: ${comm.status}`);
      }
    } else {
      logError(`API error: ${data1.error}`);
      if (data1.details) logError(`Details: ${data1.details}`);
    }
    
    // Test 3B: Filter by status
    logTest('Get pending commissions only');
    const response2 = await fetch(
      `${BASE_URL}/api/agent/commissions?agentId=${TEST_DATA.agentId}&status=PENDING`
    );
    const data2 = await response2.json();
    
    if (response2.ok) {
      logSuccess('Filtered commissions retrieved');
      logInfo(`Pending commissions: ${data2.commissions.length}`);
    } else {
      logError(`Filter error: ${data2.error}`);
    }
    
  } catch (error) {
    logError(`Exception: ${error.message}`);
  }
}

/**
 * Test 4: Developer Payments Endpoint
 */
async function testDeveloperPayments() {
  logSection('TEST 4: Developer Payments Endpoint');
  
  if (!TEST_DATA.developmentId) {
    logError('TEST_DATA.developmentId not set - skipping payment recording test');
    logInfo('Update TEST_DATA.developmentId in script with actual ID');
  } else {
    try {
      // Test 4A: Record a test payment
      logTest('Record developer payment');
      const paymentData = {
        developmentId: TEST_DATA.developmentId,
        amount: 10000.00,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'Bank Transfer',
        referenceNumber: `TEST-${Date.now()}`,
        notes: 'Test payment from API test script',
      };
      
      const response1 = await fetch(`${BASE_URL}/api/developer/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      const data1 = await response1.json();
      
      if (response1.ok) {
        logSuccess('Payment recorded successfully');
        logInfo(`Payment ID: ${data1.payment.id}`);
        logInfo(`Development: ${data1.payment.development_name}`);
        logInfo(`Amount: $${data1.payment.amount.toFixed(2)}`);
        logInfo(`Reference: ${data1.payment.reference_number}`);
      } else {
        logError(`Payment error: ${data1.error}`);
        if (data1.details) logError(`Details: ${data1.details}`);
      }
    } catch (error) {
      logError(`Exception: ${error.message}`);
    }
  }
  
  try {
    // Test 4B: Get payment history
    logTest('Get payment history');
    const response2 = await fetch(`${BASE_URL}/api/developer/payments`);
    const data2 = await response2.json();
    
    if (response2.ok) {
      logSuccess('Payment history retrieved');
      logInfo(`Total payments: ${data2.payments.length}`);
      
      if (data2.payments.length > 0) {
        const recent = data2.payments[0];
        logInfo(`  Most recent: $${recent.amount.toFixed(2)} to ${recent.development_name}`);
        logInfo(`    Date: ${new Date(recent.payment_date).toLocaleDateString()}`);
      }
    } else {
      logError(`History error: ${data2.error}`);
    }
    
    // Test 4C: Get payments for specific development
    if (TEST_DATA.developmentId) {
      logTest('Get payments for specific development');
      const response3 = await fetch(
        `${BASE_URL}/api/developer/payments?developmentId=${TEST_DATA.developmentId}`
      );
      const data3 = await response3.json();
      
      if (response3.ok) {
        logSuccess('Filtered payments retrieved');
        logInfo(`Payments for development: ${data3.payments.length}`);
      } else {
        logError(`Filter error: ${data3.error}`);
      }
    }
    
  } catch (error) {
    logError(`Exception: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         Financial Tracking API Test Suite                         ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo('Make sure your dev server is running (npm run dev)');
  logInfo('Press Ctrl+C to stop at any time\n');
  
  // Update these IDs with actual values from your database
  log('\n⚠️  IMPORTANT: Update TEST_DATA with actual IDs from your database', 'yellow');
  logInfo(`Current developmentId: ${TEST_DATA.developmentId}`);
  logInfo(`Current agentId: ${TEST_DATA.agentId}`);
  
  await testFinancialSummary();
  await testDeveloperStatement();
  await testAgentCommissions();
  await testDeveloperPayments();
  
  logSection('TEST SUITE COMPLETE');
  log('All tests finished!', 'green');
  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n');
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
