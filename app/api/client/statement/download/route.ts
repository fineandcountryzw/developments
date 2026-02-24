import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/client/statement/download
 * Generate and return the logged-in client's account statement as PDF.
 * Same layout as admin statement; client resolved from session (email + branch).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { email_branch: { email: session.user.email, branch: 'Harare' } },
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
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Get offline sales and payments for this client
    const offlineSales = await prisma.offlineSale.findMany({
      where: { clientId: client.id },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        stand: {
          include: { development: true },
        },
      },
    });

    const verifiedPayments = client.payments.filter((p) => p.verificationStatus === 'Verified');
    const offlinePaymentTotal = offlineSales.reduce((sum, sale) =>
      sum + sale.payments.reduce((paymentSum, payment) =>
        paymentSum + Number(payment.amount || 0), 0
      ), 0
    );
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) + offlinePaymentTotal;

    // Get stands from both reservations and offline sales
    const standsFromReservations = client.reservations
      .filter((r) => r.stand)
      .map((r) => ({
        id: r.stand!.id,
        number: r.stand!.standNumber,
        status: r.stand!.status,
        price_usd: Number(r.stand!.price) || 0,
        area_sqm: Number(r.stand!.sizeSqm) || 0,
        developmentName: r.stand!.development?.name || 'Unknown',
      }));

    const standsFromOfflineSales = offlineSales
      .filter((sale) => sale.stand)
      .map((sale) => ({
        id: sale.stand!.id,
        number: sale.stand!.standNumber,
        status: sale.stand!.status,
        price_usd: Number(sale.salePrice) || 0,
        area_sqm: Number(sale.stand!.sizeSqm) || 0,
        developmentName: sale.stand!.development?.name || 'Unknown',
      }));

    // Combine and deduplicate stands (in case a stand is in both reservations and offline sales)
    const standMap = new Map();
    [...standsFromReservations, ...standsFromOfflineSales].forEach(stand => {
      if (!standMap.has(stand.id)) {
        standMap.set(stand.id, stand);
      }
    });
    const stands = Array.from(standMap.values());

    // Calculate total contract value from both reservations and offline sales
    const contractValueFromReservations = standsFromReservations.reduce((sum, s) => sum + s.price_usd, 0);
    const contractValueFromOfflineSales = standsFromOfflineSales.reduce((sum, s) => sum + s.price_usd, 0);
    const totalContractValue = contractValueFromReservations + contractValueFromOfflineSales;

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

    // Combine regular payments and offline payments
    const allTransactions: {
      id: string;
      date: Date;
      reference: string | null;
      description: string;
      status: string;
      amount: number;
      type: string;
    }[] = [];

    // Add regular payments
    client.payments.forEach(payment => {
      allTransactions.push({
        id: payment.id,
        date: payment.createdAt,
        reference: payment.reference,
        description: payment.description || 'Payment',
        status: payment.verificationStatus || 'Pending',
        amount: Number(payment.amount) || 0,
        type: 'regular'
      });
    });

    // Add offline payments
    offlineSales.forEach(sale => {
      sale.payments.forEach(payment => {
        allTransactions.push({
          id: payment.id,
          date: payment.createdAt,
          reference: payment.reference,
          description: payment.notes || 'Offline Payment',
          status: 'Verified', // Offline payments are considered verified
          amount: Number(payment.amount) || 0,
          type: 'offline'
        });
      });
    });

    // Sort transactions by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (allTransactions.length === 0) {
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
      for (const transaction of allTransactions) {
        if (y > 265) {
          doc.addPage();
          y = 30;
        }
        const date = transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A';
        const ref = (transaction.reference || 'N/A').substring(0, 12);
        const desc = transaction.description.substring(0, 28);
        const status = transaction.status;
        const amount = transaction.amount;
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
    logger.error('Client statement download error', error as Error, { module: 'API', action: 'GET_CLIENT_STATEMENT_DOWNLOAD' });
    return apiError((error as Error)?.message || 'Failed to generate statement', 500, ErrorCodes.FETCH_ERROR);
  }
}
