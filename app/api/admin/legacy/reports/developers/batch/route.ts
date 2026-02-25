/**
 * POST /api/admin/legacy/reports/developers/batch
 * Generate reports for multiple or all developers at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllDevelopers, getDeveloperReportData, PeriodType } from '@/lib/legacy/reports/developer-report-data';
import { generateDeveloperPDF } from '@/lib/legacy/reports/developer-pdf';
import { generateDeveloperExcel } from '@/lib/legacy/reports/developer-excel';
import { sendDeveloperReportEmail, isValidEmail } from '@/lib/legacy/reports/developer-email';
import { parseISO, isValid } from 'date-fns';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // Get request body
    const body = await request.json();
    const developerNames: string[] | undefined = body.developers;
    const format: 'PDF' | 'EXCEL' | 'BOTH' = body.format || 'BOTH';
    const periodType: PeriodType = body.period || 'ALL_TIME';
    const fromParam = body.from;
    const toParam = body.to;
    const emailDirect: boolean = body.emailDirect || false;

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

    // Get list of developers to process
    let developersToProcess: string[];
    if (developerNames && developerNames.length > 0) {
      developersToProcess = developerNames;
    } else {
      // Get all developers
      const allDevelopers = await getAllDevelopers();
      developersToProcess = allDevelopers.map(d => d.name);
    }

    if (developersToProcess.length === 0) {
      return NextResponse.json({ error: 'No developers found' }, { status: 404 });
    }

    // Process each developer
    const results = {
      generated: 0,
      emailed: 0,
      failed: 0,
      errors: [] as string[],
      files: [] as { name: string; buffer: ArrayBuffer }[],
    };

    for (const developerName of developersToProcess) {
      try {
        // Generate report data
        const reportData = await getDeveloperReportData(developerName, period, session.user.email || 'Unknown');

        // Generate files based on format
        if (format === 'PDF' || format === 'BOTH') {
          const pdfBlob = await generateDeveloperPDF(reportData);
          const pdfBuffer = await pdfBlob.arrayBuffer();
          
          if (emailDirect && reportData.developerEmail && isValidEmail(reportData.developerEmail)) {
            // Email directly
            const emailResult = await sendDeveloperReportEmail({
              to: reportData.developerEmail,
              developerName,
              data: reportData,
              periodType,
              includePDF: true,
              includeExcel: false,
              pdfBuffer,
            });
            if (emailResult.success) {
              results.emailed++;
            } else {
              results.errors.push(`${developerName}: ${emailResult.error}`);
            }
          } else {
            // Add to ZIP
            results.files.push({
              name: `FC_${developerName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${periodType}_${new Date().toISOString().split('T')[0]}.pdf`,
              buffer: pdfBuffer,
            });
          }
        }

        if (format === 'EXCEL' || format === 'BOTH') {
          const excelBuffer = generateDeveloperExcel(reportData);
          
          if (emailDirect && reportData.developerEmail && isValidEmail(reportData.developerEmail) && format === 'EXCEL') {
            // Email directly
            const emailResult = await sendDeveloperReportEmail({
              to: reportData.developerEmail,
              developerName,
              data: reportData,
              periodType,
              includePDF: false,
              includeExcel: true,
              excelBuffer,
            });
            if (emailResult.success) {
              results.emailed++;
            } else {
              results.errors.push(`${developerName}: ${emailResult.error}`);
            }
          } else if (!emailDirect || format === 'BOTH') {
            // Add to ZIP
            results.files.push({
              name: `FC_${developerName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${periodType}_${new Date().toISOString().split('T')[0]}.xlsx`,
              buffer: excelBuffer,
            });
          }
        }

        results.generated++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${developerName}: ${error.message}`);
      }
    }

    // If we have files to return as ZIP
    if (results.files.length > 0) {
      const zip = new JSZip();
      results.files.forEach(file => {
        zip.file(file.name, file.buffer);
      });
      
      const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="FC_DeveloperReports_${periodType}_${new Date().toISOString().split('T')[0]}.zip"`,
        },
      });
    }

    // Return summary if only emailing
    return NextResponse.json({
      success: true,
      summary: {
        total: developersToProcess.length,
        generated: results.generated,
        emailed: results.emailed,
        failed: results.failed,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error: any) {
    console.error('Error in batch report generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate batch reports', message: error.message },
      { status: 500 }
    );
  }
}
