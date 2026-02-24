
import prisma from "@/lib/prisma";
import {
    PaymentTransaction,
    Prisma,
    InvoiceStatus,
    SaleStatus,
    StandStatus,
    TransactionStatus,
    PaymentSource,
    Currency,
    PaymentMethod
} from "@prisma/client";

export type CreatePaymentInput = {
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    reference?: string;
    externalId?: string;
    idempotencyKey: string;
    memo?: string;
    clientId: string;
    saleId?: string;
    invoiceId?: string;
    developmentId?: string;
    standId?: string;
    source?: PaymentSource;
    postedAt?: Date;
    createdByUserId?: string;
    status?: TransactionStatus;  // Allow specifying status (e.g., PENDING for unverified payments)
};

export type PaymentFilter = {
    clientId?: string;
    saleId?: string;
    invoiceId?: string;
    developmentId?: string;
    standId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
};

export class PaymentsService {
    /**
     * Create a new payment transaction with strict idempotency and balance updates.
     */
    static async createPayment(data: CreatePaymentInput): Promise<PaymentTransaction> {
        const { idempotencyKey } = data;

        // Check strict idempotency
        const existing = await prisma.paymentTransaction.findUnique({
            where: { idempotencyKey },
        });

        if (existing) {
            return existing;
        }

        // Default values
        const postedAt = data.postedAt || new Date();
        const source = data.source || PaymentSource.MANUAL;
        // Allow override, default to COMPLETED for backward compatibility
        const status = data.status || TransactionStatus.COMPLETED;

        // Execute in transaction
        const transaction = await prisma.$transaction(async (tx) => {
            // 1. Create Payment Record
            const payment = await tx.paymentTransaction.create({
                data: {
                    clientId: data.clientId,
                    amount: new Prisma.Decimal(data.amount),
                    currency: data.currency,
                    method: data.method,
                    reference: data.reference,
                    externalId: data.externalId,
                    idempotencyKey,
                    memo: data.memo,
                    saleId: data.saleId,
                    invoiceId: data.invoiceId,
                    developmentId: data.developmentId,
                    standId: data.standId,
                    source,
                    status,
                    postedAt,
                    createdByUserId: data.createdByUserId,
                },
            });

            // 2. If linked to Sale, recompute balances and update status if needed
            if (data.saleId) {
                await this.recomputeSaleStatus(data.saleId, tx);
            }

            // 3. If linked to Invoice, update Invoice status (simple logic for now)
            if (data.invoiceId) {
                await this.updateInvoiceStatus(data.invoiceId, tx);
            }

            return payment;
        });

        return transaction;
    }

    /**
     * List payments with filters.
     */
    static async listPayments(filters: PaymentFilter) {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;

        const where: Prisma.PaymentTransactionWhereInput = {
            clientId: filters.clientId,
            saleId: filters.saleId,
            invoiceId: filters.invoiceId,
            developmentId: filters.developmentId,
            standId: filters.standId,
            postedAt: {
                gte: filters.startDate,
                lte: filters.endDate,
            },
        };

        const [total, items] = await Promise.all([
            prisma.paymentTransaction.count({ where }),
            prisma.paymentTransaction.findMany({
                where,
                orderBy: { postedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    client: { select: { name: true, email: true } },
                    development: { select: { name: true } },
                    stand: { select: { standNumber: true } },
                },
            }),
        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            items,
        };
    }

    /**
     * Get Client Statement (Ledger).
     */
    static async getClientStatement(clientId: string, from?: Date, to?: Date) {
        const where: Prisma.PaymentTransactionWhereInput = {
            clientId,
            postedAt: {
                gte: from,
                lte: to,
            },
            status: TransactionStatus.COMPLETED,
        };

        const payments = await prisma.paymentTransaction.findMany({
            where,
            orderBy: { postedAt: 'asc' }, // Chronological for running balance?
            include: {
                sale: { select: { id: true, totalAmount: true } },
                invoice: { select: { invoiceNumber: true } },
            },
        });

        return payments;
    }

    /**
     * Recompute Sale status based on total payments.
     * If Paid >= Total, mark Sale COMPLETED and Stand SOLD.
     */
    private static async recomputeSaleStatus(saleId: string, tx: Prisma.TransactionClient) {
        const sale = await tx.sale.findUnique({
            where: { id: saleId },
            include: { stand: true }, // Need stand to update status
        });

        if (!sale) return;

        // Sum all COMPLETED payments for this sale
        const paymentsSum = await tx.paymentTransaction.aggregate({
            where: {
                saleId,
                status: TransactionStatus.COMPLETED,
            },
            _sum: {
                amount: true,
            },
        });

        const totalPaid = paymentsSum._sum.amount || new Prisma.Decimal(0);
        const totalAmount = sale.totalAmount;
        const isFullyPaid = totalPaid.gte(totalAmount);

        // Logic: If fully paid and sale is ACTIVE, complete it.
        if (isFullyPaid && sale.status === SaleStatus.ACTIVE) {
            // 1. Mark Sale COMPLETED
            await tx.sale.update({
                where: { id: saleId },
                data: { status: SaleStatus.COMPLETED },
            });

            // 2. Mark Stand SOLD (if linked)
            if (sale.standId) {
                await tx.stand.update({
                    where: { id: sale.standId },
                    data: {
                        status: StandStatus.SOLD,
                        soldAt: new Date(), // Set sold date to now? Or last payment date? Using now for simplicity.
                        soldBy: sale.clientId, // Optional: tracking
                    },
                });
            }
        } else if (!isFullyPaid && sale.status === SaleStatus.COMPLETED) {
            // Revert if payment was voided? (Edge case)
            // For now, only handle forward progress.
        }
    }

    /**
     * Update Invoice status based on payments.
     */
    private static async updateInvoiceStatus(invoiceId: string, tx: Prisma.TransactionClient) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) return;

        const paymentsSum = await tx.paymentTransaction.aggregate({
            where: {
                invoiceId,
                status: TransactionStatus.COMPLETED,
            },
            _sum: { amount: true },
        });

        const totalPaid = paymentsSum._sum.amount || new Prisma.Decimal(0);
        const invoiceTotal = invoice.totalAmount;

        let newStatus: InvoiceStatus = InvoiceStatus.ISSUED;

        if (totalPaid.gte(invoiceTotal)) {
            newStatus = InvoiceStatus.PAID;
        } else if (totalPaid.gt(0)) {
            newStatus = InvoiceStatus.PARTIALLY_PAID;
        } else {
            newStatus = InvoiceStatus.ISSUED; // Or maintain current if OUTSTANDING?
        }

        // Don't revert VOID or DRAFT unnecessarily, but for now strict computation:
        if (invoice.status !== InvoiceStatus.VOID && invoice.status !== InvoiceStatus.DRAFT) {
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: newStatus,
                    paidAmount: totalPaid
                },
            });
        }
    }

    /**
     * Compute balances for a sale public helper.
     */
    static async computeSaleBalance(saleId: string) {
        const sale = await prisma.sale.findUnique({ where: { id: saleId } });
        if (!sale) throw new Error("Sale not found");

        const paymentsSum = await prisma.paymentTransaction.aggregate({
            where: { saleId, status: TransactionStatus.COMPLETED },
            _sum: { amount: true },
        });

        const totalPaid = paymentsSum._sum.amount || new Prisma.Decimal(0);
        const outstanding = sale.totalAmount.sub(totalPaid);

        return {
            totalAmount: sale.totalAmount,
            totalPaid,
            outstanding,
            isPaid: totalPaid.gte(sale.totalAmount),
            status: sale.status,
        };
    }
}
