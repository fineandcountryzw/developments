/**
 * Diagnostic script to check user roles in database
 * Run: npx tsx scripts/check-user-roles.ts
 */

import prisma from '../lib/prisma';

async function main() {
  console.log('🔍 Checking User Roles in Database...\n');

  try {
    // Check if UserRole enum has all expected values
    const enumCheck = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'UserRole'
      )
      ORDER BY enumlabel;
    `;

    console.log('📋 UserRole Enum Values in Database:');
    enumCheck.forEach(({ enumlabel }) => {
      console.log(`  - ${enumlabel}`);
    });

    // Check all users and their roles
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branch: true,
      },
      orderBy: {
        email: 'asc',
      },
    });

    console.log(`\n👥 Total Users: ${users.length}\n`);

    // Group by role
    const roleGroups: Record<string, any[]> = {};
    users.forEach(user => {
      const role = user.role || 'UNKNOWN';
      if (!roleGroups[role]) {
        roleGroups[role] = [];
      }
      roleGroups[role].push(user);
    });

    console.log('📊 Users by Role:');
    Object.entries(roleGroups).forEach(([role, users]) => {
      console.log(`\n  ${role} (${users.length} users):`);
      users.forEach(user => {
        console.log(`    - ${user.email} (${user.name || 'No name'}) - Branch: ${user.branch || 'N/A'}`);
      });
    });

    // Check for DEVELOPER and ACCOUNT users specifically
    const developerUsers = users.filter(u => u.role === 'DEVELOPER');
    const accountUsers = users.filter(u => u.role === 'ACCOUNT' || u.role === 'ACCOUNTS' || u.role === 'ACCOUNTANT');

    console.log(`\n🔍 DEVELOPER Users: ${developerUsers.length}`);
    if (developerUsers.length > 0) {
      developerUsers.forEach(u => {
        console.log(`  - ${u.email} (Role: ${u.role})`);
      });
    } else {
      console.log('  ⚠️  No DEVELOPER users found in database');
    }

    console.log(`\n🔍 ACCOUNT Users: ${accountUsers.length}`);
    if (accountUsers.length > 0) {
      accountUsers.forEach(u => {
        console.log(`  - ${u.email} (Role: ${u.role})`);
      });
    } else {
      console.log('  ⚠️  No ACCOUNT users found in database');
    }

    // Check if enum needs updating
    const expectedRoles = ['ADMIN', 'MANAGER', 'AGENT', 'ACCOUNT', 'CLIENT', 'DEVELOPER'];
    const dbRoles = enumCheck.map(e => e.enumlabel);
    const missingRoles = expectedRoles.filter(r => !dbRoles.includes(r));

    if (missingRoles.length > 0) {
      console.log(`\n⚠️  Missing Roles in Database Enum: ${missingRoles.join(', ')}`);
      console.log('   You may need to update the UserRole enum in the database.');
    } else {
      console.log('\n✅ All expected roles are present in the database enum');
    }

  } catch (error: any) {
    console.error('❌ Error checking user roles:', error.message);
    if (error.message.includes('does not exist') || error.message.includes('UserRole')) {
      console.error('\n⚠️  UserRole enum may not exist in database. Run migrations first.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
