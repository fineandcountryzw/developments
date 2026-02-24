import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/developments
 * Fetch developments and stats for a developer (landowner). Scoped by developer_email.
 * Recent payments: use GET /api/developer/payments separately.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }
    const userEmail = session.user.email;

    const period = request.nextUrl.searchParams.get('period') || '30d';
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 500, ErrorCodes.DB_UNAVAILABLE);
    }

    const pool = new Pool({ connectionString: databaseUrl });

    // Fetch developer-scoped developments with stand counts
    const developmentsQuery = `
      SELECT 
        d.id,
        d.name,
        d.location,
        COALESCE(d.total_stands, 0) as "totalStands",
        d.developer_email as "developerEmail",
        d.developer_name as "developerName",
        d.base_price as "basePrice",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'SOLD'), 0)::int as "soldStands",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'RESERVED'), 0)::int as "reservedStands",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'AVAILABLE'), 0)::int as "availableStands",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id), 0)::int as "actualStands"
      FROM developments d
      WHERE UPPER(d.status) = 'ACTIVE' AND d.developer_email = $1
      ORDER BY d.created_at DESC
      LIMIT 20
    `;

    const devResult = await pool.query(developmentsQuery, [userEmail]);
    
    // Process developments with calculated revenue
    const developments = devResult.rows.map(dev => {
      const totalStands = parseInt(dev.actualStands) || parseInt(dev.totalStands) || 0;
      const soldStands = parseInt(dev.soldStands) || 0;
      const reservedStands = parseInt(dev.reservedStands) || 0;
      const availableStands = parseInt(dev.availableStands) || 0;
      const basePrice = parseFloat(dev.basePrice) || 25000;
      const totalRevenue = soldStands * basePrice;
      const pendingPayments = reservedStands * basePrice * 0.3;
      
      return {
        id: dev.id,
        name: dev.name,
        location: dev.location,
        totalStands,
        soldStands,
        reservedStands,
        availableStands,
        totalRevenue,
        pendingPayments,
        commissionDue: totalRevenue * 0.05,
        lastSaleDate: new Date().toISOString()
      };
    });

    // Calculate aggregate stats
    const totalReserved = developments.reduce((sum, d) => sum + d.reservedStands, 0);
    const totalAvailable = developments.reduce((sum, d) => sum + d.availableStands, 0);
    const avgPrice = developments.length > 0 
      ? developments.reduce((sum, d) => sum + (d.totalRevenue / Math.max(d.soldStands, 1)), 0) / developments.length 
      : 25000;
    
    // Expected revenue this month: reserved stands likely to convert + projected new sales
    const expectedRevenueThisMonth = Math.round(
      (totalReserved * avgPrice * 0.7) + // 70% of reserved expected to complete
      (totalAvailable * avgPrice * 0.05)   // 5% of available expected to sell
    );
    
    // Expected installments: based on sold stands with payment plans (assume 60% are on installments)
    const expectedInstallmentsThisMonth = Math.round(
      developments.reduce((sum, d) => sum + d.soldStands, 0) * avgPrice * 0.6 * 0.1 // 10% monthly installment
    );

    const stats = {
      totalDevelopments: developments.length,
      totalStands: developments.reduce((sum, d) => sum + d.totalStands, 0),
      totalSold: developments.reduce((sum, d) => sum + d.soldStands, 0),
      totalRevenue: developments.reduce((sum, d) => sum + d.totalRevenue, 0),
      pendingPayouts: developments.reduce((sum, d) => sum + d.pendingPayments, 0),
      thisMonthSales: developments.reduce((sum, d) => sum + d.soldStands, 0),
      lastMonthSales: Math.floor(developments.reduce((sum, d) => sum + d.soldStands, 0) * 0.8),
      averagePricePerStand: 0,
      expectedRevenueThisMonth,
      expectedInstallmentsThisMonth,
      projectedMonthlyRevenue: expectedRevenueThisMonth + expectedInstallmentsThisMonth
    };

    if (stats.totalSold > 0) {
      stats.averagePricePerStand = Math.round(stats.totalRevenue / stats.totalSold);
    }

    await pool.end();

    logger.info('Developer API Returning data', {
      module: 'API',
      action: 'GET_DEVELOPER_DEVELOPMENTS',
      developmentCount: developments.length,
      totalRevenue: stats.totalRevenue,
      totalSold: stats.totalSold
    });

    return apiSuccess({
      developments,
      stats
    });

  } catch (error: any) {
    logger.error('Developer API Error', error, { module: 'API', action: 'GET_DEVELOPER_DEVELOPMENTS' });
    return apiError(error.message || 'Failed to fetch developer data', 500, ErrorCodes.FETCH_ERROR);
  }
}
