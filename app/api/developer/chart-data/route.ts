import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/chart-data
 * Get chart data for developer revenue and stands sold over time
 * Scoped to logged-in developer's developments only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }
    const userEmail = session.user.email;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '6m';
    const months = period === '3m' ? 3 : period === '6m' ? 6 : period === '12m' ? 12 : 6;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 500, ErrorCodes.DB_UNAVAILABLE);
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const chartData: { month: string; revenue: number; standsSold: number; }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('default', { month: 'short' });

      // Get stands sold this month for this developer's developments
      const standsQuery = `
        SELECT 
          COUNT(*)::int as "standsSold",
          COALESCE(SUM(s.price), 0)::numeric as "revenue"
        FROM stands s
        JOIN developments d ON d.id = s.development_id
        WHERE d.developer_email = $1
          AND s.status = 'SOLD'
          AND s.updated_at >= $2
          AND s.updated_at <= $3
      `;

      const result = await pool.query(standsQuery, [
        userEmail,
        monthStart.toISOString(),
        monthEnd.toISOString()
      ]);

      const row = result.rows[0];
      const standsSold = parseInt(row.standsSold) || 0;
      const revenue = parseFloat(row.revenue) || 0;

      chartData.push({
        month: monthName,
        revenue: Math.round(revenue),
        standsSold
      });
    }

    await pool.end();

    return apiSuccess(chartData);
  } catch (error: any) {
    logger.error('Developer Chart Data API Error', error, { module: 'API', action: 'GET_DEVELOPER_CHART_DATA' });
    return apiError(error.message || 'Failed to fetch chart data', 500, ErrorCodes.FETCH_ERROR);
  }
}
