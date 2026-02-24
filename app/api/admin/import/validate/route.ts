/**
 * Import Validation API (Dry Run)
 * POST /api/admin/import/validate
 * 
 * Validates CSV data without writing to the database.
 * Returns a validation report with errors, warnings, and summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

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

interface ValidationError {
    row: number;
    type: 'sale' | 'payment';
    field?: string;
    message: string;
    severity: 'error' | 'warning';
}

interface ValidatedSale {
    rowIndex: number;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    standNumber: string;
    developmentName: string;
    developmentId: string;
    standId: string;
    saleDate: Date;
    salePrice: number;
    depositAmount: number;
    paymentMethod: string;
    notes?: string;
    sourceRowHash: string;
    inlinePayment?: {
        paymentDate: Date;
        amount: number;
        reference?: string;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function parseAmount(value: string): number {
    if (!value) return 0;
    return parseFloat(value.replace(/[,\s$]/g, '')) || 0;
}

function isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const VALID_PAYMENT_METHODS = ['CASH', 'TRANSFER', 'ECOCASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER'];

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { sales = [], payments = [], options = {} } = body;
        const { allowDuplicates = false, forceOverwrite = false } = options;

        if (!Array.isArray(sales) || sales.length === 0) {
            return NextResponse.json({ error: 'No sales data provided' }, { status: 400 });
        }

        const errors: ValidationError[] = [];
        const validatedSales: ValidatedSale[] = [];
        const seenStands = new Set<string>();
        const seenHashes = new Set<string>();
        let newClients = 0;
        let existingClients = 0;
        let totalValue = 0;
        let totalDeposits = 0;

        // ─── Validate each sale row ──────────────────────────────────────────

        for (let i = 0; i < sales.length; i++) {
            const sale = sales[i] as SaleRow;
            const rowNum = i + 1;

            // Required fields check
            const requiredFields = ['name', 'email', 'standNumber', 'developmentName', 'saleDate', 'salePrice', 'depositAmount', 'paymentMethod'];
            const missingFields = requiredFields.filter(f => !sale[f as keyof SaleRow]);
            if (missingFields.length > 0) {
                errors.push({
                    row: rowNum, type: 'sale', severity: 'error',
                    field: missingFields[0],
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                });
                continue;
            }

            // Email validation
            if (!isValidEmail(sale.email)) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'email', message: `Invalid email: ${sale.email}` });
                continue;
            }

            // Date validation
            if (!isValidDate(sale.saleDate)) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'saleDate', message: `Invalid date: ${sale.saleDate}` });
                continue;
            }

            // Amount validation
            const salePrice = parseAmount(sale.salePrice);
            const depositAmount = parseAmount(sale.depositAmount);
            if (salePrice <= 0) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'salePrice', message: `Invalid sale price: ${sale.salePrice}` });
                continue;
            }
            if (depositAmount < 0) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'depositAmount', message: `Invalid deposit: ${sale.depositAmount}` });
                continue;
            }
            if (depositAmount > salePrice) {
                errors.push({ row: rowNum, type: 'sale', severity: 'warning', field: 'depositAmount', message: `Deposit ($${depositAmount}) exceeds sale price ($${salePrice})` });
            }

            // Payment method validation
            const normalizedMethod = sale.paymentMethod.toUpperCase().replace(/[\s-]/g, '_');
            if (!VALID_PAYMENT_METHODS.includes(normalizedMethod)) {
                errors.push({ row: rowNum, type: 'sale', severity: 'warning', field: 'paymentMethod', message: `Unrecognized payment method: ${sale.paymentMethod}. Will default to OTHER.` });
            }

            // Development lookup
            const development = await prisma.development.findFirst({
                where: { name: { equals: sale.developmentName, mode: 'insensitive' } },
                select: { id: true, name: true, branch: true, availableStands: true },
            });

            if (!development) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'developmentName', message: `Development not found: ${sale.developmentName}` });
                continue;
            }

            // Stand lookup
            const stand = await prisma.stand.findFirst({
                where: {
                    standNumber: sale.standNumber,
                    developmentId: development.id,
                },
                select: { id: true, standNumber: true, status: true },
            });

            if (!stand) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'standNumber', message: `Stand ${sale.standNumber} not found in ${development.name}` });
                continue;
            }

            // Stand status check
            if (stand.status !== 'AVAILABLE' && !forceOverwrite) {
                errors.push({
                    row: rowNum, type: 'sale', severity: 'warning', field: 'standNumber',
                    message: `Stand ${sale.standNumber} is currently ${stand.status}. Use forceOverwrite to import anyway.`,
                });
            }

            // Duplicate stand check within CSV
            const standKey = `${development.id}:${stand.id}`;
            if (seenStands.has(standKey)) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', field: 'standNumber', message: `Duplicate stand ${sale.standNumber} in same CSV` });
                continue;
            }
            seenStands.add(standKey);

            // Source row hash for idempotency
            const hash = generateRowHash(sale);
            if (seenHashes.has(hash) && !allowDuplicates) {
                errors.push({ row: rowNum, type: 'sale', severity: 'error', message: `Duplicate row detected (hash: ${hash})` });
                continue;
            }
            seenHashes.add(hash);

            // Client lookup
            const existingClient = await prisma.client.findFirst({
                where: { email: sale.email, branch: development.branch },
                select: { id: true },
            });

            if (existingClient) {
                existingClients++;
            } else {
                newClients++;
            }

            // Inline payment validation
            let inlinePayment: ValidatedSale['inlinePayment'];
            if (sale.paymentDate && sale.paymentAmount) {
                const paymentAmount = parseAmount(sale.paymentAmount);
                if (!isValidDate(sale.paymentDate)) {
                    errors.push({ row: rowNum, type: 'sale', severity: 'warning', field: 'paymentDate', message: `Invalid inline payment date: ${sale.paymentDate}` });
                } else if (paymentAmount <= 0) {
                    errors.push({ row: rowNum, type: 'sale', severity: 'warning', field: 'paymentAmount', message: `Invalid inline payment amount: ${sale.paymentAmount}` });
                } else {
                    inlinePayment = {
                        paymentDate: new Date(sale.paymentDate),
                        amount: paymentAmount,
                        reference: sale.paymentReference,
                    };
                }
            }

            totalValue += salePrice;
            totalDeposits += depositAmount;

            validatedSales.push({
                rowIndex: rowNum,
                clientName: sale.name.trim(),
                clientEmail: sale.email.trim().toLowerCase(),
                clientPhone: sale.phone?.trim(),
                standNumber: sale.standNumber.trim(),
                developmentName: development.name,
                developmentId: development.id,
                standId: stand.id,
                saleDate: new Date(sale.saleDate),
                salePrice,
                depositAmount,
                paymentMethod: normalizedMethod,
                notes: sale.notes,
                sourceRowHash: hash,
                inlinePayment,
            });
        }

        // ─── Validate separate payments ──────────────────────────────────────

        let validPaymentsCount = 0;
        if (Array.isArray(payments)) {
            for (let i = 0; i < payments.length; i++) {
                const payment = payments[i] as PaymentRow;
                const rowNum = i + 1;

                if (!payment.clientEmail || !payment.standNumber || !payment.paymentDate || !payment.amount || !payment.paymentMethod) {
                    errors.push({ row: rowNum, type: 'payment', severity: 'error', message: 'Missing required payment fields' });
                    continue;
                }

                if (!isValidEmail(payment.clientEmail)) {
                    errors.push({ row: rowNum, type: 'payment', severity: 'error', field: 'clientEmail', message: `Invalid email: ${payment.clientEmail}` });
                    continue;
                }

                if (!isValidDate(payment.paymentDate)) {
                    errors.push({ row: rowNum, type: 'payment', severity: 'error', field: 'paymentDate', message: `Invalid date: ${payment.paymentDate}` });
                    continue;
                }

                const amount = parseAmount(payment.amount);
                if (amount <= 0) {
                    errors.push({ row: rowNum, type: 'payment', severity: 'error', field: 'amount', message: `Invalid amount: ${payment.amount}` });
                    continue;
                }

                validPaymentsCount++;
            }
        }

        // ─── Build validation report ─────────────────────────────────────────

        const criticalErrors = errors.filter(e => e.severity === 'error');
        const warnings = errors.filter(e => e.severity === 'warning');

        // Generate validation token (hash of validated data for execute step)
        const validationToken = crypto.createHash('sha256')
            .update(JSON.stringify(validatedSales.map(s => s.sourceRowHash)))
            .digest('hex')
            .slice(0, 32);

        return NextResponse.json({
            valid: criticalErrors.length === 0,
            validationToken,
            errors: criticalErrors,
            warnings,
            summary: {
                totalRows: sales.length,
                validSales: validatedSales.length,
                invalidSales: sales.length - validatedSales.length,
                validPayments: validPaymentsCount,
                newClients,
                existingClients,
                totalValue,
                totalDeposits,
                standsToUpdate: validatedSales.length,
            },
            validatedData: validatedSales,
        });
    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json(
            { error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
