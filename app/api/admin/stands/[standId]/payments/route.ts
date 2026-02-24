import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import { getStandPayments } from '@/lib/services/stands-financial-service';

/**
 * GET /api/admin/stands/[standId]/payments
 * Get payment history for a specific stand
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ standId: string }> }
) {
  try {
    const { standId } = await params;
    const authResult = await requireRole(['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const payments = await getStandPayments(standId);

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error fetching stand payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
