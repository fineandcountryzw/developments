import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import {
  getStandsWithFinancials,
  getStandsStatistics,
} from '@/lib/services/stands-financial-service';

/**
 * GET /api/admin/stands-financial
 * Admin Financial View - Full access to all stands with centralized calculations
 * 
 * This endpoint uses the shared financial service to ensure consistency
 * with Account, Manager, and Developer dashboards.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Admin sees everything
    const stands = await getStandsWithFinancials({
      branch: branch || undefined,
      status: status || undefined,
      search: search || undefined,
    });

    const stats = await getStandsStatistics({
      branch: branch || undefined,
    });

    console.log(`[admin-stands-financial] Returning ${stands.length} stands with stats:`, stats);

    return NextResponse.json({
      success: true,
      stands,
      stats,
      role: 'admin',
      scope: 'all_developments',
    });
  } catch (error) {
    console.error('Error fetching admin stands financial:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stands' },
      { status: 500 }
    );
  }
}
