import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { generatePDF } from '@/lib/pdf-generator';

// Force Node.js runtime for Puppeteer PDF generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    // Check authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { paymentId } = await params;

    // Get payment with receipt
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        receipt: true,
        stand: {
          select: {
            standNumber: true,
            development: {
              select: {
                name: true,
              },
            },
          },
        },
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    // IDOR Protection: Check client/branch access
    const userRole = user.role?.toUpperCase();
    if (userRole === 'CLIENT') {
      // Clients can only access their own receipts
      if (payment.clientId !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Access denied: Not your receipt' },
          { status: 403 }
        );
      }
    } else if (userRole === 'ACCOUNT' || userRole === 'ADMIN') {
      // ACCOUNT/ADMIN can only access receipts in their branch
      const userBranch = user.branch || 'Harare';
      if (payment.officeLocation !== userBranch && payment.officeLocation !== 'all') {
        return NextResponse.json(
          { success: false, error: 'Access denied: Payment not in your branch' },
          { status: 403 }
        );
      }
    }

    // If receipt already has PDF data stored, return it
    if (payment.receipt?.pdfData) {
      return new NextResponse(payment.receipt.pdfData, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="receipt-${payment.receipt.receiptNumber}.pdf"`,
        },
      });
    }

    // Generate receipt PDF
    const receiptData = {
      receiptNumber: payment.receipt?.receiptNumber || payment.reference,
      clientName: payment.clientName,
      clientEmail: payment.client?.email || '',
      amount: payment.amount.toNumber(),
      method: payment.method,
      description: payment.description,
      standNumber: payment.stand?.standNumber,
      developmentName: payment.stand?.development?.name,
      receivedBy: payment.receivedByName || 'System',
      date: payment.createdAt.toISOString(),
    };

    const pdfBuffer = await generatePDF('receipt', receiptData);

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${receiptData.receiptNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
