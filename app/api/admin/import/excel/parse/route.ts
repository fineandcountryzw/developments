/**
 * Excel Parse API
 * POST /api/admin/import/excel/parse
 * 
 * Accepts an Excel file (.xlsx), parses it using the LakeCity ledger parser,
 * and returns the parsed data with validation results.
 * 
 * This is a DRY RUN - no database writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { parseLakeCityExcel, convertToImportFormat } from '@/lib/import/excel-parser';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx and .xls files are supported.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();

    // Parse the Excel file
    const parseResult = parseLakeCityExcel(bytes);

    // Convert to import format
    const importFormat = convertToImportFormat(parseResult);

    // Generate parse ID for tracking
    const parseId = `parse_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Build response with all details
    const response = {
      success: true,
      parseId,
      fileName: file.name,
      summary: {
        totalSheets: parseResult.summary.totalSheets,
        totalStands: parseResult.summary.totalStands,
        totalTransactions: parseResult.summary.totalTransactions,
        totalCollected: parseResult.summary.totalCollected,
      },
      developers: importFormat.developers,
      developments: importFormat.developments.map(d => ({
        name: d.name,
        standCount: d.standCount,
      })),
      stands: importFormat.stands.map(s => ({
        sheetName: s.sheetName,
        developer: s.developer,
        development: s.development,
        standNumber: s.standNumber,
        standType: s.standType,
        sizeSqm: s.sizeSqm,
        priceUsd: s.priceUsd,
        agentCode: s.agentCode,
        transactionCount: s.transactions.length,
        transactions: s.transactions.map(t => ({
          date: t.date ? t.date.toISOString() : null,
          description: t.description,
          reference: t.reference,
          amount: t.amount,
          type: t.type,
          side: t.side,
        })),
      })),
      validationIssues: {
        warnings: parseResult.warnings,
        skipped: parseResult.skipped,
      },
      errors: [],
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Excel parse error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to parse Excel file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
