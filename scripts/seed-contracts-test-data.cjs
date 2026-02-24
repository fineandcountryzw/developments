/**
 * Contract Visibility Test Seed Script
 * 
 * Creates controlled test data to verify role-based access control:
 * - 3 Developments (A, B, C)
 * - 2 Developer users (DevA owns A+B, DevB owns C)
 * - 2 Agents (Agent1 owns Client1+2, Agent2 owns Client3)
 * - 3 Clients
 * - 12 Contracts with mixed statuses
 * 
 * Run: node scripts/seed-contracts-test-data.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BRANCH = 'Harare';

async function seedTestData() {
  console.log('🌱 Starting contract visibility test seed...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CREATE DEVELOPMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating developments...');
  
  const { Prisma } = require('@prisma/client');

  const developments = await Promise.all([
    prisma.development.create({
      data: {
        name: 'Test Development A',
        location: 'Test Location A',
        branch: BRANCH,
        status: 'ACTIVE',
        developerEmail: 'deva@test.com',
        developerName: 'Developer A',
        basePrice: new Prisma.Decimal(100000),
        vatPercentage: new Prisma.Decimal(15),
        totalStands: 10,
        availableStands: 10,
        description: 'Test development for QA',
      }
    }),
    prisma.development.create({
      data: {
        name: 'Test Development B',
        location: 'Test Location B',
        branch: BRANCH,
        status: 'ACTIVE',
        developerEmail: 'deva@test.com', // Same developer owns A and B
        developerName: 'Developer A',
        basePrice: new Prisma.Decimal(100000),
        vatPercentage: new Prisma.Decimal(15),
        totalStands: 10,
        availableStands: 10,
        description: 'Test development for QA',
      }
    }),
    prisma.development.create({
      data: {
        name: 'Test Development C',
        location: 'Test Location C',
        branch: BRANCH,
        status: 'ACTIVE',
        developerEmail: 'devb@test.com', // DevB owns C
        developerName: 'Developer B',
        basePrice: new Prisma.Decimal(100000),
        vatPercentage: new Prisma.Decimal(15),
        totalStands: 10,
        availableStands: 10,
        description: 'Test development for QA',
      }
    }),
  ]);

  console.log(`  ✓ Created ${developments.length} developments`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CREATE STANDS (4 per development)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating stands...');

  const stands = [];
  for (const dev of developments) {
    for (let i = 1; i <= 4; i++) {
      const stand = await prisma.stand.create({
        data: {
          standNumber: `TEST-${dev.name.split(' ').pop()}-${i}`,
          developmentId: dev.id,
          branch: BRANCH,
          price: new Prisma.Decimal(50000),
          sizeSqm: new Prisma.Decimal(500),
          status: 'AVAILABLE',
        }
      });
      stands.push(stand);
    }
  }

  console.log(`  ✓ Created ${stands.length} stands`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CREATE TEST USERS (Agents + Developers)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating test users...');

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@test.com' },
    update: {},
    create: {
      email: 'agent1@test.com',
      name: 'Test Agent 1',
      role: 'AGENT',
      branch: BRANCH,
      isActive: true,
      password: 'hashed_password_placeholder'
    }
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@test.com' },
    update: {},
    create: {
      email: 'agent2@test.com',
      name: 'Test Agent 2',
      role: 'AGENT',
      branch: BRANCH,
      isActive: true,
      password: 'hashed_password_placeholder'
    }
  });

  const devUserA = await prisma.user.upsert({
    where: { email: 'deva@test.com' },
    update: {},
    create: {
      email: 'deva@test.com',
      name: 'Developer A User',
      role: 'DEVELOPER',
      branch: BRANCH,
      isActive: true,
      password: 'hashed_password_placeholder'
    }
  });

  const devUserB = await prisma.user.upsert({
    where: { email: 'devb@test.com' },
    update: {},
    create: {
      email: 'devb@test.com',
      name: 'Developer B User',
      role: 'DEVELOPER',
      branch: BRANCH,
      isActive: true,
      password: 'hashed_password_placeholder'
    }
  });

  console.log('  ✓ Created 4 test users (2 agents, 2 developers)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CREATE CLIENTS (assigned to agents)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating clients...');

  const client1 = await prisma.client.create({
    data: {
      name: 'Test Client 1',
      email: 'client1@test.com',
      phone: '+263771111111',
      branch: BRANCH,
      agentId: agent1.id, // Agent1's client
    }
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'Test Client 2',
      email: 'client2@test.com',
      phone: '+263772222222',
      branch: BRANCH,
      agentId: agent1.id, // Agent1's client
    }
  });

  const client3 = await prisma.client.create({
    data: {
      name: 'Test Client 3',
      email: 'client3@test.com',
      phone: '+263773333333',
      branch: BRANCH,
      agentId: agent2.id, // Agent2's client
    }
  });

  console.log('  ✓ Created 3 clients');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CREATE CONTRACT TEMPLATE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating contract template...');

  const template = await prisma.contractTemplate.upsert({
    where: { id: 'test-template-qa' },
    update: {},
    create: {
      id: 'test-template-qa',
      name: 'QA Test Contract Template',
      content: '<h1>Test Contract</h1><p>This is a test contract for QA purposes.</p>',
      branch: BRANCH,
      status: 'ACTIVE',
    }
  });

  console.log('  ✓ Created contract template');

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CREATE 12 CONTRACTS WITH MIXED STATUSES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Creating contracts...');

  const contractConfigs = [
    // Client1 (Agent1) - Development A (DevA)
    { client: client1, stand: stands[0], status: 'DRAFT' },
    { client: client1, stand: stands[1], status: 'SENT', docuseal: true },
    { client: client1, stand: stands[2], status: 'SIGNED', signed: true },
    { client: client1, stand: stands[3], status: 'PARTIALLY_SIGNED', docuseal: true },

    // Client2 (Agent1) - Development B (DevA)
    { client: client2, stand: stands[4], status: 'DRAFT' },
    { client: client2, stand: stands[5], status: 'SENT', docuseal: true },
    { client: client2, stand: stands[6], status: 'SIGNED', signed: true },
    { client: client2, stand: stands[7], status: 'PARTIALLY_SIGNED', docuseal: true },

    // Client3 (Agent2) - Development C (DevB)
    { client: client3, stand: stands[8], status: 'DRAFT' },
    { client: client3, stand: stands[9], status: 'SENT', docuseal: true },
    { client: client3, stand: stands[10], status: 'SIGNED', signed: true },
    { client: client3, stand: stands[11], status: 'PARTIALLY_SIGNED', docuseal: true },
  ];

  const contracts = [];
  for (const config of contractConfigs) {
    const contract = await prisma.generatedContract.create({
      data: {
        clientId: config.client.id,
        templateId: template.id,
        standId: config.stand.id,
        templateName: template.name,
        content: template.content,
        status: config.status,
        branch: BRANCH,
        signedAt: config.signed ? new Date() : null,
        signedPdfUrl: config.signed ? `https://example.com/signed/${config.stand.id}.pdf` : null,
        docusealSubmissionId: config.docuseal ? `sub_${config.stand.id}` : null,
        docusealStatus: config.docuseal ? config.status : null,
      }
    });
    contracts.push(contract);
  }

  console.log(`  ✓ Created ${contracts.length} contracts`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📊 Test Data Summary:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Developments: ${developments.length}`);
  console.log(`  - Dev A (deva@test.com): ${developments[0].name}, ${developments[1].name}`);
  console.log(`  - Dev B (devb@test.com): ${developments[2].name}`);
  console.log(`Stands: ${stands.length}`);
  console.log(`Agents: 2 (agent1@test.com, agent2@test.com)`);
  console.log(`Clients: 3`);
  console.log(`  - Client1, Client2 → Agent1`);
  console.log(`  - Client3 → Agent2`);
  console.log(`Contracts: ${contracts.length}`);
  console.log(`  - DRAFT: ${contracts.filter(c => c.status === 'DRAFT').length}`);
  console.log(`  - SENT: ${contracts.filter(c => c.status === 'SENT').length}`);
  console.log(`  - SIGNED: ${contracts.filter(c => c.status === 'SIGNED').length}`);
  console.log(`  - PARTIALLY_SIGNED: ${contracts.filter(c => c.status === 'PARTIALLY_SIGNED').length}`);
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\n✅ Expected visibility by role:');
  console.log('  ADMIN/MANAGER: 12 contracts');
  console.log('  Developer A (deva@test.com): 8 contracts (Dev A + B)');
  console.log('  Developer B (devb@test.com): 4 contracts (Dev C only)');
  console.log('  Agent 1 (agent1@test.com): 8 contracts (Client1 + Client2)');
  console.log('  Agent 2 (agent2@test.com): 4 contracts (Client3 only)');
  console.log('  Client 1 (client1@test.com): 4 contracts');
  console.log('  Client 2 (client2@test.com): 4 contracts');
  console.log('  Client 3 (client3@test.com): 4 contracts');

  return {
    developments: developments.map(d => ({ id: d.id, name: d.name, developerEmail: d.developerEmail || '' })),
    stands: stands.map(s => ({ id: s.id, developmentId: s.developmentId, standNumber: s.standNumber })),
    agents: [
      { id: agent1.id, email: agent1.email },
      { id: agent2.id, email: agent2.email }
    ],
    clients: [
      { id: client1.id, name: client1.name, email: client1.email, agentId: client1.agentId || '' },
      { id: client2.id, name: client2.name, email: client2.email, agentId: client2.agentId || '' },
      { id: client3.id, name: client3.name, email: client3.email, agentId: client3.agentId || '' }
    ],
    contracts: contracts.map(c => ({ id: c.id, clientId: c.clientId, standId: c.standId, status: c.status }))
  };
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up existing test data...');
  
  // Delete in reverse order of dependencies
  await prisma.generatedContract.deleteMany({
    where: { branch: BRANCH, templateName: 'QA Test Contract Template' }
  });
  
  await prisma.stand.deleteMany({
    where: { standNumber: { startsWith: 'TEST-' } }
  });
  
  await prisma.development.deleteMany({
    where: { name: { startsWith: 'Test Development' } }
  });
  
  await prisma.client.deleteMany({
    where: { email: { in: ['client1@test.com', 'client2@test.com', 'client3@test.com'] } }
  });

  console.log('  ✓ Cleanup complete');
}

async function main() {
  try {
    // Cleanup existing test data first
    await cleanupTestData();
    
    // Create new test data
    const testData = await seedTestData();
    
    console.log('\n🎉 Test data seeding complete!');
    console.log('\nRun tests with:');
    console.log('  curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/admin/contracts"');
    
    return testData;
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
main().catch(console.error);

module.exports = { seedTestData, cleanupTestData };
