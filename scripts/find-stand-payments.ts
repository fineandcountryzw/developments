/**
 * Deep Scan: Find payments for Stand 34931 (St Lucia - Sylvaine vongai Tendere)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { config } from 'dotenv';

// Load environment variables
config();

// Create Prisma client
function getPrisma() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter });
}

async function findStandPayments() {
    const prisma = getPrisma();

    try {
        console.log('🔍 Deep Scan: Stand 34931 (St Lucia - Sylvaine vongai Tendere)\n');

        // 1. Find the stand
        console.log('1️⃣ Looking for Stand 34931...');
        const stand = await (prisma as any).stand.findFirst({
            where: {
                standNumber: '34931'
            },
            include: {
                development: true
            }
        });

        if (!stand) {
            console.log('❌ Stand 34931 not found');
            return;
        }

        console.log(`✅ Found Stand: ${stand.id}`);
        console.log(`   Stand Number: ${stand.standNumber}`);
        console.log(`   Development: ${stand.development?.name} (${stand.developmentId})`);
        console.log(`   Status: ${stand.status}\n`);

        // 2. Find client "Sylvaine vongai Tendere"
        console.log('2️⃣ Looking for client "Sylvaine vongai Tendere"...');
        const client = await (prisma as any).client.findFirst({
            where: {
                name: {
                    contains: 'Tendere',
                    mode: 'insensitive'
                }
            }
        });

        if (client) {
            console.log(`✅ Found Client: ${client.id}`);
            console.log(`   Name: ${client.name}`);
            console.log(`   Email: ${client.email}\n`);
        } else {
            console.log('⚠️ Client not found with name containing "Tendere"\n');
        }

        // 3. Search Payment table by standId
        console.log('3️⃣ Searching Payment table by standId...');
        const paymentsByStand = await (prisma as any).payment.findMany({
            where: {
                standId: stand.id
            },
            include: {
                client: true,
                stand: {
                    include: {
                        development: true
                    }
                },
                allocations: true,
                receipt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`   Found ${paymentsByStand.length} payments in Payment table by standId`);
        paymentsByStand.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ID: ${p.id}, Amount: $${p.amount}, Status: ${p.status}, Client: ${p.clientName}`);
            console.log(`      Date: ${p.createdAt}, Ref: ${p.reference}`);
        });
        console.log('');

        // 4. Search Payment table by client name
        if (client) {
            console.log('4️⃣ Searching Payment table by clientId...');
            const paymentsByClient = await (prisma as any).payment.findMany({
                where: {
                    clientId: client.id
                },
                include: {
                    stand: {
                        include: {
                            development: true
                        }
                    },
                    allocations: true
                },
                orderBy: { createdAt: 'desc' }
            });

            console.log(`   Found ${paymentsByClient.length} payments in Payment table by clientId`);
            paymentsByClient.forEach((p: any, i: number) => {
                console.log(`   ${i + 1}. ID: ${p.id}, Amount: $${p.amount}, Stand: ${p.stand?.standNumber || 'N/A'}`);
            });
            console.log('');
        }

        // 5. Search PaymentTransaction table by standId
        console.log('5️⃣ Searching PaymentTransaction table by standId...');
        const ptByStand = await (prisma as any).paymentTransaction.findMany({
            where: {
                standId: stand.id
            },
            include: {
                client: true,
                stand: {
                    include: {
                        development: true
                    }
                },
                allocations: true
            },
            orderBy: { postedAt: 'desc' }
        });

        console.log(`   Found ${ptByStand.length} payments in PaymentTransaction table by standId`);
        ptByStand.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ID: ${p.id}, Amount: $${p.amount}, Status: ${p.status}, Client: ${p.client?.name}`);
            console.log(`      Date: ${p.postedAt}, Ref: ${p.reference}`);
        });
        console.log('');

        // 6. Search PaymentTransaction table by client
        if (client) {
            console.log('6️⃣ Searching PaymentTransaction table by clientId...');
            const ptByClient = await (prisma as any).paymentTransaction.findMany({
                where: {
                    clientId: client.id
                },
                include: {
                    stand: {
                        include: {
                            development: true
                        }
                    },
                    allocations: true
                },
                orderBy: { postedAt: 'desc' }
            });

            console.log(`   Found ${ptByClient.length} payments in PaymentTransaction table by clientId`);
            ptByClient.forEach((p: any, i: number) => {
                console.log(`   ${i + 1}. ID: ${p.id}, Amount: $${p.amount}, Stand: ${p.stand?.standNumber || 'N/A'}`);
            });
            console.log('');
        }

        // 7. Search all payments with reference containing "34931"
        console.log('7️⃣ Searching all payments with reference containing "34931"...');
        const paymentsByRef = await (prisma as any).payment.findMany({
            where: {
                reference: {
                    contains: '34931',
                    mode: 'insensitive'
                }
            },
            include: {
                client: true,
                stand: true
            }
        });

        console.log(`   Found ${paymentsByRef.length} payments with reference containing "34931"`);
        paymentsByRef.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ID: ${p.id}, Ref: ${p.reference}, Amount: $${p.amount}`);
        });
        console.log('');

        // 8. Check for any stand with similar number
        console.log('8️⃣ Searching for stands with similar numbers...');
        const similarStands = await (prisma as any).stand.findMany({
            where: {
                OR: [
                    { standNumber: { contains: '34931' } },
                    { standNumber: { contains: '3493' } }
                ]
            },
            include: {
                development: true
            }
        });

        console.log(`   Found ${similarStands.length} stands with similar numbers`);
        similarStands.forEach((s: any) => {
            console.log(`   - Stand ${s.standNumber} (${s.development?.name})`);
        });

        console.log('\n📊 Summary:');
        console.log(`   Payment table (by stand): ${paymentsByStand.length}`);
        console.log(`   PaymentTransaction table (by stand): ${ptByStand.length}`);
        console.log(`   Total payments found: ${paymentsByStand.length + ptByStand.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findStandPayments();
