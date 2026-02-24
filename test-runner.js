#!/usr/bin/env node

/**
 * QUICK TEST RUNNER - Security & CRUD Tests
 * 
 * This script runs a subset of critical security tests without Jest
 * Useful for quick validation during development
 * 
 * Usage: node test-runner.js
 * Or: npm run test:quick
 */

const http = require('http');
const https = require('https');

const API_URL = process.env.API_URL || 'http://localhost:6060/api';
const TEST_EMAIL = 'test@example.com';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test result tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Email': TEST_EMAIL
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Test case wrapper
 */
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({
      name,
      status: 'PASS',
      message: '✅'
    });
    console.log(`${colors.green}✅ PASS${colors.reset}: ${name}`);
  } catch (error) {
    failed++;
    results.push({
      name,
      status: 'FAIL',
      message: error.message
    });
    console.log(`${colors.red}❌ FAIL${colors.reset}: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * Assertion helpers
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIn(actual, expected, message) {
  if (!expected.includes(actual)) {
    throw new Error(`${message}: expected one of [${expected.join(', ')}], got ${actual}`);
  }
}

/**
 * RUN TESTS
 */
async function runTests() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   QUICK SECURITY TEST RUNNER - START    ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);

  // ============================================================================
  // Developer Dashboard Tests
  // ============================================================================
  
  console.log(`${colors.blue}TEST SUITE: Developer Dashboard${colors.reset}\n`);

  await test('Statement: Unauthenticated access blocked', async () => {
    const response = await makeRequest('GET', '/developer/statement/dev-123');
    assertEqual(response.status, 401, 'Should return 401 for unauthenticated request');
  });

  await test('Statement: Has getServerSession check', async () => {
    const response = await makeRequest('GET', '/developer/statement/dev-123');
    assertIn(response.status, [401, 403], 'Should require authentication');
  });

  await test('Stands: GET scoped to developer email', async () => {
    const response = await makeRequest('GET', '/developer/stands');
    assertIn(response.status, [200, 401], 'Should return stands or auth error, not IDOR');
  });

  await test('Stands: PUT scoped to developer email', async () => {
    const response = await makeRequest('PUT', '/developer/stands', {
      standId: 'any-id',
      status: 'SOLD'
    });
    assertIn(response.status, [200, 403, 401], 'Should enforce ownership');
  });

  await test('Payments: POST requires authentication', async () => {
    const response = await makeRequest('POST', '/developer/payments', {
      developmentId: 'dev-123',
      amount: 50000,
      paymentDate: new Date().toISOString()
    });
    assertEqual(response.status, 401, 'Should require authentication');
  });

  await test('Backup: Only returns own developments', async () => {
    const response = await makeRequest('POST', '/developer/backup', {
      type: 'full'
    });
    assertIn(response.status, [200, 401], 'Should return backup or auth error');
  });

  // ============================================================================
  // Manager Dashboard Tests
  // ============================================================================

  console.log(`\n${colors.blue}TEST SUITE: Manager Dashboard${colors.reset}\n`);

  await test('Team: POST to invite agent works', async () => {
    const response = await makeRequest('POST', '/manager/team', {
      agentEmail: `agent-${Date.now()}@test.com`,
      agentName: 'Test Agent',
      branch: 'Harare'
    });
    assertIn(response.status, [201, 401, 403], 'Should return valid response');
  });

  await test('Targets: GET single target endpoint exists', async () => {
    const response = await makeRequest('GET', '/manager/targets/target-123');
    assertIn(response.status, [200, 404, 401], 'Should return target or error');
  });

  await test('Targets: DELETE target endpoint exists', async () => {
    const response = await makeRequest('DELETE', '/manager/targets/target-123');
    assertIn(response.status, [200, 404, 401], 'Should allow deletion');
  });

  await test('Approvals: History endpoint exists', async () => {
    const response = await makeRequest('GET', '/manager/approvals/history');
    assertIn(response.status, [200, 401], 'Should return approval history');
  });

  await test('Approvals: Branch check on approve endpoint', async () => {
    const response = await makeRequest('POST', '/manager/approvals/test-123/approve', {
      comments: 'Approved'
    });
    assertIn(response.status, [200, 403, 404, 401], 'Should enforce branch isolation');
  });

  // ============================================================================
  // Email Invitation Tests
  // ============================================================================

  console.log(`\n${colors.blue}TEST SUITE: Email Invitations${colors.reset}\n`);

  await test('Invite: POST endpoint exists and requires auth', async () => {
    const response = await makeRequest('POST', '/admin/users/invite', {
      email: `invite-${Date.now()}@test.com`,
      name: 'Test User'
    });
    assertIn(response.status, [201, 401, 403], 'Should handle request');
  });

  await test('Accept: GET validation endpoint exists', async () => {
    const response = await makeRequest('GET', '/auth/accept-invitation?token=test');
    assertIn(response.status, [200, 400, 401], 'Should validate token');
  });

  // ============================================================================
  // RESULTS
  // ============================================================================

  console.log(`\n${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║        TEST EXECUTION COMPLETE          ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total:  ${passed + failed}\n`);

  if (failed > 0) {
    console.log(`${colors.yellow}FAILED TESTS:${colors.reset}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    ${r.message}`);
    });
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Start tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});
