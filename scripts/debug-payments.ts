
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database (standard client)...');

        // Test connection
        await prisma.$connect();
        console.log('Connected!');

        const count = await prisma.payment.count();
        console.log(`Total payments in DB: ${count}`);

        if (count > 0) {
            const firstPayment = await prisma.payment.findFirst();
            console.log('First payment:', firstPayment);
        } else {
            console.log('No payments found in the database.');
        }

    } catch (e: any) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
