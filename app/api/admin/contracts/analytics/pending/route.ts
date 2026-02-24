import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

const sql = neon(process.env.DATABASE_URL!);

interface PendingSignatureItem {
  contractId: string;
  contractTitle: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  sentDate: string;
  expiresDate: string;
  daysOverdue: number;
  isOverdue: boolean;
  status: string;
}

/**
 * GET /api/admin/contracts/analytics/pending
 * Get pending signatures with overdue tracking
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const branch = new URL(req.url).searchParams.get('branch') || user.branch || 'Harare';

    // Get pending signatures
    const query = `
      SELECT 
        cs.id as signature_id,
        cs.contract_id,
        cs.signer_name,
        cs.signer_email,
        cs.signer_role,
        cs.created_at as sent_date,
        cs.expires_at as expires_date,
        cs.status,
        c.title as contract_title,
        EXTRACT(DAY FROM NOW() - cs.expires_at) as days_overdue
      FROM contract_signatures cs
      JOIN contracts c ON cs.contract_id = c.id
      WHERE cs.status = 'pending'
        AND c.branch = $1
      ORDER BY cs.expires_at ASC
    `;

    const result = await sql.query(query, [branch]);
    const rows = (Array.isArray(result) ? result : (result as any)?.rows) || [];

    const pending: PendingSignatureItem[] = rows.map((row: any) => ({
      contractId: row.contract_id,
      contractTitle: row.contract_title,
      signerName: row.signer_name,
      signerEmail: row.signer_email,
      signerRole: row.signer_role,
      sentDate: row.sent_date,
      expiresDate: row.expires_date,
      daysOverdue: Math.max(0, parseInt(row.days_overdue, 10)),
      isOverdue: parseInt(row.days_overdue, 10) > 0,
      status: row.status
    }));

    // Count overdue
    const overdueCount = pending.filter(p => p.isOverdue).length;
    const totalPending = pending.length;

    // Get pending by role
    const roleQuery = `
      SELECT signer_role, COUNT(*) as count
      FROM contract_signatures
      WHERE status = 'pending'
        AND contract_id IN (SELECT id FROM contracts WHERE branch = $1)
      GROUP BY signer_role
    `;

    const roleResult = await sql.query(roleQuery, [branch]);
    const byRole = Object.fromEntries(
      ((Array.isArray(roleResult) ? roleResult : (roleResult as any)?.rows) || []).map((row: { signer_role: string; count: string }) => [row.signer_role, parseInt(row.count, 10)])
    );

    // Get alert threshold (more than 5 days overdue)
    const alerts = pending.filter(p => p.daysOverdue > 5).map(p => ({
      contractId: p.contractId,
      contractTitle: p.contractTitle,
      signerName: p.signerName,
      signerEmail: p.signerEmail,
      daysOverdue: p.daysOverdue
    }));

    return apiSuccess({
      pending: {
        total: totalPending,
        overdue: overdueCount,
        onTime: totalPending - overdueCount,
        byRole,
        items: pending,
        alerts
      },
      branch
    });
  } catch (error: any) {
    logger.error('Pending signatures error', error, { module: 'API', action: 'GET_CONTRACT_ANALYTICS_PENDING' });
    return apiError('Failed to fetch pending signatures', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}