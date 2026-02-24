import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/client/documents/:id/download
 * Download document as PDF (receipt or contract).
 * Returns actual PDF for View/Download in client dashboard.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email!, branch: 'Harare' } }
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    if (type === 'receipt') {
      const receipt = await prisma.receipt.findUnique({
        where: { id },
        include: {
          payment: {
            select: {
              clientId: true,
              amount: true,
              paymentType: true,
              createdAt: true
            }
          }
        }
      });

      if (!receipt) {
        return NextResponse.json(
          { success: false, error: 'Receipt not found' },
          { status: 404 }
        );
      }

      const ownedByPayment = receipt.payment?.clientId === client.id;
      const ownedByReceipt = 'clientId' in receipt && receipt.clientId === client.id;
      if (!ownedByPayment && !ownedByReceipt) {
        return NextResponse.json(
          { success: false, error: 'Receipt not found or unauthorized' },
          { status: 404 }
        );
      }

      const pdfBuffer = generateReceiptPDF({
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        clientName: receipt.clientName,
        paymentType: receipt.paymentType,
        paymentMethod: receipt.paymentMethod,
        branch: receipt.branch,
        createdAt: receipt.createdAt,
        standNumber: receipt.standNumber,
        developmentName: receipt.developmentName,
        description: receipt.description,
        receivedBy: receipt.receivedBy
      });

      const filename = `Receipt_${receipt.receiptNumber}.pdf`;
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      });
    }

    if (type === 'contract') {
      const contract = await prisma.contract.findUnique({
        where: { id }
      });

      if (!contract || contract.clientId !== client.id) {
        return NextResponse.json(
          { success: false, error: 'Contract not found or unauthorized' },
          { status: 404 }
        );
      }

      const pdfBuffer = generateContractPDF(contract);
      const safeTitle = (contract.title || 'Contract').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
      const filename = `Contract_${safeTitle}.pdf`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid document type. Use ?type=receipt or ?type=contract' },
      { status: 400 }
    );
  } catch (error: any) {
    logger.error('Error downloading document', error, { module: 'API', action: 'GET_CLIENT_DOCUMENTS_DOWNLOAD' });
    return apiError(error?.message || 'Failed to download document', 500, ErrorCodes.FETCH_ERROR);
  }
}

function generateContractPDF(contract: {
  title: string;
  content: string;
  status: string;
  createdAt: Date;
}): Buffer {
  const doc = new jsPDF();

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 31, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.setDrawColor(133, 117, 78);
  doc.line(20, 38, 190, 38);

  doc.setFontSize(16);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(133, 117, 78);
  doc.text(contract.title || 'Contract', 105, 52, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${new Date(contract.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, 62);
  doc.text(`Status: ${contract.status}`, 20, 68);

  doc.setLineWidth(0.2);
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 74, 190, 74);

  const plainText = stripHtml(contract.content || '').trim();
  const lines = plainText ? doc.splitTextToSize(plainText, 170) : ['(No contract content.)'];
  let y = 82;
  const pageHeight = 275;
  const lineHeight = 6;

  for (let i = 0; i < lines.length; i++) {
    if (y > pageHeight) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(lines[i], 20, y);
    y += lineHeight;
  }

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const footerY = Math.min(y + 20, 285);
  doc.text('This document was generated by Fine & Country Zimbabwe. For inquiries, contact your branch.', 105, footerY, { align: 'center' });
  doc.text(`Generated: ${new Date().toISOString()}`, 105, footerY + 5, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
