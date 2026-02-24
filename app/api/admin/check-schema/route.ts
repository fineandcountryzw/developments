import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/check-schema
 * Check kanban_boards table columns
 */
export async function GET(_request: NextRequest) {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'kanban_boards'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      columns: result
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
