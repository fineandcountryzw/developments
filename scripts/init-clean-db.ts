/**
 * Database Initialization Script
 * Clears all data and creates fresh admin user
 * 
 * MUST set DATABASE_URL environment variable before running:
 * DATABASE_URL="postgresql://..." npx tsx scripts/init-clean-db.ts
 */

import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('Run like this:');
  console.error('DATABASE_URL="postgresql://..." npx tsx scripts/init-clean-db.ts');
  process.exit(1);
}

// Configure WebSocket
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

// Create adapter with connection string (NOT a Pool!)
const adapter = new PrismaNeon({ connectionString });

// Create Prisma client
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Cleaning database...\n');

  // Delete all data in order (respecting foreign keys)
  await prisma.activity.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stand.deleteMany();
  await prisma.development.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All tables cleared\n');

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@fineandcountry.co.zw',
      name: 'Admin User',
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });

  console.log('✅ Admin user created:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   ID: ${admin.id}\n`);

  console.log('🎉 Database is clean and ready!');
  console.log('\nYou can now:');
  console.log('1. Sign in as admin@fineandcountry.co.zw');
  console.log('2. Add developments via Admin Developments module');
  console.log('3. Upload logos and images using the media manager\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
