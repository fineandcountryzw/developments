/**
 * GET /api/admin/legacy/reports/developers
 * Returns list of all developers with basic stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllDevelopers } from '@/lib/legacy/reports/developer-report-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin, manager, and account roles can access reports
    const allowedRoles = ['ADMIN', 'MANAGER', 'ACCOUNT'];
    const userRole = session.user.role as string;
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden', 
        message: 'Only administrators, managers, and accounts can access developer reports' 
      }, { status: 403 });
    }

    const developers = await getAllDevelopers();
    
    return NextResponse.json({
      success: true,
      developers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching developer list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer list', message: error.message },
      { status: 500 }
    );
  }
}
