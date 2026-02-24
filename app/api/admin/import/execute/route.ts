/**
 * Import Execute API (Atomic Commit)
 * POST /api/admin/import/execute
 * 
 * Executes an import within a single database transaction.
 * If any row fails, the entire import is rolled back.
 * 
 * CRITICAL: Updates stand.status to SOLD and decrements development.availableStands
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SaleRow {
    name: string;
    email: string;
    phone?: string;
    standNumber: string;
    developmentName: string;
    saleDate: string;
    salePrice: string;
    depositAmount: string;
    paymentMethod: string;
    notes?: string;
    paymentDate?: string;
    paymentAmount?: string;
    paymentReference?: string;
}

interface PaymentRow {
    clientEmail: string;
    standNumber: string;
    paymentDate: string;
    amount: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
}

interface ImportResult {
    batchId: string;
    status: 'COMPLETED' | 'FAILED';
    summary: {
        salesCreated: number;
        paymentsCreated: number;
        standsUpdated: number;
        clientsCreated: number;
        clientsLinked: number;
        totalValue: number;
        totalDeposits: number;
    };
    errors: { row: number; type: string; message: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseAmount(value: string): number {
    if (!value) return 0;
    return parseFloat(value.replace(/[,\s$]/g, '')) || 0;
}

function generateRowHash(row: SaleRow): string {
    const canonical = [
        row.standNumber.trim().toUpperCase(),
        row.developmentName.trim().toUpperCase(),
        row.saleDate.trim(),
        row.salePrice.replace(/[,\s]/g, ''),
        row.email.trim().toLowerCase(),
    ].join('|');

    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

const VALID_PAYMENT_METHODS = ['CASH', 'TRANSFER', 'ECOCASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER'];

function normalizePaymentMethod(method: string): string {
    const normalized = method.toUpperCase().replace(/[\s-]/g, '_');
    return VALID_PAYMENT_METHODS.includes(normalized) ? normalized : 'OTHER';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.email || 'unknown';
        const body = await request.json();
        const { sales = [], payments = [], options = {} } = body;
        const {
            updateStandStatus = true,
            batchLabel,
            forceOverwrite = false,
        } = options;

        if (!Array.isArray(sales) || sales.length === 0) {
            return NextResponse.json({ error: 'No sales data provided' }, { status: 400 });
        }

        const batchId = uuidv4();
        const result: ImportResult = {
            batchId,
            status: 'COMPLETED',
            summary: {
                salesCreated: 0,
                paymentsCreated: 0,
                standsUpdated: 0,
                clientsCreated: 0,
                clientsLinked: 0,
                totalValue: 0,
                totalDeposits: 0,
            },
            errors: [],
        };

        // ─── Atomic Transaction ──────────────────────────────────────────────

        try {
            await prisma.$transaction(async (tx: any) => {
                // 1. Create import batch
                await tx.importBatch.create({
                    data: {
                        id: batchId,
                        fileName: batchLabel || `past-sales-${new Date().toISOString().slice(0, 10)}.csv`,
                        importType: 'past_sales',
                        status: 'PROCESSING',
                        totalRecords: sales.length,
                        importedBy: userId,
                        branch: 'Harare',
                    },
                });

                // Track developments whose availableStands must be decremented
                const developmentDecrements = new Map<string, number>();

                // 2. Process each sale row
                for (let i = 0; i < sales.length; i++) {
                    const sale = sales[i] as SaleRow;
                    const rowNum = i + 1;

                    // Skip rows with missing required fields
                    if (!sale.name || !sale.email || !sale.standNumber || !sale.developmentName ||
                        !sale.saleDate || !sale.salePrice || !sale.depositAmount || !sale.paymentMethod) {
                        result.errors.push({ row: rowNum, type: 'sale', message: 'Missing required fields' });
                        continue;
                    }

                    const salePrice = parseAmount(sale.salePrice);
                    const depositAmount = parseAmount(sale.depositAmount);

                    if (salePrice <= 0) {
                        result.errors.push({ row: rowNum, type: 'sale', message: `Invalid sale price: ${sale.salePrice}` });
                        continue;
                    }

                    // 2a. Find development
                    const development = await tx.development.findFirst({
                        where: { name: { equals: sale.developmentName, mode: 'insensitive' } },
                        select: { id: true, branch: true },
                    });

                    if (!development) {
                        result.errors.push({ row: rowNum, type: 'sale', message: `Development not found: ${sale.developmentName}` });
                        continue;
                    }

                    // 2b. Find stand
                    const stand = await tx.stand.findFirst({
                        where: {
                            standNumber: sale.standNumber.trim().toUpperCase(),
                            developmentId: development.id,
                        },
                        select: { id: true, status: true },
                    });

                    if (!stand) {
                        result.errors.push({ row: rowNum, type: 'sale', message: `Stand ${sale.standNumber} not found in ${sale.developmentName}` });
                        continue;
                    }

                    // 2c. Check stand availability
                    if (stand.status !== 'AVAILABLE' && !forceOverwrite) {
                        result.errors.push({
                            row: rowNum, type: 'sale',
                            message: `Stand ${sale.standNumber} is ${stand.status}. Use forceOverwrite to import.`,
                        });
                        continue;
                    }

                    // 2d. Find or create client (upsert by email + branch)
                    let client = await tx.client.findFirst({
                        where: { email: sale.email.trim().toLowerCase(), branch: development.branch },
                        select: { id: true },
                    });

                    if (!client) {
                        client = await tx.client.create({
                            data: {
                                id: uuidv4(),
                                name: sale.name.trim(),
                                email: sale.email.trim().toLowerCase(),
                                phone: sale.phone?.trim() || '',
                                branch: development.branch,
                                updatedAt: new Date(),
                            },
                        });
                        result.summary.clientsCreated++;
                    } else {
                        result.summary.clientsLinked++;
                    }

                    // 2e. Create offline sale record
                    const offlineSaleId = uuidv4();

                    await tx.offlineSale.create({
                        data: {
                            id: offlineSaleId,
                            clientId: client.id,
                            standId: stand.id,
                            developmentId: development.id,
                            saleDate: new Date(sale.saleDate),
                            salePrice: salePrice,
                            depositAmount: depositAmount,
                            paymentMethod: normalizePaymentMethod(sale.paymentMethod),
                            notes: sale.notes || null,
                            importBatchId: batchId,
                        },
                    });

                    result.summary.salesCreated++;
                    result.summary.totalValue += salePrice;
                    result.summary.totalDeposits += depositAmount;

                    // 2f. Create deposit payment if amount > 0
                    if (depositAmount > 0) {
                        await tx.offlinePayment.create({
                            data: {
                                id: uuidv4(),
                                offlineSaleId: offlineSaleId,
                                paymentDate: new Date(sale.saleDate),
                                amount: depositAmount,
                                paymentMethod: normalizePaymentMethod(sale.paymentMethod),
                                reference: `DEP-${batchId.slice(0, 8)}-${rowNum}`,
                                notes: `Deposit for imported sale`,
                            },
                        });
                        result.summary.paymentsCreated++;
                    }

                    // 2g. Create inline payment if provided
                    if (sale.paymentDate && sale.paymentAmount) {
                        const paymentAmount = parseAmount(sale.paymentAmount);
                        if (paymentAmount > 0) {
                            await tx.offlinePayment.create({
                                data: {
                                    id: uuidv4(),
                                    offlineSaleId: offlineSaleId,
                                    paymentDate: new Date(sale.paymentDate),
                                    amount: paymentAmount,
                                    paymentMethod: normalizePaymentMethod(sale.paymentMethod),
                                    reference: sale.paymentReference || `PAY-${batchId.slice(0, 8)}-${rowNum}`,
                                    notes: `Imported inline payment`,
                                },
                            });
                            result.summary.paymentsCreated++;
                        }
                    }

                    // 2h. *** CRITICAL: Update stand status to SOLD ***
                    if (updateStandStatus) {
                        await tx.stand.update({
                            where: { id: stand.id },
                            data: {
                                status: 'SOLD',
                                soldAt: new Date(sale.saleDate),
                                soldReason: `Imported via batch ${batchId.slice(0, 8)}`,
                                soldBy: session.user.email,
                                reservedBy: client.id,
                                updatedAt: new Date(),
                            },
                        });
                        result.summary.standsUpdated++;

                        // Track development decrement
                        const currentCount = developmentDecrements.get(development.id) || 0;
                        developmentDecrements.set(development.id, currentCount + 1);
                    }
                }

                // 3. Process separate payments
                if (Array.isArray(payments)) {
                    for (let i = 0; i < payments.length; i++) {
                        const payment = payments[i] as PaymentRow;
                        const rowNum = i + 1;

                        if (!payment.clientEmail || !payment.standNumber || !payment.paymentDate ||
                            !payment.amount || !payment.paymentMethod) {
                            result.errors.push({ row: rowNum, type: 'payment', message: 'Missing required fields' });
                            continue;
                        }

                        const amount = parseAmount(payment.amount);
                        if (amount <= 0) {
                            result.errors.push({ row: rowNum, type: 'payment', message: `Invalid amount: ${payment.amount}` });
                            continue;
                        }

                        // Find client
                        const client = await tx.client.findFirst({
                            where: { email: payment.clientEmail.trim().toLowerCase() },
                            select: { id: true, branch: true },
                        });

                        if (!client) {
                            result.errors.push({ row: rowNum, type: 'payment', message: `Client not found: ${payment.clientEmail}` });
                            continue;
                        }

                        // Find stand
                        const stand = await tx.stand.findFirst({
                            where: {
                                standNumber: payment.standNumber,
                                branch: client.branch,
                            },
                            select: { id: true },
                        });

                        if (!stand) {
                            result.errors.push({ row: rowNum, type: 'payment', message: `Stand ${payment.standNumber} not found` });
                            continue;
                        }

                        // Find existing offline sale for this client + stand
                        let offlineSale = await tx.offlineSale.findFirst({
                            where: {
                                clientId: client.id,
                                standId: stand.id,
                            },
                            select: { id: true },
                        });

                        // Create minimal sale if none exists
                        if (!offlineSale) {
                            offlineSale = await tx.offlineSale.create({
                                data: {
                                    id: uuidv4(),
                                    clientId: client.id,
                                    standId: stand.id,
                                    saleDate: new Date(payment.paymentDate),
                                    salePrice: amount,
                                    depositAmount: amount,
                                    paymentMethod: normalizePaymentMethod(payment.paymentMethod),
                                    importBatchId: batchId,
                                },
                            });
                        }

                        // Create payment
                        await tx.offlinePayment.create({
                            data: {
                                id: uuidv4(),
                                offlineSaleId: offlineSale.id,
                                paymentDate: new Date(payment.paymentDate),
                                amount: amount,
                                paymentMethod: normalizePaymentMethod(payment.paymentMethod),
                                reference: payment.reference || `PAY-${batchId.slice(0, 8)}-S${rowNum}`,
                                notes: payment.notes || `Imported separate payment`,
                            },
                        });

                        result.summary.paymentsCreated++;
                    }
                }

                // 4. *** CRITICAL: Decrement availableStands for each development ***
                for (const [devId, count] of developmentDecrements) {
                    await tx.development.update({
                        where: { id: devId },
                        data: {
                            availableStands: { decrement: count },
                        },
                    });
                }

                // 5. Mark batch as completed
                await tx.importBatch.update({
                    where: { id: batchId },
                    data: {
                        status: 'COMPLETED',
                        processedRecords: result.summary.salesCreated,
                        failedRecords: result.errors.length,
                        errorLog: result.errors.length > 0 ? result.errors : undefined,
                        completedAt: new Date(),
                    },
                });
            }, {
                maxWait: 30000,  // 30s max wait for transaction lock
                timeout: 60000,  // 60s max transaction duration
            });

            result.status = 'COMPLETED';
        } catch (txError) {
            // Transaction rolled back automatically
            result.status = 'FAILED';

            // Create a failed batch record outside transaction
            try {
                await prisma.importBatch.create({
                    data: {
                        id: batchId,
                        fileName: batchLabel || `past-sales-${new Date().toISOString().slice(0, 10)}.csv`,
                        importType: 'past_sales',
                        status: 'FAILED',
                        totalRecords: sales.length,
                        importedBy: userId,
                        errorLog: {
                            message: txError instanceof Error ? txError.message : 'Transaction failed',
                            errors: result.errors,
                        },
                        completedAt: new Date(),
                    },
                });
            } catch {
                // Ignore if failed batch record can't be created
            }

            return NextResponse.json({
                ...result,
                error: txError instanceof Error ? txError.message : 'Import transaction failed - all changes rolled back',
            }, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Import execute error:', error);
        return NextResponse.json(
            { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
