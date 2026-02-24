import prisma from '../lib/prisma';

async function main() {
  console.log('\n=== ACTIVE USERS IN DATABASE ===\n');
  
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      branch: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  console.log(`Found ${users.length} active users:\n`);
  
  // Group by role
  const byRole: Record<string, typeof users> = {};
  for (const user of users) {
    const role = user.role || 'UNKNOWN';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(user);
  }

  for (const [role, roleUsers] of Object.entries(byRole)) {
    console.log(`\n--- ${role} (${roleUsers.length}) ---`);
    for (const user of roleUsers) {
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name || 'N/A'}`);
      console.log(`  Branch: ${user.branch || 'N/A'}`);
      console.log(`  Last Login: ${user.lastLogin ? user.lastLogin.toISOString() : 'Never'}`);
      console.log(`  Created: ${user.createdAt.toISOString()}`);
      console.log('');
    }
  }

  // Also check for any inactive/revoked users
  const inactiveUsers = await prisma.user.findMany({
    where: { isActive: false },
    select: {
      email: true,
      name: true,
      role: true,
      accessRevokedAt: true,
      revokeReason: true,
    }
  });

  if (inactiveUsers.length > 0) {
    console.log(`\n=== INACTIVE/REVOKED USERS (${inactiveUsers.length}) ===\n`);
    for (const user of inactiveUsers) {
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Revoked: ${user.accessRevokedAt?.toISOString() || 'N/A'}`);
      console.log(`  Reason: ${user.revokeReason || 'N/A'}`);
      console.log('');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
