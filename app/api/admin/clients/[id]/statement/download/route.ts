import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/clients/[id]/statement/download
 * Generates and returns a PDF statement for the client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;

    if (!id) {
      return apiError('Client ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch client with payments and reservations
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        reservations: {
          include: {
            stand: {
              include: {
                development: true
              }
            }
          }
        }
      }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Calculate financial summary using correct field names
    const totalPaid = client.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const verifiedPayments = client.payments.filter(p => p.verificationStatus === 'Verified');
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Get stands from reservations
    const stands = client.reservations
      .filter(r => r.stand)
      .map(r => ({
        id: r.stand!.id,
        number: r.stand!.standNumber,
        status: r.stand!.status,
        price_usd: Number(r.stand!.price) || 0,
        area_sqm: Number(r.stand!.sizeSqm) || 0,
        developmentName: r.stand!.development?.name || 'Unknown'
      }));

    const totalContractValue = stands.reduce((sum, s) => sum + s.price_usd, 0);
    const outstandingBalance = Math.max(0, totalContractValue - totalVerified);

    // Branch settings
    const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
      Harare: {
        address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
        phone: '08644 253731',
        email: 'harare@fineandcountry.co.zw'
      },
      Bulawayo: {
        address: '6 Kingsley Crescent, Malindela, Bulawayo',
        phone: '08644 253731',
        email: 'bulawayo@fineandcountry.co.zw'
      }
    };

    const branch = client.branch || 'Harare';
    const settings = branchSettings[branch] || branchSettings.Harare;

    // Generate PDF
    const doc = new jsPDF();
    
    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text('FINE & COUNTRY', 105, 30, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 36, { align: 'center' });
    
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(20, 42, 190, 42);

    // Branch Info
    doc.setFontSize(8);
    const branchLabel = branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
    doc.text(branchLabel, 190, 25, { align: 'right' });
    doc.text(settings.address, 190, 30, { align: 'right' });
    doc.text(settings.phone, 190, 35, { align: 'right' });
    doc.text(settings.email, 190, 40, { align: 'right' });

    // Statement Title
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text('CLIENT STATEMENT OF ACCOUNT', 105, 60, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 68, { align: 'center' });

    // Client Details
    let y = 80;
    doc.setLineWidth(0.2);
    doc.line(20, y, 190, y);
    y += 8;
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Client Information', 20, y);
    y += 8;
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Name: ${client.name}`, 25, y);
    y += 6;
    doc.text(`Email: ${client.email}`, 25, y);
    y += 6;
    doc.text(`Phone: ${client.phone}`, 25, y);
    if (client.nationalId) {
      y += 6;
      doc.text(`ID Number: ${client.nationalId}`, 25, y);
    }
    y += 10;

    // Financial Summary
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Financial Summary', 20, y);
    y += 8;
    
    doc.setFont('Helvetica', 'normal');
    doc.text(`Total Contract Value:`, 25, y);
    doc.text(`$${totalContractValue.toLocaleString()} USD`, 190, y, { align: 'right' });
    y += 6;
    doc.text(`Total Paid (Verified):`, 25, y);
    doc.text(`$${totalVerified.toLocaleString()} USD`, 190, y, { align: 'right' });
    y += 6;
    doc.setFont('Helvetica', 'bold');
    doc.text(`Outstanding Balance:`, 25, y);
    doc.text(`$${outstandingBalance.toLocaleString()} USD`, 190, y, { align: 'right' });
    y += 10;

    // Property Holdings
    if (stands.length > 0) {
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFont('Helvetica', 'bold');
      doc.text('Property Holdings', 20, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont('Helvetica', 'bold');
      doc.text('Stand', 25, y);
      doc.text('Development', 60, y);
      doc.text('Size (m²)', 120, y);
      doc.text('Status', 145, y);
      doc.text('Value', 190, y, { align: 'right' });
      y += 6;
      doc.line(20, y, 190, y);
      y += 6;

      doc.setFont('Helvetica', 'normal');
      stands.forEach(stand => {
        doc.text(`#${stand.number}`, 25, y);
        doc.text(stand.developmentName.substring(0, 25), 60, y);
        doc.text(`${stand.area_sqm}`, 120, y);
        doc.text(stand.status, 145, y);
        doc.text(`$${stand.price_usd.toLocaleString()}`, 190, y, { align: 'right' });
        y += 6;
      });
      y += 4;
    }

    // Transaction History
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Transaction History', 20, y);
    y += 8;

    if (client.payments.length === 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('No transactions recorded.', 25, y);
    } else {
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'bold');
      doc.text('Date', 25, y);
      doc.text('Reference', 55, y);
      doc.text('Description', 95, y);
      doc.text('Status', 155, y);
      doc.text('Amount', 190, y, { align: 'right' });
      y += 6;
      doc.line(20, y, 190, y);
      y += 6;

      doc.setFont('Helvetica', 'normal');
      for (const payment of client.payments) {
        if (y > 265) {
          doc.addPage();
          y = 30;
        }
        
        const date = payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A';
        const ref = (payment.reference || 'N/A').substring(0, 12);
        const desc = (payment.description || 'Payment').substring(0, 28);
        const status = payment.verificationStatus || 'Pending';
        const amount = Number(payment.amount) || 0;

        doc.text(date, 25, y);
        doc.text(ref, 55, y);
        doc.text(desc, 95, y);
        doc.text(status, 155, y);
        doc.text(`$${amount.toLocaleString()}`, 190, y, { align: 'right' });
        y += 6;
      }
    }

    // Footer
    y = 280;
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a computer-generated document. For inquiries, contact your branch office.', 105, y, { align: 'center' });

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `Statement_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    logger.error('Client statement download error', error, { module: 'API', action: 'GET_ADMIN_CLIENT_STATEMENT_DOWNLOAD' });
    return apiError(error?.message || 'Failed to generate statement PDF', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/clients/[id]/statement/download
 * Email statement with PDF attachment to client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { recipientEmail, includeMessage } = body;

    // Fetch client with payments
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        reservations: {
          include: {
            stand: {
              include: {
                development: true
              }
            }
          }
        }
      }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Determine recipient
    const toEmail = recipientEmail || client.email;
    
    if (!toEmail) {
      return apiError('No recipient email provided and no client email on record', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Generate PDF (reuse the same logic as GET)
    const pdfBuffer = generateStatementPDF(client);

    // Calculate summary for email
    const totalPaid = client.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const verifiedPayments = client.payments.filter(p => p.verificationStatus === 'Verified');
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const stands = client.reservations.filter(r => r.stand);
    const totalContractValue = stands.reduce((sum, r) => sum + Number(r.stand?.price || 0), 0);
    const outstandingBalance = Math.max(0, totalContractValue - totalVerified);

    // Generate email HTML
    const htmlContent = generateStatementEmailHTML({
      clientName: client.name,
      totalPaid: totalVerified,
      outstandingBalance,
      customMessage: includeMessage
    });

    logger.info('Sending statement email', {
      module: 'API',
      action: 'POST_ADMIN_CLIENT_STATEMENT_DOWNLOAD',
      clientId: id,
      clientName: client.name,
      to: toEmail?.substring(0, 3) + '***'
    });

    // Send email with PDF attachment
    const result = await sendEmail({
      to: toEmail,
      subject: `Account Statement | Fine & Country Zimbabwe`,
      html: htmlContent,
      attachments: [{
        filename: `Statement_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: client.branch || 'HEAD_OFFICE',
        userId: null,
        action: 'EMAIL',
        module: 'CLIENTS',
        recordId: client.id,
        description: `Statement emailed to ${toEmail}`,
        changes: JSON.stringify({
          clientName: client.name,
          sentTo: toEmail,
          outstandingBalance
        })
      }
    });

    logger.info('Statement email sent successfully', {
      module: 'API',
      action: 'POST_ADMIN_CLIENT_STATEMENT_DOWNLOAD',
      emailId: result.id,
      sentTo: toEmail?.substring(0, 3) + '***',
      clientName: client.name
    });

    return apiSuccess({
      emailId: result.id,
      sentTo: toEmail,
      clientName: client.name,
      message: `Statement sent to ${toEmail}`
    });

  } catch (error: any) {
    logger.error('Statement API Email error', error, { module: 'API', action: 'POST_ADMIN_CLIENT_STATEMENT_DOWNLOAD' });
    return apiError(error.message || 'Failed to send statement email', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * Generate Statement PDF (extracted for reuse)
 */
function generateStatementPDF(client: any): Buffer {
  // Branch settings
  const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
    Harare: {
      address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
      phone: '08644 253731',
      email: 'harare@fineandcountry.co.zw'
    },
    Bulawayo: {
      address: '6 Kingsley Crescent, Malindela, Bulawayo',
      phone: '08644 253731',
      email: 'bulawayo@fineandcountry.co.zw'
    }
  };

  const branch = client.branch || 'Harare';
  const settings = branchSettings[branch] || branchSettings.Harare;

  // Calculate financial summary
  const totalPaid = client.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const verifiedPayments = client.payments.filter((p: any) => p.verificationStatus === 'Verified');
  const totalVerified = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const stands = client.reservations
    .filter((r: any) => r.stand)
    .map((r: any) => ({
      number: r.stand!.standNumber,
      status: r.stand!.status,
      price_usd: Number(r.stand!.price) || 0,
      area_sqm: Number(r.stand!.sizeSqm) || 0,
      developmentName: r.stand!.development?.name || 'Unknown'
    }));
  const totalContractValue = stands.reduce((sum: number, s: any) => sum + s.price_usd, 0);
  const outstandingBalance = Math.max(0, totalContractValue - totalVerified);

  const doc = new jsPDF();
  
  // Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('FINE & COUNTRY', 105, 30, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 36, { align: 'center' });
  
  doc.setLineWidth(0.8);
  doc.setDrawColor(0, 0, 0);
  doc.line(20, 42, 190, 42);

  // Branch Info
  doc.setFontSize(8);
  const branchLabel = branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
  doc.text(branchLabel, 190, 25, { align: 'right' });
  doc.text(settings.address, 190, 30, { align: 'right' });
  doc.text(settings.phone, 190, 35, { align: 'right' });
  doc.text(settings.email, 190, 40, { align: 'right' });

  // Statement Title
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.text('CLIENT STATEMENT OF ACCOUNT', 105, 60, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 68, { align: 'center' });

  // Client Details
  let y = 80;
  doc.setLineWidth(0.2);
  doc.line(20, y, 190, y);
  y += 8;
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Client Information', 20, y);
  y += 8;
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${client.name}`, 25, y);
  y += 6;
  doc.text(`Email: ${client.email}`, 25, y);
  y += 6;
  doc.text(`Phone: ${client.phone}`, 25, y);
  if (client.nationalId) {
    y += 6;
    doc.text(`ID Number: ${client.nationalId}`, 25, y);
  }
  y += 10;

  // Financial Summary
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Financial Summary', 20, y);
  y += 8;
  
  doc.setFont('Helvetica', 'normal');
  doc.text(`Total Contract Value:`, 25, y);
  doc.text(`$${totalContractValue.toLocaleString()} USD`, 190, y, { align: 'right' });
  y += 6;
  doc.text(`Total Paid (Verified):`, 25, y);
  doc.text(`$${totalVerified.toLocaleString()} USD`, 190, y, { align: 'right' });
  y += 6;
  doc.setFont('Helvetica', 'bold');
  doc.text(`Outstanding Balance:`, 25, y);
  doc.text(`$${outstandingBalance.toLocaleString()} USD`, 190, y, { align: 'right' });
  y += 10;

  // Property Holdings
  if (stands.length > 0) {
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Property Holdings', 20, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('Stand', 25, y);
    doc.text('Development', 60, y);
    doc.text('Size (m²)', 120, y);
    doc.text('Status', 145, y);
    doc.text('Value', 190, y, { align: 'right' });
    y += 6;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    stands.forEach((stand: any) => {
      doc.text(`#${stand.number}`, 25, y);
      doc.text(stand.developmentName.substring(0, 25), 60, y);
      doc.text(`${stand.area_sqm}`, 120, y);
      doc.text(stand.status, 145, y);
      doc.text(`$${stand.price_usd.toLocaleString()}`, 190, y, { align: 'right' });
      y += 6;
    });
    y += 4;
  }

  // Transaction History
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Transaction History', 20, y);
  y += 8;

  if (client.payments.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No transactions recorded.', 25, y);
  } else {
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('Date', 25, y);
    doc.text('Reference', 55, y);
    doc.text('Description', 95, y);
    doc.text('Status', 155, y);
    doc.text('Amount', 190, y, { align: 'right' });
    y += 6;
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    for (const payment of client.payments) {
      if (y > 265) {
        doc.addPage();
        y = 30;
      }
      
      const date = payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A';
      const ref = (payment.reference || 'N/A').substring(0, 12);
      const desc = (payment.description || 'Payment').substring(0, 28);
      const status = payment.verificationStatus || 'Pending';
      const amount = Number(payment.amount) || 0;

      doc.text(date, 25, y);
      doc.text(ref, 55, y);
      doc.text(desc, 95, y);
      doc.text(status, 155, y);
      doc.text(`$${amount.toLocaleString()}`, 190, y, { align: 'right' });
      y += 6;
    }
  }

  // Footer
  y = 280;
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('This is a computer-generated document. For inquiries, contact your branch office.', 105, y, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Generate HTML email for statement
 */
function generateStatementEmailHTML(params: {
  clientName: string;
  totalPaid: number;
  outstandingBalance: number;
  customMessage?: string;
}): string {
  const { clientName, totalPaid, outstandingBalance, customMessage } = params;
  
  const formattedPaid = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalPaid);
  
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(outstandingBalance);

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
    .summary-box { background: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .balance { font-size: 24px; font-weight: bold; color: ${outstandingBalance > 0 ? '#dc2626' : '#10b981'}; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ACCOUNT STATEMENT</h1>
      <p>Fine & Country Zimbabwe</p>
    </div>
    <div class="content">
      <p>Dear ${clientName},</p>
      <p>Please find attached your account statement for your records.</p>
      
      <div class="summary-box">
        <p><strong>Account Summary</strong></p>
        <p>Total Paid: <strong>${formattedPaid}</strong></p>
        <p>Outstanding Balance: <span class="balance">${formattedBalance}</span></p>
      </div>
      
      ${customMessage ? `<p style="background:#f0f9ff; padding:15px; border-radius:4px; color:#0369a1;"><em>${customMessage}</em></p>` : ''}
      
      <p>Your detailed statement is attached as a PDF document.</p>
      
      ${outstandingBalance > 0 ? `
      <p style="background:#fef3c7; padding:15px; border-radius:4px; color:#92400e;">
        <strong>Payment Reminder:</strong> You have an outstanding balance of ${formattedBalance}. 
        Please make payment at your earliest convenience.
      </p>
      ` : `
      <p style="background:#d1fae5; padding:15px; border-radius:4px; color:#065f46;">
        <strong>Thank you!</strong> Your account is fully paid up.
      </p>
      `}
      
      <p>If you have any questions, please contact us at <a href="mailto:accounts@fineandcountry.co.zw">accounts@fineandcountry.co.zw</a>.</p>
      
      <p style="margin-top:30px;">Best regards,<br><strong>Fine & Country Zimbabwe</strong><br>Accounts Department</p>
    </div>
    <div class="footer">
      <p>This is an automated statement notification.</p>
      <p>Fine & Country Zimbabwe | www.fineandcountry.co.zw</p>
    </div>
  </div>
</body>
</html>
  `;
}
