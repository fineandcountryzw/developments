
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const paymentCount = await prisma.payment.count();
        const allocationCount = await prisma.paymentAllocation.count().catch(() => 'Error/Table missing');

        return NextResponse.json({
            success: true,
            data: {
                paymentCount,
                allocationCount
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
