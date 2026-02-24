
import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService, CreatePaymentInput } from '@/lib/payments/payments.service';
import { Currency, PaymentMethod, PaymentSource } from '@prisma/client';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Basic validation
        if (!body.amount || !body.clientId || !body.idempotencyKey) {
            return NextResponse.json(
                { error: "Missing required fields: amount, clientId, idempotencyKey" },
                { status: 400 }
            );
        }

        const input: CreatePaymentInput = {
            amount: Number(body.amount),
            currency: body.currency as Currency || Currency.USD,
            method: body.method as PaymentMethod || PaymentMethod.CASH,
            reference: body.reference,
            externalId: body.externalId,
            idempotencyKey: body.idempotencyKey,
            memo: body.memo,
            clientId: body.clientId,
            saleId: body.saleId,
            invoiceId: body.invoiceId,
            developmentId: body.developmentId,
            standId: body.standId,
            source: body.source as PaymentSource || PaymentSource.API,
            postedAt: body.postedAt ? new Date(body.postedAt) : undefined,
            createdByUserId: body.createdByUserId, // Extract from session if available
        };

        const payment = await PaymentsService.createPayment(input);
        return NextResponse.json(payment);
    } catch (error) {
        console.error("Payment creation failed:", error);
        return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filters = {
            clientId: searchParams.get('clientId') || undefined,
            saleId: searchParams.get('saleId') || undefined,
            invoiceId: searchParams.get('invoiceId') || undefined,
            developmentId: searchParams.get('developmentId') || undefined,
            standId: searchParams.get('standId') || undefined,
            startDate: searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined,
            endDate: searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined,
            page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
        };

        const result = await PaymentsService.listPayments(filters);
        return NextResponse.json(result);
    } catch (error) {
        console.error("List payments failed:", error);
        return NextResponse.json({ error: "Failed to list payments" }, { status: 500 });
    }
}
