import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { ComplianceChecker } from '@/lib/compliance-checker';
import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/admin/contracts/analytics/summary
 * Get contract analytics summary for dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const branch = new URL(req.url).searchParams.get('branch') || user.branch || 'Harare';

    // Get contract counts by status
    const statusQuery = `
      SELECT status, COUNT(*) as count FROM contracts 
      WHERE branch = $1
      GROUP BY status
    `;

    const statusResult = await sql.query(statusQuery, [branch]);
    const statusCounts = Object.fromEntries(
      ((Array.isArray(statusResult) ? statusResult : (statusResult as any)?.rows) || []).map((row: { status: string; count: string }) => [row.status, parseInt(row.count, 10)])
    );

    // Get total value
    const valueQuery = `
      SELECT SUM(CAST((variables->>'amount')::NUMERIC AS NUMERIC)) as total_value 
      FROM contracts WHERE branch = $1
    `;
    
    const valueResult = await sql.query(valueQuery, [branch]);
    const rowsData = Array.isArray(valueResult) ? valueResult : (valueResult as any)?.rows || [];
    const totalValue = rowsData[0]?.total_value || 0;

    // Get SLA metrics
    const slaMetrics = await ComplianceChecker.generateSLAMetrics(branch);

    // Get overdue signatures
    const overdueSignatures = await ComplianceChecker.getOverdueSignatureContracts();
    const overdueCount = overdueSignatures.length;

    // Get expiring contracts
    const expiringContracts = await ComplianceChecker.getExpiringContracts(30);
    const expiringCount = expiringContracts.length;

    const totalContracts = Object.values(statusCounts).reduce((a: number, b: any) => a + b, 0);

    return apiSuccess({
      summary: {
        total: totalContracts,
        byStatus: statusCounts,
        totalValue: parseFloat(totalValue),
        overdueSignatures: overdueCount,
        expiringThirtyDays: expiringCount
      },
      sla: slaMetrics,
      branch
    });
  } catch (error: any) {
    logger.error('Analytics summary error', error, { module: 'API', action: 'GET_CONTRACT_ANALYTICS_SUMMARY' });
    return apiError('Failed to fetch analytics', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}