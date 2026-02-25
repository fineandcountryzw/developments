/**
 * POST /api/admin/legacy/reports/developers/[name]/email
 * Emails report to developer's email address
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDeveloperReportData, PeriodType } from '@/lib/legacy/reports/developer-report-data';
import { generateDeveloperPDF } from '@/lib/legacy/reports/developer-pdf';
import { generateDeveloperExcel } from '@/lib/legacy/reports/developer-excel';
import { sendDeveloperReportEmail, isValidEmail, getDeveloperEmail } from '@/lib/legacy/reports/developer-email';
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
    const toEmail: string | undefined = body.to;
    const customMessage: string | undefined = body.message;
    const includePDF: boolean = body.includePDF !== false;
    const includeExcel: boolean = body.includeExcel !== false;

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

    // Determine recipient email
    const recipientEmail = toEmail || getDeveloperEmail(reportData);
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No email address found for this developer. Please provide an email address.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Generate attachments
    let pdfBuffer: ArrayBuffer | undefined;
    let excelBuffer: ArrayBuffer | undefined;

    if (includePDF) {
      const pdfBlob = await generateDeveloperPDF(reportData);
      pdfBuffer = await pdfBlob.arrayBuffer();
    }

    if (includeExcel) {
      excelBuffer = generateDeveloperExcel(reportData);
    }

    // Send email
    const result = await sendDeveloperReportEmail({
      to: recipientEmail,
      developerName,
      data: reportData,
      periodType,
      customMessage,
      includePDF,
      includeExcel,
      pdfBuffer,
      excelBuffer,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send email', message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Report emailed successfully to ${recipientEmail}`,
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error('Error emailing report:', error);
    return NextResponse.json(
      { error: 'Failed to email report', message: error.message },
      { status: 500 }
    );
  }
}
