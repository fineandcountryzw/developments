import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for PDF generation with jsPDF

/**
 * GET /api/admin/receipts/[id]
 * Get a specific receipt or download as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const format = request.nextUrl.searchParams.get('format');

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: true,
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
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // IDOR Protection: Verify agent owns this client
    const role = user.role?.toUpperCase();
    if (role === 'AGENT') {
      const agentReservations = await prisma.reservation.findMany({
        where: { agentId: user.id },
        select: { clientId: true }
      });
      const allowedClientIds = agentReservations
        .map(r => r.clientId)
        .filter((id): id is string => id !== null);
      
      if (!allowedClientIds.includes(receipt.clientId)) {
        logger.warn('Agent attempted to access receipt for unauthorized client', {
          module: 'API',
          action: 'GET_RECEIPT_BY_ID_IDOR',
          agentId: user.id,
          receiptId: id,
          clientId: receipt.clientId
        });
        return apiError('Access denied', 403, ErrorCodes.ACCESS_DENIED);
      }
    }

    // If PDF format requested, generate and return PDF
    if (format === 'pdf') {
      const pdfBuffer = generateReceiptPDF(receipt);
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Receipt_${receipt.receiptNumber}.pdf"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      });
    }

    return apiSuccess(receipt);

  } catch (error: any) {
    logger.error('Receipt API Error', error, { module: 'API', action: 'GET_RECEIPT_BY_ID' });
    return apiError(error.message || 'Failed to fetch receipt', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * DELETE /api/admin/receipts/[id]
 * Void a receipt (soft delete for accounting audit trail)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'No reason provided';

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { 
        payment: true,
        installment: {
          include: { plan: true }
        }
      }
    });

    if (!receipt) {
      return apiError('Receipt not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Soft delete with transaction to reverse financial effects
    const voidedReceipt = await prisma.$transaction(async (tx) => {
      // 1. Mark receipt as voided
      const voided = await tx.receipt.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: user?.email || 'unknown',
          voidReason: reason
        }
      });

      // 2. Reverse installment payment if linked
      if (receipt.installmentId && receipt.installment) {
        const installment = receipt.installment;
        const newAmountPaid = Math.max(0, Number(installment.amountPaid) - Number(receipt.amount));
        
        await tx.installment.update({
          where: { id: receipt.installmentId },
          data: {
            amountPaid: newAmountPaid,
            status: newAmountPaid <= 0 ? 'PENDING' : 
                    newAmountPaid >= Number(installment.amountDue) ? 'PAID' : 'PARTIAL',
            paidDate: newAmountPaid <= 0 ? null : installment.paidDate
          }
        });

        // 3. Update plan totals
        if (installment.plan) {
          await tx.installmentPlan.update({
            where: { id: installment.planId },
            data: {
              totalPaid: { decrement: receipt.amount },
              remainingBalance: { increment: receipt.amount }
            }
          });
        }

        logger.info('Receipt voided with installment reversal', {
          module: 'API',
          action: 'VOID_RECEIPT_WITH_REVERSAL',
          receiptId: id,
          installmentId: receipt.installmentId,
          planId: installment.planId,
          amount: receipt.amount
        });
      }

      return voided;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: receipt.branch || 'HEAD_OFFICE',
        userId: null,
        action: 'DELETE',
        module: 'RECEIPTS',
        recordId: receipt.id,
        description: `Receipt voided: ${receipt.receiptNumber} - Reason: ${reason}`,
        changes: JSON.stringify({ 
          voided: true, 
          reason, 
          voidedBy: user?.email,
          originalAmount: receipt.amount,
          receiptNumber: receipt.receiptNumber
        })
      }
    });

    logger.info('Receipt API Receipt voided', {
      module: 'API',
      action: 'DELETE_RECEIPT',
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      voidedBy: user?.email
    });

    return apiSuccess({
      receipt: voidedReceipt,
      message: 'Receipt voided successfully'
    });

  } catch (error: any) {
    logger.error('Receipt API Delete error', error, { module: 'API', action: 'DELETE_RECEIPT' });
    return apiError(error.message || 'Failed to void receipt', 500, ErrorCodes.DELETE_ERROR);
  }
}

/**
 * POST /api/admin/receipts/[id]
 * Email receipt with PDF attachment to client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { recipientEmail, includeMessage } = body;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: true,
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

    // Determine recipient - use provided email or fall back to client email from payment
    const toEmail = recipientEmail || receipt.clientEmail;
    
    if (!toEmail) {
      return apiError('No recipient email provided and no client email on record', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Generate PDF
    const pdfBuffer = generateReceiptPDF(receipt);

    // Generate email HTML
    const htmlContent = generateReceiptEmailHTML({
      clientName: receipt.clientName || 'Valued Client',
      receiptNumber: receipt.receiptNumber,
      amount: Number(receipt.amount),
      paymentDate: receipt.createdAt,
      customMessage: includeMessage
    });

    logger.info('Receipt API Sending receipt email', {
      module: 'API',
      action: 'POST_RECEIPT_EMAIL',
      receiptId: id,
      receiptNumber: receipt.receiptNumber,
      to: toEmail?.substring(0, 3) + '***'
    });

    // Send email with PDF attachment
    const result = await sendEmail({
      to: toEmail,
      subject: `Payment Receipt - ${receipt.receiptNumber} | Fine & Country Zimbabwe`,
      html: htmlContent,
      attachments: [{
        filename: `Receipt_${receipt.receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: receipt.branch || 'HEAD_OFFICE',
        userId: null,
        action: 'EMAIL',
        module: 'RECEIPTS',
        recordId: receipt.id,
        description: `Receipt emailed: ${receipt.receiptNumber} to ${toEmail}`,
        changes: JSON.stringify({
          receiptNumber: receipt.receiptNumber,
          sentTo: toEmail,
          amount: receipt.amount,
          emailSentAt: new Date().toISOString()
        })
      }
    });

    logger.info('Receipt API Receipt email sent successfully', {
      module: 'API',
      action: 'POST_RECEIPT_EMAIL',
      receiptId: id,
      receiptNumber: receipt.receiptNumber,
      emailId: result.id
    });

    return apiSuccess({
      emailId: result.id,
      sentTo: toEmail,
      receiptNumber: receipt.receiptNumber,
      message: `Receipt sent to ${toEmail}`
    });

  } catch (error: any) {
    logger.error('Receipt API Email error', error, { module: 'API', action: 'POST_RECEIPT_EMAIL' });
    return apiError(error.message || 'Failed to send receipt email', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * Generate HTML email for receipt
 */
function generateReceiptEmailHTML(params: {
  clientName: string;
  receiptNumber: string;
  amount: number;
  paymentDate: Date;
  customMessage?: string;
}): string {
  const { clientName, receiptNumber, amount, paymentDate, customMessage } = params;
  
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
  
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full'
  }).format(new Date(paymentDate));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { background: linear-gradient(135deg, #0A1629 0%, #1a2838 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #85754E; margin: 0; font-size: 24px; }
    .header p { color: #fff; margin: 5px 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .amount-box { background: #f9fafb; border-left: 4px solid #85754E; padding: 20px; margin: 20px 0; }
    .amount { font-size: 28px; font-weight: bold; color: #85754E; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PAYMENT RECEIPT</h1>
      <p>Fine & Country Zimbabwe</p>
    </div>
    <div class="content">
      <p>Dear ${clientName},</p>
      <p>Thank you for your payment. Please find attached your official receipt for your records.</p>
      
      <div class="amount-box">
        <p style="margin:0; font-size:14px; color:#666;">Receipt Number: <strong>${receiptNumber}</strong></p>
        <p style="margin:5px 0 0; font-size:14px; color:#666;">Payment Date: ${formattedDate}</p>
        <p class="amount" style="margin:15px 0 0;">${formattedAmount}</p>
      </div>
      
      ${customMessage ? `<p style="background:#f0f9ff; padding:15px; border-radius:4px; color:#0369a1;"><em>${customMessage}</em></p>` : ''}
      
      <p>The PDF receipt is attached to this email. Please keep it for your records.</p>
      <p>If you have any questions about this payment, please contact us at <a href="mailto:accounts@fineandcountry.co.zw">accounts@fineandcountry.co.zw</a>.</p>
      
      <p style="margin-top:30px;">Best regards,<br><strong>Fine & Country Zimbabwe</strong><br>Accounts Department</p>
    </div>
    <div class="footer">
      <p>This is an automated receipt notification.</p>
      <p>Fine & Country Zimbabwe | www.fineandcountry.co.zw</p>
    </div>
  </div>
</body>
</html>
  `;
}
