/**
 * Import Batch Details API
 * GET /api/admin/import/batches/[batchId]
 * 
 * Returns detailed information about a specific import batch,
 * including all sales records and associated payments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { batchId } = await params;

        const batch = await prisma.importBatch.findUnique({
            where: { id: batchId },
            include: {
                offlineSales: {
                    include: {
                        client: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                        stand: {
                            select: { id: true, standNumber: true, status: true, price: true },
                        },
                        payments: {
                            orderBy: { paymentDate: 'asc' },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!batch) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }

        // Calculate totals
        const totalSaleValue = batch.offlineSales.reduce(
            (sum, sale) => sum + Number(sale.salePrice), 0
        );
        const totalPayments = batch.offlineSales.reduce(
            (sum, sale) => sum + sale.payments.reduce(
                (pSum, p) => pSum + Number(p.amount), 0
            ), 0
        );

        return NextResponse.json({
            batch: {
                id: batch.id,
                fileName: batch.fileName,
                importType: batch.importType,
                status: batch.status,
                totalRecords: batch.totalRecords,
                processedRecords: batch.processedRecords,
                failedRecords: batch.failedRecords,
                importedBy: batch.importedBy,
                branch: batch.branch,
                errorLog: batch.errorLog,
                createdAt: batch.createdAt,
                completedAt: batch.completedAt,
            },
            sales: batch.offlineSales.map(sale => ({
                id: sale.id,
                client: sale.client,
                stand: sale.stand,
                saleDate: sale.saleDate,
                salePrice: Number(sale.salePrice),
                depositAmount: Number(sale.depositAmount),
                paymentMethod: sale.paymentMethod,
                notes: sale.notes,
                payments: sale.payments.map(p => ({
                    id: p.id,
                    date: p.paymentDate,
                    amount: Number(p.amount),
                    method: p.paymentMethod,
                    reference: p.reference,
                    notes: p.notes,
                })),
            })),
            totals: {
                salesCount: batch.offlineSales.length,
                totalSaleValue,
                totalPayments,
                outstandingBalance: totalSaleValue - totalPayments,
            },
        });
    } catch (error) {
        console.error('Fetch batch details error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch batch details' },
            { status: 500 }
        );
    }
}
