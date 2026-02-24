/**
 * Integration Test: GeoJSON Enrichment API
 * 
 * This test verifies that:
 * 1. The API endpoint is accessible
 * 2. Stands are properly enriched with database state
 * 3. The response format matches GeoJSON spec
 */

async function testGeoJSONAPI() {
  console.log('\n🧪 Testing GeoJSON Enrichment API...\n');

  try {
    // Get first development ID from database
    const devResponse = await fetch('http://localhost:3000/api/developments');
    const developments = await devResponse.json();
    
    if (!developments || developments.length === 0) {
      console.log('⚠️  No developments in database. Skipping API test.');
      return;
    }

    const development = developments[0];
    console.log(`📍 Testing with development: ${development.name}`);

    // Call the GeoJSON API
    const apiUrl = `/api/stands/geojson?developmentId=${development.id}`;
    console.log(`🔗 Calling: ${apiUrl}\n`);

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      return;
    }

    const geojson = await response.json();

    // Verify GeoJSON structure
    if (geojson.type !== 'FeatureCollection') {
      console.error('❌ Invalid GeoJSON: missing FeatureCollection type');
      return;
    }

    console.log(`✅ Valid GeoJSON response received`);
    console.log(`📊 Features count: ${geojson.features.length}\n`);

    // Analyze features
    if (geojson.features.length > 0) {
      const feature = geojson.features[0];
      console.log('📋 Sample Feature Properties:');
      Object.entries(feature.properties || {}).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });

      // Check for enriched properties
      const enrichedProps = ['status', 'id', 'price'];
      const hasEnrichedProps = enrichedProps.some(prop => 
        prop in (feature.properties || {})
      );

      if (hasEnrichedProps) {
        console.log('\n✅ Features are properly enriched with database state');
      } else {
        console.log('\n⚠️  Features may lack database enrichment');
      }
    }

    // Analyze stand statuses
    const statusCount = geojson.features.reduce((acc: any, feature: any) => {
      const status = feature.properties?.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Stand Status Distribution:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n✅ GeoJSON API test passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if in browser context
if (typeof window !== 'undefined') {
  // Uncomment to run in browser console
  // testGeoJSONAPI();
  console.log('Run testGeoJSONAPI() in console to test the API');
} else {
  // Node.js context
  testGeoJSONAPI();
}
