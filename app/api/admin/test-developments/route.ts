/**
 * Test endpoint to verify database connection and developments count
 * GET /api/admin/test-developments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db-pool';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    logger.info('Test developments endpoint called', { module: 'API' });
    
    // Get database pool
    const pool = getDbPool();
    
    // Test 1: Simple connection test
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    logger.info('Database connection test passed', { 
      module: 'API',
      currentTime: connectionTest.rows[0]?.current_time 
    });
    
    // Test 2: Count all developments
    const countResult = await pool.query('SELECT COUNT(*) as count FROM developments');
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);
    logger.info('Developments count query', { 
      module: 'API',
      totalCount 
    });
    
    // Test 3: Get all developments with basic info
    const allDevs = await pool.query(`
      SELECT 
        id, 
        name, 
        COALESCE(branch, 'Harare') as branch,
        COALESCE(status, 'Active') as status,
        created_at
      FROM developments 
      ORDER BY created_at DESC
    `);
    
    logger.info('Fetched all developments', { 
      module: 'API',
      count: allDevs.rows.length,
      sampleIds: allDevs.rows.slice(0, 5).map(r => ({ 
        id: r.id, 
        name: r.name, 
        branch: r.branch, 
        status: r.status 
      }))
    });
    
    return NextResponse.json({
      success: true,
      connection: 'OK',
      totalCount,
      developments: allDevs.rows,
      message: `Found ${totalCount} development(s) in database`
    });
    
  } catch (error: any) {
    logger.error('Test endpoint error', error, { module: 'API' });
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
