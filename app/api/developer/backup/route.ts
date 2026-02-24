import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * POST /api/developer/backup
 * Create a backup of developer data (developments, stands, payments)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }
    const userEmail = session.user.email;

    const { type = 'full' } = await request.json();
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 500, ErrorCodes.DB_UNAVAILABLE);
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const backupData: any = {
      backupDate: new Date().toISOString(),
      backupType: type,
      createdBy: session.user.email,
      version: '1.0'
    };

    if (type === 'full' || type === 'developments') {
      // Fetch all developments
      const developmentsQuery = `
        SELECT 
          d.id,
          d.name,
          d.location,
          d.status,
          d.total_stands as "totalStands",
          d.developer_email as "developerEmail",
          d.developer_name as "developerName",
          d.base_price as "basePrice",
          d.branch,
          d.created_at as "createdAt",
          d.updated_at as "updatedAt"
        FROM developments d
        WHERE d.developer_email = $1
        ORDER BY d.created_at DESC
      `;
      
      const devResult = await pool.query(developmentsQuery, [userEmail]);
      backupData.developments = devResult.rows;

      // Fetch stands for each development
      const standsQuery = `
        SELECT 
          s.id,
          s.stand_number as "standNumber",
          s.development_id as "developmentId",
          s.status,
          s.size,
          s.price,
          s.created_at as "createdAt"
        FROM stands s
        JOIN developments d ON d.id = s.development_id
        WHERE d.developer_email = $1
        ORDER BY s.development_id, s.stand_number
      `;
      
      const standsResult = await pool.query(standsQuery, [userEmail]);
      backupData.stands = standsResult.rows;
    }

    if (type === 'full' || type === 'payments') {
      // Fetch payment records
      const paymentsQuery = `
        SELECT 
          p.id,
          p.amount,
          p.payment_date as "paymentDate",
          p.payment_method as "paymentMethod",
          p.status,
          p.reference,
          p.created_at as "createdAt"
        FROM payments p
        JOIN stands s ON p.stand_id = s.id
        JOIN developments d ON d.id = s.development_id
        WHERE d.developer_email = $1
        ORDER BY p.created_at DESC
        LIMIT 1000
      `;
      
      try {
        const paymentsResult = await pool.query(paymentsQuery, [userEmail]);
        backupData.payments = paymentsResult.rows;
      } catch (err: any) {
        // Payments table might not exist or have different schema
        logger.warn('Payments query failed, using empty array', { error: err, module: 'API', action: 'POST_DEVELOPER_BACKUP' });
        backupData.payments = [];
      }

      // Fetch reservations
      const reservationsQuery = `
        SELECT 
          r.id,
          r.stand_id as "standId",
          r.client_id as "clientId",
          r.status,
          r.total_amount as "totalAmount",
          r.deposit_amount as "depositAmount",
          r.created_at as "createdAt"
        FROM reservations r
        JOIN stands s ON r.stand_id = s.id
        JOIN developments d ON d.id = s.development_id
        WHERE d.developer_email = $1
        ORDER BY r.created_at DESC
        LIMIT 1000
      `;
      
      try {
        const reservationsResult = await pool.query(reservationsQuery, [userEmail]);
        backupData.reservations = reservationsResult.rows;
      } catch (err: any) {
        logger.warn('Reservations query failed, using empty array', { error: err, module: 'API', action: 'POST_DEVELOPER_BACKUP' });
        backupData.reservations = [];
      }
    }

    await pool.end();

    // Add summary statistics
    backupData.summary = {
      totalDevelopments: backupData.developments?.length || 0,
      totalStands: backupData.stands?.length || 0,
      totalPayments: backupData.payments?.length || 0,
      totalReservations: backupData.reservations?.length || 0
    };

    logger.info('Backup API Created backup', {
      module: 'API',
      action: 'POST_DEVELOPER_BACKUP',
      type,
      developments: backupData.summary.totalDevelopments,
      stands: backupData.summary.totalStands,
      payments: backupData.summary.totalPayments
    });

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(backupData, null, 2);
    
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${type}-${new Date().toISOString().split('T')[0]}.json"`
      }
    });

  } catch (error: any) {
    logger.error('Backup API Error', error, { module: 'API', action: 'POST_DEVELOPER_BACKUP' });
    return apiError(error.message || 'Failed to create backup', 500, ErrorCodes.CREATE_ERROR);
  }
}
