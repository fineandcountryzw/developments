import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for PDF generation with jsPDF

/**
 * GET /api/client/receipts/[id]
 * Get a specific receipt or download as PDF (CLIENT-ONLY)
 * IDOR Protection: Verifies receipt belongs to authenticated client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const { id } = await params;
    const format = request.nextUrl.searchParams.get('format');

    // Find client by email
    const client = await prisma.client.findFirst({
      where: { email: session.user.email }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get receipt with relations
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: {
          select: { id: true, reference: true, verificationStatus: true }
        },
        installment: {
          include: {
            plan: {
              include: { development: true }
            }
          }
        }
      }
    });

    if (!receipt) {
      return apiError('Receipt not found', 404, ErrorCodes.NOT_FOUND);
    }

    // IDOR Protection: Verify receipt belongs to this client
    if (receipt.clientId !== client.id) {
      logger.warn('Client Receipt API IDOR attempt blocked', {
        module: 'API',
        action: 'GET_CLIENT_RECEIPT_IDOR',
        clientEmail: session.user.email,
        attemptedReceiptId: id,
        receiptOwner: receipt.clientId
      });
      return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // If PDF format requested, generate and return PDF
    if (format === 'pdf') {
      const pdfBuffer = generateReceiptPDF(receipt);
      
      logger.info('Client Receipt API PDF downloaded', {
        module: 'API',
        action: 'DOWNLOAD_CLIENT_RECEIPT',
        receiptId: id,
        receiptNumber: receipt.receiptNumber,
        clientEmail: session.user.email
      });
      
      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Receipt_${receipt.receiptNumber}.pdf"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      });
    }

    // Return JSON receipt details
    logger.info('Client Receipt API Receipt viewed', {
      module: 'API',
      action: 'VIEW_CLIENT_RECEIPT',
      receiptId: id,
      clientEmail: session.user.email
    });

    return apiSuccess(receipt);

  } catch (error: any) {
    logger.error('Client Receipt API Error', error, { module: 'API', action: 'GET_CLIENT_RECEIPT' });
    return apiError(error.message || 'Failed to fetch receipt', 500, ErrorCodes.FETCH_ERROR);
  }
}
