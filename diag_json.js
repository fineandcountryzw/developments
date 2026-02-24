import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT status, COUNT(*) as count FROM "stands" GROUP BY status');
        console.log('STANDS_SUMMARY:' + JSON.stringify(res.rows));

        const res2 = await client.query('SELECT branch, status, COUNT(*) as count FROM "stands" GROUP BY branch, status');
        console.log('STANDS_BY_BRANCH:' + JSON.stringify(res2.rows));

        const res3 = await client.query('SELECT branch, COUNT(*) as count FROM "developments" GROUP BY branch');
        console.log('DEVS_BY_BRANCH:' + JSON.stringify(res3.rows));

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
main();
