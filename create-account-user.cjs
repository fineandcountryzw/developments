require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createAccountUser() {
  const hash = bcrypt.hashSync('Account@123', 10);
  const email = 'accounts@fineandcountry.co.zw';
  const name = 'Accounts User';
  const role = 'ACCOUNT';
  const branch = 'Harare';

  try {
    // Try update first
    const updateResult = await pool.query(
      'UPDATE users SET role = $1, password = $2, is_active = true WHERE email = $3 RETURNING email, role',
      [role, hash, email]
    );

    if (updateResult.rows.length > 0) {
      console.log('✅ Account user updated:', updateResult.rows[0]);
    } else {
      // Insert new user
      const insertResult = await pool.query(
        `INSERT INTO users (id, email, name, password, role, branch, is_active, created_at, updated_at) 
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()) 
         RETURNING email, role`,
        [email, name, hash, role, branch]
      );
      console.log('✅ Account user created:', insertResult.rows[0]);
    }

    console.log('\n📋 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password: Account@123');
    console.log('   Dashboard: /dashboards/account');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createAccountUser();
