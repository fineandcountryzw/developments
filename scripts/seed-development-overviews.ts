/**
 * Seed Comprehensive Overviews to All Developments
 * 
 * Generates and injects detailed, marketing-focused overviews for all developments
 * that don't have comprehensive overviews yet.
 */

import { config } from 'dotenv';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

/**
 * Generate comprehensive overview based on development properties
 */
function generateComprehensiveOverview(dev: any): string {
  const name = dev.name || 'This Development';
  const location = dev.location || 'Zimbabwe';
  const phase = dev.phase || 'SERVICING';
  const servicingProgress = parseFloat(dev.servicing_progress || '0');
  const basePrice = parseFloat(dev.base_price || '0');
  const pricePerSqm = parseFloat(dev.price_per_sqm || '0');
  const totalStands = parseInt(dev.total_stands || '0', 10);
  const availableStands = parseInt(dev.available_stands || '0', 10);
  const branch = dev.branch || 'Harare';
  
  // Parse features array if it's JSON
  let features: string[] = [];
  try {
    if (dev.features) {
      if (typeof dev.features === 'string') {
        features = JSON.parse(dev.features);
      } else if (Array.isArray(dev.features)) {
        features = dev.features;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  // Parse stand sizes if available
  let standSizes: any = null;
  try {
    if (dev.stand_sizes) {
      if (typeof dev.stand_sizes === 'string') {
        standSizes = JSON.parse(dev.stand_sizes);
      } else {
        standSizes = dev.stand_sizes;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  // Determine phase description
  const phaseDescriptions: Record<string, string> = {
    'PLANNING': 'currently in the planning phase',
    'SERVICING': 'undergoing infrastructure development',
    'READY_TO_BUILD': 'fully serviced and ready for construction',
    'COMPLETED': 'fully completed with all infrastructure in place'
  };
  
  const phaseDesc = phaseDescriptions[phase] || 'in active development';
  const progressDesc = servicingProgress >= 90 
    ? 'nearly complete' 
    : servicingProgress >= 70 
    ? 'well underway' 
    : servicingProgress >= 50 
    ? 'progressing steadily' 
    : 'in early stages';
  
  // Build feature list
  const featureList = features.length > 0 
    ? features.slice(0, 6).join(', ') + (features.length > 6 ? ', and more' : '')
    : 'modern infrastructure and amenities';
  
  // Stand size information
  let standSizeInfo = '';
  if (standSizes) {
    const sizes = [];
    if (standSizes.small) sizes.push(`${standSizes.small}m²`);
    if (standSizes.medium) sizes.push(`${standSizes.medium}m²`);
    if (standSizes.large) sizes.push(`${standSizes.large}m²`);
    if (sizes.length > 0) {
      standSizeInfo = ` Stands range from ${sizes.join(' to ')}.`;
    }
  }
  
  // Location-specific benefits
  const locationBenefits: Record<string, string> = {
    'Harare': 'strategic location in Zimbabwe\'s capital city, offering proximity to business districts, schools, and shopping centers',
    'Bulawayo': 'prime location in Zimbabwe\'s second-largest city, known for its rich cultural heritage and modern amenities',
    'Victoria Falls': 'exclusive location near one of the world\'s natural wonders, perfect for tourism and investment',
    'Norton': 'serene suburban setting with easy access to Harare, ideal for families seeking a peaceful lifestyle'
  };
  
  const locationBenefit = locationBenefits[branch] || `strategic location in ${location}`;
  
  // Price positioning
  let pricePositioning = '';
  if (basePrice > 100000) {
    pricePositioning = 'premium investment opportunity';
  } else if (basePrice > 60000) {
    pricePositioning = 'excellent value for discerning buyers';
  } else {
    pricePositioning = 'affordable entry point into quality property ownership';
  }
  
  // Build comprehensive overview
  const overview = `Welcome to ${name}, an exceptional residential development ${locationBenefit}. This ${phaseDesc} project offers ${totalStands} carefully planned stands, with ${availableStands} currently available for immediate acquisition.

${name} represents a ${pricePositioning}, with infrastructure development ${progressDesc} at ${servicingProgress}% completion. The development features ${featureList}, ensuring residents enjoy modern conveniences and a high quality of life.${standSizeInfo}

Whether you're seeking a family home, an investment property, or a retirement haven, ${name} provides the perfect foundation. The development is designed with careful attention to detail, offering secure, well-planned residential spaces that meet the highest standards.

Located in ${location}, this development benefits from excellent connectivity and proximity to essential services. With flexible payment plans and transparent pricing starting from $${basePrice.toLocaleString()}, ${name} makes property ownership accessible and straightforward.

Don't miss this opportunity to secure your place in one of ${branch}'s most promising residential developments. Contact us today to schedule a site visit and discover why ${name} is the ideal choice for your property investment.`;

  return overview;
}

async function seedDevelopmentOverviews() {
  try {
    logger.info('Starting comprehensive overview seeding', { module: 'SEED' });
    
    const pool = getDbPool();
    
    // Get all developments
    const result = await pool.query(`
      SELECT 
        id, name, location, phase, servicing_progress, 
        base_price, price_per_sqm, total_stands, available_stands,
        branch, features, stand_sizes, overview, description
      FROM developments
      WHERE status = 'Active'
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No active developments found');
      process.exit(0);
    }
    
    console.log(`\n📍 Found ${result.rows.length} active developments\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const dev of result.rows) {
      const developmentId = dev.id;
      const currentOverview = dev.overview;
      
      // Check if overview already exists and is comprehensive (more than 200 chars)
      const hasComprehensiveOverview = currentOverview && currentOverview.length > 200;
      
      if (hasComprehensiveOverview) {
        console.log(`⏭️  Skipping ${dev.name} - already has comprehensive overview`);
        skipped++;
        continue;
      }
      
      console.log(`\n📝 Processing: ${dev.name} (${dev.location})`);
      
      // Generate comprehensive overview
      const comprehensiveOverview = generateComprehensiveOverview(dev);
      
      // Update development with comprehensive overview
      await pool.query(
        `UPDATE developments 
         SET overview = $1, updated_at = NOW()
         WHERE id = $2`,
        [comprehensiveOverview, developmentId]
      );
      
      console.log(`   ✅ Comprehensive overview added (${comprehensiveOverview.length} characters)`);
      console.log(`   📊 Preview: ${comprehensiveOverview.substring(0, 120)}...`);
      
      updated++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ COMPREHENSIVE OVERVIEW SEEDING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated} developments`);
    console.log(`   ⏭️  Skipped: ${skipped} developments (already have overviews)`);
    console.log(`   📝 Total processed: ${result.rows.length} developments\n`);
    
    process.exit(0);
    
  } catch (error: any) {
    logger.error('Overview seeding failed', error, { module: 'SEED' });
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

seedDevelopmentOverviews();
