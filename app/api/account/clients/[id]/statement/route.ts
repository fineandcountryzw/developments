import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/account/clients/[id]/statement
 * Generate and return a client's account statement as PDF.
 * For accounts dashboard - accessible by account users.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        reservations: {
          include: {
            stand: {
              include: { development: true },
            },
          },
        },
      },
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    const verifiedPayments = client.payments.filter((p) => p.verificationStatus === 'Verified');
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const stands = client.reservations
      .filter((r) => r.stand)
      .map((r) => ({
        id: r.stand!.id,
        number: r.stand!.standNumber,
        status: r.stand!.status,
        price_usd: Number(r.stand!.price) || 0,
        area_sqm: Number(r.stand!.sizeSqm) || 0,
        developmentName: r.stand!.development?.name || 'Unknown',
      }));
    const totalContractValue = stands.reduce((sum, s) => sum + s.price_usd, 0);
    const outstandingBalance = Math.max(0, totalContractValue - totalVerified);

    const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
      Harare: {
        address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
        phone: '08644 253731',
        email: 'harare@fineandcountry.co.zw',
      },
      Bulawayo: {
        address: '6 Kingsley Crescent, Malindela, Bulawayo',
        phone: '08644 253731',
        email: 'bulawayo@fineandcountry.co.zw',
      },
    };
    const branch = client.branch || 'Harare';
    const settings = branchSettings[branch] || branchSettings.Harare;

    const doc = new jsPDF();
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

    doc.setFontSize(8);
    const branchLabel = branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
    doc.text(branchLabel, 190, 25, { align: 'right' });
    doc.text(settings.address, 190, 30, { align: 'right' });
    doc.text(settings.phone, 190, 35, { align: 'right' });
    doc.text(settings.email, 190, 40, { align: 'right' });

    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text('CLIENT STATEMENT OF ACCOUNT', 105, 60, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 68, { align: 'center' });

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
      stands.forEach((stand) => {
        doc.text(`#${stand.number}`, 25, y);
        doc.text(stand.developmentName.substring(0, 25), 60, y);
        doc.text(`${stand.area_sqm}`, 120, y);
        doc.text(stand.status, 145, y);
        doc.text(`$${stand.price_usd.toLocaleString()}`, 190, y, { align: 'right' });
        y += 6;
      });
      y += 4;
    }

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

    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a computer-generated document. For inquiries, contact your branch office.', 105, 280, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `Statement_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Client statement generation error', error as Error, { module: 'API', action: 'GET_CLIENT_STATEMENT' });
    return apiError((error as Error)?.message || 'Failed to generate statement', 500, ErrorCodes.FETCH_ERROR);
  }
}
