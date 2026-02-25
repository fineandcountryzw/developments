
import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService, CreatePaymentInput } from '@/lib/payments/payments.service';
import Papa from 'papaparse';

// Enums defined locally since Prisma 7 doesn't export them the same way
const Currency = { USD: 'USD', ZAR: 'ZAR', BWP: 'BWP' } as const;
const PaymentMethod = { BANK: 'BANK', CASH: 'CASH', MOBILE: 'MOBILE', ECOCASH: 'ECOCASH', ZIPIT: 'ZIPIT', TRANSFER: 'TRANSFER' } as const;
const PaymentSource = { API: 'API', PORTAL: 'PORTAL', IMPORT: 'IMPORT', MANUAL: 'MANUAL' } as const;
type Currency = typeof Currency[keyof typeof Currency];
type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];
type PaymentSource = typeof PaymentSource[keyof typeof PaymentSource];
import crypto from 'crypto';

// Helper to hash row for idempotency
function generateIdempotencyKey(data: any, batchId: string, index: number): string {
    const content = JSON.stringify(data) + batchId + index;
    return crypto.createHash('sha256').update(content).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';

        let rows: any[] = [];
        let batchId = crypto.randomUUID();

        if (contentType.includes('application/json')) {
            const body = await req.json();
            if (Array.isArray(body)) {
                rows = body;
            } else if (body.rows && Array.isArray(body.rows)) {
                rows = body.rows;
            }
        } else if (contentType.includes('text/csv')) {
            const text = await req.text();
            const parseResult = Papa.parse(text, { header: true, skipEmptyLines: true });
            rows = parseResult.data;
        } else {
            return NextResponse.json({ error: "Unsupported content type. Use application/json or text/csv" }, { status: 400 });
        }

        if (rows.length === 0) {
            return NextResponse.json({ error: "No rows to import" }, { status: 400 });
        }

        const results = {
            total: rows.length,
            success: 0,
            failed: 0,
            skipped: 0,
            errors: [] as any[],
        };

        // Process in batches or sequential? Sequential for safety in logic, but parallel db calls?
        // Using PaymentService.createPayment which is transactional.
        // We'll process one by one to capture individual errors.

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            try {
                // Validation
                if (!row.amount || (!row.clientId && !row.clientEmail)) {
                    throw new Error("Missing amount or identification (clientId/clientEmail)");
                }

                // If clientEmail provided but not clientId, we might need lookup. 
                // For now, assume clientId is provided or dealt with by caller. 
                // In a real CSV import, we'd likely need to lookup ID by email/phone.
                // Let's assume the row has clientId for the canonical API.

                const input: CreatePaymentInput = {
                    amount: Number(row.amount),
                    currency: (row.currency as any) || 'USD',
                    method: (row.method as any) || 'BANK',
                    reference: row.reference,
                    externalId: row.externalId || `import-${batchId}-${i}`,
                    idempotencyKey: row.idempotencyKey || generateIdempotencyKey(row, batchId, i),
                    clientId: row.clientId,
                    source: 'IMPORT' as any,
                    postedAt: row.postedAt ? new Date(row.postedAt) : new Date(),
                    memo: row.memo || `Imported via API batch ${batchId}`
                };

                await PaymentsService.createPayment(input);
                results.success++;
            } catch (error: any) {
                // Check for idempotency dupe (P2002)
                if (error.code === 'P2002') {
                    results.skipped++;
                } else {
                    results.failed++;
                    results.errors.push({ row: i, error: error.message });
                }
            }
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error("Import failed:", error);
        return NextResponse.json({ error: "Import processing failed" }, { status: 500 });
    }
}
