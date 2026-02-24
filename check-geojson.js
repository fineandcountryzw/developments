import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkGeoJson() {
  try {
    // Check geo_json_data in developments
    const result = await pool.query(`
      SELECT 
        id,
        name,
        latitude,
        longitude,
        geo_json_data IS NOT NULL as has_geojson_data,
        geo_json_data IS NOT NULL AND (geo_json_data->>'type') = 'FeatureCollection' as is_valid_featurecollection,
        CASE 
          WHEN geo_json_data IS NULL THEN 0
          WHEN (geo_json_data->'features') IS NULL THEN 0
          ELSE jsonb_array_length(geo_json_data->'features')
        END as feature_count,
        geo_json_url
      FROM developments
      ORDER BY name
    `);

    console.log('=== GEOJSON DATA CHECK ===\n');
    console.log('Developments with GeoJSON data:\n');
    
    result.rows.forEach(row => {
      console.log(`Development: ${row.name} (${row.id})`);
      console.log(`  - Has geo_json_data: ${row.has_geojson_data}`);
      console.log(`  - Is valid FeatureCollection: ${row.is_valid_featurecollection}`);
      console.log(`  - Feature count: ${row.feature_count}`);
      console.log(`  - Latitude: ${row.latitude}, Longitude: ${row.longitude}`);
      console.log(`  - geo_json_url: ${row.geo_json_url || 'N/A'}`);
      console.log('');
    });

    const withGeoJson = result.rows.filter(r => r.has_geojson_data).length;
    const withFeatures = result.rows.filter(r => parseInt(r.feature_count) > 0).length;
    
    console.log('=== SUMMARY ===');
    console.log(`Total developments: ${result.rows.length}`);
    console.log(`With geo_json_data: ${withGeoJson}`);
    console.log(`With features: ${withFeatures}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkGeoJson();
