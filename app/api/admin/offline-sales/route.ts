import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/offline-sales
 * List all offline sales for contract generation
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const auth = await requireAdmin(req);
    if (auth.error) {
      return auth.error;
    }

    const sales = await prisma.offlineSale.findMany({
      include: {
        payments: true,
        stand: {
          include: {
            development: true,
          }
        },
        client: true,
      },
      orderBy: {
        saleDate: 'desc',
      },
    });

    // Calculate total paid for each sale
    const salesWithTotal = sales.map(sale => ({
      id: sale.id,
      standNumber: sale.stand?.standNumber || 'N/A',
      developmentName: sale.stand?.development?.name || 'N/A',
      clientName: sale.client?.name || 'Unknown',
      clientEmail: sale.client?.email || 'N/A',
      saleDate: sale.saleDate.toISOString().split('T')[0],
      salePrice: sale.salePrice,
      depositAmount: sale.depositAmount,
      paymentMethod: sale.paymentMethod,
      totalPaid: sale.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      status: 'COMPLETED',
    }));

    return NextResponse.json({
      success: true,
      sales: salesWithTotal,
    });
  } catch (error) {
    logger.error('Failed to fetch offline sales', error instanceof Error ? error : undefined, {
      module: 'offline-sales-api',
    });
    return NextResponse.json(
      { error: 'Failed to fetch offline sales' },
      { status: 500 }
    );
  }
}
