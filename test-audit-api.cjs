#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function testAuditTrail() {
  try {
    console.log('🔍 Testing Audit Trail System-Wide Fetch...\n');

    // Test 1: Count all entries
    const auditCount = await prisma.auditTrail.count();
    const activityCount = await prisma.activityLog.count();
    const totalExpected = auditCount + activityCount;

    console.log('📊 Database Counts:');
    console.log(`  • auditTrail entries: ${auditCount}`);
    console.log(`  • activityLog entries: ${activityCount}`);
    console.log(`  • Total expected: ${totalExpected}\n`);

    // Test 2: Fetch all auditTrail entries
    console.log('📝 auditTrail Entries:');
    const allAudits = await prisma.auditTrail.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        branch: true,
        createdAt: true,
      },
    });
    allAudits.forEach((entry, i) => {
      console.log(
        `  ${i + 1}. [${entry.action}] ${entry.resourceType}${entry.resourceId ? ` (${entry.resourceId})` : ''} @ ${entry.createdAt.toISOString()}`
      );
    });

    // Test 3: Fetch all activityLog entries
    console.log('\n📋 activityLog Entries:');
    const allActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        module: true,
        recordId: true,
        branch: true,
        createdAt: true,
      },
    });
    allActivity.forEach((entry, i) => {
      console.log(
        `  ${i + 1}. [${entry.action}] ${entry.module}${entry.recordId ? ` (${entry.recordId})` : ''} @ ${entry.createdAt.toISOString()}`
      );
    });

    // Test 4: Verify system-wide data
    console.log(`\n✅ System-wide total: ${totalExpected} entries`);
    console.log(
      `   (If you fetch from the audit API with NO filters, you should see ${totalExpected} entries across pages)`
    );

    // Test 5: Show unique values
    const uniqueActions = await prisma.auditTrail.findMany({
      select: { action: true },
      distinct: ['action'],
    });
    const uniqueModules = await prisma.auditTrail.findMany({
      select: { resourceType: true },
      distinct: ['resourceType'],
    });

    console.log('\n🏷️  Unique auditTrail Actions:', uniqueActions.map((a) => a.action).join(', '));
    console.log('🏷️  Unique auditTrail ResourceTypes:', uniqueModules.map((m) => m.resourceType).join(', '));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditTrail();
