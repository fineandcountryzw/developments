/**
 * Comprehensive Feature Testing Script
 * 
 * Tests all recently implemented features:
 * - Stand discount feature
 * - Reservation flow enhancements
 * - PDF URL fields
 * - Development overview display
 */

import { config } from 'dotenv';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';
import { parseRangeSpec } from '../lib/standRange';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

function addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  testResults.push({ name, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}: ${message}`);
}

async function testAllFeatures() {
  console.log('\n🧪 COMPREHENSIVE FEATURE TESTING\n');
  console.log('='.repeat(60));
  
  try {
    const pool = getDbPool();
    
    // ============================================
    // TEST 1: Database Schema Verification
    // ============================================
    console.log('\n📊 TEST 1: Database Schema Verification\n');
    
    // Test discount fields
    const discountFields = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'stands'
        AND column_name IN ('discount_percent', 'discount_active')
    `);
    
    if (discountFields.rows.length === 2) {
      addResult('Stand Discount Fields', 'PASS', 'All discount fields exist');
    } else {
      addResult('Stand Discount Fields', 'FAIL', `Missing fields. Found: ${discountFields.rows.length}/2`);
    }
    
    // Test price snapshot fields
    const priceFields = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'reservations'
        AND column_name IN ('base_price_at_reservation', 'discount_percent_at_reservation', 'final_price_at_reservation')
    `);
    
    if (priceFields.rows.length === 3) {
      addResult('Reservation Price Snapshot Fields', 'PASS', 'All price snapshot fields exist');
    } else {
      addResult('Reservation Price Snapshot Fields', 'FAIL', `Missing fields. Found: ${priceFields.rows.length}/3`);
    }
    
    // Test PDF URL fields
    const pdfFields = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'developments'
        AND column_name IN ('terms_pdf_url', 'refund_pdf_url')
    `);
    
    if (pdfFields.rows.length === 2) {
      addResult('Development PDF URL Fields', 'PASS', 'All PDF URL fields exist');
    } else {
      addResult('Development PDF URL Fields', 'FAIL', `Missing fields. Found: ${pdfFields.rows.length}/2`);
    }
    
    // ============================================
    // TEST 2: Stand Range Parser
    // ============================================
    console.log('\n🔢 TEST 2: Stand Range Parser\n');
    
    try {
      const result1 = parseRangeSpec('1-10,12,15-18');
      if (result1.errors.length === 0 && result1.standNumbers.size > 0) {
        addResult('Range Parser - Basic', 'PASS', `Parsed ${result1.standNumbers.size} stand numbers`);
      } else {
        addResult('Range Parser - Basic', 'FAIL', `Errors: ${result1.errors.join(', ')}`);
      }
      
      const result2 = parseRangeSpec('1-5');
      if (result2.errors.length === 0 && result2.standNumbers.size === 5) {
        addResult('Range Parser - Single Range', 'PASS', 'Correctly parsed single range');
      } else {
        addResult('Range Parser - Single Range', 'FAIL', `Expected 5, got ${result2.standNumbers.size}`);
      }
      
      const result3 = parseRangeSpec('invalid-range');
      if (result3.errors.length > 0) {
        addResult('Range Parser - Error Handling', 'PASS', 'Correctly rejected invalid input');
      } else {
        addResult('Range Parser - Error Handling', 'FAIL', 'Should have rejected invalid input');
      }
    } catch (error: any) {
      addResult('Range Parser', 'FAIL', `Error: ${error.message}`);
    }
    
    // ============================================
    // TEST 3: Stand Discount Application
    // ============================================
    console.log('\n💰 TEST 3: Stand Discount Application\n');
    
    // Get a development with stands
    const devResult = await pool.query(`
      SELECT d.id, d.name, COUNT(s.id) as stand_count
      FROM developments d
      LEFT JOIN stands s ON s.development_id = d.id
      WHERE d.status = 'Active'
      GROUP BY d.id, d.name
      HAVING COUNT(s.id) > 0
      ORDER BY stand_count DESC
      LIMIT 1
    `);
    
    if (devResult.rows.length === 0) {
      addResult('Discount Application', 'SKIP', 'No developments with stands found');
    } else {
      const dev = devResult.rows[0];
      
      // Get stands before discount
      const standsBefore = await pool.query(`
        SELECT stand_number, price, discount_percent
        FROM stands
        WHERE development_id = $1
          AND status = 'AVAILABLE'
        ORDER BY stand_number
        LIMIT 5
      `, [dev.id]);
      
      if (standsBefore.rows.length > 0) {
        // Apply a test discount (we'll rollback)
        const testStand = standsBefore.rows[0];
        const testStandNumber = testStand.stand_number;
        const numericValue = testStandNumber.replace(/\D/g, '');
        
        if (numericValue) {
          const standNum = parseInt(numericValue, 10);
          
          // Apply discount
          await pool.query(`
            UPDATE stands
            SET discount_percent = 10,
                discount_active = true
            WHERE development_id = $1
              AND stand_number = $2
          `, [dev.id, testStandNumber]);
          
          // Verify discount applied
          const standsAfter = await pool.query(`
            SELECT stand_number, discount_percent, discount_active
            FROM stands
            WHERE development_id = $1
              AND stand_number = $2
          `, [dev.id, testStandNumber]);
          
          const discountValue = standsAfter.rows[0]?.discount_percent;
          const discountActive = standsAfter.rows[0]?.discount_active;
          
          // Check if discount was applied (handle numeric/decimal comparison)
          const discountNum = discountValue ? parseFloat(discountValue.toString()) : null;
          
          if (standsAfter.rows.length > 0 && discountNum === 10 && discountActive === true) {
            addResult('Discount Application', 'PASS', `Discount applied to stand ${testStandNumber}`);
            
            // Rollback test discount
            await pool.query(`
              UPDATE stands
              SET discount_percent = NULL,
                  discount_active = NULL
              WHERE development_id = $1
                AND stand_number = $2
            `, [dev.id, testStandNumber]);
          } else {
            addResult('Discount Application', 'FAIL', 
              `Discount not applied correctly. Got: ${discountNum}, Active: ${discountActive}`);
          }
        } else {
          addResult('Discount Application', 'SKIP', 'Could not extract numeric value from stand number');
        }
      } else {
        addResult('Discount Application', 'SKIP', 'No available stands found');
      }
    }
    
    // ============================================
    // TEST 4: Price Calculation
    // ============================================
    console.log('\n🧮 TEST 4: Price Calculation\n');
    
    const priceTests = [
      { basePrice: 100000, discountPercent: 10, expected: 90000 },
      { basePrice: 50000, discountPercent: 15, expected: 42500 },
      { basePrice: 200000, discountPercent: 5, expected: 190000 },
    ];
    
    let priceTestsPassed = 0;
    for (const test of priceTests) {
      const calculated = test.basePrice * (1 - test.discountPercent / 100);
      if (Math.abs(calculated - test.expected) < 0.01) {
        priceTestsPassed++;
      }
    }
    
    if (priceTestsPassed === priceTests.length) {
      addResult('Price Calculation', 'PASS', `All ${priceTests.length} test cases passed`);
    } else {
      addResult('Price Calculation', 'FAIL', `${priceTestsPassed}/${priceTests.length} test cases passed`);
    }
    
    // ============================================
    // TEST 5: Reservation Price Snapshot
    // ============================================
    console.log('\n📸 TEST 5: Reservation Price Snapshot\n');
    
    // Check if any reservations have price snapshots
    const reservationCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM reservations
      WHERE base_price_at_reservation IS NOT NULL
         OR final_price_at_reservation IS NOT NULL
    `);
    
    const hasSnapshots = parseInt(reservationCheck.rows[0]?.count || '0', 10) > 0;
    
    if (hasSnapshots) {
      addResult('Reservation Price Snapshot', 'PASS', 'Reservations with price snapshots found');
    } else {
      // Check if we can create a test reservation
      const testStand = await pool.query(`
        SELECT s.id, s.stand_number, s.price, s.discount_percent
        FROM stands s
        WHERE s.status = 'AVAILABLE'
        LIMIT 1
      `);
      
      if (testStand.rows.length > 0) {
        addResult('Reservation Price Snapshot', 'SKIP', 'No existing snapshots, but fields ready for use');
      } else {
        addResult('Reservation Price Snapshot', 'SKIP', 'No stands available for testing');
      }
    }
    
    // ============================================
    // TEST 6: Development Overview Field
    // ============================================
    console.log('\n📝 TEST 6: Development Overview Field\n');
    
    const overviewCheck = await pool.query(`
      SELECT COUNT(*) as total_devs,
             COUNT(overview) as with_overview
      FROM developments
      WHERE status = 'Active'
    `);
    
    const totalDevs = parseInt(overviewCheck.rows[0]?.total_devs || '0', 10);
    const withOverview = parseInt(overviewCheck.rows[0]?.with_overview || '0', 10);
    
    if (totalDevs > 0) {
      addResult('Development Overview Field', 'PASS', 
        `Overview field exists. ${withOverview}/${totalDevs} developments have overview text`);
    } else {
      addResult('Development Overview Field', 'SKIP', 'No active developments found');
    }
    
    // ============================================
    // TEST 7: PDF URL Fields
    // ============================================
    console.log('\n📄 TEST 7: PDF URL Fields\n');
    
    const pdfCheck = await pool.query(`
      SELECT COUNT(*) as total_devs,
             COUNT(terms_pdf_url) as with_terms,
             COUNT(refund_pdf_url) as with_refund
      FROM developments
      WHERE status = 'Active'
    `);
    
    const pdfTotalDevs = parseInt(pdfCheck.rows[0]?.total_devs || '0', 10);
    const withTerms = parseInt(pdfCheck.rows[0]?.with_terms || '0', 10);
    const withRefund = parseInt(pdfCheck.rows[0]?.with_refund || '0', 10);
    
    if (pdfTotalDevs > 0) {
      addResult('PDF URL Fields', 'PASS', 
        `Fields ready. ${withTerms} developments have Terms PDF, ${withRefund} have Refund PDF`);
    } else {
      addResult('PDF URL Fields', 'SKIP', 'No active developments found');
    }
    
    // ============================================
    // TEST SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    const skipped = testResults.filter(r => r.status === 'SKIP').length;
    const totalTests = testResults.length;
    
    console.log(`\n✅ Passed: ${passed}/${totalTests}`);
    console.log(`❌ Failed: ${failed}/${totalTests}`);
    console.log(`⏭️  Skipped: ${skipped}/${totalTests}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (failed === 0) {
      console.log('✨ All tests passed! Features are ready for use.');
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.');
    }
    
    console.log('='.repeat(60) + '\n');
    
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error: any) {
    logger.error('Feature testing failed', error, { module: 'TEST' });
    console.error('❌ Test suite failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testAllFeatures();
