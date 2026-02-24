/**
 * Demo Data Seeder for Fine & Country Zimbabwe ERP
 * 
 * Populates the database with realistic demo data including:
 * - Users (Admin, Agents, Clients)
 * - Developments (Property projects)
 * - Stands (Individual plots)
 * - Reservations
 * - Activity logs
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
  
  // Use traditional pg connection pool
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  
  prisma = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
  });
}

async function main() {
  await initializePrisma();
  console.log('🌱 Starting demo data seed...');
  
  // Run migrations first
  console.log('\n🔧 Running database migrations...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id SERIAL PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMP,
        execution_time BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMP,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('✅ Migrations table ready');
  } catch (e) {
    console.log('⚠️  Migrations table already exists');
  }

  // ============================================
  // 1. USERS (Admin, Agents, Clients)
  // ============================================
  console.log('\n📝 Creating users...');
  
  const admin = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'Admin User',
      email: '[email protected]',
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log('✅ Admin created:', admin.email);

  const agent1 = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'John Moyo',
      email: '[email protected]',
      role: 'AGENT',
      emailVerified: new Date(),
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'Sarah Ncube',
      email: '[email protected]',
      role: 'AGENT',
      emailVerified: new Date(),
    },
  });
  console.log('✅ Agents created:', agent1.email, agent2.email);

  const client1 = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'Michael Chikwanha',
      email: '[email protected]',
      role: 'CLIENT',
      emailVerified: new Date(),
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'Grace Mutasa',
      email: '[email protected]',
      role: 'CLIENT',
      emailVerified: new Date(),
    },
  });

  const client3 = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'David Sibanda',
      email: '[email protected]',
      role: 'CLIENT',
      emailVerified: new Date(),
    },
  });
  console.log('✅ Clients created:', client1.email, client2.email, client3.email);

  // ============================================
  // 2. AGENTS TABLE
  // ============================================
  console.log('\n📝 Creating agent profiles...');

  const agentProfile1 = await prisma.agent.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'John Moyo',
      email: '[email protected]',
      phone: '+263 77 123 4567',
    },
  });

  const agentProfile2 = await prisma.agent.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      name: 'Sarah Ncube',
      email: '[email protected]',
      phone: '+263 77 234 5678',
    },
  });
  console.log('✅ Agent profiles created');

  // ============================================
  // 3. DEVELOPMENTS (Property Projects)
  // ============================================
  console.log('\n📝 Creating developments...');

  const dev1 = await prisma.development.create({
    data: {
      name: 'Borrowdale Brooke Estate',
      location: 'Borrowdale, Harare',
      description: 'Premium residential estate in the heart of Borrowdale. Featuring serviced stands with water, electricity, and tarred roads. Ideal for families seeking upscale living.',
      phase: 'READY_TO_BUILD',
      servicingProgress: 100,
      status: 'Active',
      basePrice: 85000,
      pricePerSqm: 125,
      vatPercentage: 15,
      endowmentFee: 2500,
      totalAreaSqm: 50000,
      totalStands: 45,
      availableStands: 32,
      imageUrls: [
        'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      ],
      logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400',
      documentUrls: ['https://example.com/borrowdale-brochure.pdf'],
    },
  });

  const dev2 = await prisma.development.create({
    data: {
      name: 'Victoria Falls View',
      location: 'Victoria Falls',
      description: 'Exclusive residential development with panoramic views of the Victoria Falls mist. Close to town center and tourist amenities. Perfect for investment or retirement.',
      phase: 'SERVICING',
      servicingProgress: 65,
      status: 'Active',
      basePrice: 125000,
      pricePerSqm: 175,
      vatPercentage: 15,
      endowmentFee: 3500,
      totalAreaSqm: 75000,
      totalStands: 60,
      availableStands: 54,
      imageUrls: [
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      ],
      logoUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400',
      documentUrls: ['https://example.com/vicfalls-prospectus.pdf'],
    },
  });

  const dev3 = await prisma.development.create({
    data: {
      name: 'Bulawayo Heights',
      location: 'Burnside, Bulawayo',
      description: 'Modern estate in Bulawayo\'s premier suburb. Features include gated security, borehole water, and proximity to schools and shopping centers.',
      phase: 'READY_TO_BUILD',
      servicingProgress: 90,
      status: 'Active',
      basePrice: 55000,
      pricePerSqm: 95,
      vatPercentage: 15,
      endowmentFee: 1800,
      totalAreaSqm: 35000,
      totalStands: 38,
      availableStands: 25,
      imageUrls: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
        'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
      ],
      logoUrl: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400',
      documentUrls: ['https://example.com/bulawayo-info.pdf'],
    },
  });

  const dev4 = await prisma.development.create({
    data: {
      name: 'Greendale Gardens',
      location: 'Greendale, Harare',
      description: 'Affordable housing project in Greendale. Perfect for first-time homeowners. All stands fully serviced with municipal water and electricity connections.',
      phase: 'COMPLETED',
      servicingProgress: 100,
      status: 'Active',
      basePrice: 42000,
      pricePerSqm: 70,
      vatPercentage: 15,
      endowmentFee: 1200,
      totalAreaSqm: 28000,
      totalStands: 52,
      availableStands: 18,
      imageUrls: [
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
      ],
      logoUrl: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=400',
      documentUrls: ['https://example.com/greendale-terms.pdf'],
    },
  });

  console.log('✅ Developments created:', dev1.name, dev2.name, dev3.name, dev4.name);

  // ============================================
  // 4. STANDS (Individual Plots)
  // ============================================
  console.log('\n📝 Creating stands...');

  const stands = [];

  // Borrowdale Brooke Estate - 45 stands
  for (let i = 1; i <= 45; i++) {
    const status = i <= 5 ? 'SOLD' : i <= 13 ? 'RESERVED' : 'AVAILABLE';
    stands.push({
      standNumber: `BB${String(i).padStart(3, '0')}`,
      developmentId: dev1.id,
      price: 85000 + (i * 1000), // Varying prices
      pricePerSqm: 125,
      sizeSqm: 800 + (i * 10),
      status,
    });
  }

  // Victoria Falls View - 60 stands
  for (let i = 1; i <= 60; i++) {
    const status = i <= 3 ? 'SOLD' : i <= 6 ? 'RESERVED' : 'AVAILABLE';
    stands.push({
      standNumber: `VF${String(i).padStart(3, '0')}`,
      developmentId: dev2.id,
      price: 125000 + (i * 1500),
      pricePerSqm: 175,
      sizeSqm: 1000 + (i * 15),
      status,
    });
  }

  // Bulawayo Heights - 38 stands
  for (let i = 1; i <= 38; i++) {
    const status = i <= 7 ? 'SOLD' : i <= 13 ? 'RESERVED' : 'AVAILABLE';
    stands.push({
      standNumber: `BH${String(i).padStart(3, '0')}`,
      developmentId: dev3.id,
      price: 55000 + (i * 800),
      pricePerSqm: 95,
      sizeSqm: 650 + (i * 12),
      status,
    });
  }

  // Greendale Gardens - 52 stands
  for (let i = 1; i <= 52; i++) {
    const status = i <= 20 ? 'SOLD' : i <= 34 ? 'RESERVED' : 'AVAILABLE';
    stands.push({
      standNumber: `GG${String(i).padStart(3, '0')}`,
      developmentId: dev4.id,
      price: 42000 + (i * 500),
      pricePerSqm: 70,
      sizeSqm: 550 + (i * 8),
      status,
    });
  }

  const createdStands = await prisma.stand.createMany({
    data: stands,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${createdStands.count} stands across 4 developments`);

  // ============================================
  // 5. RESERVATIONS
  // ============================================
  console.log('\n📝 Creating reservations...');

  // Get some reserved stands
  const reservedStands = await prisma.stand.findMany({
    where: { status: 'RESERVED' },
    take: 10,
  });

  const reservations = [];

  // Create reservations for the first few reserved stands
  if (reservedStands.length > 0) {
    // Reservation 1 - Agent lead, active timer
    reservations.push(
      await prisma.reservation.create({
        data: {
          standId: reservedStands[0].id,
          userId: client1.id,
          agentId: agentProfile1.id,
          isCompanyLead: false,
          assignedLeadType: 'Agent',
          termsAcceptedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days remaining
          status: 'PENDING',
          timerActive: true,
        },
      })
    );

    // Reservation 2 - Company lead, payment pending
    if (reservedStands[1]) {
      reservations.push(
        await prisma.reservation.create({
          data: {
            standId: reservedStands[1].id,
            userId: client2.id,
            agentId: null,
            isCompanyLead: true,
            assignedLeadType: 'Company',
            termsAcceptedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
            expiresAt: new Date(Date.now() + 60 * 60 * 60 * 1000), // 60 hours remaining
            status: 'PAYMENT_PENDING',
            timerActive: false, // Timer stopped due to payment upload
            popUrl: 'https://example.com/proof-of-payment-001.jpg',
          },
        })
      );
    }

    // Reservation 3 - Agent lead, confirmed
    if (reservedStands[2]) {
      reservations.push(
        await prisma.reservation.create({
          data: {
            standId: reservedStands[2].id,
            userId: client3.id,
            agentId: agentProfile2.id,
            isCompanyLead: false,
            assignedLeadType: 'Agent',
            termsAcceptedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day remaining
            status: 'CONFIRMED',
            timerActive: false, // Payment confirmed
          },
        })
      );
    }

    // Reservation 4 - About to expire
    if (reservedStands[3]) {
      reservations.push(
        await prisma.reservation.create({
          data: {
            standId: reservedStands[3].id,
            userId: client1.id,
            agentId: agentProfile1.id,
            isCompanyLead: false,
            assignedLeadType: 'Agent',
            termsAcceptedAt: new Date(Date.now() - 70 * 60 * 60 * 1000), // 70 hours ago
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours remaining!
            status: 'PENDING',
            timerActive: true,
          },
        })
      );
    }

    console.log(`✅ Created ${reservations.length} reservations`);
  }

  // ============================================
  // 6. ACTIVITY LOGS (Forensic Trail)
  // ============================================
  console.log('\n📝 Creating activity logs...');

  const activities = await prisma.activity.createMany({
    data: [
      {
        type: 'LOGIN',
        description: 'Admin logged into system',
        userId: admin.id,
        metadata: { ip: '41.79.197.1', device: 'Chrome/Windows' },
      },
      {
        type: 'LOGIN',
        description: 'Agent John Moyo logged in',
        userId: agent1.id,
        metadata: { ip: '41.79.197.22', device: 'Safari/MacOS' },
      },
      {
        type: 'RESERVATION',
        description: 'Client reserved stand BB001',
        userId: client1.id,
        metadata: { 
          standId: reservedStands[0]?.id, 
          development: 'Borrowdale Brooke Estate',
          agentId: agentProfile1.id,
        },
      },
      {
        type: 'PAYMENT_UPLOAD',
        description: 'Client uploaded proof of payment',
        userId: client2.id,
        metadata: { 
          standId: reservedStands[1]?.id, 
          amount: 8500,
          method: 'Bank Transfer',
        },
      },
      {
        type: 'VERIFICATION',
        description: 'Admin verified payment',
        userId: admin.id,
        metadata: { 
          reservationId: reservations[1]?.id,
          verifiedAmount: 8500,
        },
      },
      {
        type: 'STAND_UPDATE',
        description: 'Stand status updated to RESERVED',
        userId: agent1.id,
        metadata: { 
          standId: reservedStands[0]?.id, 
          oldStatus: 'AVAILABLE',
          newStatus: 'RESERVED',
        },
      },
      {
        type: 'USER_CREATED',
        description: 'New client registered',
        userId: admin.id,
        metadata: { 
          newUserId: client3.id,
          role: 'CLIENT',
        },
      },
      {
        type: 'AGENT_ASSIGNED',
        description: 'Agent assigned to reservation',
        userId: admin.id,
        metadata: { 
          agentId: agentProfile2.id,
          reservationId: reservations[2]?.id,
        },
      },
    ],
  });

  console.log(`✅ Created ${activities.count} activity log entries`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n========================================');
  console.log('✨ DEMO DATA SEED COMPLETE!');
  console.log('========================================');
  console.log('\n📊 Summary:');
  console.log(`   Users: 6 (1 admin, 2 agents, 3 clients)`);
  console.log(`   Developments: 4 property projects`);
  console.log(`   Stands: ${createdStands.count} plots across all developments`);
  console.log(`   Reservations: ${reservations.length} active reservations`);
  console.log(`   Activity Logs: ${activities.count} audit trail entries`);
  console.log('\n🔑 Demo Login Credentials:');
  console.log('   Admin: [email protected]');
  console.log('   Agent 1: [email protected]');
  console.log('   Agent 2: [email protected]');
  console.log('   Client 1: [email protected]');
  console.log('   Client 2: [email protected]');
  console.log('   Client 3: [email protected]');
  console.log('\n🚀 You can now login and explore the system!');
  console.log('========================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding demo data:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
