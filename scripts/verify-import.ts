/**
 * Import Verification Script
 * 
 * Run: npx ts-node scripts/verify-import.ts
 * 
 * Verifies the import infrastructure is working correctly by:
 * 1. Checking schema tables exist
 * 2. Verifying import batches are stored
 * 3. Checking stand status consistency
 * 4. Validating available_stands counts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
}

async function verify(): Promise<void> {
    const results: VerificationResult[] = [];

    console.log('\n🔍 Import Infrastructure Verification\n');
    console.log('━'.repeat(60));

    // ─── 1. Schema Tables Exist ────────────────────────────────────────
    try {
        const batchCount = await prisma.import_batches.count();
        results.push({
            check: 'import_batches table exists',
            status: 'PASS',
            details: `${batchCount} batch records found`,
        });
    } catch {
        results.push({
            check: 'import_batches table exists',
            status: 'FAIL',
            details: 'Table does not exist - run migration',
        });
    }

    try {
        const saleCount = await prisma.offline_sales.count();
        results.push({
            check: 'offline_sales table exists',
            status: 'PASS',
            details: `${saleCount} sale records found`,
        });
    } catch {
        results.push({
            check: 'offline_sales table exists',
            status: 'FAIL',
            details: 'Table does not exist - run migration',
        });
    }

    try {
        const paymentCount = await prisma.offline_payments.count();
        results.push({
            check: 'offline_payments table exists',
            status: 'PASS',
            details: `${paymentCount} payment records found`,
        });
    } catch {
        results.push({
            check: 'offline_payments table exists',
            status: 'FAIL',
            details: 'Table does not exist - run migration',
        });
    }

    // ─── 2. Stand Status Consistency ───────────────────────────────────
    try {
        // Check for stands that have offline sales but are still AVAILABLE
        const inconsistentStands = await prisma.$queryRaw<Array<{
            stand_number: string;
            development_name: string;
            stand_status: string;
            sale_count: bigint;
        }>>`
      SELECT s.stand_number, d.name as development_name, s.status as stand_status, 
             COUNT(os.id)::bigint as sale_count
      FROM stands s
      JOIN developments d ON s.development_id = d.id
      JOIN offline_sales os ON os.stand_id = s.id
      WHERE s.status = 'AVAILABLE'
      GROUP BY s.id, s.stand_number, d.name, s.status
    `;

        if (inconsistentStands.length > 0) {
            results.push({
                check: 'Stand status consistency',
                status: 'WARN',
                details: `${inconsistentStands.length} stands have offline sales but are still AVAILABLE: ${inconsistentStands.map(s => `${s.stand_number} (${s.development_name})`).join(', ')
                    }`,
            });
        } else {
            results.push({
                check: 'Stand status consistency',
                status: 'PASS',
                details: 'All stands with offline sales are marked as SOLD',
            });
        }
    } catch (error) {
        results.push({
            check: 'Stand status consistency',
            status: 'FAIL',
            details: `Query failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        });
    }

    // ─── 3. Available Stands Count Accuracy ────────────────────────────
    try {
        const developments = await prisma.developments.findMany({
            select: {
                id: true,
                name: true,
                total_stands: true,
                available_stands: true,
                stands: {
                    select: { status: true },
                },
            },
        });

        for (const dev of developments) {
            const actualAvailable = dev.stands.filter(s => s.status === 'AVAILABLE').length;
            const recordedAvailable = dev.available_stands || 0;

            if (actualAvailable !== recordedAvailable) {
                results.push({
                    check: `Available stands count: ${dev.name}`,
                    status: 'WARN',
                    details: `Recorded: ${recordedAvailable}, Actual: ${actualAvailable} (diff: ${recordedAvailable - actualAvailable})`,
                });
            } else {
                results.push({
                    check: `Available stands count: ${dev.name}`,
                    status: 'PASS',
                    details: `${actualAvailable} available (matches recorded)`,
                });
            }
        }
    } catch (error) {
        results.push({
            check: 'Available stands count accuracy',
            status: 'FAIL',
            details: `Query failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        });
    }

    // ─── 4. Import Batch Summary ───────────────────────────────────────
    try {
        const batches = await prisma.import_batches.findMany({
            include: {
                _count: { select: { offline_sales: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 10,
        });

        if (batches.length > 0) {
            console.log('\n📦 Recent Import Batches:');
            console.log('─'.repeat(60));
            for (const batch of batches) {
                console.log(`  ${batch.status === 'COMPLETED' ? '✅' : '❌'} ${batch.file_name}`);
                console.log(`     Type: ${batch.import_type} | Status: ${batch.status}`);
                console.log(`     Records: ${batch.total_records} | Sales: ${batch._count.offline_sales}`);
                console.log(`     Date: ${batch.created_at.toISOString()}`);
                console.log('');
            }
        }
    } catch {
        // Skip batch summary if table doesn't exist
    }

    // ─── Print Results ─────────────────────────────────────────────────
    console.log('\n📋 Verification Results:');
    console.log('━'.repeat(60));

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} ${r.check}`);
        console.log(`   ${r.details}`);

        if (r.status === 'PASS') passCount++;
        else if (r.status === 'FAIL') failCount++;
        else warnCount++;
    }

    console.log('\n━'.repeat(60));
    console.log(`Total: ${results.length} checks | ✅ ${passCount} passed | ⚠️ ${warnCount} warnings | ❌ ${failCount} failed`);

    if (failCount > 0) {
        console.log('\n🔴 Some checks FAILED. Run migration and fix issues before importing data.');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('\n🟡 Some checks have WARNINGS. Review before proceeding.');
    } else {
        console.log('\n🟢 All checks PASSED. Import infrastructure is ready.');
    }

    await prisma.$disconnect();
}

verify().catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
});
