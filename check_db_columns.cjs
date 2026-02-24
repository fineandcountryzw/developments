const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'developments' 
      AND column_name IN ('is_public', 'featured_rank', 'display_rank', 'updated_at');
    `);

        console.log('Existing columns:', res.rows.map(r => r.column_name));

        // Check if migration table exists and has what columns
        const migRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '_prisma_migrations';
    `);
        console.log('Migration table columns:', migRes.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
