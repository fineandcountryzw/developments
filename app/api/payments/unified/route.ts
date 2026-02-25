/**
 * Unified Payments API
 * Fine & Country Zimbabwe ERP
 * 
 * Single source of truth for ALL payments across the system.
 * Aggregates payments from both Payment and PaymentTransaction tables.
 * 
 * This endpoint replaces:
 * - /api/admin/payments (Payments Module)
 * - /api/admin/billing/ledger (Billing Module)
 * - /api/client/payments (Client Module)
 */

import { NextRequest } from 'next/server';
import { requireAdmin, requireAgent, getAuthenticatedUser } from '@/lib/access-control';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * Unified payment type that works for both Payment and PaymentTransaction
 */
export interface UnifiedPayment {
    id: string;
    source: 'PAYMENT' | 'PAYMENT_TRANSACTION';
    amount: number;
    currency: string;
    status: string;
    method: string;
    reference: string;
    description?: string;

    // Client info
    clientId: string;
    clientName: string;
    clientEmail?: string;

    // Stand/Development info
    standId?: string | null;
    standNumber?: string | null;
    developmentId?: string | null;
    developmentName?: string | null;

    // Dates
    createdAt: string;
    updatedAt: string;
    confirmedAt?: string | null;
    postedAt?: string | null;

    // Additional metadata
    paymentType?: string;
    officeLocation?: string;
    receivedByName?: string;
    manualReceiptNo?: string;
    verificationStatus?: string;

    // Allocations
    allocations: Array<{
        id: string;
        amount: number;
        type: string;
        status: string;
        description?: string;
        allocatedAt: string;
        allocatedBy?: string | null;
    }>;

    totalAllocated: number;
    unallocatedAmount: number;
}

/**
 * Fetch unified payments from both Payment and PaymentTransaction tables
 */
async function getUnifiedPayments(options: {
    clientId?: string;
    developmentId?: string;
    standId?: string;
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    source?: 'ALL' | 'PAYMENT' | 'PAYMENT_TRANSACTION';
}): Promise<UnifiedPayment[]> {
    const {
        clientId, developmentId, standId, status, search,
        startDate, endDate, limit = 100, offset = 0, source = 'ALL'
    } = options;

    try {
        // Build where clauses
        const pWhere: any = {}; // Payment table where
        const ptWhere: any = {}; // PaymentTransaction table where

        if (clientId) {
            pWhere.clientId = clientId;
            ptWhere.clientId = clientId;
        }

        if (standId) {
            pWhere.standId = standId;
            ptWhere.standId = standId;
        }

        if (developmentId) {
            pWhere.developmentId = developmentId;
            ptWhere.developmentId = developmentId;
        }

        if (status) {
            pWhere.status = status;
            ptWhere.status = status;
        }

        if (search) {
            pWhere.OR = [
                { clientName: { contains: search, mode: 'insensitive' } },
                { reference: { contains: search, mode: 'insensitive' } }
            ];
            ptWhere.OR = [
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { reference: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (startDate || endDate) {
            pWhere.createdAt = {};
            ptWhere.postedAt = {};
            if (startDate) {
                pWhere.createdAt.gte = startDate;
                ptWhere.postedAt.gte = startDate;
            }
            if (endDate) {
                pWhere.createdAt.lte = endDate;
                ptWhere.postedAt.lte = endDate;
            }
        }

        // Fetch from both tables in parallel (unless filtered by source)
        const promises: [Promise<any[]>, Promise<any[]>] = [
            Promise.resolve([]),
            Promise.resolve([])
        ];

        if (source === 'ALL' || source === 'PAYMENT') {
            promises[0] = (prisma as any).payment.findMany({
                where: pWhere,
                include: {
                    client: { select: { name: true, email: true } },
                    stand: {
                        include: {
                            development: { select: { id: true, name: true } }
                        }
                    },
                    allocations: {
                        include: {
                            installment: { select: { installmentNo: true } }
                        }
                    },
                    receipt: {
                        select: { id: true, receiptNumber: true, pdfUrl: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });
        }

        if (source === 'ALL' || source === 'PAYMENT_TRANSACTION') {
            promises[1] = (prisma as any).paymentTransaction.findMany({
                where: ptWhere,
                include: {
                    client: { select: { name: true, email: true } },
                    development: { select: { id: true, name: true } },
                    stand: {
                        include: {
                            development: { select: { id: true, name: true } }
                        }
                    },
                    allocations: {
                        include: {
                            invoice: { select: { invoiceNumber: true, description: true } }
                        }
                    }
                },
                orderBy: { postedAt: 'desc' },
                take: limit,
                skip: offset
            });
        }

        const [legacyPayments, paymentTransactions] = await Promise.all(promises);

        // Transform legacy Payment entries
        const pEntries: UnifiedPayment[] = (legacyPayments || []).map((p: any) => {
            const totalAllocated = (p.allocations || []).reduce((sum: number, a: any) => sum + Number(a.amount), 0);
            return {
                id: p.id,
                source: 'PAYMENT' as const,
                amount: Number(p.amount),
                currency: 'USD',
                status: p.status,
                method: p.method,
                reference: p.reference || p.manualReceiptNo || 'N/A',
                description: p.description,

                clientId: p.clientId,
                clientName: p.clientName || p.client?.name || 'Unknown',
                clientEmail: p.client?.email,

                standId: p.standId,
                standNumber: p.stand?.standNumber || null,
                developmentId: p.developmentId || p.stand?.development?.id,
                developmentName: p.stand?.development?.name || null,

                createdAt: p.createdAt?.toISOString(),
                updatedAt: p.updatedAt?.toISOString(),
                confirmedAt: p.confirmedAt?.toISOString() || null,
                postedAt: p.createdAt?.toISOString(),

                paymentType: p.paymentType,
                officeLocation: p.officeLocation,
                receivedByName: p.receivedByName,
                manualReceiptNo: p.manualReceiptNo,
                verificationStatus: p.verificationStatus,

                allocations: (p.allocations || []).map((a: any) => ({
                    id: a.id,
                    amount: Number(a.amount),
                    type: a.allocationType || 'INSTALLMENT',
                    status: a.allocationStatus || 'APPLIED',
                    description: a.installment?.installmentNo ? `Installment ${a.installment.installmentNo}` : undefined,
                    allocatedAt: a.allocatedAt?.toISOString() || a.createdAt?.toISOString(),
                    allocatedBy: a.allocatedBy
                })),

                totalAllocated,
                unallocatedAmount: Number(p.amount) - totalAllocated
            };
        });

        // Transform PaymentTransaction entries
        const ptEntries: UnifiedPayment[] = (paymentTransactions || []).map((p: any) => {
            const totalAllocated = (p.allocations || []).reduce((sum: number, a: any) => sum + Number(a.amount), 0);
            return {
                id: p.id,
                source: 'PAYMENT_TRANSACTION' as const,
                amount: Number(p.amount),
                currency: p.currency,
                status: p.status,
                method: p.method,
                reference: p.reference || 'N/A',
                description: p.memo,

                clientId: p.clientId,
                clientName: p.client?.name || 'Unknown',
                clientEmail: p.client?.email,

                standId: p.standId,
                standNumber: p.stand?.standNumber || null,
                developmentId: p.developmentId || p.stand?.development?.id,
                developmentName: p.development?.name || p.stand?.development?.name || null,

                createdAt: p.createdAt?.toISOString(),
                updatedAt: p.updatedAt?.toISOString(),
                confirmedAt: null,
                postedAt: p.postedAt?.toISOString(),

                paymentType: p.source,
                officeLocation: undefined,
                receivedByName: undefined,
                manualReceiptNo: undefined,
                verificationStatus: undefined,

                allocations: (p.allocations || []).map((a: any) => ({
                    id: a.id,
                    amount: Number(a.amount),
                    type: 'INVOICE',
                    status: 'APPLIED',
                    description: a.invoice?.description || `Invoice ${a.invoice?.invoiceNumber || 'Unknown'}`,
                    allocatedAt: a.createdAt?.toISOString(),
                    allocatedBy: 'System'
                })),

                totalAllocated,
                unallocatedAmount: Number(p.amount) - totalAllocated
            };
        });

        // Combine and sort by date (newest first)
        const combined = [...pEntries, ...ptEntries].sort((a, b) => {
            const dateA = new Date(a.postedAt || a.createdAt).getTime();
            const dateB = new Date(b.postedAt || b.createdAt).getTime();
            return dateB - dateA;
        });

        // Apply limit after combining
        return combined.slice(0, limit);
    } catch (error) {
        logger.error('Failed to fetch unified payments', error as Error, {
            module: 'UnifiedPayments',
            action: 'GET_UNIFIED_PAYMENTS_ERROR'
        });
        throw error;
    }
}

/**
 * GET /api/payments/unified
 * Get unified payments from all sources
 * 
 * Query params:
 * - clientId: Filter by client
 * - developmentId: Filter by development
 * - standId: Filter by stand
 * - status: Filter by status
 * - search: Search by client name or reference
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Number of records (default 100)
 * - offset: Pagination offset (default 0)
 * - source: 'ALL' | 'PAYMENT' | 'PAYMENT_TRANSACTION' (default 'ALL')
 */
export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
        }

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId') || undefined;
        const developmentId = searchParams.get('developmentId') || undefined;
        const standId = searchParams.get('standId') || undefined;
        const status = searchParams.get('status') || undefined;
        const search = searchParams.get('search') || undefined;
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const source = (searchParams.get('source') as 'ALL' | 'PAYMENT' | 'PAYMENT_TRANSACTION') || 'ALL';

        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;

        const payments = await getUnifiedPayments({
            clientId,
            developmentId,
            standId,
            status,
            search,
            startDate,
            endDate,
            limit,
            offset,
            source
        });

        // Calculate summary stats
        const totalPayments = payments.length;
        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalAllocated = payments.reduce((sum, p) => sum + p.totalAllocated, 0);
        const totalUnallocated = payments.reduce((sum, p) => sum + p.unallocatedAmount, 0);

        logger.info('Unified payments retrieved', {
            module: 'UnifiedPayments',
            action: 'GET_UNIFIED_PAYMENTS',
            filters: { clientId, developmentId, status, source },
            count: payments.length
        });

        return apiSuccess({
            payments,
            summary: {
                totalPayments,
                totalAmount,
                totalAllocated,
                totalUnallocated,
                sources: {
                    payment: payments.filter(p => p.source === 'PAYMENT').length,
                    paymentTransaction: payments.filter(p => p.source === 'PAYMENT_TRANSACTION').length
                }
            }
        }, 200, {
            total: totalPayments,
            limit,
            offset,
            hasMore: payments.length === limit
        });
    } catch (error) {
        logger.error('Failed to retrieve unified payments', error as Error, {
            module: 'UnifiedPayments',
            action: 'GET_UNIFIED_PAYMENTS_ERROR'
        });
        console.error('UNIFIED PAYMENTS ERROR:', error);
        return apiError('Failed to retrieve payments', 500, ErrorCodes.FETCH_ERROR, {
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
