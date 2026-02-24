import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT COUNT(*) as orphan_count FROM "stands" WHERE development_id IS NULL OR development_id NOT IN (SELECT id FROM "developments")');
        console.log('ORPHAN_STANDS:' + JSON.stringify(res.rows));

        const res2 = await client.query('SELECT DISTINCT development_id FROM "stands"');
        console.log('DISTINCT_DEV_IDS_IN_STANDS:' + JSON.stringify(res2.rows));

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
main();
