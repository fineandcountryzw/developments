const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGeoJson() {
  try {
    const devs = await prisma.development.findMany({
      select: {
        id: true,
        name: true,
        geoJsonData: true,
        geoJsonUrl: true,
        latitude: true,
        longitude: true
      }
    });
    
    console.log('=== GEOJSON DATA CHECK ===\n');
    devs.forEach(d => {
      console.log(`Development: ${d.name} (${d.id})`);
      console.log(`  - geoJsonData exists: ${!!d.geoJsonData}`);
      console.log(`  - geoJsonData type: ${typeof d.geoJsonData}`);
      console.log(`  - geoJsonData keys: ${d.geoJsonData ? Object.keys(d.geoJsonData).join(', ') : 'N/A'}`);
      console.log(`  - geoJsonUrl: ${d.geoJsonUrl || 'N/A'}`);
      console.log(`  - latitude: ${d.latitude}, longitude: ${d.longitude}`);
      console.log('');
    });
    
    const withGeoJson = devs.filter(d => !!d.geoJsonData).length;
    console.log(`Total developments: ${devs.length}`);
    console.log(`With geoJsonData: ${withGeoJson}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGeoJson();
