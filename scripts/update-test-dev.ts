/**
 * Update Test Development with proper images and verify GeoJSON
 */
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const prismaModule = await import('../lib/prisma');
const prisma = prismaModule.default;

async function main() {
  console.log('🔄 Updating Test Development with images...\n');

  // Update with real images
  const updated = await prisma.development.update({
    where: { id: 'dev-test-demo' },
    data: {
      mainImage: 'https://utfs.io/f/test-development-main.jpg',
      gallery: [
        'https://utfs.io/f/test-dev-gallery-1.jpg',
        'https://utfs.io/f/test-dev-gallery-2.jpg',
        'https://utfs.io/f/test-dev-gallery-3.jpg',
      ],
      imageUrls: [
        'https://utfs.io/f/test-dev-1.jpg',
        'https://utfs.io/f/test-dev-2.jpg',
      ],
      logoUrl: 'https://utfs.io/f/test-dev-logo.png',
    }
  });

  console.log('✅ Development updated with images');
  console.log('   Main Image:', updated.mainImage);
  console.log('   Gallery:', updated.gallery.length, 'images');

  // Verify GeoJSON
  const dev = await prisma.development.findUnique({
    where: { id: 'dev-test-demo' },
    select: { name: true, geoJsonData: true }
  });

  console.log('\n📍 GeoJSON Verification:');
  console.log('   Development:', dev?.name);
  
  const geoJson = dev?.geoJsonData as any;
  if (geoJson && geoJson.features) {
    console.log('   Features count:', geoJson.features.length);
    console.log('   Sample stand:', geoJson.features[0]?.properties?.standNumber);
  } else {
    console.log('   ❌ GeoJSON data missing or malformed');
  }

  console.log('\n✅ Update complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
