/**
 * Excel Import Execute API
 * POST /api/admin/import/excel/execute
 * 
 * Executes the actual import of parsed Excel data to the database.
 * Creates developers, developments, stands, offline sales, and payments.
 * 
 * This performs LIVE DATABASE WRITES - use with caution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { parseLakeCityExcel, ParseResult } from '@/lib/import/excel-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImportOptions {
  skipInvalidDates: boolean;
  allowFutureDates: boolean;
  duplicateSuffix: string;
  dryRun: boolean;
}

interface ImportCounts {
  developersCreated: number;
  developmentsCreated: number;
  standsCreated: number;
  clientsCreated: number;
  salesCreated: number;
  paymentsCreated: number;
}

interface ImportLog {
  row: number;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Import Function
// ─────────────────────────────────────────────────────────────────────────────

async function executeImport(
  parseResult: ParseResult,
  filename: string,
  userId: string,
  options: ImportOptions
): Promise<{
  batchId: string;
  counts: ImportCounts;
  logs: ImportLog[];
  errors: string[];
}> {
  const logs: ImportLog[] = [];
  const errors: string[] = [];
  const counts: ImportCounts = {
    developersCreated: 0,
    developmentsCreated: 0,
    standsCreated: 0,
    clientsCreated: 0,
    salesCreated: 0,
    paymentsCreated: 0,
  };

  const batchId = uuidv4();

  try {
    await prisma.$transaction(async (tx: any) => {
      // 1. Create ImportBatch record
      if (!options.dryRun) {
        await tx.importBatch.create({
          data: {
            id: batchId,
            fileName: filename,
            importType: 'legacy_excel',
            status: 'PROCESSING',
            totalRecords: parseResult.summary.totalTransactions,
            importedBy: userId,
            branch: 'Harare',
          },
        });
      }

      logs.push({ row: 0, type: 'batch', message: `Created import batch ${batchId}`, severity: 'info' });

      // Track created entities to avoid duplicates within this import
      const createdDevelopers = new Map<string, string>();
      const createdDevelopments = new Map<string, string>();
      const createdStands = new Map<string, string>();
      const createdClients = new Map<string, string>();

      // 2. Process each stand
      for (const stand of parseResult.stands) {
        // 2a. Get or create developer
        let developerId = createdDevelopers.get(stand.developer);
        if (!developerId) {
          const existingDev = await tx.development.findFirst({
            where: { name: { equals: stand.developer, mode: 'insensitive' } },
          });

          if (existingDev) {
            developerId = existingDev.id;
            logs.push({ row: 0, type: 'developer', message: `Found existing developer: ${stand.developer}`, severity: 'info' });
          } else if (!options.dryRun) {
            const newDev = await tx.developer.create({
              data: {
                id: uuidv4(),
                name: stand.developer,
                contactEmail: '',
                contactPhone: '',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            developerId = newDev.id;
            counts.developersCreated++;
            logs.push({ row: stand.rowIndex, type: 'developer', message: `Created developer: ${stand.developer}`, severity: 'info' });
          } else {
            developerId = `dry-run-${stand.developer}`;
          }
          if (developerId) {
            createdDevelopers.set(stand.developer, developerId);
          }
        }

        // 2b. Get or create development
        let developmentId = createdDevelopments.get(stand.development);
        if (!developmentId && developerId) {
          const existingDev = await tx.development.findFirst({
            where: { name: { equals: stand.development, mode: 'insensitive' } },
          });

          if (existingDev) {
            developmentId = existingDev.id;
            logs.push({ row: 0, type: 'development', message: `Found existing development: ${stand.development}`, severity: 'info' });
          } else if (!options.dryRun) {
            const newDev = await tx.development.create({
              data: {
                id: uuidv4(),
                name: stand.development,
                developerId: developerId,
                location: 'Zimbabwe',
                branch: 'Harare',
                basePrice: stand.priceUsd || 0,
                availableStands: 0,
                totalStands: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            developmentId = newDev.id;
            counts.developmentsCreated++;
            logs.push({ row: stand.rowIndex, type: 'development', message: `Created development: ${stand.development}`, severity: 'info' });
          } else {
            developmentId = `dry-run-${stand.development}`;
          }
          if (developmentId) {
            createdDevelopments.set(stand.development, developmentId);
          }
        }

        // 2c. Create stand
        const standKey = `${stand.development}:${stand.standNumber}`;
        let standId = createdStands.get(standKey);
        if (!standId && developmentId) {
          if (!options.dryRun) {
            const newStand = await tx.stand.create({
              data: {
                id: uuidv4(),
                standNumber: stand.standNumber,
                developmentId: developmentId,
                price: stand.priceUsd || 0,
                sizeSqm: stand.sizeSqm || 0,
                status: 'SOLD',
                agentName: stand.agentCode,
                standType: stand.standType,
                soldAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            standId = newStand.id;
            counts.standsCreated++;

            // Update development counts
            await tx.development.update({
              where: { id: developmentId },
              data: { totalStands: { increment: 1 } },
            });
          } else {
            standId = `dry-run-${standKey}`;
          }
          if (standId) {
            createdStands.set(standKey, standId);
          }
        }

        // 2d. Create sale and payments
        if (standId && !options.dryRun) {
          // Calculate totals from transactions
          const totalPayments = stand.transactions
            .filter(t => t.side === 'LEFT')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

          // Create offline sale
          const sale = await tx.offlineSale.create({
            data: {
              id: uuidv4(),
              clientId: '', // Will be linked later via assign-client
              standId: standId,
              developmentId: developmentId!,
              saleDate: new Date(),
              salePrice: stand.priceUsd || totalPayments,
              depositAmount: totalPayments,
              paymentMethod: 'TRANSFER',
              notes: `Imported from ${filename}. Agent: ${stand.agentCode || 'N/A'}. Sheet: ${stand.sheetName}`,
              importBatchId: batchId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          counts.salesCreated++;

          // Create payments
          for (const transaction of stand.transactions) {
            if (!transaction.date) continue;

            await tx.offlinePayment.create({
              data: {
                id: uuidv4(),
                offlineSaleId: sale.id,
                paymentDate: transaction.date,
                amount: transaction.amount || 0,
                paymentMethod: 'TRANSFER',
                reference: transaction.reference || `${transaction.type}-${transaction.side}`,
                notes: `${transaction.description} (${transaction.side})`,
                createdAt: new Date(),
              },
            });
            counts.paymentsCreated++;
          }
        }
      }

      // 3. Update batch status to COMPLETED
      if (!options.dryRun) {
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: 'COMPLETED',
            processedRecords: counts.salesCreated + counts.paymentsCreated,
            failedRecords: 0,
            completedAt: new Date(),
          },
        });
      }
    }, {
      maxWait: 60000,
      timeout: 120000,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
    errors.push(errorMsg);
    logs.push({ row: 0, type: 'error', message: errorMsg, severity: 'error' });

    // Update batch to FAILED
    try {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorLog: { message: errorMsg, logs } as any,
          completedAt: new Date(),
        },
      });
    } catch (batchError) {
      console.error('[Import] Failed to update batch status to FAILED:', batchError);
    }
  }

  return {
    batchId,
    counts,
    logs,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dryRun = formData.get('dryRun') === 'true';
    const skipErrors = formData.get('skipErrors') === 'true';

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

    // Read file buffer
    const bytes = await file.arrayBuffer();

    // Parse the Excel file
    const parseResult = parseLakeCityExcel(bytes);

    // Check for critical errors
    if (parseResult.stands.length === 0) {
      return NextResponse.json(
        { error: 'No valid stands found in the Excel file', warnings: parseResult.warnings },
        { status: 400 }
      );
    }

    // Execute import
    const options: ImportOptions = {
      skipInvalidDates: skipErrors,
      allowFutureDates: false,
      duplicateSuffix: '-dup',
      dryRun,
    };

    const result = await executeImport(
      parseResult,
      file.name,
      session.user.email || 'unknown',
      options
    );

    return NextResponse.json({
      success: result.errors.length === 0,
      batchId: result.batchId,
      counts: result.counts,
      logs: result.logs,
      errors: result.errors,
      summary: {
        totalStands: parseResult.summary.totalStands,
        totalTransactions: parseResult.summary.totalTransactions,
        totalCollected: parseResult.summary.totalCollected,
      },
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to import Excel file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
