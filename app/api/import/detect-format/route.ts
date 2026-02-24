/**
 * Format Detection API
 * POST /api/import/detect-format
 * 
 * Detects the format of an uploaded file:
 * - LAKECITY_LEDGER: Excel with ledger-style blocks
 * - FLAT_CSV: Standard CSV file
 * - FLAT_EXCEL: Standard Excel table
 * - UNKNOWN: Cannot determine format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { detectFileFormat, parseLakeCityExcel } from '@/lib/import/excel-parser';
import * as XLSX from 'xlsx';

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

    // Read file buffer
    const bytes = await file.arrayBuffer();

    // Detect format
    const format = detectFileFormat(bytes, file.name);

    // Build response based on format
    const response: any = {
      format,
      fileName: file.name,
      fileSize: file.size,
    };

    if (format === 'LAKECITY_LEDGER') {
      // Parse to get sheet details
      const parseResult = parseLakeCityExcel(bytes);
      
      response.sheets = parseResult.summary.totalSheets;
      response.standCount = parseResult.summary.totalStands;
      response.detectedSheets = parseResult.stands.reduce((acc: any[], stand) => {
        // Only add unique sheet entries
        const existing = acc.find(s => s.name === stand.sheetName);
        if (!existing) {
          acc.push({
            name: stand.sheetName,
            developer: stand.developer,
            development: stand.development,
          });
        }
        return acc;
      }, []);
      response.totalCollected = parseResult.summary.totalCollected;
      response.warnings = parseResult.warnings;
    } else if (format === 'FLAT_EXCEL') {
      // Get basic Excel info
      const workbook = XLSX.read(bytes, { type: 'array' });
      response.sheets = workbook.SheetNames;
      response.sheetCount = workbook.SheetNames.length;
      
      // Get row/column count from first sheet
      if (workbook.SheetNames.length > 0) {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        response.rowCount = data.length;
        response.columnCount = data.length > 0 ? (data[0] as any[]).length : 0;
      }
    } else if (format === 'FLAT_CSV') {
      // Get basic CSV info
      const text = new TextDecoder().decode(bytes);
      const lines = text.split('\n').filter(line => line.trim());
      response.rowCount = lines.length;
      response.columnCount = lines.length > 0 ? lines[0].split(',').length : 0;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Format detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect format', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
