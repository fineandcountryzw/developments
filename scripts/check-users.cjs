require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n=== ACTIVE USERS IN DATABASE ===\n');
  
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        email: true,
        name: true,
        role: true,
        branch: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { role: 'asc' }
    });

    console.log(`Found ${users.length} active users:\n`);
    console.log('ROLE       | EMAIL                          | NAME             | BRANCH   | LAST LOGIN');
    console.log('-'.repeat(100));
    
    for (const user of users) {
      const role = (user.role || 'UNKNOWN').padEnd(10);
      const email = (user.email || 'N/A').padEnd(30);
      const name = (user.name || 'N/A').substring(0, 16).padEnd(16);
      const branch = (user.branch || 'N/A').padEnd(8);
      const login = user.lastLogin ? user.lastLogin.toISOString().split('T')[0] : 'Never';
      console.log(`${role} | ${email} | ${name} | ${branch} | ${login}`);
    }

    // Also check inactive
    const inactive = await prisma.user.findMany({
      where: { isActive: false },
      select: { email: true, role: true, revokeReason: true }
    });
    
    if (inactive.length > 0) {
      console.log(`\n=== INACTIVE USERS (${inactive.length}) ===\n`);
      for (const u of inactive) {
        console.log(`${u.role} | ${u.email} | Reason: ${u.revokeReason || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
