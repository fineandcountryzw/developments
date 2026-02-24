require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check audit_trails table
  try {
    const auditTrails = await prisma.auditTrail.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, resourceType: true, branch: true, createdAt: true }
    });
    console.log('=== AuditTrail entries:', auditTrails.length, '===');
    auditTrails.forEach(a => console.log(`  ${a.createdAt.toISOString().slice(0,19)} | ${a.action} | ${a.resourceType} | ${a.branch}`));
  } catch(e) {
    console.log('AuditTrail error:', e.message);
  }
  
  // Check activity_logs table
  try {
    const activityLogs = await prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, module: true, description: true, createdAt: true }
    });
    console.log('\n=== ActivityLog entries:', activityLogs.length, '===');
    activityLogs.forEach(a => console.log(`  ${a.createdAt.toISOString().slice(0,19)} | ${a.action} | ${a.module} | ${a.description?.substring(0,40)}`));
  } catch(e) {
    console.log('ActivityLog error:', e.message);
  }
  
  // Check activities table
  try {
    const activities = await prisma.activity.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, description: true, createdAt: true }
    });
    console.log('\n=== Activity entries:', activities.length, '===');
    activities.forEach(a => console.log(`  ${a.createdAt.toISOString().slice(0,19)} | ${a.type} | ${a.description?.substring(0,40)}`));
  } catch(e) {
    console.log('Activity error:', e.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
