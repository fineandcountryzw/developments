
import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService } from '@/lib/payments/payments.service';

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const clientId = params.id;
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
        const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;

        const statement = await PaymentsService.getClientStatement(clientId, from, to);

        // Calculate running balance or totals if needed
        const totalPaid = statement.reduce((sum, p) => sum + Number(p.amount), 0);

        return NextResponse.json({
            clientId,
            period: { from, to },
            totalPaid,
            transactions: statement
        });
    } catch (error) {
        console.error("Get client statement failed:", error);
        return NextResponse.json({ error: "Failed to get statement" }, { status: 500 });
    }
}
