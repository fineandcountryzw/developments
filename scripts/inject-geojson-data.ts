/**
 * Inject GeoJSON Data into Existing Developments
 * 
 * Adds GeoJSON data to developments that don't have it yet.
 * Creates stands from GeoJSON features.
 */

import { config } from 'dotenv';
import { join } from 'path';
import { getDbPool } from '../lib/db-pool';
import { logger } from '../lib/logger';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

// St Lucia coordinates (Norton, Zimbabwe)
const ST_LUCIA_CENTER = { lat: -17.8833, lng: 30.7167 };

// Generate realistic stand polygons around the center point
function generateStandPolygon(baseIndex: number, rows: number, cols: number) {
  const row = Math.floor(baseIndex / cols);
  const col = baseIndex % cols;
  
  // Each stand is approximately 500sqm (0.05 hectares)
  const standWidth = 0.0003; // ~33m in degrees
  const standHeight = 0.0003; // ~33m in degrees
  const spacing = 0.00005; // 5m spacing
  
  const baseLat = ST_LUCIA_CENTER.lat + (row * (standHeight + spacing));
  const baseLng = ST_LUCIA_CENTER.lng + (col * (standWidth + spacing));
  
  // Create rectangular polygon (clockwise)
  return {
    type: 'Polygon',
    coordinates: [[
      [baseLng, baseLat], // bottom-left
      [baseLng + standWidth, baseLat], // bottom-right
      [baseLng + standWidth, baseLat + standHeight], // top-right
      [baseLng, baseLat + standHeight], // top-left
      [baseLng, baseLat] // close polygon
    ]]
  };
}

async function injectGeoJSONData() {
  try {
    logger.info('Starting GeoJSON data injection', { module: 'SEED' });
    
    const pool = getDbPool();
    
    // Get all developments without GeoJSON data
    const result = await pool.query(`
      SELECT id, name, location, total_stands, base_price, price_per_sqm
      FROM developments
      WHERE geo_json_data IS NULL OR geo_json_data::text = 'null'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ All developments already have GeoJSON data');
      process.exit(0);
    }
    
    console.log(`\n📍 Found ${result.rows.length} developments without GeoJSON data\n`);
    
    for (const dev of result.rows) {
      const developmentId = dev.id;
      const totalStands = dev.total_stands || 30;
      const basePrice = parseFloat(dev.base_price) || 50000;
      const pricePerSqm = parseFloat(dev.price_per_sqm) || 100;
      
      console.log(`\n📝 Processing: ${dev.name} (${dev.location})`);
      console.log(`   Stands to create: ${totalStands}`);
      
      // Generate GeoJSON features
      const ROWS = Math.ceil(Math.sqrt(totalStands));
      const COLS = Math.ceil(totalStands / ROWS);
      const standSizes = [300, 500, 800];
      const geoJsonFeatures = [];
      
      for (let i = 0; i < totalStands; i++) {
        const sizeIndex = i % 3;
        const size = standSizes[sizeIndex];
        const price = basePrice + (i * 1000); // Varying prices
        const standNumber = `${String(i + 1).padStart(3, '0')}`;
        
        geoJsonFeatures.push({
          type: 'Feature',
          geometry: generateStandPolygon(i, ROWS, COLS),
          properties: {
            id: `stand-${developmentId}-${i + 1}`,
            stand_number: standNumber,
            standNumber: standNumber,
            status: i < Math.floor(totalStands * 0.1) ? 'SOLD' : i < Math.floor(totalStands * 0.3) ? 'RESERVED' : 'AVAILABLE',
            size_sqm: size,
            price: price.toString(),
            price_per_sqm: Math.round(price / size).toString()
          }
        });
      }
      
      const geoJsonData = {
        type: 'FeatureCollection',
        name: dev.name,
        center: { lat: ST_LUCIA_CENTER.lat, lng: ST_LUCIA_CENTER.lng },
        features: geoJsonFeatures
      };
      
      // Update development with GeoJSON data
      await pool.query(
        `UPDATE developments 
         SET geo_json_data = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(geoJsonData), developmentId]
      );
      
      console.log(`   ✅ GeoJSON data added (${geoJsonFeatures.length} features)`);
      
      // Create stands from GeoJSON if they don't exist
      const existingStands = await pool.query(
        'SELECT COUNT(*) as count FROM stands WHERE development_id = $1',
        [developmentId]
      );
      
      const existingCount = parseInt(existingStands.rows[0]?.count || '0', 10);
      
      if (existingCount === 0) {
        console.log(`   🏘️  Creating ${geoJsonFeatures.length} stands from GeoJSON...`);
        
        let created = 0;
        for (const feature of geoJsonFeatures) {
          const props = feature.properties;
          const standNumber = props.stand_number || props.standNumber;
          const size = parseInt(props.size_sqm || '500', 10);
          const price = parseFloat(props.price || basePrice.toString());
          const status = props.status || 'AVAILABLE';
          
          try {
            await pool.query(
              `INSERT INTO stands (
                id, stand_number, development_id, branch,
                price, price_per_sqm, size_sqm, status,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid()::text, $1, $2, $3,
                $4, $5, $6, $7,
                NOW(), NOW()
              )
              ON CONFLICT (development_id, stand_number) DO NOTHING`,
              [
                standNumber,
                developmentId,
                'Harare',
                price,
                pricePerSqm,
                size,
                status
              ]
            );
            created++;
          } catch (err: any) {
            logger.warn('Failed to create stand', { 
              module: 'SEED',
              standNumber,
              error: err.message 
            });
          }
        }
        
        console.log(`   ✅ Created ${created} stands`);
      } else {
        console.log(`   ℹ️  Stands already exist (${existingCount} stands)`);
      }
    }
    
    console.log('\n✅ GeoJSON data injection complete!');
    process.exit(0);
    
  } catch (error: any) {
    logger.error('GeoJSON injection failed', error, { module: 'SEED' });
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

injectGeoJSONData();
