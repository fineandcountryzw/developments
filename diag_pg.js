import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- Developments by Branch ---');
        const resDevs = await client.query('SELECT branch, COUNT(*) as count FROM developments GROUP BY branch');
        console.table(resDevs.rows);

        console.log('\n--- Stands by Branch and Status ---');
        const resStands = await client.query('SELECT branch, status, COUNT(*) as count FROM stands GROUP BY branch, status ORDER BY branch, status');
        console.table(resStands.rows);

        console.log('\n--- Developments without branch field ---');
        const resNoBranch = await client.query('SELECT id, name FROM developments WHERE branch IS NULL');
        console.table(resNoBranch.rows);

        console.log('\n--- User Roles and Branches ---');
        const resUsers = await client.query('SELECT email, role, branch FROM "User"'); // "User" table usually created by NextAuth/Prisma
        console.table(resUsers.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
