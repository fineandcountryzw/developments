import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT d.name, d.branch, COUNT(s.id) as stand_count 
      FROM developments d 
      LEFT JOIN stands s ON d.id = s.development_id 
      GROUP BY d.name, d.branch 
      ORDER BY stand_count DESC
    `);
        console.log('STANDS_PER_DEVELOPMENT:' + JSON.stringify(res.rows));

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
main();
