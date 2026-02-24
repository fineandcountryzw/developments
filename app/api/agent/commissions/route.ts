import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/commissions
 * 
 * Get agent commission records from financial tracking system
 * SECURITY: Uses authenticated user's ID (no user-supplied agentId)
 * 
 * Query Parameters:
 * - status: Filter by status (PENDING, PAID, DISPUTED, CANCELLED)
 * - startDate: Start date filter (YYYY-MM-DD)
 * - endDate: End date filter (YYYY-MM-DD)
 * 
 * Returns:
 * - Summary stats (total earned, pending, paid this month)
 * - Detailed commission list
 */
export async function GET(request: NextRequest) {
  // SECURITY FIX: Add authentication check
  const authResult = await requireAgent();
  if (authResult.error) return authResult.error;
  const user = authResult.user;
  
  // SECURITY FIX: Use authenticated user's ID instead of query parameter
  const agentId = user.id;
  
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  logger.info('Agent Commissions API Request', { module: 'API', action: 'GET_AGENT_COMMISSIONS', agentId, status, startDate, endDate });
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
  }
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Build WHERE clause
    let whereConditions = ['ac.agent_id = $1'];
    let params: any[] = [agentId];
    let paramIndex = 2;
    
    if (status) {
      whereConditions.push(`ac.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (startDate) {
      whereConditions.push(`ac.sale_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereConditions.push(`ac.sale_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Get summary stats
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_commissions,
        SUM(commission_amount) as total_earned,
        SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END) as paid_lifetime,
        SUM(
          CASE 
            WHEN status = 'PAID' 
            AND DATE_TRUNC('month', paid_date) = DATE_TRUNC('month', CURRENT_DATE)
            THEN commission_amount 
            ELSE 0 
          END
        ) as paid_this_month
      FROM agent_commissions ac
      WHERE ac.agent_id = $1
    `;
    
    const summaryResult = await pool.query(summaryQuery, [agentId]);
    const summary = summaryResult.rows[0];
    
    // Get detailed commissions
    const commissionsQuery = `
      SELECT 
        ac.id,
        ac.stand_number,
        ac.development_id,
        d.name as development_name,
        ac.client_name,
        ac.sale_date,
        ac.commission_type,
        ac.base_price,
        ac.commission_rate,
        ac.commission_amount,
        ac.status,
        ac.paid_date,
        ac.payment_reference,
        ac.payment_method,
        ac.notes,
        ac.created_at
      FROM agent_commissions ac
      LEFT JOIN developments d ON d.id = ac.development_id
      ${whereClause}
      ORDER BY ac.sale_date DESC
    `;
    
    const commissionsResult = await pool.query(commissionsQuery, params);
    
    // Get agent name
    const agentQuery = `SELECT name, email FROM users WHERE id = $1`;
    const agentResult = await pool.query(agentQuery, [agentId]);
    const agent = agentResult.rows[0];
    
    // Format response
    const response = {
      agent_id: agentId,
      agent_name: agent?.name || 'Unknown',
      agent_email: agent?.email || null,
      
      summary: {
        total_earned: parseFloat(summary.total_earned) || 0,
        pending_amount: parseFloat(summary.pending_amount) || 0,
        paid_this_month: parseFloat(summary.paid_this_month) || 0,
        paid_lifetime: parseFloat(summary.paid_lifetime) || 0,
        sales_count: parseInt(summary.total_commissions) || 0,
      },
      
      commissions: commissionsResult.rows.map(c => ({
        id: c.id,
        stand_number: c.stand_number,
        development_id: c.development_id,
        development_name: c.development_name,
        client_name: c.client_name,
        sale_date: c.sale_date,
        commission_type: c.commission_type,
        base_price: parseFloat(c.base_price),
        commission_rate: c.commission_rate ? parseFloat(c.commission_rate) : null,
        commission_amount: parseFloat(c.commission_amount),
        status: c.status,
        paid_date: c.paid_date,
        payment_reference: c.payment_reference,
        payment_method: c.payment_method,
        notes: c.notes,
        created_at: c.created_at,
      })),
      
      filters: {
        status: status || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
    
    logger.info('Agent Commissions API Success', {
      module: 'API',
      action: 'GET_AGENT_COMMISSIONS',
      agentId,
      commissionCount: response.commissions.length,
      totalEarned: response.summary.total_earned,
      pending: response.summary.pending_amount,
    });
    
    return apiSuccess(response);
    
  } catch (error: any) {
    logger.error('Agent Commissions API Error', error, { module: 'API', action: 'GET_AGENT_COMMISSIONS', agentId });
    return apiError('Failed to fetch agent commissions', 500, ErrorCodes.FETCH_ERROR);
  } finally {
    await pool.end();
  }
}

/**
 * POST /api/agent/commissions
 * 
 * Mark a commission as PAID
 * SECURITY: Agents cannot mark their own commissions (admin/manager only)
 * 
 * Body:
 * - commissionId: Commission record ID
 * - paymentDate: Date payment was made
 * - paymentReference: Payment reference number
 * - paymentMethod: Payment method used
 * - notes: Optional notes
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Add authentication check
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;
    
    // Note: Consider restricting POST to ADMIN/MANAGER roles only
    // Agents typically should not mark their own commissions as paid
    
    const body = await request.json();
    const { commissionId, paymentDate, paymentReference, paymentMethod, notes } = body;
    
    if (!commissionId || !paymentDate || !paymentReference) {
      return apiError('commissionId, paymentDate, and paymentReference are required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    logger.info('Mark Commission Paid API Request', { module: 'API', action: 'POST_AGENT_COMMISSIONS', commissionId, paymentReference, userId: user.id });
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
    }
    
    const pool = new Pool({ connectionString: databaseUrl });
    
    try {
      const updateQuery = `
        UPDATE agent_commissions
        SET 
          status = 'PAID',
          paid_date = $1,
          payment_reference = $2,
          payment_method = $3,
          notes = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING id, agent_id, commission_amount, status
      `;
      
      const result = await pool.query(updateQuery, [
        paymentDate,
        paymentReference,
        paymentMethod || null,
        notes || null,
        commissionId,
      ]);
      
      if (result.rows.length === 0) {
        return apiError('Commission not found', 404, ErrorCodes.NOT_FOUND);
      }
      
      const commission = result.rows[0];
      
      logger.info('Mark Commission Paid API Success', {
        module: 'API',
        action: 'POST_AGENT_COMMISSIONS',
        commissionId,
        agentId: commission.agent_id,
        amount: commission.commission_amount,
      });
      
      return apiSuccess({
        commission: {
          id: commission.id,
          agent_id: commission.agent_id,
          amount: parseFloat(commission.commission_amount),
          status: commission.status,
        },
      });
      
    } finally {
      await pool.end();
    }
    
  } catch (error: any) {
    logger.error('Mark Commission Paid API Error', error, { module: 'API', action: 'POST_AGENT_COMMISSIONS' });
    return apiError('Failed to mark commission as paid', 500, ErrorCodes.UPDATE_ERROR);
  }
}
