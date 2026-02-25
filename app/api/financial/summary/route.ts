import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/financial/summary
 * 
 * Get financial summary for accounts dashboard
 * 
 * Query Parameters:
 * - developmentId: Filter by specific development (optional)
 * - startDate: Start month (YYYY-MM format, optional)
 * - endDate: End month (YYYY-MM format, optional)
 * 
 * Returns comprehensive financial overview including:
 * - Total sales value
 * - Developer amounts owed
 * - Commission breakdown
 * - VAT and fees collected
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('developmentId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  logger.info('Financial Summary API Request', {
    module: 'API',
    action: 'GET_FINANCIAL_SUMMARY',
    developmentId,
    startDate,
    endDate
  });
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
  }
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Build WHERE clause
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;
    
    if (developmentId) {
      whereConditions.push(`fs.development_id = $${paramIndex}`);
      params.push(developmentId);
      paramIndex++;
    }
    
    if (startDate) {
      whereConditions.push(`fs.month_year >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereConditions.push(`fs.month_year <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Get overall summary
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT fs.development_id) as development_count,
        SUM(fs.total_sales_count) as total_sales,
        SUM(fs.total_sales_value) as total_sales_value,
        SUM(fs.developer_net) as developer_owed_total,
        SUM(fs.developer_paid_amount) as developer_paid_total,
        SUM(fs.developer_outstanding) as developer_outstanding_total,
        SUM(fs.total_commission) as total_commission,
        SUM(fs.agent_commission_total) as agent_commissions_total,
        SUM(fs.company_commission_total) as company_commissions_total,
        SUM(fs.vat_collected) as vat_collected_total,
        SUM(fs.aos_fees_collected) as aos_fees_total,
        SUM(fs.cession_fees_collected) as cession_fees_total,
        SUM(fs.endowment_fees_collected) as endowment_fees_total,
        SUM(fs.total_fees_collected) as total_fees_collected
      FROM financial_summaries fs
      ${whereClause}
    `;
    
    const summaryResult = await pool.query(summaryQuery, params);
    const summary = summaryResult.rows[0];
    
    // Get breakdown by development
    const developmentsQuery = `
      SELECT 
        fs.development_id,
        d.name as development_name,
        d.developer_email,
        d.developer_name,
        SUM(fs.total_sales_count) as sales_count,
        SUM(fs.developer_gross) as gross_revenue,
        SUM(fs.total_commission) as commission_deducted,
        SUM(fs.developer_net) as net_to_developer,
        SUM(fs.developer_paid_amount) as paid_amount,
        SUM(fs.developer_outstanding) as outstanding_balance,
        SUM(fs.vat_collected) as vat_component,
        SUM(fs.aos_fees_collected) as aos_fees,
        SUM(fs.cession_fees_collected) as cession_fees,
        SUM(fs.endowment_fees_collected) as endowment_fees,
        SUM(fs.total_fees_collected) as total_fees
      FROM financial_summaries fs
      JOIN developments d ON d.id = fs.development_id
      ${whereClause}
      GROUP BY fs.development_id, d.name, d.developer_email, d.developer_name
      ORDER BY SUM(fs.developer_outstanding) DESC
    `;
    
    const developmentsResult = await pool.query(developmentsQuery, params);
    
    // Format response
    const response = {
      summary: {
        development_count: parseInt(summary.development_count) || 0,
        total_sales: parseInt(summary.total_sales) || 0,
        total_sales_value: parseFloat(summary.total_sales_value) || 0,
        developer_owed_total: parseFloat(summary.developer_owed_total) || 0,
        developer_paid_total: parseFloat(summary.developer_paid_total) || 0,
        developer_outstanding_total: parseFloat(summary.developer_outstanding_total) || 0,
        vat_collected_total: parseFloat(summary.vat_collected_total) || 0,
        commissions_earned_total: parseFloat(summary.company_commissions_total) || 0,
        agent_commissions_total: parseFloat(summary.agent_commissions_total) || 0,
      },
      developments: developmentsResult.rows.map(dev => ({
        id: dev.development_id,
        name: dev.development_name,
        developer_email: dev.developer_email,
        developer_name: dev.developer_name,
        sales_count: parseInt(dev.sales_count) || 0,
        gross_revenue: parseFloat(dev.gross_revenue) || 0,
        commission_deducted: parseFloat(dev.commission_deducted) || 0,
        net_to_developer: parseFloat(dev.net_to_developer) || 0,
        paid_amount: parseFloat(dev.paid_amount) || 0,
        outstanding_balance: parseFloat(dev.outstanding_balance) || 0,
        vat_component: parseFloat(dev.vat_component) || 0,
        fees_breakdown: {
          aos: parseFloat(dev.aos_fees) || 0,
          cession: parseFloat(dev.cession_fees) || 0,
          endowment: parseFloat(dev.endowment_fees) || 0,
          total: parseFloat(dev.total_fees) || 0,
        },
      })),
      commission_breakdown: {
        agents_total: parseFloat(summary.agent_commissions_total) || 0,
        company_total: parseFloat(summary.company_commissions_total) || 0,
        total: parseFloat(summary.total_commission) || 0,
      },
      filters: {
        developmentId: developmentId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
    
    logger.info('Financial Summary API Success', {
      module: 'API',
      action: 'GET_FINANCIAL_SUMMARY',
      developmentCount: response.summary.development_count,
      totalSales: response.summary.total_sales,
      totalValue: response.summary.total_sales_value,
    });
    
    return apiSuccess(response);
    
  } catch (error: any) {
    logger.error('Financial Summary API Error', error, { module: 'API', action: 'GET_FINANCIAL_SUMMARY' });
    return apiError('Failed to fetch financial summary', 500, ErrorCodes.FETCH_ERROR, {
      details: error.message
    });
  } finally {
    await pool.end();
  }
}
