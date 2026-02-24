/**
 * Update UserRole Enum using Prisma
 * Run: npx tsx scripts/update-user-role-enum.ts
 */

import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  console.log('🔧 Updating UserRole Enum...\n');

  try {
    // Check current enum values
    console.log('📋 Current enum values:');
    const currentEnum = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel::text as enumlabel
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'UserRole'
      )
      ORDER BY enumlabel;
    `;
    
    currentEnum.forEach(({ enumlabel }) => {
      console.log(`  - ${enumlabel}`);
    });

    // Add DEVELOPER if missing
    console.log('\n➕ Adding DEVELOPER...');
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'DEVELOPER' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
          ) THEN
            ALTER TYPE "UserRole" ADD VALUE 'DEVELOPER';
          END IF;
        END $$;
      `);
      console.log('  ✅ DEVELOPER added (or already exists)');
    } catch (error: any) {
      console.log(`  ℹ️  ${error.message.includes('already') ? 'DEVELOPER already exists' : 'Error: ' + error.message}`);
    }

    // Add ACCOUNT if missing
    console.log('\n➕ Adding ACCOUNT...');
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'ACCOUNT' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
          ) THEN
            ALTER TYPE "UserRole" ADD VALUE 'ACCOUNT';
          END IF;
        END $$;
      `);
      console.log('  ✅ ACCOUNT added (or already exists)');
    } catch (error: any) {
      console.log(`  ℹ️  ${error.message.includes('already') ? 'ACCOUNT already exists' : 'Error: ' + error.message}`);
    }

    // Add MANAGER if missing
    console.log('\n➕ Adding MANAGER...');
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'MANAGER' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
          ) THEN
            ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
          END IF;
        END $$;
      `);
      console.log('  ✅ MANAGER added (or already exists)');
    } catch (error: any) {
      console.log(`  ℹ️  ${error.message.includes('already') ? 'MANAGER already exists' : 'Error: ' + error.message}`);
    }

    // Verify final state
    console.log('\n📋 Final enum values:');
    const finalEnum = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel::text as enumlabel
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'UserRole'
      )
      ORDER BY enumlabel;
    `;
    
    finalEnum.forEach(({ enumlabel }) => {
      console.log(`  - ${enumlabel}`);
    });

    // Check users
    console.log('\n👥 Users with DEVELOPER or ACCOUNT roles:');
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['DEVELOPER', 'ACCOUNT'],
        },
      },
      select: {
        email: true,
        name: true,
        role: true,
      },
    });

    if (users.length > 0) {
      users.forEach(u => {
        console.log(`  - ${u.email} (${u.name || 'No name'}) - ${u.role}`);
      });
    } else {
      console.log('  ⚠️  No users found with DEVELOPER or ACCOUNT roles');
    }

    console.log('\n✅ Update complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
