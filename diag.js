import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Developments by Branch ---');
    const developments = await prisma.$queryRawUnsafe('SELECT branch, COUNT(*) as count FROM developments GROUP BY branch');
    console.table(developments);

    console.log('\n--- Stands by Branch and Status ---');
    const stands = await prisma.$queryRawUnsafe('SELECT branch, status, COUNT(*) as count FROM stands GROUP BY branch, status ORDER BY branch, status');
    console.table(stands);

    console.log('\n--- Developments without branch field ---');
    const noBranchDevs = await prisma.development.findMany({
        where: { branch: null },
        select: { id: true, name: true }
    });
    console.table(noBranchDevs);

    console.log('\n--- User Roles and Branches ---');
    const users = await prisma.$queryRawUnsafe('SELECT email, role, branch FROM "User"'); // Changed from User to "User" for postgres case sensitivity
    console.table(users);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
