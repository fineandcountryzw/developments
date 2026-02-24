/**
 * Investigation: Find where Client Module displays payment data for Stand 34931
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

async function investigateClientData() {
    const prisma = getPrisma();

    try {
        console.log('🔍 Investigating Client Module Data for Stand 34931\n');

        const standId = 'std_mlqn2ghu5f3be1bb3145';
        const clientId = '7650de08-ca16-48ff-9ac0-aa26dc26539b';

        // 1. Check InstallmentPlan
        console.log('1️⃣ Checking InstallmentPlan table...');
        const installmentPlans = await (prisma as any).installmentPlan.findMany({
            where: {
                OR: [
                    { standId: standId },
                    { clientId: clientId }
                ]
            },
            include: {
                installments: {
                    include: {
                        allocations: true,
                        receipt: true
                    }
                },
                client: true,
                stand: {
                    include: {
                        development: true
                    }
                }
            }
        });

        console.log(`   Found ${installmentPlans.length} installment plans`);
        installmentPlans.forEach((plan: any, i: number) => {
            console.log(`   Plan ${i + 1}: ${plan.id}`);
            console.log(`      Client: ${plan.client?.name}`);
            console.log(`      Stand: ${plan.stand?.standNumber}`);
            console.log(`      Total Amount: $${plan.totalAmount}`);
            console.log(`      Total Paid: $${plan.totalPaid}`);
            console.log(`      Status: ${plan.status}`);
            console.log(`      Installments: ${plan.installments?.length || 0}`);

            if (plan.installments?.length > 0) {
                plan.installments.forEach((inst: any, j: number) => {
                    console.log(`         Installment ${j + 1}: #${inst.installmentNo}, Due: $${inst.amountDue}, Paid: $${inst.amountPaid}, Status: ${inst.status}`);
                    if (inst.allocations?.length > 0) {
                        inst.allocations.forEach((alloc: any, k: number) => {
                            console.log(`            Allocation ${k + 1}: $${alloc.amount}`);
                        });
                    }
                });
            }
        });
        console.log('');

        // 2. Check Receipts
        console.log('2️⃣ Checking Receipt table...');
        const receipts = await (prisma as any).receipt.findMany({
            where: {
                OR: [
                    { payment: { standId: standId } },
                    { installment: { plan: { standId: standId } } },
                    { clientId: clientId }
                ]
            },
            include: {
                payment: {
                    include: {
                        client: true,
                        stand: true
                    }
                },
                installment: {
                    include: {
                        plan: {
                            include: {
                                stand: true
                            }
                        }
                    }
                }
            }
        });

        console.log(`   Found ${receipts.length} receipts`);
        receipts.forEach((r: any, i: number) => {
            console.log(`   Receipt ${i + 1}: ${r.receiptNumber}`);
            console.log(`      Amount: $${r.amount}`);
            console.log(`      Client: ${r.clientName}`);
            console.log(`      Date: ${r.createdAt}`);
            console.log(`      Payment ID: ${r.paymentId}`);
            console.log(`      Stand: ${r.payment?.stand?.standNumber || r.standNumber || 'N/A'}`);
        });
        console.log('');

        // 3. Check for any table with stand_id
        console.log('3️⃣ Checking all tables that might have stand_id...');

        // Check OfflineSale
        const offlineSales = await (prisma as any).offlineSale.findMany({
            where: {
                standId: standId
            }
        });
        console.log(`   OfflineSale: ${offlineSales.length} records`);

        // Check Reservation
        const reservations = await (prisma as any).reservation.findMany({
            where: {
                standId: standId
            },
            include: {
                stand: true,
                client: true
            }
        });
        console.log(`   Reservation: ${reservations.length} records`);
        reservations.forEach((r: any, i: number) => {
            console.log(`      Reservation ${i + 1}: ${r.id}, Status: ${r.status}`);
        });

        // Check Sale
        const sales = await (prisma as any).sale.findMany({
            where: {
                standId: standId
            },
            include: {
                invoices: true
            }
        });
        console.log(`   Sale: ${sales.length} records`);
        sales.forEach((s: any, i: number) => {
            console.log(`      Sale ${i + 1}: ${s.id}, Type: ${s.saleType}, Status: ${s.status}`);
            console.log(`      Invoices: ${s.invoices?.length || 0}`);
        });

        // Check Invoice
        const invoices = await (prisma as any).invoice.findMany({
            where: {
                standId: standId
            }
        });
        console.log(`   Invoice: ${invoices.length} records`);

        console.log('');

        // 4. Check ActivityLog for stand-related entries
        console.log('4️⃣ Checking ActivityLog for payment-related entries...');
        const activities = await (prisma as any).activityLog.findMany({
            where: {
                OR: [
                    { recordId: standId },
                    { recordId: clientId },
                    { description: { contains: '34931', mode: 'insensitive' } },
                    { description: { contains: 'payment', mode: 'insensitive' } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        console.log(`   Found ${activities.length} activity log entries`);
        activities.forEach((a: any, i: number) => {
            console.log(`   ${i + 1}. [${a.createdAt}] ${a.action} - ${a.description}`);
        });
        console.log('');

        // 5. Summary of where data might be
        console.log('📊 Summary of Data Locations:\n');

        const hasInstallmentData = installmentPlans.some((p: any) =>
            p.installments?.some((i: any) => i.amountPaid > 0)
        );

        const hasReceiptData = receipts.length > 0;
        const hasReservationPayments = reservations.length > 0;

        console.log('   InstallmentPlan with payments:', hasInstallmentData ? 'YES ✅' : 'NO ❌');
        console.log('   Receipts found:', hasReceiptData ? 'YES ✅' : 'NO ❌');
        console.log('   Reservation payments:', hasReservationPayments ? 'YES ✅' : 'NO ❌');
        console.log('');

        if (hasInstallmentData) {
            console.log('💡 The Client Module likely displays data from InstallmentPlan → Installments');
            console.log('   The payments are stored as Installment.allocations');
        }

        if (hasReceiptData) {
            console.log('💡 The Client Module may also display data from Receipts table');
        }

        if (!hasInstallmentData && !hasReceiptData && !hasReservationPayments) {
            console.log('⚠️  NO PAYMENT DATA FOUND ANYWHERE for this stand/client');
            console.log('   The Client Module may be showing cached/mock data');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateClientData();
