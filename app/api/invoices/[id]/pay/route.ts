
import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService } from '@/lib/payments/payments.service';
// import { PaymentMethod, Currency, PaymentSource } from '@prisma/client';
import crypto from 'crypto';

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const invoiceId = params.id;
        const body = await req.json();

        if (!body.amount || !body.clientId) {
            return NextResponse.json({ error: "Missing amount or clientId" }, { status: 400 });
        }

        // Idempotency: use provided key or generate one deterministic for this invoice+amount+time attempt?
        // Better to require unique key from client (e.g. UUID).
        const idempotencyKey = body.idempotencyKey || `pay-inv-${invoiceId}-${Date.now()}`;

        const payment = await PaymentsService.createPayment({
            amount: Number(body.amount),
            currency: (body.currency as any) || ('USD' as any),
            method: (body.method as any) || ('OTHER' as any), // Default?
            clientId: body.clientId,
            invoiceId: invoiceId,
            idempotencyKey,
            source: 'API' as any,
            reference: body.reference,
            memo: body.memo,
            postedAt: new Date(),
        });

        return NextResponse.json(payment);
    } catch (error) {
        console.error("Invoice payment failed:", error);
        return NextResponse.json({ error: "Failed to process invoice payment" }, { status: 500 });
    }
}
