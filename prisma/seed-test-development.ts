/**
 * Test Development Seed Script
 * Creates "Test Development" with GeoJSON stand data for testing the reservation flow
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env file FIRST
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

// Import prisma AFTER env vars are loaded
const prismaModule = await import('../lib/prisma');
const prisma = prismaModule.default;

// Test Development coordinates (Harare area for testing)
const TEST_DEV_CENTER = { lat: -17.8156, lng: 31.0533 };

// Generate realistic stand polygons around the center point
function generateStandPolygon(baseIndex: number, rows: number, cols: number) {
  const row = Math.floor(baseIndex / cols);
  const col = baseIndex % cols;
  
  // Each stand is approximately 400sqm
  const standWidth = 0.00025; // ~28m in degrees
  const standHeight = 0.00025; // ~28m in degrees
  const spacing = 0.00005; // 5m spacing
  
  const baseLat = TEST_DEV_CENTER.lat + (row * (standHeight + spacing));
  const baseLng = TEST_DEV_CENTER.lng + (col * (standWidth + spacing));
  
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

async function main() {
  console.log('🌱 Starting Test Development seed...\n');

  const ROWS = 4;
  const COLS = 5;
  const standSizes = [400, 500, 600]; // small, medium, large
  const standPrices = [20000, 28000, 35000];
  
  // Pre-generate all stand features for the GeoJSON
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
        price: price.toString(),
        price_per_sqm: Math.round(price / size).toString()
      }
    });
  }

  // 1. Create Test Development
  console.log('📍 Creating Test Development...');
  const testDev = await prisma.development.upsert({
    where: { id: 'dev-test-demo' },
    update: {
      geoJsonData: {
        type: 'FeatureCollection',
        name: 'Test Development',
        center: { lat: TEST_DEV_CENTER.lat, lng: TEST_DEV_CENTER.lng },
        features: geoJsonFeatures
      }
    },
    create: {
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
      features: [
        'Tarred roads',
        'Electricity',
        'Water',
        'Security'
      ],
      commissionModel: { type: 'percentage', percentage: 5 },
      branch: 'Harare',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log(`✅ Test Development created: ${testDev.id}\n`);
  console.log(`   📍 GeoJSON features: ${geoJsonFeatures.length} stands\n`);

  // 2. Create 20 stands with GeoJSON data (4x5 grid)
  console.log('🏘️  Creating 20 stands with GeoJSON coordinates...');
  const stands = [];

  for (let i = 0; i < 20; i++) {
    const sizeIndex = i % 3;
    const size = standSizes[sizeIndex];
    const price = standPrices[sizeIndex];
    const standNumber = `TD-${String(i + 1).padStart(3, '0')}`;
    
    // First 2 stands sold, next 2 reserved, rest available
    const status = i < 2 ? 'SOLD' : i < 4 ? 'RESERVED' : 'AVAILABLE';
    
    const stand = await prisma.stand.upsert({
      where: { id: `stand-test-${i + 1}` },
      update: {},
      create: {
        id: `stand-test-${i + 1}`,
        standNumber: standNumber,
        developmentId: testDev.id,
        status: status,
        sizeSqm: size,
        price: price,
        pricePerSqm: Math.round(price / size),
        branch: 'Harare',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    stands.push(stand);
  }
  console.log(`✅ Created ${stands.length} stands with GeoJSON polygons\n`);

  // 3. Create a test client
  console.log('👤 Creating test client...');
  const testClient = await prisma.client.upsert({
    where: { id: 'client-test-demo' },
    update: {},
    create: {
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
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log(`✅ Test client created: ${testClient.email}\n`);

  // 4. Create a test agent
  console.log('👤 Creating test agent...');
  const testAgent = await prisma.agent.upsert({
    where: { id: 'agent-test-demo' },
    update: {},
    create: {
      id: 'agent-test-demo',
      name: 'Test Agent',
      email: 'test.agent@example.com',
      phone: '+263 77 888 8888',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log(`✅ Test agent created: ${testAgent.email}\n`);

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('✅ Test Development Seed Complete!');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Development: Test Development (${testDev.id})`);
  console.log(`📍 Location: Harare, Zimbabwe`);
  console.log(`📍 Stands: ${stands.length} total (2 sold, 2 reserved, ${stands.length - 4} available)`);
  console.log(`👤 Test Client: ${testClient.email}`);
  console.log(`👤 Test Agent: ${testAgent.email}`);
  console.log('');
  console.log('Use this development for testing the reservation flow!');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
