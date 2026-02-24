import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/test-db
 * Test database connection and list tables
 */
export async function GET(request: NextRequest) {
  try {
    // Try to query the kanban_boards table
    const boards = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'kanban_boards'
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Database connection OK',
      kanbanBoardsTableExists: boards[0]?.count > 0
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
