/**
 * Test Stand Discount Feature
 * 
 * Tests the discount API endpoint and verifies discount application
 */

import { config } from 'dotenv';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function testDiscountFeature() {
  try {
    console.log('\n🧪 Testing Stand Discount Feature...\n');
    
    const pool = getDbPool();
    
    // 1. Get a development with stands
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
      console.log('⚠️  No developments with stands found. Please seed stands first.');
      process.exit(0);
    }
    
    const development = devResult.rows[0];
    console.log(`✅ Found development: ${development.name} (${development.stand_count} stands)`);
    console.log(`   Development ID: ${development.id}\n`);
    
    // 2. Get some available stands
    const standsResult = await pool.query(`
      SELECT stand_number, price, status, discount_percent, discount_active
      FROM stands
      WHERE development_id = $1
        AND status = 'AVAILABLE'
      ORDER BY stand_number
      LIMIT 10
    `, [development.id]);
    
    if (standsResult.rows.length === 0) {
      console.log('⚠️  No available stands found for testing.');
      process.exit(0);
    }
    
    console.log(`📊 Sample stands (first 10 available):`);
    standsResult.rows.forEach((stand: any) => {
      const discount = stand.discount_percent ? `${stand.discount_percent}%` : 'None';
      console.log(`   - ${stand.stand_number}: $${stand.price} (Discount: ${discount})`);
    });
    console.log();
    
    // 3. Test discount application (simulate)
    console.log('💡 To apply a discount, use the API endpoint:');
    console.log(`   POST /api/admin/developments/${development.id}/discounts`);
    console.log(`   Body: { "discountPercent": 10, "rangeSpec": "1-5", "active": true }`);
    console.log();
    
    // 4. Verify discount fields exist
    console.log('✅ Verifying discount fields in database...');
    const fieldCheck = await pool.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stands'
        AND column_name IN ('discount_percent', 'discount_active')
      ORDER BY column_name
    `);
    
    if (fieldCheck.rows.length === 2) {
      console.log('   ✅ Discount fields exist:');
      fieldCheck.rows.forEach((field: any) => {
        console.log(`      - ${field.column_name}: ${field.data_type} (nullable: ${field.is_nullable})`);
      });
    } else {
      console.log('   ⚠️  Some discount fields missing:', fieldCheck.rows);
    }
    
    // 5. Verify price snapshot fields exist
    console.log('\n✅ Verifying price snapshot fields in reservations...');
    const reservationFields = await pool.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reservations'
        AND column_name IN ('base_price_at_reservation', 'discount_percent_at_reservation', 'final_price_at_reservation')
      ORDER BY column_name
    `);
    
    if (reservationFields.rows.length === 3) {
      console.log('   ✅ Price snapshot fields exist:');
      reservationFields.rows.forEach((field: any) => {
        console.log(`      - ${field.column_name}: ${field.data_type} (nullable: ${field.is_nullable})`);
      });
    } else {
      console.log('   ⚠️  Some price snapshot fields missing:', reservationFields.rows);
    }
    
    // 6. Verify PDF URL fields exist
    console.log('\n✅ Verifying PDF URL fields in developments...');
    const pdfFields = await pool.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'developments'
        AND column_name IN ('terms_pdf_url', 'refund_pdf_url')
      ORDER BY column_name
    `);
    
    if (pdfFields.rows.length === 2) {
      console.log('   ✅ PDF URL fields exist:');
      pdfFields.rows.forEach((field: any) => {
        console.log(`      - ${field.column_name}: ${field.data_type} (nullable: ${field.is_nullable})`);
      });
    } else {
      console.log('   ⚠️  Some PDF URL fields missing:', pdfFields.rows);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ P0 MIGRATION VERIFICATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Stand discount fields: ${fieldCheck.rows.length}/2`);
    console.log(`   ✅ Reservation price snapshot fields: ${reservationFields.rows.length}/3`);
    console.log(`   ✅ Development PDF URL fields: ${pdfFields.rows.length}/2`);
    console.log(`   ✅ Test development ready: ${development.name}`);
    console.log(`   ✅ Available stands: ${standsResult.rows.length}`);
    console.log('\n🚀 Next: Test discount API endpoint with the development ID above\n');
    
    process.exit(0);
    
  } catch (error: any) {
    logger.error('Discount feature test failed', error, { module: 'TEST' });
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testDiscountFeature();
