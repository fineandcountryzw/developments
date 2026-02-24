#!/usr/bin/env node

/**
 * Quick Demo Data Seeder (Standalone Version)
 * 
 * This is a simplified version that can be run without building.
 * Run: node scripts/seed-demo-quick.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Demo data configuration
const DEMO_DATA = {
  users: [
    { name: 'Admin User', email: '[email protected]', role: 'ADMIN' },
    { name: 'John Moyo', email: '[email protected]', role: 'AGENT' },
    { name: 'Sarah Ncube', email: '[email protected]', role: 'AGENT' },
    { name: 'Michael Chikwanha', email: '[email protected]', role: 'CLIENT' },
    { name: 'Grace Mutasa', email: '[email protected]', role: 'CLIENT' },
    { name: 'David Sibanda', email: '[email protected]', role: 'CLIENT' },
  ],
  
  agents: [
    { name: 'John Moyo', email: '[email protected]', phone: '+263 77 123 4567' },
    { name: 'Sarah Ncube', email: '[email protected]', phone: '+263 77 234 5678' },
  ],
  
  developments: [
    {
      name: 'Borrowdale Brooke Estate',
      location: 'Borrowdale, Harare',
      description: 'Premium residential estate in Borrowdale',
      phase: 'READY_TO_BUILD',
      basePrice: 85000,
      pricePerSqm: 125,
      totalStands: 45,
    },
    {
      name: 'Victoria Falls View',
      location: 'Victoria Falls',
      description: 'Exclusive residential with panoramic views',
      phase: 'SERVICING',
      basePrice: 125000,
      pricePerSqm: 175,
      totalStands: 60,
    },
    {
      name: 'Bulawayo Heights',
      location: 'Burnside, Bulawayo',
      description: 'Modern estate in Bulawayo premier suburb',
      phase: 'READY_TO_BUILD',
      basePrice: 55000,
      pricePerSqm: 95,
      totalStands: 38,
    },
    {
      name: 'Greendale Gardens',
      location: 'Greendale, Harare',
      description: 'Affordable housing project',
      phase: 'COMPLETED',
      basePrice: 42000,
      pricePerSqm: 70,
      totalStands: 52,
    },
  ],
};

async function seed() {
  console.log('🌱 Seeding demo data...\n');

  try {
    // Create users
    console.log('📝 Creating users...');
    for (const userData of DEMO_DATA.users) {
      await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          ...userData,
          emailVerified: new Date(),
        },
      });
    }
    console.log(`✅ Created ${DEMO_DATA.users.length} users\n`);

    // Create agent profiles
    console.log('📝 Creating agent profiles...');
    for (const agentData of DEMO_DATA.agents) {
      await prisma.agent.upsert({
        where: { email: agentData.email },
        update: {},
        create: agentData,
      });
    }
    console.log(`✅ Created ${DEMO_DATA.agents.length} agents\n`);

    // Create developments
    console.log('📝 Creating developments...');
    const devIds = [];
    for (const dev of DEMO_DATA.developments) {
      const created = await prisma.development.create({
        data: {
          ...dev,
          servicingProgress: dev.phase === 'COMPLETED' ? 100 : dev.phase === 'READY_TO_BUILD' ? 90 : 65,
          status: 'Active',
          vatPercentage: 15,
          endowmentFee: Math.round(dev.basePrice * 0.03),
          totalAreaSqm: dev.totalStands * 800,
          availableStands: Math.round(dev.totalStands * 0.7),
          imageUrls: ['https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800'],
          documentUrls: [],
        },
      });
      devIds.push({ id: created.id, ...dev });
    }
    console.log(`✅ Created ${devIds.length} developments\n`);

    // Create stands for each development
    console.log('📝 Creating stands...');
    let totalStands = 0;
    for (const dev of devIds) {
      const stands = [];
      const prefix = dev.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      
      for (let i = 1; i <= dev.totalStands; i++) {
        const status = i <= 5 ? 'SOLD' : i <= 10 ? 'RESERVED' : 'AVAILABLE';
        stands.push({
          standNumber: `${prefix}${String(i).padStart(3, '0')}`,
          developmentId: dev.id,
          price: dev.basePrice + (i * 1000),
          pricePerSqm: dev.pricePerSqm,
          sizeSqm: 700 + (i * 10),
          status,
        });
      }
      
      await prisma.stand.createMany({
        data: stands,
        skipDuplicates: true,
      });
      totalStands += stands.length;
    }
    console.log(`✅ Created ${totalStands} stands\n`);

    // Create some reservations
    console.log('📝 Creating reservations...');
    const reservedStands = await prisma.stand.findMany({
      where: { status: 'RESERVED' },
      take: 3,
    });
    
    const users = await prisma.user.findMany({ where: { role: 'CLIENT' } });
    const agents = await prisma.agent.findMany();
    
    if (reservedStands.length > 0 && users.length > 0) {
      await prisma.reservation.create({
        data: {
          standId: reservedStands[0].id,
          userId: users[0].id,
          agentId: agents[0]?.id,
          termsAcceptedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          status: 'PENDING',
          timerActive: true,
        },
      });
      console.log('✅ Created sample reservation\n');
    }

    // Create activity logs
    console.log('📝 Creating activity logs...');
    const admin = await prisma.user.findUnique({ where: { email: '[email protected]' } });
    if (admin) {
      await prisma.activity.create({
        data: {
          type: 'LOGIN',
          description: 'Admin logged into system',
          userId: admin.id,
          metadata: { ip: '41.79.197.1' },
        },
      });
      console.log('✅ Created activity log\n');
    }

    console.log('========================================');
    console.log('✨ DEMO DATA SEED COMPLETE!');
    console.log('========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   Users: ${DEMO_DATA.users.length}`);
    console.log(`   Developments: ${devIds.length}`);
    console.log(`   Stands: ${totalStands}`);
    console.log(`\n🔑 Login with: [email protected]`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
