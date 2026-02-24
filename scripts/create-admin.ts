import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function createAdminUser() {
  try {
    console.log('Creating admin user...\n');
    
    const result = await sql`
      INSERT INTO users (
        id, email, name, role, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'admin@fineandcountry.co.zw',
        'System Administrator',
        'ADMIN',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING email, role, is_active
    `;
    
    if (result.length > 0) {
      console.log('✅ Admin user created successfully!');
      console.log('Email:', result[0].email);
      console.log('Role:', result[0].role);
      console.log('\n🔐 Login credentials:');
      console.log('Email: admin@fineandcountry.co.zw');
      console.log('Password: admin123 (or demo123, password123)');
    } else {
      console.log('ℹ️  Admin user already exists');
      
      // Verify it exists
      const existing = await sql`
        SELECT email, role, is_active
        FROM users
        WHERE email = 'admin@fineandcountry.co.zw'
      `;
      
      if (existing.length > 0) {
        console.log('Found:', existing[0]);
        console.log('\n🔐 Login credentials:');
        console.log('Email: admin@fineandcountry.co.zw');
        console.log('Password: admin123 (or demo123, password123)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAdminUser();
