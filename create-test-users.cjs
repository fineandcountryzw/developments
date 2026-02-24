const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createUsers() {
  // Read DATABASE_URL directly from .env file
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
  
  if (!dbMatch) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }
  
  const connectionString = dbMatch[1].replace(/["']/g, '').trim();
  console.log('Connecting to:', connectionString.substring(0, 60) + '...');
  
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });
  
  try {
    // Check existing users
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    console.log('Existing users:', users);
    
    // Create Account user
    const accountPassword = await bcrypt.hash('Account@123', 12);
    const accountUser = await prisma.user.upsert({
      where: { email: 'account@fineandcountry.co.zw' },
      update: { password: accountPassword, role: 'ACCOUNT' },
      create: {
        email: 'account@fineandcountry.co.zw',
        name: 'Account User',
        password: accountPassword,
        role: 'ACCOUNT',
        branch: 'Harare'
      }
    });
    console.log('✅ Account user created:', accountUser.email);
    
    // Create Developer user  
    const devPassword = await bcrypt.hash('Developer@123', 12);
    const devUser = await prisma.user.upsert({
      where: { email: 'developer@fineandcountry.co.zw' },
      update: { password: devPassword, role: 'DEVELOPER' },
      create: {
        email: 'developer@fineandcountry.co.zw',
        name: 'Developer User',
        password: devPassword,
        role: 'DEVELOPER',
        branch: 'Harare'
      }
    });
    console.log('✅ Developer user created:', devUser.email);

    // Create Manager user  
    const managerPassword = await bcrypt.hash('Manager@123', 12);
    const managerUser = await prisma.user.upsert({
      where: { email: 'manager@fineandcountry.co.zw' },
      update: { password: managerPassword, role: 'MANAGER' },
      create: {
        email: 'manager@fineandcountry.co.zw',
        name: 'Manager User',
        password: managerPassword,
        role: 'MANAGER',
        branch: 'Harare'
      }
    });
    console.log('✅ Manager user created:', managerUser.email);

    // Create Client user  
    const clientPassword = await bcrypt.hash('Client@123', 12);
    const clientUser = await prisma.user.upsert({
      where: { email: 'client@fineandcountry.co.zw' },
      update: { password: clientPassword, role: 'CLIENT' },
      create: {
        email: 'client@fineandcountry.co.zw',
        name: 'Client User',
        password: clientPassword,
        role: 'CLIENT',
        branch: 'Harare'
      }
    });
    console.log('✅ Client user created:', clientUser.email);

    console.log('\n=== Test Credentials ===');
    console.log('Account: account@fineandcountry.co.zw / Account@123');
    console.log('Developer: developer@fineandcountry.co.zw / Developer@123');
    console.log('Manager: manager@fineandcountry.co.zw / Manager@123');
    console.log('Client: client@fineandcountry.co.zw / Client@123');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

createUsers();
