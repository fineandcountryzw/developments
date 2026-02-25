/**
 * GET /api/admin/legacy/reports/developers/[name]
 * Returns full report data for one developer
 * Query params: period=ALL_TIME|THIS_MONTH|CUSTOM&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDeveloperReportData, PeriodType } from '@/lib/legacy/reports/developer-report-data';
import { parseISO, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get developer name from URL (decode it)
    const { name: encodedName } = await params;
    const developerName = decodeURIComponent(encodedName);
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const periodParam = searchParams.get('period') as PeriodType || 'ALL_TIME';
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    // Build period object
    let period: { type: PeriodType; from?: Date; to?: Date } = { type: periodParam };
    
    if (periodParam === 'CUSTOM' && fromParam && toParam) {
      const fromDate = parseISO(fromParam);
      const toDate = parseISO(toParam);
      
      if (!isValid(fromDate) || !isValid(toDate)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
      
      period.from = fromDate;
      period.to = toDate;
    }
    
    const reportData = await getDeveloperReportData(
      developerName,
      period,
      session.user.email || 'Unknown'
    );
    
    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error: any) {
    console.error('Error fetching developer report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer report', message: error.message },
      { status: 500 }
    );
  }
}
