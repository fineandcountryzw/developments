// FORENSIC DIAGNOSTIC SCRIPT
// Add this to the frontend to capture the exact issue

/**
 * Run this in browser console on the LandingPage to diagnose:
 * 
 * 1. Check if selectedDev exists and has geo_json_data
 * 2. Verify center coordinates extraction
 * 3. Test API response directly
 */

(async function forensicDiagnostic() {
  console.log('=== MAP RENDERING FORENSIC DIAGNOSTIC ===\n');

  // 1. Check if we're on the right page
  const urlParams = new URLSearchParams(window.location.search);
  const devId = urlParams.get('id') || 'dev-spitzkop-gardens-f1781';
  console.log(`Testing development: ${devId}\n`);

  // 2. Test API response directly
  console.log('Testing API response...');
  try {
    const apiResponse = await fetch(`/api/admin/developments?id=${devId}`);
    const apiData = await apiResponse.json();
    
    console.log('API Response:');
    console.log('  - Success:', apiResponse.ok);
    console.log('  - Data length:', apiData.data?.length || 1);
    
    if (apiData.data?.[0]) {
      const dev = apiData.data[0];
      console.log('\n  Development:');
      console.log('  - ID:', dev.id);
      console.log('  - Name:', dev.name);
      console.log('  - Has geo_json_data:', !!dev.geo_json_data);
      console.log('  - geo_json_data type:', typeof dev.geo_json_data);
      console.log('  - geo_json_data keys:', dev.geo_json_data ? Object.keys(dev.geo_json_data) : 'N/A');
      
      if (dev.geo_json_data) {
        console.log('\n  GeoJSON Details:');
        console.log('  - Has center:', !!dev.geo_json_data.center);
        console.log('  - Center:', dev.geo_json_data.center);
        console.log('  - Features count:', dev.geo_json_data.features?.length);
        console.log('  - First feature geometry type:', dev.geo_json_data.features?.[0]?.geometry?.type);
      }
      
      console.log('\n  Coordinates:');
      console.log('  - Latitude:', dev.latitude);
      console.log('  - Longitude:', dev.longitude);
    }
  } catch (error) {
    console.error('API Error:', error);
  }

  // 3. Test GeoJSON API specifically
  console.log('\nTesting /api/stands/geojson endpoint...');
  try {
    const geoResponse = await fetch(`/api/stands/geojson?developmentId=${devId}`);
    const geoData = await geoResponse.json();
    
    console.log('GeoJSON API Response:');
    console.log('  - Status:', geoResponse.status);
    console.log('  - Has features:', geoData?.features?.length > 0);
    console.log('  - Feature count:', geoData?.features?.length);
    console.log('  - Metadata:', geoData?.metadata);
  } catch (error) {
    console.error('GeoJSON API Error:', error);
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  console.log('Check console output above for findings.\n');
  
  console.log('Likely issues:');
  console.log('1. If API has geo_json_data but frontend does not → Data transformation issue');
  console.log('2. If API returns 404 → Geometry source not found');
  console.log('3. If no features → Empty GeoJSON');
})();
