import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- Columns in stands table ---');
        const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stands'
    `);
        console.table(cols.rows);

        console.log('\n--- Stands Summary (Global) ---');
        const res = await client.query('SELECT status, COUNT(*) as count FROM "stands" GROUP BY status');
        console.table(res.rows);

        console.log('\n--- Stands by Branch ---');
        // Check if 'branch' column exists first
        const hasBranch = cols.rows.some(c => c.column_name === 'branch');
        if (hasBranch) {
            const res2 = await client.query('SELECT branch, status, COUNT(*) as count FROM "stands" GROUP BY branch, status');
            console.table(res2.rows);
        } else {
            console.log('Column "branch" NOT found in stands table.');
        }

        console.log('\n--- Sample Stands ---');
        const res3 = await client.query('SELECT id, stand_number, development_id, status FROM "stands" LIMIT 5');
        console.table(res3.rows);

    } catch (err) {
        console.error('ERROR during diagnostic:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
main();
