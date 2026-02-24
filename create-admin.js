import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAdminUser() {
  const email = 'gwanzuranicholas@gmail.com';
  const password = 'asdf_1234';
  const name = 'Nicholas Gwanzura';
  const role = 'ADMIN';  // Uppercase enum value
  const branch = 'Harare';
  
  console.log('Creating Admin User...');
  console.log('-'.repeat(40));
  
  try {
    // First check table structure
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' ORDER BY ordinal_position
    `);
    console.log('Users table columns:', cols.rows.map(r => r.column_name).join(', '));
    
    // Check if user already exists
    const existing = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  User already exists:');
      console.log(`   Email: ${existing.rows[0].email}`);
      console.log(`   Role: ${existing.rows[0].role}`);
      console.log(`   ID: ${existing.rows[0].id}`);
      await pool.end();
      return;
    }
    
    // Generate ID
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(8).toString('hex').substring(0, 12);
    const userId = `usr_${timestamp}${randomPart}`;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Insert user (without status column)
    const result = await pool.query(`
      INSERT INTO users (
        id, email, password, name, role, branch, 
        email_verified, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        NOW(), NOW(), NOW()
      )
      RETURNING id, email, name, role, branch
    `, [userId, email, hashedPassword, name, role, branch]);
    
    console.log('✅ Admin user created successfully!');
    console.log('-'.repeat(40));
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Name: ${result.rows[0].name}`);
    console.log(`   Role: ${result.rows[0].role}`);
    console.log(`   Branch: ${result.rows[0].branch}`);
    console.log('-'.repeat(40));
    console.log('');
    console.log('You can now login at http://localhost:3000/login');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
  } finally {
    await pool.end();
  }
}

createAdminUser();
