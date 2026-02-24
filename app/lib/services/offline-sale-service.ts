/**
 * Offline Sale Service
 * Handles offline sale CRUD operations
 */

import prisma from '@/lib/prisma';

export interface CreateOfflineSaleInput {
  standId: string;
  clientId: string;
  importBatchId?: string;
  saleDate: string;
  salePrice: string;
  depositAmount: string;
  paymentMethod: string;
  notes?: string;
}

export const createOfflineSale = async (input: CreateOfflineSaleInput) => {
  if (!prisma) throw new Error('Database not connected');

  const sale = await prisma.offlineSale.create({
    data: {
      standId: input.standId,
      clientId: input.clientId,
      importBatchId: input.importBatchId,
      saleDate: new Date(input.saleDate),
      salePrice: parseFloat(input.salePrice.replace(/,/g, '')),
      depositAmount: parseFloat(input.depositAmount.replace(/,/g, '')),
      paymentMethod: input.paymentMethod.toLowerCase(),
      notes: input.notes,
    },
    include: {
      stand: {
        include: { development: true },
      },
      client: true,
    },
  });

  return sale;
};

export const getOfflineSaleById = async (id: string) => {
  if (!prisma) throw new Error('Database not connected');
  return prisma.offlineSale.findUnique({
    where: { id },
    include: {
      stand: {
        include: { development: true },
      },
      client: true,
      importBatch: true,
    },
  });
};

export const getOfflineSalesByBatch = async (batchId: string) => {
  if (!prisma) throw new Error('Database not connected');
  return prisma.offlineSale.findMany({
    where: { importBatchId: batchId },
    include: {
      stand: {
        include: { development: true },
      },
      client: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getAllOfflineSales = async (limit = 50, offset = 0) => {
  if (!prisma) throw new Error('Database not connected');
  const [sales, total] = await Promise.all([
    prisma.offlineSale.findMany({
      include: {
        stand: {
          include: { development: true },
        },
        client: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.offlineSale.count(),
  ]);

  return { sales, total };
};
