import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ standId: string }> }
) {
  try {
    // Check authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { standId } = await params;

    // Get payments for the stand
    const payments = await prisma.payment.findMany({
      where: {
        standId: standId,
      },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        createdAt: true,
        receipt: {
          select: {
            id: true,
            receiptNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data
    const transformedPayments = payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toNumber(),
      method: payment.method,
      status: payment.status.toLowerCase() as 'confirmed' | 'pending' | 'rejected',
      createdAt: payment.createdAt.toISOString(),
      receiptUrl: payment.receipt ? `/api/receipts/${payment.receipt.id}/download` : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: transformedPayments,
    });
  } catch (error) {
    console.error('Error fetching stand payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
