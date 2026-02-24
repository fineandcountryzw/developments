/**
 * Test script to verify GeoJSON enrichment API
 * Run with: npx tsx scripts/test-geojson-api.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

async function testGeoJSONEnrichment() {
  console.log('\n🔍 Testing GeoJSON Enrichment API...\n');

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not set');
    }

    // TODO: Fix PrismaNeon adapter initialization
    // const pool = new Pool({ connectionString });
    // const adapter = new PrismaNeon(pool);
    // const prisma = new PrismaClient({ adapter });

    console.log('Test skipped: PrismaNeon adapter needs configuration fix');
    return;

    // TODO: Test code needs PrismaNeon adapter fix
    /*
    // Get first development with geometry
    const development = await prisma.development.findFirst({
      select: {
        id: true,
        name: true,
        geometry: true,
      }
    });

    if (!development) {
      console.log('❌ No developments found in database');
      return;
    }

    console.log(`✅ Found development: ${development.name}`);
    console.log(`   ID: ${development.id}`);
    
    // Get stands for this development
    const stands = await prisma.stand.findMany({
      where: { developmentId: development.id },
      select: {
        id: true,
        standNumber: true,
        status: true,
        price: true,
      }
    });

    console.log(`✅ Found ${stands.length} stands\n`);

    // Show status breakdown
    const statusBreakdown = stands.reduce((acc: any, stand) => {
      acc[stand.status] = (acc[stand.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Stand Status Breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Show sample enrichment
    console.log('\n📍 Sample Stand Details:');
    stands.slice(0, 3).forEach(stand => {
      console.log(`   ${stand.standNumber}: ${stand.status} (${stand.price})`);
    });

    // Verify enrichment would work
    const enrichedFeatures = (development.geometry?.features || []).map((feature: any) => ({
      ...feature,
      properties: {
        ...feature.properties,
        status: stands.find(s => s.standNumber === feature.properties?.stand_number)?.status || 'AVAILABLE',
        standId: stands.find(s => s.standNumber === feature.properties?.stand_number)?.id || null,
      }
    }));

    console.log(`\n✅ Enrichment successful! ${enrichedFeatures.length} features enriched`);
    console.log('\n🚀 API endpoint ready at: /api/stands/geojson?developmentId=' + development.id);
    */

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGeoJSONEnrichment();
