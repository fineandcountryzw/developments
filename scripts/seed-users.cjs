require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const bcrypt = require('bcryptjs');

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Default password for all test users
const DEFAULT_PASSWORD = 'Test@123';

const testUsers = [
  {
    email: 'admin@fineandcountry.co.zw',
    name: 'Admin User',
    role: 'ADMIN',
    branch: 'Harare',
  },
  {
    email: 'manager@fineandcountry.co.zw',
    name: 'Manager User',
    role: 'MANAGER',
    branch: 'Harare',
  },
  {
    email: 'agent@fineandcountry.co.zw',
    name: 'Agent User',
    role: 'AGENT',
    branch: 'Harare',
  },
  {
    email: 'accountant@fineandcountry.co.zw',
    name: 'Accountant User',
    role: 'ACCOUNT',
    branch: 'Harare',
  },
  {
    email: 'client@fineandcountry.co.zw',
    name: 'Client User',
    role: 'CLIENT',
    branch: 'Harare',
  },
  {
    email: 'developer@fineandcountry.co.zw',
    name: 'Developer User',
    role: 'DEVELOPER',
    branch: 'Harare',
  },
  // Bulawayo branch users
  {
    email: 'manager.byo@fineandcountry.co.zw',
    name: 'Manager Bulawayo',
    role: 'MANAGER',
    branch: 'Bulawayo',
  },
  {
    email: 'agent.byo@fineandcountry.co.zw',
    name: 'Agent Bulawayo',
    role: 'AGENT',
    branch: 'Bulawayo',
  },
];

async function main() {
  console.log('\n=== SEEDING TEST USERS ===\n');
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}\n`);

  // Hash the password once
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existing) {
        console.log(`✓ EXISTS: ${userData.role.padEnd(10)} | ${userData.email}`);
        
        // Update password if needed (in case it was forgotten)
        await prisma.user.update({
          where: { email: userData.email },
          data: { 
            password: hashedPassword,
            isActive: true,
            name: userData.name,
            branch: userData.branch,
          }
        });
      } else {
        // Create new user
        await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            role: userData.role,
            branch: userData.branch,
            password: hashedPassword,
            isActive: true,
            emailVerified: new Date(),
          }
        });
        console.log(`✓ CREATED: ${userData.role.padEnd(10)} | ${userData.email}`);
      }
    } catch (error) {
      console.error(`✗ FAILED: ${userData.email} - ${error.message}`);
    }
  }

  console.log('\n=== SEEDING COMPLETE ===\n');
  console.log('You can now login with any of these accounts using password:', DEFAULT_PASSWORD);
  console.log('\nDashboard URLs:');
  console.log('  Admin:      /dashboards/admin');
  console.log('  Manager:    /dashboards/manager');
  console.log('  Agent:      /dashboards/agent');
  console.log('  Accountant: /dashboards/accounts');
  console.log('  Client:     /dashboards/client');
  console.log('  Developer:  /developer');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
