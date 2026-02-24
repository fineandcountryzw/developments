import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Setup Neon websocket for serverless
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function setPassword() {
  const email = 'gwanzuranicholas@gmail.com';
  const password = 'Admin123!';
  
  const hash = bcrypt.hashSync(password, 10);
  
  console.log('Setting password for:', email);
  console.log('Password hash:', hash);
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { password: hash }
    });
    
    console.log('✅ Password updated for user:', user.email);
    console.log('   Role:', user.role);
    console.log('   Name:', user.name);
    console.log('\n📧 Login credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
  } catch (error) {
    if (error.code === 'P2025') {
      console.log('User not found, creating new user...');
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hash,
          name: 'Nicholas Gwanzura',
          role: 'ADMIN',
          branch: 'Harare'
        }
      });
      console.log('✅ Created new admin user:', newUser.email);
      console.log('\n📧 Login credentials:');
      console.log('   Email:', email);
      console.log('   Password:', password);
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

setPassword().catch(console.error);
