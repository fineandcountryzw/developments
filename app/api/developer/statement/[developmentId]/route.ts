import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/developer/statement/[developmentId]
 * 
 * Get detailed developer financial statement for a specific development
 * 
 * Query Parameters:
 * - period: Month filter (YYYY-MM format, optional)
 * 
 * Returns:
 * - Sales summary
 * - Financial breakdown (gross, commission, net)
 * - VAT and fees (informational)
 * - Payment tracking
 * - Detailed transaction list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
  }
  const userEmail = session.user.email;

  const { developmentId } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period'); // YYYY-MM
  
  logger.info('Developer Statement API Request', { module: 'API', action: 'GET_DEVELOPER_STATEMENT_BY_ID', developmentId, period });
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
  }
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Get development info
    const devQuery = `
      SELECT id, name, developer_name, developer_email
      FROM developments
      WHERE id = $1
    `;
    const devResult = await pool.query(devQuery, [developmentId]);
    
    if (devResult.rows.length === 0) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }
    
    const development = devResult.rows[0];

    if (development.developer_email !== userEmail) {
      return apiError('Forbidden', 403, ErrorCodes.AUTH_REQUIRED);
    }
    
    // Build period filter
    let periodCondition = '';
    let periodParams: any[] = [developmentId];
    
    if (period) {
      periodCondition = `AND TO_CHAR(c."createdAt", 'YYYY-MM') = $2`;
      periodParams.push(period);
    }
    
    // Get financial summary for the period
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_stands_sold,
        SUM(c.base_price) as gross_sales,
        SUM(c.commission_total) as total_commission,
        SUM(c.developer_net_amount) as net_amount,
        SUM(c.vat_amount) as vat_collected,
        SUM(c.aos_fee) as aos_fees,
        SUM(c.cession_fee) as cession_fees,
        SUM(c.endowment_fee) as endowment_fees,
        SUM(COALESCE(c.admin_fee, 0)) as admin_fees
      FROM contracts c
      JOIN stands s ON s.id = c."standId"
      WHERE s.development_id = $1
      ${periodCondition}
    `;
    
    const summaryResult = await pool.query(summaryQuery, periodParams);
    const summary = summaryResult.rows[0];
    
    // Get transaction details
    const transactionsQuery = `
      SELECT 
        c.id as sale_id,
        s."standNumber" as stand_number,
        c."clientName" as client_name,
        c."createdAt" as sale_date,
        c.base_price,
        c.commission_total as commission,
        c.developer_net_amount as net_to_developer,
        c.status
      FROM contracts c
      JOIN stands s ON s.id = c."standId"
      WHERE s.development_id = $1
      ${periodCondition}
      ORDER BY c."createdAt" DESC
    `;
    
    const transactionsResult = await pool.query(transactionsQuery, periodParams);
    
    // Get payment history
    const paymentsQuery = `
      SELECT 
        id,
        amount,
        payment_date,
        payment_method,
        reference_number,
        period_start,
        period_end,
        month_year,
        notes
      FROM developer_payments
      WHERE development_id = $1
      ${period ? 'AND month_year = $2' : ''}
      ORDER BY payment_date DESC
    `;
    
    const paymentsResult = await pool.query(paymentsQuery, periodParams);
    
    // Calculate payments received
    const paymentsReceived = paymentsResult.rows.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );
    
    const netAmount = parseFloat(summary.net_amount) || 0;
    const outstandingBalance = netAmount - paymentsReceived;
    
    // Format response
    const response = {
      development_id: developmentId,
      development_name: development.name,
      developer_name: development.developer_name,
      developer_email: development.developer_email,
      period: period || 'All Time',
      month_year: period || null,
      
      // Sales summary
      total_stands_sold: parseInt(summary.total_stands_sold) || 0,
      
      // Financial breakdown
      gross_sales: parseFloat(summary.gross_sales) || 0,
      total_commission: parseFloat(summary.total_commission) || 0,
      net_amount: netAmount,
      
      // Informational (not owed to developer)
      vat_collected: parseFloat(summary.vat_collected) || 0,
      fees_collected: {
        aos: parseFloat(summary.aos_fees) || 0,
        cession: parseFloat(summary.cession_fees) || 0,
        endowment: parseFloat(summary.endowment_fees) || 0,
        admin: parseFloat(summary.admin_fees) || 0,
        total: (parseFloat(summary.aos_fees) || 0) + 
               (parseFloat(summary.cession_fees) || 0) + 
               (parseFloat(summary.endowment_fees) || 0) +
               (parseFloat(summary.admin_fees) || 0),
      },
      
      // Payment tracking
      payments_received: paymentsReceived,
      outstanding_balance: outstandingBalance,
      
      // Transaction list
      transactions: transactionsResult.rows.map(t => ({
        sale_id: t.sale_id,
        stand_number: t.stand_number,
        client_name: t.client_name,
        sale_date: t.sale_date,
        base_price: parseFloat(t.base_price) || 0,
        commission: parseFloat(t.commission) || 0,
        net_to_developer: parseFloat(t.net_to_developer) || 0,
        status: t.status,
      })),
      
      // Payment history
      payment_history: paymentsResult.rows.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        period_start: p.period_start,
        period_end: p.period_end,
        month_year: p.month_year,
        notes: p.notes,
      })),
    };
    
    logger.info('Developer Statement API Success', {
      module: 'API',
      action: 'GET_DEVELOPER_STATEMENT_BY_ID',
      developmentId,
      standsSold: response.total_stands_sold,
      netAmount: response.net_amount,
      outstanding: response.outstanding_balance,
    });
    
    return apiSuccess(response);
    
  } catch (error: any) {
    logger.error('Developer Statement API Error', error, { module: 'API', action: 'GET_DEVELOPER_STATEMENT_BY_ID', developmentId });
    return apiError('Failed to generate developer statement', 500, ErrorCodes.FETCH_ERROR);
  } finally {
    await pool.end();
  }
}
