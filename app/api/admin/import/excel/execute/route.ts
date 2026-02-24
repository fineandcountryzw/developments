/**
 * Excel Import Execute API (Live Import)
 * POST /api/admin/import/excel/execute
 * 
 * Executes the import of parsed Excel data to the database.
 * Handles all edge cases: duplicates, invalid dates, missing agents, future dates.
 * 
 * Adjustments per requirements:
 * 1. DUPLICATE STAND 343: Keep both, differentiate by appending sheet name
 * 2. INVALID DATES: Skip and log, don't fail
 * 3. MISSING AGENT CODES: Set to NULL, don't block
 * 4. FUTURE DATE: Import as-is (2026-09-01)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { parseLakeCityExcel, convertToImportFormat, ExcelParseResult } from '@/lib/import/excel-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImportOptions {
  skipInvalidDates: boolean;
  allowFutureDates: boolean;
  duplicateSuffix: string;
  dryRun: boolean;
}

interface ImportLog {
  row: number;
  type: 'stand' | 'transaction' | 'client' | 'sale' | 'payment';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

interface ImportCounts {
  developersCreated: number;
  developmentsCreated: number;
  standsCreated: number;
  clientsCreated: number;
  salesCreated: number;
  paymentsCreated: number;
  transactionsSkipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function parseAmount(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(String(value).replace(/[$,\s]/g, '')) || 0;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  // Handle Excel serial dates
  if (typeof value === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = value - 2;
    return new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  }
  
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function isValidDate(value: any): boolean {
  if (!value) return false;
  const date = parseDate(value);
  return date !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Import Function
// ─────────────────────────────────────────────────────────────────────────────

async function executeImport(
  parseResult: ExcelParseResult,
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
    transactionsSkipped: 0,
  };

  const batchId = uuidv4();

  // Track created entities to avoid duplicates within this import
  const createdDevelopers = new Map<string, string>(); // name -> id
  const createdDevelopments = new Map<string, string>(); // name -> id
  const createdStands = new Map<string, string>(); // composite key -> id
  const createdClients = new Map<string, string>(); // email+branch -> id

  // Track duplicate stand numbers for renaming
  const standNumberOccurrences = new Map<string, number>();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create ImportBatch record
      await tx.importBatch.create({
        data: {
          id: batchId,
          fileName: parseResult.fileName,
          importType: 'legacy_excel',
          status: 'PROCESSING',
          totalRecords: parseResult.globalSummary.totalTransactions,
          importedBy: userId,
          branch: 'Harare',
        },
      });

      logs.push({ row: 0, type: 'stand', message: `Created import batch ${batchId}`, severity: 'info' });

      // 2. Process each sheet
      for (const sheet of parseResult.sheets) {
        logs.push({ row: 0, type: 'stand', message: `Processing sheet: ${sheet.sheetName}`, severity: 'info' });

        // 2a. Get or create developer
        let developerId = createdDevelopers.get(sheet.developerName);
        if (!developerId) {
          const existingDev = await tx.developer.findFirst({
            where: { name: { equals: sheet.developerName, mode: 'insensitive' } },
          });

          if (existingDev) {
            developerId = existingDev.id;
            logs.push({ row: 0, type: 'stand', message: `Found existing developer: ${sheet.developerName}`, severity: 'info' });
          } else {
            if (!options.dryRun) {
              const newDev = await tx.developer.create({
                data: {
                  id: uuidv4(),
                  name: sheet.developerName,
                  contactEmail: '',
                  contactPhone: '',
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              developerId = newDev.id;
              counts.developersCreated++;
            } else {
              developerId = `dry-run-${sheet.developerName}`;
            }
            createdDevelopers.set(sheet.developerName, developerId);
            logs.push({ row: 0, type: 'stand', message: `Created developer: ${sheet.developerName}`, severity: 'info' });
          }
        }

        // 2b. Get or create development
        let developmentId = createdDevelopments.get(sheet.developmentName);
        if (!developmentId) {
          const existingDev = await tx.development.findFirst({
            where: { name: { equals: sheet.developmentName, mode: 'insensitive' } },
          });

          if (existingDev) {
            developmentId = existingDev.id;
            logs.push({ row: 0, type: 'stand', message: `Found existing development: ${sheet.developmentName}`, severity: 'info' });
          } else {
            if (!options.dryRun) {
              const newDev = await tx.development.create({
                data: {
                  id: uuidv4(),
                  name: sheet.developmentName,
                  developerId: developerId,
                  location: 'Zimbabwe',
                  branch: 'Harare',
                  basePrice: sheet.priceTier,
                  availableStands: 0, // Will be updated as we create stands
                  totalStands: 0,
                  vatEnabled: true,
                  vatPercentage: 15.5,
                  depositPercentage: 10,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              developmentId = newDev.id;
              counts.developmentsCreated++;
            } else {
              developmentId = `dry-run-${sheet.developmentName}`;
            }
            createdDevelopments.set(sheet.developmentName, developmentId);
            logs.push({ row: 0, type: 'stand', message: `Created development: ${sheet.developmentName}`, severity: 'info' });
          }
        }

        // 2c. Process stands
        for (const stand of sheet.stands) {
          // Handle duplicate stands by appending sheet name
          let standNumber = stand.standNumber;
          const standKey = `${sheet.developmentName}:${stand.standNumber}`;
          
          if (stand.isDuplicate) {
            standNumber = `${stand.standNumber}-${sheet.sheetName}`;
            logs.push({
              row: stand.transactions[0]?.rowIndex || 0,
              type: 'stand',
              message: `Renamed duplicate stand ${stand.standNumber} to ${standNumber}`,
              severity: 'warning',
            });
          }

          // Check if stand already exists
          let standId = createdStands.get(standKey);
          if (!standId) {
            const existingStand = await tx.stand.findFirst({
              where: {
                standNumber: standNumber,
                developmentId: developmentId,
              },
            });

            if (existingStand) {
              standId = existingStand.id;
            } else {
              if (!options.dryRun) {
                const newStand = await tx.stand.create({
                  data: {
                    id: uuidv4(),
                    standNumber: standNumber,
                    developmentId: developmentId,
                    price: sheet.priceTier || 0,
                    sizeSqm: 0,
                    status: 'SOLD', // Legacy imports are all sold
                    agentName: stand.agentCode, // NULL if not present
                    soldAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
                standId = newStand.id;
                counts.standsCreated++;

                // Increment development stand counts
                await tx.development.update({
                  where: { id: developmentId },
                  data: {
                    totalStands: { increment: 1 },
                  },
                });
              } else {
                standId = `dry-run-${standKey}`;
              }
              createdStands.set(standKey, standId);
            }
          }

          // 2d. Create client if we have a name
          let clientId: string | null = null;
          if (stand.clientName) {
            const clientKey = `${stand.clientName.toLowerCase()}:Harare`;
            clientId = createdClients.get(clientKey);

            if (!clientId) {
              // Generate email from name if not present
              const generatedEmail = `imported.${stand.clientName.toLowerCase().replace(/\s+/g, '.')}@legacy.import`;

              if (!options.dryRun) {
                const newClient = await tx.client.create({
                  data: {
                    id: uuidv4(),
                    name: stand.clientName,
                    email: generatedEmail,
                    phone: '',
                    branch: 'Harare',
                    isProspect: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
                clientId = newClient.id;
                counts.clientsCreated++;
              } else {
                clientId = `dry-run-${clientKey}`;
              }
              createdClients.set(clientKey, clientId);
            }
          }

          // 2e. Create offline sale
          let offlineSaleId: string | null = null;
          if (clientId && !options.dryRun) {
            const newSale = await tx.offlineSale.create({
              data: {
                id: uuidv4(),
                clientId: clientId,
                standId: standId,
                developmentId: developmentId,
                saleDate: new Date(),
                salePrice: stand.totals.clientPayments,
                depositAmount: stand.totals.clientPayments,
                paymentMethod: 'TRANSFER',
                notes: `Imported from Excel. Agent: ${stand.agentCode || 'N/A'}. Sheet: ${sheet.sheetName}`,
                importBatchId: batchId,
              },
            });
            offlineSaleId = newSale.id;
            counts.salesCreated++;
          } else if (options.dryRun) {
            offlineSaleId = `dry-run-sale-${standNumber}`;
            counts.salesCreated++;
          }

          // 2f. Process transactions
          for (const transaction of stand.transactions) {
            // Check for invalid dates
            if (!transaction.isValid || !transaction.date) {
              if (options.skipInvalidDates) {
                counts.transactionsSkipped++;
                logs.push({
                  row: transaction.rowIndex,
                  type: 'transaction',
                  message: `Skipped transaction with invalid date: ${transaction.description}`,
                  severity: 'warning',
                });
                continue;
              }
            }

            // Skip internal F&C admin fees (not actual payments)
            if (transaction.transactionType === 'FC_ADMIN_FEE') {
              logs.push({
                row: transaction.rowIndex,
                type: 'transaction',
                message: `Skipped internal F&C admin fee: ${transaction.description}`,
                severity: 'info',
              });
              continue;
            }

            // Create payment record
            if (offlineSaleId && !options.dryRun) {
              await tx.offlinePayment.create({
                data: {
                  id: uuidv4(),
                  offlineSaleId: offlineSaleId,
                  paymentDate: transaction.date || new Date(),
                  amount: transaction.amount,
                  paymentMethod: 'TRANSFER',
                  reference: `${transaction.transactionType}-${transaction.side}`,
                  notes: `${transaction.description} (${transaction.side})`,
                },
              });
              counts.paymentsCreated++;
            } else if (options.dryRun) {
              counts.paymentsCreated++;
            }
          }
        }
      }

      // 3. Update batch status to completed
      if (!options.dryRun) {
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: 'COMPLETED',
            processedRecords: counts.paymentsCreated + counts.salesCreated,
            failedRecords: counts.transactionsSkipped,
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
    logs.push({ row: 0, type: 'stand', message: errorMsg, severity: 'error' });

    // Update batch to failed status
    try {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorLog: { message: errorMsg, logs },
          completedAt: new Date(),
        },
      });
    } catch {
      // Ignore if update fails
    }
  }

  return { batchId, counts, logs, errors };
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

    const userId = session.user.email || 'unknown';

    // Parse request body
    const body = await request.json();
    const { 
      fileBuffer, 
      fileName,
      options = {
        skipInvalidDates: true,
        allowFutureDates: true,
        duplicateSuffix: 'sheet',
        dryRun: false,
      }
    } = body;

    if (!fileBuffer) {
      return NextResponse.json({ error: 'No file buffer provided' }, { status: 400 });
    }

    // Convert base64 buffer to Buffer
    const buffer = Buffer.from(fileBuffer, 'base64');

    // Parse the Excel file
    const parseResult = parseLakeCityExcel(buffer, fileName || 'import.xlsx');

    // Execute the import
    const result = await executeImport(parseResult, userId, options);

    return NextResponse.json({
      success: result.errors.length === 0,
      batchId: result.batchId,
      counts: result.counts,
      summary: parseResult.globalSummary,
      logs: result.logs,
      errors: result.errors,
    });

  } catch (error) {
    console.error('Import execute error:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
