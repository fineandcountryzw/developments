import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { getStandPayments } from '@/lib/services/stands-financial-service';

/**
 * GET /api/manager/stands-financial/[standId]/payments
 * Get payment history with authorization check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ standId: string }> }
) {
  try {
    const { standId } = await params;
    const authResult = await requireRole(['MANAGER']);
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Verify stand exists
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      select: { id: true },
    });

    if (!stand) {
      return NextResponse.json(
        { success: false, error: 'Stand not found' },
        { status: 404 }
      );
    }

    // TODO: Add authorization check when managerId is added to Development schema

    const payments = await getStandPayments(standId);

    return NextResponse.json({
      success: true,
      data: payments,
      payments, // Backward compat
    });
  } catch (error) {
    console.error('Error fetching stand payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
