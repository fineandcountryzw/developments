/**
 * POST /api/admin/legacy/reports/developers/[name]/pdf
 * Generates and returns PDF binary for developer report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDeveloperReportData, PeriodType } from '@/lib/legacy/reports/developer-report-data';
import { generateDeveloperPDF } from '@/lib/legacy/reports/developer-pdf';
import { parseISO, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['ADMIN', 'MANAGER', 'ACCOUNT'];
    const userRole = session.user.role as string;
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden', 
        message: 'Only administrators, managers, and accounts can access developer reports' 
      }, { status: 403 });
    }

    const { name: encodedName } = await params;
    const developerName = decodeURIComponent(encodedName);

    // Get request body
    const body = await request.json();
    const periodType: PeriodType = body.period || 'ALL_TIME';
    const fromParam = body.from;
    const toParam = body.to;

    // Build period
    let period: { type: PeriodType; from?: Date; to?: Date } = { type: periodType };
    if (periodType === 'CUSTOM' && fromParam && toParam) {
      const fromDate = parseISO(fromParam);
      const toDate = parseISO(toParam);
      if (!isValid(fromDate) || !isValid(toDate)) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
      period.from = fromDate;
      period.to = toDate;
    }

    // Generate report data
    const reportData = await getDeveloperReportData(developerName, period, session.user.email || 'Unknown');

    // Generate PDF
    const pdfBlob = await generateDeveloperPDF(reportData);
    const pdfBuffer = await pdfBlob.arrayBuffer();

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="FC_${developerName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${periodType}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', message: error.message },
      { status: 500 }
    );
  }
}
