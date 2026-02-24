#!/usr/bin/env node

/**
 * Backfill script to sync existing offline payments to main payment table
 * This fixes the issue where payments for past sales were not appearing in the billing module
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Create Prisma client with same configuration as the project
function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('DATABASE_URL is not set');
    connectionString = "postgresql://localhost:5432/placeholder_missing_env";
  }

  const adapter = new PrismaNeon({ connectionString });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"] 
      : ["error"],
  });

  console.debug('Prisma client created with Neon adapter');
  return client;
}

const prisma = createPrismaClient();

async function backfillOfflinePayments() {
  try {
    console.log('Starting backfill of offline payments...');

    // Get all offline payments
    const offlinePayments = await prisma.offlinePayment.findMany({
      include: {
        offlineSale: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    console.log(`Found ${offlinePayments.length} offline payments to backfill`);

    let successCount = 0;
    let errorCount = 0;

    for (const offlinePayment of offlinePayments) {
      try {
        const { offlineSale, ...paymentData } = offlinePayment;

        // Check if payment already exists in main payment table
        const existingPayment = await prisma.payment.findFirst({
          where: {
            reference: paymentData.reference || `OP-${paymentData.id.slice(0, 8)}`,
          },
        });

        if (existingPayment) {
          console.log(`Payment ${paymentData.id} already exists in main table, skipping...`);
          continue;
        }

        // Create payment in main payment table
        await prisma.payment.create({
          data: {
            clientId: offlineSale.clientId,
            clientName: offlineSale.client.name,
            amount: paymentData.amount,
            method: paymentData.paymentMethod.toLowerCase(),
            paymentType: 'Installment',
            officeLocation: 'Harare', // Default location
            reference: paymentData.reference || `OP-${paymentData.id.slice(0, 8)}`,
            manualReceiptNo: `OP-${paymentData.id.slice(0, 8)}`,
            description: `Offline Payment - ${paymentData.reference || paymentData.id.slice(0, 8)}`,
            status: 'COMPLETED',
            verificationStatus: 'Verified',
            standId: offlineSale.standId,
            developmentId: offlineSale.developmentId,
            confirmedAt: new Date(),
            receivedByName: 'System',
          },
        });

        successCount++;
        console.log(`Successfully synced payment: ${paymentData.id}`);
      } catch (error) {
        errorCount++;
        console.error(`Error syncing payment ${offlinePayment.id}:`, error);
      }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Successfully synced: ${successCount} payments`);
    console.log(`Failed to sync: ${errorCount} payments`);

  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillOfflinePayments();