/**
 * Import Batches API
 * GET /api/admin/import/batches
 * 
 * Lists all import batches with filtering and pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (type) where.importType = type;
    if (status) where.status = status;

    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              offlineSales: true,
            },
          },
        },
      }),
      prisma.importBatch.count({ where }),
    ]);

    return NextResponse.json({
      batches: batches.map(batch => ({
        id: batch.id,
        fileName: batch.fileName,
        importType: batch.importType,
        status: batch.status,
        totalRecords: batch.totalRecords,
        processedRecords: batch.processedRecords,
        failedRecords: batch.failedRecords,
        importedBy: batch.importedBy,
        branch: batch.branch,
        salesCount: (batch as any)._count.offlineSales,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Fetch batches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}
