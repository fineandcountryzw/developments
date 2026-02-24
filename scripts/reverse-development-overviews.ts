/**
 * Reverse Comprehensive Overviews from All Developments
 * 
 * Removes or clears the comprehensive overviews that were previously seeded.
 * This will clear the overview field for all developments.
 */

import { config } from 'dotenv';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function reverseDevelopmentOverviews() {
  try {
    logger.info('Starting overview reversal', { module: 'SEED' });
    
    const pool = getDbPool();
    
    // Get all developments with overviews
    const result = await pool.query(`
      SELECT 
        id, name, location, overview
      FROM developments
      WHERE overview IS NOT NULL AND overview != ''
      ORDER BY updated_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No developments with overviews found');
      process.exit(0);
    }
    
    console.log(`\n📍 Found ${result.rows.length} developments with overviews\n`);
    
    // Show what will be cleared
    console.log('Developments that will have overviews cleared:');
    result.rows.forEach((dev, index) => {
      const overviewLength = dev.overview ? dev.overview.length : 0;
      console.log(`  ${index + 1}. ${dev.name} (${dev.location}) - ${overviewLength} chars`);
    });
    
    console.log('\n⚠️  This will clear all overview fields.');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');
    
    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let cleared = 0;
    
    for (const dev of result.rows) {
      const developmentId = dev.id;
      
      console.log(`\n📝 Clearing overview for: ${dev.name}`);
      
      // Clear overview field
      await pool.query(
        `UPDATE developments 
         SET overview = NULL, updated_at = NOW()
         WHERE id = $1`,
        [developmentId]
      );
      
      console.log(`   ✅ Overview cleared`);
      
      cleared++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ OVERVIEW REVERSAL COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Cleared: ${cleared} developments`);
    console.log(`   📝 Total processed: ${result.rows.length} developments\n`);
    
    process.exit(0);
    
  } catch (error: any) {
    logger.error('Overview reversal failed', error, { module: 'SEED' });
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

reverseDevelopmentOverviews();
