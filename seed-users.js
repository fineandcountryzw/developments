/**
 * Seed Users Script
 * Creates test users for all roles: ADMIN, MANAGER, AGENT, ACCOUNT, CLIENT
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Generate unique user ID
function generateUserId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `usr_${timestamp}${random}`;
}

// Seed users configuration
const seedUsers = [
  {
    email: 'admin@fineandcountry.co.zw',
    password: 'Admin@123',
    name: 'System Administrator',
    role: 'ADMIN',
    branch: 'Harare'
  },
  {
    email: 'manager@fineandcountry.co.zw',
    password: 'Manager@123',
    name: 'Branch Manager',
    role: 'MANAGER',
    branch: 'Harare'
  },
  {
    email: 'agent@fineandcountry.co.zw',
    password: 'Agent@123',
    name: 'Sarah Moyo',
    role: 'AGENT',
    branch: 'Harare'
  },
  {
    email: 'accounts@fineandcountry.co.zw',
    password: 'Account@123',
    name: 'Finance Officer',
    role: 'ACCOUNT',
    branch: 'Harare'
  },
  {
    email: 'client@example.com',
    password: 'Client@123',
    name: 'John Makoni',
    role: 'CLIENT',
    branch: 'Harare'
  },
  // Bulawayo branch users
  {
    email: 'manager.byo@fineandcountry.co.zw',
    password: 'Manager@123',
    name: 'Bulawayo Manager',
    role: 'MANAGER',
    branch: 'Bulawayo'
  },
  {
    email: 'agent.byo@fineandcountry.co.zw',
    password: 'Agent@123',
    name: 'Tendai Ncube',
    role: 'AGENT',
    branch: 'Bulawayo'
  }
];

async function seedAllUsers() {
  const client = await pool.connect();
  
  console.log('\n🌱 SEEDING TEST USERS');
  console.log('='.repeat(60));
  
  const results = [];
  
  try {
    for (const user of seedUsers) {
      // Check if user already exists
      const existing = await client.query(
        'SELECT id, email, role FROM users WHERE email = $1',
        [user.email]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏭️  SKIP: ${user.email} (already exists as ${existing.rows[0].role})`);
        results.push({
          ...user,
          status: 'skipped',
          id: existing.rows[0].id
        });
        continue;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const userId = generateUserId();
      
      // Insert user
      await client.query(`
        INSERT INTO users (id, email, password, name, role, branch, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::\"UserRole\", $6, NOW(), NOW())
      `, [userId, user.email, hashedPassword, user.name, user.role, user.branch]);
      
      console.log(`✅ CREATED: ${user.email}`);
      console.log(`   Role: ${user.role} | Branch: ${user.branch} | ID: ${userId}`);
      
      results.push({
        ...user,
        status: 'created',
        id: userId
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 SEED SUMMARY');
    console.log('='.repeat(60));
    
    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    
    console.log(`Created: ${created} | Skipped: ${skipped} | Total: ${results.length}`);
    
    console.log('\n📝 LOGIN CREDENTIALS');
    console.log('='.repeat(60));
    console.log('');
    console.log('| Role     | Email                              | Password     | Branch   |');
    console.log('|----------|------------------------------------|--------------| ---------|');
    
    for (const user of seedUsers) {
      const email = user.email.padEnd(34);
      const role = user.role.padEnd(8);
      const pwd = user.password.padEnd(12);
      const branch = user.branch.padEnd(9);
      console.log(`| ${role} | ${email} | ${pwd} | ${branch} |`);
    }
    
    console.log('');
    console.log('🔗 Login URL: http://localhost:3000/login');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAllUsers().catch(console.error);
