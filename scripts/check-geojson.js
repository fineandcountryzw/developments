import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function checkGeoJSON() {
  try {
    const dev = await prisma.development.findFirst({
      where: { id: 'dev-stlucia-demo' },
      select: { 
        id: true, 
        name: true, 
        geoJsonData: true, 
        location: true
      }
    });
    
    console.log('Development:', dev?.id, dev?.name);
    console.log('Location:', dev?.location);
    console.log('Has geoJsonData:', !!dev?.geoJsonData);
    
    if (dev?.geoJsonData) {
      const geo = dev.geoJsonData;
      console.log('GeoJSON type:', geo.type);
      console.log('Features count:', geo.features?.length || 0);
      console.log('Center:', geo.center);
      
      if (geo.features?.[0]) {
        console.log('First feature geometry type:', geo.features[0].geometry?.type);
        console.log('First feature properties:', geo.features[0].properties);
        console.log('First feature coords (first 2 points):', 
          JSON.stringify(geo.features[0].geometry?.coordinates?.[0]?.slice(0, 2)));
      }
    } else {
      console.log('\n⚠️ No GeoJSON data found! Need to add polygon geometry.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGeoJSON();
