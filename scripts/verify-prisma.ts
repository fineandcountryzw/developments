
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Checking PaymentTransaction model...');
        if ((prisma as any).paymentTransaction) {
            console.log('SUCCESS: prisma.paymentTransaction exists.');
        } else {
            console.error('FAILURE: prisma.paymentTransaction is missing.');
            const keys = Object.keys(prisma);
            console.log('Available keys on prisma instance:', keys.filter(k => !k.startsWith('_')));
        }
    } catch (err) {
        console.error('Error during check:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
