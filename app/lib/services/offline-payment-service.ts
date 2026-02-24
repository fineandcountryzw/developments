/**
 * Offline Payment Service
 * Handles offline payment CRUD operations for past sales
 */

import prisma from '@/lib/prisma';

export interface CreateOfflinePaymentInput {
  offlineSaleId: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export const createOfflinePayment = async (input: CreateOfflinePaymentInput) => {
  if (!prisma) throw new Error('Database not connected');

  // First, get the offline sale to get client and stand information
  const offlineSale = await prisma.offlineSale.findUnique({
    where: { id: input.offlineSaleId },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  if (!offlineSale) {
    throw new Error('Offline sale not found');
  }

  const payment = await prisma.offlinePayment.create({
    data: {
      offlineSaleId: input.offlineSaleId,
      paymentDate: new Date(input.paymentDate),
      amount: parseFloat(input.amount.replace(/,/g, '')),
      paymentMethod: input.paymentMethod.toLowerCase(),
      reference: input.reference,
      notes: input.notes,
    },
  });

  // Sync to main Payment Ledger (Billing)
  await prisma.payment.create({
    data: {
      clientId: offlineSale.clientId,
      clientName: offlineSale.client?.name || 'Unknown',
      amount: parseFloat(input.amount.replace(/,/g, '')),
      method: input.paymentMethod.toLowerCase(),
      paymentType: 'Installment',
      officeLocation: 'Harare', // Default location, can be updated if offlineSale has branch info
      reference: input.reference || `OP-${payment.id.slice(0, 8)}`,
      manualReceiptNo: `OP-${payment.id.slice(0, 8)}`,
      description: `Offline Payment - ${input.reference || payment.id.slice(0, 8)}`,
      status: 'COMPLETED',
      verificationStatus: 'Verified',
      standId: offlineSale.standId,
      developmentId: offlineSale.developmentId,
      confirmedAt: new Date(),
      receivedByName: 'System',
    },
  });

  return payment;
};

export const createMultiplePayments = async (inputs: CreateOfflinePaymentInput[]) => {
  if (!prisma) throw new Error('Database not connected');

  const payments = await Promise.all(
    inputs.map(input => createOfflinePayment(input))
  );

  return payments;
};

export const getPaymentsBySaleId = async (saleId: string) => {
  if (!prisma) throw new Error('Database not connected');

  return prisma.offlinePayment.findMany({
    where: { offlineSaleId: saleId },
    orderBy: { paymentDate: 'asc' },
  });
};

export const deletePayment = async (paymentId: string) => {
  if (!prisma) throw new Error('Database not connected');

  return prisma.offlinePayment.delete({
    where: { id: paymentId },
  });
};

export const getPaymentTotalBySaleId = async (saleId: string): Promise<number> => {
  if (!prisma) throw new Error('Database not connected');

  const payments = await prisma.offlinePayment.findMany({
    where: { offlineSaleId: saleId },
    select: { amount: true },
  });

  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
};
