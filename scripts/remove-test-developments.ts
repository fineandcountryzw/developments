/**
 * Remove Test Developments Cleanup Script
 * Deletes Test Development A, B, C and their associated stands from the database
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

let prisma: PrismaClient;

async function initializePrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🔌 Initializing database connection...');
  
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  
  prisma = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
  });
}

async function main() {
  await initializePrisma();
  
  const testDevelopments = [
    'Test Development A',
    'Test Development B', 
    'Test Development C'
  ];

  console.log('\n🗑️  Removing test developments...');

  // First, get the development IDs
  const developments = await prisma.development.findMany({
    where: {
      name: { in: testDevelopments }
    },
    include: {
      _count: {
        select: { stands: true }
      }
    }
  });

  if (developments.length === 0) {
    console.log('✅ No test developments found in the database');
    return;
  }

  console.log(`Found ${developments.length} test developments:`);
  for (const dev of developments) {
    console.log(`  - ${dev.name} (ID: ${dev.id}, Stands: ${dev._count.stands})`);
  }

  const developmentIds = developments.map(d => d.id);

  // Get stand IDs for these developments
  const stands = await prisma.stand.findMany({
    where: { developmentId: { in: developmentIds } },
    select: { id: true }
  });

  const standIds = stands.map(s => s.id);

  if (standIds.length > 0) {
    console.log(`\n🗑️  Deleting related records for ${standIds.length} stands...`);

    // Use raw SQL for cascade delete to handle all foreign key constraints
    // Delete reservations
    await prisma.$executeRaw`DELETE FROM reservations WHERE stand_id = ANY(${standIds})`;
    console.log('  - Deleted reservations');

    // Delete payments
    await prisma.$executeRaw`DELETE FROM payments WHERE stand_id = ANY(${standIds})`;
    console.log('  - Deleted payments');

    // Delete installment plans
    await prisma.$executeRaw`DELETE FROM installment_plans WHERE stand_id = ANY(${standIds})`;
    console.log('  - Deleted installment plans');

    // Delete generated contracts
    await prisma.$executeRaw`DELETE FROM generated_contracts WHERE stand_id = ANY(${standIds})`;
    console.log('  - Deleted generated contracts');

    // Delete stands
    const deletedStands = await prisma.stand.deleteMany({
      where: { id: { in: standIds } }
    });
    console.log(`  - Deleted ${deletedStands.count} stands`);
  }

  // Delete developments
  const deletedDevs = await prisma.development.deleteMany({
    where: { id: { in: developmentIds } }
  });
  console.log(`\n🗑️  Deleted ${deletedDevs.count} developments`);

  console.log('\n✅ Test developments removed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
