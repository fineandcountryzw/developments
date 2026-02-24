/**
 * Past Sales Import API with Payments Support
 * POST /api/admin/import/past-sales
 * 
 * CSV Format:
 * Required columns: name, email, standNumber, developmentName, saleDate, salePrice, depositAmount, paymentMethod
 * Optional columns: phone, address, notes
 * 
 * Payments can be included inline or in a separate CSV:
 * Inline: paymentDate, paymentAmount, paymentReference
 * Separate payments CSV: clientEmail, standNumber, paymentDate, amount, paymentMethod, reference, notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';

interface SaleRow {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  standNumber: string;
  developmentName: string;
  saleDate: string;
  salePrice: string;
  depositAmount: string;
  paymentMethod: string;
  notes?: string;
  // Optional inline payment fields
  paymentDate?: string;
  paymentAmount?: string;
  paymentReference?: string;
}

interface PaymentRow {
  clientEmail: string;
  standNumber: string;
  developmentName: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const userId = 'test-user'; // Temporarily hardcoded user ID

    const body = await request.json();
    const { sales, payments } = body;

    // Support both unified "past-sales" body and separate specialized import bodies
    const salesToProcess = sales || (body.importType === 'stands' ? body.data : []);
    const paymentsToProcess = payments || (body.importType === 'payments' ? body.data : []);
    const clientsToProcess = body.importType === 'clients' ? body.data : [];

    if (!Array.isArray(salesToProcess) && !Array.isArray(paymentsToProcess) && !Array.isArray(clientsToProcess)) {
      return NextResponse.json({ error: 'No valid import data provided' }, { status: 400 });
    }

    const batchId = uuidv4();

    // Import results
    const results: {
      salesProcessed: number;
      salesFailed: number;
      paymentsProcessed: number;
      paymentsFailed: number;
      clientsProcessed: number;
      clientsFailed: number;
      totalAmount: number;
      depositTotal: number;
      errors: { row: number; type: string; message: string }[];
    } = {
      salesProcessed: 0,
      salesFailed: 0,
      paymentsProcessed: 0,
      paymentsFailed: 0,
      clientsProcessed: 0,
      clientsFailed: 0,
      totalAmount: 0,
      depositTotal: 0,
      errors: [],
    };

    let totalAmount = 0;
    let depositTotal = 0;

    // 1. Process Clients (if any)
    // 1. Process Clients
    if (Array.isArray(clientsToProcess)) {
      for (let i = 0; i < clientsToProcess.length; i++) {
        const row = clientsToProcess[i];

        // Validate required fields
        if (!row.name || !row.email) {
          results.clientsFailed++;
          results.errors.push({
            row: i + 1,
            type: 'client',
            message: 'Missing required fields: name, email'
          });
          continue;
        }

        const email = row.email.toString().trim().toLowerCase();

        try {
          // Check if client exists
          const existingClient = await prisma.client.findFirst({
            where: {
              email: email,
              branch: 'Harare' // Default branch for imports
            }
          });

          if (existingClient) {
            // Skip existing clients to prevent overwrites, or maybe update?
            // For now, we skip to be safe.
            results.clientsFailed++; // Not strictly a fail, but not "Processed/Created" either. 
            // Actually, let's not count as failed if it's just skipped. 
            // But let's log it or just ignore.
            // If we want to report "skipped", we might need a new counter.
            // For now, let's just ignore.
            continue;
          }

          // Map extra fields to preferences
          const preferences: any = {};
          if (row.address) preferences.address = row.address;
          if (row.city) preferences.city = row.city;
          if (row.country) preferences.country = row.country;
          if (row.notes) preferences.notes = row.notes;

          // Create new client
          await prisma.client.create({
            data: {
              id: uuidv4(),
              name: row.name.toString().trim(),
              email: email,
              phone: row.phone ? row.phone.toString().trim() : null,
              nationalId: row.nationalId ? row.nationalId.toString().trim() : null,
              branch: 'Harare',
              isProspect: true, // Imported clients are often prospects or past clients
              preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
            }
          });

          results.clientsProcessed++;

        } catch (error) {
          results.clientsFailed++;
          results.errors.push({
            row: i + 1,
            type: 'client',
            message: error instanceof Error ? error.message : 'Creation failed'
          });
        }
      }
    }

    // 2. Process Stands (Bulk Creation/Update)
    if (body.importType === 'stands' && Array.isArray(body.data)) {
      const { developmentId } = body;

      if (!developmentId) {
        return NextResponse.json({ error: 'Development context (developmentId) is required for stands import' }, { status: 400 });
      }

      for (let i = 0; i < body.data.length; i++) {
        const row = body.data[i];
        if (!row.standNumber || !row.sizeSqm) {
          results.salesFailed++;
          results.errors.push({ row: i + 1, type: 'stand', message: 'Missing standNumber or sizeSqm' });
          continue;
        }

        try {
          // Upsert stand logic
          await prisma.stand.upsert({
            where: {
              developmentId_standNumber: {
                standNumber: row.standNumber.toString().trim(),
                developmentId: developmentId
              }
            },
            update: {
              sizeSqm: parseFloat(row.sizeSqm.toString().replace(/,/g, '')) || 0,
            },
            create: {
              id: uuidv4(),
              standNumber: row.standNumber.toString().trim(),
              sizeSqm: parseFloat(row.sizeSqm.toString().replace(/,/g, '')) || 0,
              developmentId: developmentId,
              price: 0, // Required field, defaulting to 0 as per simplified import request
              status: 'AVAILABLE'
            }
          });
          results.salesProcessed++;
        } catch (error) {
          results.salesFailed++;
          results.errors.push({ row: i + 1, type: 'stand', message: error instanceof Error ? error.message : 'Upsert failed' });
        }
      }
    }

    // 2b. Process Sales/Stands (Existing logic)
    if (Array.isArray(salesToProcess) && body.importType !== 'stands') {
      for (let i = 0; i < salesToProcess.length; i++) {
        const sale = salesToProcess[i] as SaleRow;

        // Validate required fields
        if (!sale.name || !sale.email || !sale.standNumber || !sale.developmentName ||
          !sale.saleDate || !sale.salePrice || !sale.depositAmount || !sale.paymentMethod) {
          results.salesFailed++;
          results.errors.push({
            row: i + 1,
            type: 'sale',
            message: 'Missing required fields',
          });
          continue;
        }

        // Calculate amounts
        const salePrice = parseFloat(sale.salePrice.toString().replace(/,/g, '')) || 0;
        const depositAmount = parseFloat(sale.depositAmount.toString().replace(/,/g, '')) || 0;

        totalAmount += salePrice;
        depositTotal += depositAmount;

        try {
          // Find development by name
          const development = await prisma.development.findFirst({
            where: { name: { equals: sale.developmentName, mode: 'insensitive' } },
          });

          if (!development) {
            results.salesFailed++;
            results.errors.push({
              row: i + 1,
              type: 'sale',
              message: `Development not found: ${sale.developmentName}`,
            });
            continue;
          }

          // Find stand by stand number and development
          const stand = await prisma.stand.findFirst({
            where: {
              standNumber: sale.standNumber,
              developmentId: development.id,
            },
          });

          if (!stand) {
            results.salesFailed++;
            results.errors.push({
              row: i + 1,
              type: 'sale',
              message: `Stand ${sale.standNumber} not found in ${sale.developmentName}`,
            });
            continue;
          }

          // Find or create client
          let client = await prisma.client.findFirst({
            where: {
              email: sale.email,
              branch: development.branch
            },
          });

          if (!client) {
            client = await prisma.client.create({
              data: {
                id: uuidv4(),
                name: sale.name,
                email: sale.email,
                phone: sale.phone || '',
                branch: development.branch,
              },
            });
          }

          // Create import batch if it doesn't exist
          let importBatch = await prisma.importBatch.findUnique({
            where: { id: batchId },
          });

          if (!importBatch) {
            importBatch = await prisma.importBatch.create({
              data: {
                id: batchId,
                fileName: `import-${new Date().toISOString().slice(0, 10)}.csv`,
                importType: 'past_sales',
                status: 'PROCESSING',
                totalRecords: salesToProcess.length + paymentsToProcess.length,
                importedBy: userId,
                branch: development.branch,
              },
            });
          }

          // Create offline sale record
          const offlineSaleId = uuidv4();
          const offlineSale = await prisma.offlineSale.create({
            data: {
              id: offlineSaleId,
              clientId: client.id,
              standId: stand.id,
              developmentId: development.id,
              saleDate: new Date(sale.saleDate),
              salePrice: salePrice,
              depositAmount: depositAmount,
              paymentMethod: sale.paymentMethod,
              notes: sale.notes,
              importBatchId: batchId,
            },
          });

          // Create payment record if deposit is provided
          if (depositAmount > 0) {
            await prisma.offlinePayment.create({
              data: {
                id: uuidv4(),
                offlineSaleId: offlineSale.id,
                paymentDate: new Date(sale.saleDate),
                amount: depositAmount,
                paymentMethod: sale.paymentMethod,
                reference: `Deposit-${batchId.slice(0, 8)}`,
                notes: `Imported deposit for offline sale ${batchId.slice(0, 8)}`,
              },
            });
            results.paymentsProcessed++;
          }

          results.salesProcessed++;
        } catch (error) {
          results.salesFailed++;
          results.errors.push({
            row: i + 1,
            type: 'sale',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 3. Process separate payments
    if (Array.isArray(paymentsToProcess)) {
      for (let i = 0; i < paymentsToProcess.length; i++) {
        const payment = paymentsToProcess[i] as PaymentRow;

        if (!payment.clientEmail || !payment.standNumber || !payment.developmentName ||
          !payment.paymentDate || !payment.amount || !payment.paymentMethod) {
          results.paymentsFailed++;
          results.errors.push({
            row: i + 1,
            type: 'payment',
            message: 'Missing required fields (including developmentName)',
          });
          continue;
        }

        try {
          const amount = parseFloat(payment.amount.toString().replace(/,/g, '')) || 0;

          // Find development first
          const development = await prisma.development.findFirst({
            where: { name: { equals: payment.developmentName, mode: 'insensitive' } },
          });

          if (!development) {
            results.paymentsFailed++;
            results.errors.push({
              row: i + 1,
              type: 'payment',
              message: `Development not found: ${payment.developmentName}`,
            });
            continue;
          }

          // Find client by email and branch
          const client = await prisma.client.findFirst({
            where: {
              email: payment.clientEmail,
              branch: development.branch
            },
          });

          if (!client) {
            results.paymentsFailed++;
            results.errors.push({
              row: i + 1,
              type: 'payment',
              message: `Client ${payment.clientEmail} not found in branch ${development.branch}`,
            });
            continue;
          }

          // Find stand by stand number and developmentId
          const stand = await prisma.stand.findFirst({
            where: {
              standNumber: payment.standNumber,
              developmentId: development.id,
            },
          });

          if (!stand) {
            results.paymentsFailed++;
            results.errors.push({
              row: i + 1,
              type: 'payment',
              message: `Stand ${payment.standNumber} not found in ${payment.developmentName}`,
            });
            continue;
          }

          // Find or create offline sale for this payment
          let offlineSale = await prisma.offlineSale.findFirst({
            where: {
              clientId: client.id,
              standId: stand.id,
            },
          });

          if (!offlineSale) {
            // Create a minimal offline sale record
            offlineSale = await prisma.offlineSale.create({
              data: {
                id: uuidv4(),
                clientId: client.id,
                standId: stand.id,
                developmentId: development.id,
                saleDate: new Date(payment.paymentDate),
                salePrice: amount, // Use payment amount as minimal sale price
                depositAmount: amount,
                paymentMethod: payment.paymentMethod,
                importBatchId: batchId,
              },
            });
          }

          // Create offline payment record
          await prisma.offlinePayment.create({
            data: {
              id: uuidv4(),
              offlineSaleId: offlineSale.id,
              paymentDate: new Date(payment.paymentDate),
              amount: amount,
              paymentMethod: payment.paymentMethod,
              reference: payment.reference || `Payment-${batchId.slice(0, 8)}`,
              notes: payment.notes || `Imported payment ${batchId.slice(0, 8)}`,
            },
          });

          totalAmount += amount;
          results.paymentsProcessed++;
        } catch (error) {
          results.paymentsFailed++;
          results.errors.push({
            row: i + 1,
            type: 'payment',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    results.totalAmount = totalAmount;
    results.depositTotal = depositTotal;

    return NextResponse.json({
      batchId,
      processedSales: results.salesProcessed,
      failedSales: results.salesFailed,
      processedPayments: results.paymentsProcessed,
      failedPayments: results.paymentsFailed,
      processedClients: results.clientsProcessed,
      failedClients: results.clientsFailed,
      totalAmount: results.totalAmount,
      depositTotal: results.depositTotal,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    );
  }
}
