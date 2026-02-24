/**
 * Migration Script: Copy ST LUCIA STAND payments from Payment table to PaymentTransaction table
 * 
 * This script finds all payments in the Payment table for stands in the ST LUCIA development
 * and creates corresponding entries in the PaymentTransaction table so they appear
 * in the Billing Module.
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

async function migrateStLuciaPayments() {
    const prisma = getPrisma();

    try {
        console.log('🔍 Finding ST LUCIA development...');

        // Find the ST LUCIA development
        const stLuciaDev = await (prisma as any).development.findFirst({
            where: {
                name: {
                    contains: 'ST LUCIA',
                    mode: 'insensitive'
                }
            }
        });

        if (!stLuciaDev) {
            console.log('❌ ST LUCIA development not found');
            return;
        }

        console.log(`✅ Found ST LUCIA development: ${stLuciaDev.id}`);

        // Find all stands in ST LUCIA
        const stands = await (prisma as any).stand.findMany({
            where: {
                developmentId: stLuciaDev.id
            },
            select: {
                id: true,
                standNumber: true
            }
        });

        console.log(`📍 Found ${stands.length} stands in ST LUCIA`);

        const standIds = stands.map((s: any) => s.id);

        // Find all payments for these stands
        const payments = await (prisma as any).payment.findMany({
            where: {
                standId: {
                    in: standIds
                }
            },
            include: {
                client: true,
                stand: {
                    include: {
                        development: true
                    }
                },
                allocations: {
                    include: {
                        installment: true
                    }
                }
            }
        });

        console.log(`💰 Found ${payments.length} payments for ST LUCIA stands`);

        if (payments.length === 0) {
            console.log('ℹ️ No payments to migrate');
            return;
        }

        // Migrate each payment to PaymentTransaction
        let migratedCount = 0;
        let skippedCount = 0;

        for (const payment of payments) {
            try {
                // Check if this payment already exists in PaymentTransaction (by reference)
                const existing = await (prisma as any).paymentTransaction.findFirst({
                    where: {
                        reference: payment.reference
                    }
                });

                if (existing) {
                    console.log(`⏭️ Skipping payment ${payment.id} - already exists as ${existing.id}`);
                    skippedCount++;
                    continue;
                }

                // Create PaymentTransaction entry
                const paymentTransaction = await (prisma as any).paymentTransaction.create({
                    data: {
                        postedAt: payment.createdAt,
                        amount: payment.amount,
                        currency: 'USD',
                        method: payment.method,
                        reference: payment.reference,
                        externalId: payment.id, // Store original payment ID
                        idempotencyKey: `migrate-${payment.id}-${Date.now()}`,
                        memo: payment.description || `Migrated from Payment table - ${payment.paymentType}`,
                        clientId: payment.clientId,
                        developmentId: payment.developmentId || stLuciaDev.id,
                        standId: payment.standId,
                        source: 'MIGRATED',
                        status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'PENDING',
                        createdAt: payment.createdAt,
                        updatedAt: new Date()
                    }
                });

                console.log(`✅ Migrated payment ${payment.id} → ${paymentTransaction.id}`);

                // Create corresponding LedgerAllocations for each PaymentAllocation
                for (const allocation of payment.allocations || []) {
                    await (prisma as any).ledgerAllocation.create({
                        data: {
                            paymentTransactionId: paymentTransaction.id,
                            invoiceId: allocation.installmentId || 'legacy-installment', // Link to installment if available
                            amount: allocation.amount,
                            createdAt: allocation.createdAt
                        }
                    });
                    console.log(`   📎 Created ledger allocation for ${allocation.id}`);
                }

                migratedCount++;
            } catch (error) {
                console.error(`❌ Failed to migrate payment ${payment.id}:`, error);
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   Total payments found: ${payments.length}`);
        console.log(`   Migrated: ${migratedCount}`);
        console.log(`   Skipped (already exist): ${skippedCount}`);
        console.log(`   Failed: ${payments.length - migratedCount - skippedCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
migrateStLuciaPayments();
