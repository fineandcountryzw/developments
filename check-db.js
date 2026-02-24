import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDatabase() {
  try {
    // Check developments count
    const devCount = await pool.query('SELECT COUNT(*) as count FROM developments');
    console.log('✓ Developments table exists');
    console.log('  Count:', devCount.rows[0].count);

    // Check table columns
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'developments' 
      ORDER BY ordinal_position
    `);
    console.log('\n✓ Developments table columns:');
    columns.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    // Check stands table
    const standsCount = await pool.query('SELECT COUNT(*) as count FROM stands');
    console.log('\n✓ Stands table exists');
    console.log('  Count:', standsCount.rows[0].count);

    // Check users table
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('\n✓ Users table exists');
    console.log('  Count:', usersCount.rows[0].count);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
