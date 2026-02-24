import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkGeoJsonCenter() {
  try {
    // Get the full geo_json_data structure
    const result = await pool.query(`
      SELECT 
        id,
        name,
        geo_json_data
      FROM developments
      WHERE geo_json_data IS NOT NULL
      LIMIT 1
    `);

    console.log('=== GEOJSON STRUCTURE CHECK ===\n');
    
    result.rows.forEach(row => {
      console.log(`Development: ${row.name} (${row.id})\n`);
      
      const geo = row.geo_json_data;
      console.log('Top-level keys:', Object.keys(geo));
      console.log('Type:', geo.type);
      
      if (geo.center) {
        console.log('Has center:', geo.center);
        console.log('Center lat:', geo.center.lat);
        console.log('Center lng:', geo.center.lng);
      } else {
        console.log('NO center property found!');
      }
      
      if (geo.features) {
        console.log('Features count:', geo.features.length);
        console.log('First feature properties keys:', Object.keys(geo.features[0]?.properties || {}));
        console.log('First feature geometry type:', geo.features[0]?.geometry?.type);
      }
      
      console.log('\nFull geo_json_data preview:');
      console.log(JSON.stringify(geo, null, 2).substring(0, 2000));
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkGeoJsonCenter();
