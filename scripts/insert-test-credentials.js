/**
 * Insert Test Credentials into Database
 * Usage: node scripts/insert-test-credentials.js
 * 
 * Creates test users for all dashboard types
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const testCredentials = [
  // 1. ADMIN - Full system access
  {
    id: 'admin-test-001',
    name: 'Admin User',
    email: 'admin@fineandcountryerp.com',
    plainPassword: 'AdminTest123!',
    role: 'ADMIN',
    branch: 'Harare',
  },
  
  // 2. AGENT #1 - Harare branch
  {
    id: 'agent-test-001',
    name: 'John Agent',
    email: 'agent@fineandcountryerp.com',
    plainPassword: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Harare',
  },
  
  // 3. AGENT #2 - Bulawayo branch
  {
    id: 'agent-test-002',
    name: 'Peter Agent',
    email: 'peter.agent@fineandcountryerp.com',
    plainPassword: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Bulawayo',
  },
  
  // 4. AGENT #3 - Harare branch
  {
    id: 'agent-test-003',
    name: 'Sandra Agent',
    email: 'sandra.agent@fineandcountryerp.com',
    plainPassword: 'AgentTest123!',
    role: 'AGENT',
    branch: 'Harare',
  },
  
  // 5. CLIENT #1 - Harare
  {
    id: 'client-test-001',
    name: 'Jane Client',
    email: 'client@fineandcountryerp.com',
    plainPassword: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Harare',
  },
  
  // 6. CLIENT #2 - Bulawayo
  {
    id: 'client-test-002',
    name: 'Michael Client',
    email: 'michael.client@fineandcountryerp.com',
    plainPassword: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Bulawayo',
  },
  
  // 7. CLIENT #3 - Harare
  {
    id: 'client-test-003',
    name: 'Victoria Client',
    email: 'victoria.client@fineandcountryerp.com',
    plainPassword: 'ClientTest123!',
    role: 'CLIENT',
    branch: 'Harare',
  },
  
  // 8. MANAGER - Branch management
  {
    id: 'manager-test-001',
    name: 'Robert Manager',
    email: 'manager@fineandcountryerp.com',
    plainPassword: 'ManagerTest123!',
    role: 'MANAGER',
    branch: 'Bulawayo',
  },
  
  // 9. ACCOUNT - Support operations
  {
    id: 'account-test-001',
    name: 'Sarah Account',
    email: 'account@fineandcountryerp.com',
    plainPassword: 'AccountTest123!',
    role: 'ACCOUNT',
    branch: 'Harare',
  },
];

async function insertTestCredentials() {
  try {
    console.log('🔐 Starting test credential insertion...\n');
    
    for (const cred of testCredentials) {
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(cred.plainPassword, 10);
        
        // Upsert user (create or update)
        const user = await prisma.user.upsert({
          where: { email: cred.email },
          update: {
            name: cred.name,
            role: cred.role,
            branch: cred.branch,
            isActive: true,
            emailVerified: new Date(),
            password: hashedPassword,
          },
          create: {
            id: cred.id,
            name: cred.name,
            email: cred.email,
            role: cred.role,
            branch: cred.branch,
            isActive: true,
            emailVerified: new Date(),
            password: hashedPassword,
          },
        });
        
        console.log(`✅ ${user.role.padEnd(10)} - ${user.email}`);
      } catch (error) {
        console.error(`❌ Error creating ${cred.email}:`, error.message);
      }
    }
    
    console.log('\n✨ Test credentials created successfully!');
    console.log('\n📋 Login Information:');
    console.log('━'.repeat(70));
    
    testCredentials.forEach(cred => {
      console.log(`\n${cred.role.padEnd(10)} | ${cred.email.padEnd(35)} | ${cred.plainPassword}`);
    });
    
    console.log('\n' + '━'.repeat(70));
    console.log('\n⚠️  Remember: These are TEST CREDENTIALS only!');
    console.log('🗑️  Delete before production deployment.');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestCredentials();
