/**
 * Import Batch Service
 * Handles import batch tracking
 */

import prisma from '@/lib/prisma';

export interface CreateImportBatchInput {
  fileName: string;
  totalRecords: number;
  importedBy: string;
  importType: string;
}

export const createImportBatch = async (input: CreateImportBatchInput) => {
  if (!prisma) throw new Error('Database not connected');

  const batch = await prisma.importBatch.create({
    data: {
      fileName: input.fileName,
      totalRecords: input.totalRecords,
      processedRecords: 0,
      failedRecords: 0,
      status: 'pending',
      importedBy: input.importedBy,
      importType: input.importType,
    },
  });

  return batch;
};

export const updateImportBatch = async (
  id: string,
  updates: { processedRecords?: number; failedRecords?: number; status?: string }
) => {
  if (!prisma) throw new Error('Database not connected');

  return prisma.importBatch.update({
    where: { id },
    data: {
      ...updates,

    },
  });
};

export const getImportBatchById = async (id: string) => {
  if (!prisma) throw new Error('Database not connected');
  return prisma.importBatch.findUnique({
    where: { id },
    include: {
      _count: {
        select: { offlineSales: true },
      },
    },
  });
};

export const getAllImportBatches = async (limit = 20, offset = 0) => {
  if (!prisma) throw new Error('Database not connected');

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.importBatch.count(),
  ]);

  return { batches, total };
};
