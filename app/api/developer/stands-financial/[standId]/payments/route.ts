import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import { getStandPayments } from '@/lib/services/stands-financial-service';

/**
 * GET /api/developer/stands-financial/[standId]/payments
 * Get payment history with authorization check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ standId: string }> }
) {
  try {
    const { standId } = await params;
    const authResult = await requireRole(['DEVELOPER']);
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Verify stand belongs to developer's development
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      select: {
        id: true,
        development: {
          select: {
            developerEmail: true,
          },
        },
      },
    });

    if (!stand || stand.development?.developerEmail !== authResult.user.email) {
      return NextResponse.json(
        { success: false, error: 'Stand not found or access denied' },
        { status: 403 }
      );
    }

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
