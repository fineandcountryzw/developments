/**
 * Fix Test Development - delete bad stands and recreate with proper numeric values
 */
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const prismaModule = await import('../lib/prisma');
const prisma = prismaModule.default;

async function main() {
  console.log('🔄 Fixing Test Development data...\n');

  // Delete existing stands and development
  console.log('🗑️  Deleting existing stands...');
  await prisma.stand.deleteMany({
    where: { developmentId: 'dev-test-demo' }
  });

  // Delete development
  console.log('🗑️  Deleting development...');
  await prisma.development.delete({
    where: { id: 'dev-test-demo' }
  });

  // Delete test client and agent
  console.log('🗑️  Deleting test client and agent...');
  await prisma.client.deleteMany({
    where: { id: 'client-test-demo' }
  });
  await prisma.agent.deleteMany({
    where: { id: 'agent-test-demo' }
  });

  console.log('✅ Old data deleted\n');

  // Coordinates for test development
  const TEST_DEV_CENTER = { lat: -17.8156, lng: 31.0533 };

  function generateStandPolygon(baseIndex: number, rows: number, cols: number) {
    const row = Math.floor(baseIndex / cols);
    const col = baseIndex % cols;
    const standWidth = 0.00025;
    const standHeight = 0.00025;
    const spacing = 0.00005;
    const baseLat = TEST_DEV_CENTER.lat + (row * (standHeight + spacing));
    const baseLng = TEST_DEV_CENTER.lng + (col * (standWidth + spacing));
    
    return {
      type: 'Polygon',
      coordinates: [[
        [baseLng, baseLat],
        [baseLng + standWidth, baseLat],
        [baseLng + standWidth, baseLat + standHeight],
        [baseLng, baseLat + standHeight],
        [baseLng, baseLat]
      ]]
    };
  }

  const ROWS = 4;
  const COLS = 5;
  const standSizes = [400, 500, 600];
  const standPrices = [25000, 28000, 35000]; // Using realistic prices within Decimal limits
  
  const geoJsonFeatures = [];
  for (let i = 0; i < 20; i++) {
    const sizeIndex = i % 3;
    const size = standSizes[sizeIndex];
    const price = standPrices[sizeIndex];
    const standNumber = `TD-${String(i + 1).padStart(3, '0')}`;
    const status = i < 2 ? 'SOLD' : i < 4 ? 'RESERVED' : 'AVAILABLE';
    
    geoJsonFeatures.push({
      type: 'Feature',
      geometry: generateStandPolygon(i, ROWS, COLS),
      properties: {
        id: `stand-test-${i + 1}`,
        stand_number: standNumber,
        standNumber: standNumber,
        status: status,
        size_sqm: size,
        price: price,
        price_per_sqm: Math.round(price / size)
      }
    });
  }

  // Create development
  console.log('📍 Creating Test Development...');
  const testDev = await prisma.development.create({
    data: {
      id: 'dev-test-demo',
      name: 'Test Development',
      location: 'Harare, Zimbabwe',
      description: 'Test development for reservation flow testing',
      overview: 'A test development for validating the stand reservation flow',
      phase: 'READY_TO_BUILD',
      servicingProgress: 100,
      status: 'Active',
      basePrice: 25000,
      pricePerSqm: 50,
      vatPercentage: 15,
      endowmentFee: 0,
      totalStands: 20,
      availableStands: 16,
      mainImage: 'https://utfs.io/f/test-development-main.jpg',
      gallery: [
        'https://utfs.io/f/test-dev-gallery-1.jpg',
        'https://utfs.io/f/test-dev-gallery-2.jpg',
        'https://utfs.io/f/test-dev-gallery-3.jpg',
      ],
      geoJsonData: {
        type: 'FeatureCollection',
        name: 'Test Development',
        center: { lat: TEST_DEV_CENTER.lat, lng: TEST_DEV_CENTER.lng },
        features: geoJsonFeatures
      },
      imageUrls: [
        'https://utfs.io/f/test-dev-1.jpg',
        'https://utfs.io/f/test-dev-2.jpg',
      ],
      documentUrls: [],
      logoUrl: 'https://utfs.io/f/test-dev-logo.png',
      standSizes: { small: 400, medium: 500, large: 600 },
      standTypes: ['Residential'],
      features: ['Tarred roads', 'Electricity', 'Water', 'Security'],
      commissionModel: { type: 'percentage', percentage: 5 },
      branch: 'Harare',
    }
  });
  console.log(`✅ Development created: ${testDev.id}\n`);

  // Create stands
  console.log('🏘️  Creating 20 stands...');
  for (let i = 0; i < 20; i++) {
    const sizeIndex = i % 3;
    const size = standSizes[sizeIndex];
    const price = standPrices[sizeIndex];
    const standNumber = `TD-${String(i + 1).padStart(3, '0')}`;
    const status = i < 2 ? 'SOLD' : i < 4 ? 'RESERVED' : 'AVAILABLE';
    
    await prisma.stand.create({
      data: {
        id: `stand-test-${i + 1}`,
        standNumber: standNumber,
        developmentId: testDev.id,
        status: status,
        sizeSqm: size,
        price: price,
        pricePerSqm: Math.round(price / size),
        branch: 'Harare',
      }
    });
  }
  console.log('✅ 20 stands created\n');

  // Create test client
  console.log('👤 Creating test client...');
  await prisma.client.create({
    data: {
      id: 'client-test-demo',
      name: 'Test Client',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test.client@example.com',
      phone: '+263 77 999 9999',
      nationalId: '99-9999999-Z-99',
      branch: 'Harare',
      isPortalUser: true,
      kyc: [],
      ownedStands: [],
    }
  });
  console.log('✅ Test client created\n');

  // Create test agent
  console.log('👤 Creating test agent...');
  await prisma.agent.create({
    data: {
      id: 'agent-test-demo',
      name: 'Test Agent',
      email: 'test.agent@example.com',
      phone: '+263 77 888 8888',
    }
  });
  console.log('✅ Test agent created\n');

  console.log('═══════════════════════════════════════');
  console.log('✅ Test Development Fixed!');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Development: Test Development (${testDev.id})`);
  console.log(`📍 Stands: 20 (2 sold, 2 reserved, 16 available)`);
  console.log(`👤 Client: test.client@example.com`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
