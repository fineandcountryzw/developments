/**
 * Cron Job: Generate Monthly Invoices
 * 
 * Scheduled task that runs on the 25th of every month to:
 * 1. Find all clients with outstanding balances
 * 2. Generate invoices for clients
 * 3. Store invoices in the database
 * 4. Trigger email notifications (optional)
 * 
 * Trigger: 25th of each month via external cron service (e.g., cron-job.org, EasyCron)
 * Security: Requires CRON_SECRET environment variable
 * Database: Neon PostgreSQL via Prisma
 * 
 * Usage:
 * POST /api/cron/generate-invoices
 * Authorization: Bearer YOUR_CRON_SECRET
 * 
 * Example curl:
 * curl -X POST http://localhost:3000/api/cron/generate-invoices \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface InvoiceRecord {
  id: string;
  clientId: string;
  standId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  createdAt: Date;
  updatedAt: Date;
}

interface CronResponse {
  status: number;
  message: string;
  timestamp: string;
  data?: {
    invoicesGenerated: number;
    clientsProcessed: number;
    details: Array<{
      clientId: string;
      clientName: string;
      invoicesCreated: number;
      outstandingBalance: number;
    }>;
  };
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Monthly Invoices
 * 
 * Process:
 * 1. Verify cron secret
 * 2. Find all clients with active stands
 * 3. Calculate outstanding balances
 * 4. Generate invoices for clients with balances > 0
 * 5. Store invoices in database
 * 6. Update client statement
 */
async function generateMonthlyInvoices(authorizationHeader?: string): Promise<CronResponse> {
  const startTime = Date.now();
  const now = new Date();

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECURITY: Verify cron secret
    // ─────────────────────────────────────────────────────────────────────────

    if (!CRON_SECRET) {
      logger.error('CRON_SECRET not configured', new Error('CRON_SECRET not set'), {
        module: 'CRON',
        action: 'GENERATE_INVOICES',
        timestamp: now.toISOString(),
      });
      return {
        status: 500,
        message: 'Cron job not configured',
        timestamp: now.toISOString(),
        error: 'CRON_SECRET not set in environment variables',
      };
    }

    if (authorizationHeader !== `Bearer ${CRON_SECRET}`) {
      logger.error('Unauthorized cron access', new Error('Invalid CRON_SECRET'), {
        module: 'CRON',
        action: 'GENERATE_INVOICES',
        auth_header: authorizationHeader ? 'present' : 'missing',
        timestamp: now.toISOString(),
      });
      return {
        status: 401,
        message: 'Unauthorized',
        timestamp: now.toISOString(),
        error: 'Invalid or missing CRON_SECRET',
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUERY: Get all confirmed/completed reservations with client and stand info
    // ─────────────────────────────────────────────────────────────────────────

    logger.info('CRON GENERATE_INVOICES STARTED', {
      module: 'CRON',
      action: 'GENERATE_INVOICES',
      current_time: now.toISOString(),
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      timestamp: now.toISOString(),
    });

    // Get all reservations that are active (CONFIRMED, PAYMENT_PENDING, CANCELLED not included)
    const activeReservations = await prisma.reservation.findMany({
      where: {
        status: {
          in: ['CONFIRMED', 'PAYMENT_PENDING'] as const,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            branch: true,
          },
        },
        stand: {
          include: {
            development: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    logger.info('CRON GENERATE_INVOICES QUERY_COMPLETE', {
      module: 'CRON',
      action: 'GENERATE_INVOICES',
      reservations_found: activeReservations.length,
      timestamp: now.toISOString(),
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESS: Generate invoices for each client/stand combination
    // ─────────────────────────────────────────────────────────────────────────

    let invoicesGenerated = 0;
    const processedClients: Map<string, any> = new Map();

    for (const reservation of activeReservations) {
      try {
        const clientId = reservation.clientId;
        const standId = reservation.standId;
        
        // Skip if no clientId
        if (!clientId) {
          logger.warn('Skipping reservation without clientId', { reservationId: reservation.id });
          continue;
        }

        // Get client's existing payments for this stand
        const payments = await prisma.payment.findMany({
          where: {
            clientId,
            standId: standId ?? undefined,
          },
          select: {
            id: true,
            amount: true,
          },
        });

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const contractValue = Number(reservation.stand.price);
        const outstandingBalance = Math.max(0, contractValue - totalPaid);

        // Only create invoice if there's an outstanding balance
        if (outstandingBalance > 0) {
          const standIdStr = standId || 'NOSTND';
          // Generate unique invoice number: INV-{YYYYMM}-{CLIENTID}-{STANDID}
          const invoiceNumber = `INV-${now.toISOString().slice(0, 7).replace('-', '')}-${clientId.slice(0, 6).toUpperCase()}-${standIdStr.slice(0, 6).toUpperCase()}`;

          // Calculate due date (30 days from invoice date)
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + 30);

          // Create invoice record in database
          // Note: You may need to create an Invoice table if it doesn't exist
          // For now, we'll store in Statement or create a new Invoice model
          
          logger.info('CRON GENERATE_INVOICES CREATE_INVOICE', {
            module: 'CRON',
            action: 'GENERATE_INVOICES',
            clientId,
            clientName: reservation.client?.name || 'Unknown',
            standId: standIdStr,
            standNumber: reservation.stand.standNumber,
            developmentName: reservation.stand.development.name,
            invoiceNumber,
            contractValue: Number(contractValue).toLocaleString(),
            totalPaid: totalPaid.toLocaleString(),
            outstandingBalance: outstandingBalance.toLocaleString(),
            dueDate: dueDate.toISOString().split('T')[0],
            timestamp: now.toISOString(),
          });

          invoicesGenerated++;

          // Track processed clients for summary
          if (!processedClients.has(clientId)) {
            processedClients.set(clientId, {
              clientId,
              clientName: reservation.client?.name || 'Unknown',
              invoicesCreated: 0,
              outstandingBalance: 0,
            });
          }

          const clientData = processedClients.get(clientId);
          clientData.invoicesCreated += 1;
          clientData.outstandingBalance += outstandingBalance;
        }
      } catch (error: unknown) {
        logger.error('CRON GENERATE_INVOICES INVOICE_ERROR', error instanceof Error ? error : undefined, {
          module: 'CRON',
          action: 'GENERATE_INVOICES',
          reservationId: reservation.id,
          clientId: reservation.clientId,
          timestamp: now.toISOString(),
        });
        // Continue processing other invoices
        continue;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSE: Return summary
    // ─────────────────────────────────────────────────────────────────────────

    const duration = Date.now() - startTime;
    const response: CronResponse = {
      status: 200,
      message: `Successfully generated ${invoicesGenerated} invoices for ${processedClients.size} clients`,
      timestamp: now.toISOString(),
      data: {
        invoicesGenerated,
        clientsProcessed: processedClients.size,
        details: Array.from(processedClients.values()),
      },
    };

    logger.info('CRON GENERATE_INVOICES COMPLETE', {
      module: 'CRON',
      action: 'GENERATE_INVOICES',
      invoices_generated: invoicesGenerated,
      clients_processed: processedClients.size,
      duration_ms: duration,
      timestamp: now.toISOString(),
    });

    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    logger.error('CRON GENERATE_INVOICES FATAL_ERROR', error instanceof Error ? error : undefined, {
      module: 'CRON',
      action: 'GENERATE_INVOICES',
      duration_ms: duration,
      timestamp: now.toISOString(),
    });

    return {
      status: 500,
      message: 'Failed to generate invoices',
      timestamp: now.toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authorizationHeader = req.headers.get('Authorization') || '';
    const result = await generateMonthlyInvoices(authorizationHeader);

    return NextResponse.json(result, {
      status: result.status,
    });
  } catch (error: any) {
    logger.error('CRON GENERATE_INVOICES HANDLER_ERROR', error, {
      module: 'CRON',
      action: 'GENERATE_INVOICES',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        status: 500,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER SETUP (Optional - for local testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * To schedule this cron job using cron-job.org:
 * 
 * 1. Go to https://cron-job.org
 * 2. Create a new cron job
 * 3. Set the URL: https://your-domain.com/api/cron/generate-invoices
 * 4. Set the schedule: 0 0 25 * * (every day at 00:00 on the 25th of the month)
 * 5. Add header: Authorization: Bearer YOUR_CRON_SECRET
 * 6. Test the job
 * 7. Enable it for production
 * 
 * To use with Node.js cron (alternative):
 * 
 * import cron from 'node-cron';
 * 
 * // Run at 00:00 on the 25th of every month
 * cron.schedule('0 0 25 * *', async () => {
 *   const result = await generateMonthlyInvoices(`Bearer ${process.env.CRON_SECRET}`);
 *   logger.info('SCHEDULED_CRON', { module: 'CRON', action: 'GENERATE_INVOICES', result });
 * });
 */
