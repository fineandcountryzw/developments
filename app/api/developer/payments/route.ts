import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/developer/payments
 * 
 * Record a payment made to a developer
 * 
 * Body:
 * - developmentId: Development ID
 * - amount: Payment amount
 * - paymentDate: Date payment was made
 * - paymentMethod: Payment method (Bank Transfer, RTGS, etc.)
 * - referenceNumber: Payment reference/transaction number
 * - periodStart: Start of period covered (optional, YYYY-MM-DD)
 * - periodEnd: End of period covered (optional, YYYY-MM-DD)
 * - saleIds: Array of sale IDs included in payment (optional)
 * - notes: Additional notes (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }
    const userEmail = session.user.email;

    const body = await request.json();
    const {
      developmentId,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber,
      periodStart,
      periodEnd,
      saleIds,
      notes,
    } = body;
    
    // Validate required fields
    if (!developmentId || !amount || !paymentDate) {
      return apiError('developmentId, amount, and paymentDate are required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    logger.info('Record Developer Payment API Request', {
      module: 'API',
      action: 'POST_DEVELOPER_PAYMENTS',
      developmentId,
      amount,
      paymentDate,
      referenceNumber: referenceNumber?.substring(0, 10) + '***',
    });
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
    }
    
    const pool = new Pool({ connectionString: databaseUrl });
    
    try {
      // Get development info
      const devQuery = `
        SELECT id, name, developer_email 
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
      
      // Generate payment ID
      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract month_year from payment date
      const monthYear = new Date(paymentDate).toISOString().slice(0, 7); // YYYY-MM
      
      // Insert payment record
      const insertQuery = `
        INSERT INTO developer_payments (
          id,
          development_id,
          developer_email,
          amount,
          payment_date,
          payment_method,
          reference_number,
          period_start,
          period_end,
          month_year,
          sale_ids,
          notes,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
        RETURNING *
      `;
      
      const result = await pool.query(insertQuery, [
        paymentId,
        developmentId,
        development.developer_email,
        amount,
        paymentDate,
        paymentMethod || null,
        referenceNumber || null,
        periodStart || null,
        periodEnd || null,
        monthYear,
        saleIds ? `{${saleIds.join(',')}}` : null,
        notes || null,
      ]);
      
      const payment = result.rows[0];
      
      // Update financial_summaries to reflect payment
      const updateSummaryQuery = `
        UPDATE financial_summaries
        SET 
          developer_paid_amount = developer_paid_amount + $1,
          developer_outstanding = developer_net - (developer_paid_amount + $1),
          updated_at = NOW()
        WHERE development_id = $2 
        AND month_year = $3
      `;
      
      await pool.query(updateSummaryQuery, [amount, developmentId, monthYear]);
      
      logger.info('Record Developer Payment API Success', {
        module: 'API',
        action: 'POST_DEVELOPER_PAYMENTS',
        paymentId,
        developmentId,
        amount,
      });
      
      return apiSuccess({
        payment: {
          id: payment.id,
          development_id: payment.development_id,
          development_name: development.name,
          amount: parseFloat(payment.amount),
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          reference_number: payment.reference_number,
          month_year: payment.month_year,
        },
      }, 201);
      
    } finally {
      await pool.end();
    }
    
  } catch (error: any) {
    logger.error('Record Developer Payment API Error', error, { module: 'API', action: 'POST_DEVELOPER_PAYMENTS' });
    return apiError('Failed to record developer payment', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * GET /api/developer/payments
 * 
 * Get payment history for the logged-in developer. Scoped by developer_email.
 * 
 * Query Parameters:
 * - developmentId: Filter by development (optional)
 * - startDate: Start date filter (YYYY-MM-DD)
 * - endDate: End date filter (YYYY-MM-DD)
 * - limit: Max rows (default 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('developmentId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
  }
  const userEmail = session.user.email;
  
  logger.info('Get Developer Payments API Request', {
    module: 'API',
    action: 'GET_DEVELOPER_PAYMENTS',
    developmentId,
    startDate,
    endDate,
    userEmail: userEmail?.slice(0, 3) + '***',
  });
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return apiError('Database not configured', 503, ErrorCodes.DB_UNAVAILABLE);
  }
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Build WHERE clause (always filter by developer_email)
    const whereConditions = [`dp.developer_email = $1`];
    const params: any[] = [userEmail];
    let paramIndex = 2;
    
    if (developmentId) {
      whereConditions.push(`dp.development_id = $${paramIndex}`);
      params.push(developmentId);
      paramIndex++;
    }
    
    if (startDate) {
      whereConditions.push(`dp.payment_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereConditions.push(`dp.payment_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    params.push(limit);
    const limitParam = paramIndex;
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const query = `
      SELECT 
        dp.id,
        dp.development_id,
        d.name as development_name,
        dp.developer_email,
        dp.amount,
        dp.payment_date,
        dp.payment_method,
        dp.reference_number,
        dp.period_start,
        dp.period_end,
        dp.month_year,
        dp.notes,
        dp.created_at
      FROM developer_payments dp
      JOIN developments d ON d.id = dp.development_id
      ${whereClause}
      ORDER BY dp.payment_date DESC
      LIMIT $${limitParam}
    `;
    
    const result = await pool.query(query, params);
    
    const payments = result.rows.map(p => ({
      id: p.id,
      development_id: p.development_id,
      development_name: p.development_name,
      developer_email: p.developer_email,
      amount: parseFloat(p.amount),
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      period_start: p.period_start,
      period_end: p.period_end,
      month_year: p.month_year,
      notes: p.notes,
      created_at: p.created_at,
    }));
    
    logger.info('Get Developer Payments API Success', {
      module: 'API',
      action: 'GET_DEVELOPER_PAYMENTS',
      paymentCount: payments.length,
    });
    
    return apiSuccess({ payments });
    
  } catch (error: any) {
    logger.error('Get Developer Payments API Error', error, { module: 'API', action: 'GET_DEVELOPER_PAYMENTS' });
    return apiError('Failed to fetch developer payments', 500, ErrorCodes.FETCH_ERROR);
  } finally {
    await pool.end();
  }
}
