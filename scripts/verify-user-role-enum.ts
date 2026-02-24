/**
 * Verify and Update UserRole Enum
 * Run: npx tsx scripts/verify-user-role-enum.ts
 */

import prisma from '../lib/prisma';

async function main() {
  console.log('🔍 Verifying and Updating UserRole Enum...\n');

  try {
    // 1. Check current enum values
    console.log('📋 Step 1: Checking current enum values...');
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

    console.log('Current UserRole Enum Values:');
    enumCheck.forEach(({ enumlabel }) => {
      console.log(`  - ${enumlabel}`);
    });

    // 2. Add missing roles if they don't exist
    console.log('\n📋 Step 2: Adding missing roles...');
    
    const expectedRoles = ['DEVELOPER', 'ACCOUNT', 'MANAGER'];
    const existingRoles = enumCheck.map(e => e.enumlabel);
    const missingRoles = expectedRoles.filter(r => !existingRoles.includes(r));

    if (missingRoles.length > 0) {
      console.log(`Found ${missingRoles.length} missing role(s): ${missingRoles.join(', ')}`);
      
      for (const role of missingRoles) {
        try {
          await prisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = '${role}' 
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
              ) THEN
                ALTER TYPE "UserRole" ADD VALUE '${role}';
                RAISE NOTICE 'Added ${role} to UserRole enum';
              END IF;
            END $$;
          `);
          console.log(`  ✅ Added ${role} to UserRole enum`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`  ℹ️  ${role} already exists in enum`);
          } else {
            console.error(`  ❌ Error adding ${role}:`, error.message);
          }
        }
      }
    } else {
      console.log('  ✅ All expected roles already exist');
    }

    // 3. Verify all roles exist
    console.log('\n📋 Step 3: Verifying all roles...');
    const finalCheck = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel as "Available Roles"
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'UserRole'
      )
      ORDER BY enumlabel;
    `;

    console.log('\n✅ Final UserRole Enum Values:');
    finalCheck.forEach(({ Available_Roles }) => {
      console.log(`  - ${Available_Roles}`);
    });

    // 4. Check users with DEVELOPER or ACCOUNT roles
    console.log('\n📋 Step 4: Checking users with DEVELOPER or ACCOUNT roles...');
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['DEVELOPER', 'ACCOUNT'],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branch: true,
      },
      orderBy: {
        role: 'asc',
      },
    });

    if (users.length > 0) {
      console.log(`\nFound ${users.length} user(s) with DEVELOPER or ACCOUNT roles:`);
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.name || 'No name'}) - Role: ${user.role} - Branch: ${user.branch || 'N/A'}`);
      });
    } else {
      console.log('\n⚠️  No users found with DEVELOPER or ACCOUNT roles');
      console.log('   You may need to update user roles in the database.');
    }

    console.log('\n✅ Enum verification complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('does not exist') || error.message.includes('UserRole')) {
      console.error('\n⚠️  UserRole enum may not exist in database.');
      console.error('   Run: npx prisma db push');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
