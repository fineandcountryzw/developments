import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { generatePDF } from '@/lib/pdf-generator';

// Force Node.js runtime for Puppeteer PDF generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ standId: string }> }
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

    const { standId } = await params;

    // Get stand with all related data
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      include: {
        development: {
          select: {
            name: true,
            branch: true,
          },
        },
        payments: {
          where: {
            status: 'confirmed',
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        reservations: {
          where: {
            status: 'CONFIRMED',
          },
          include: {
            client: true,
          },
          take: 1,
        },
        installmentPlans: {
          include: {
            installments: true,
          },
          take: 1,
        },
      },
    });

    if (!stand) {
      return NextResponse.json(
        { success: false, error: 'Stand not found' },
        { status: 404 }
      );
    }

    // IDOR Protection: Check branch access
    // ACCOUNT/ADMIN can access stands in their branch only
    const userRole = user.role?.toUpperCase();
    if (userRole === 'ACCOUNT' || userRole === 'ADMIN') {
      const userBranch = user.branch || 'Harare';
      if (stand.branch !== userBranch && stand.branch !== 'all') {
        return NextResponse.json(
          { success: false, error: 'Access denied: Stand not in your branch' },
          { status: 403 }
        );
      }
    }

    const client = stand.reservations[0]?.client;
    const installmentPlan = stand.installmentPlans[0];

    // Calculate totals
    const totalPaid = stand.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const standPrice = stand.price?.toNumber() || 0;
    const balance = standPrice - totalPaid;

    // Generate statement data
    const statementData = {
      standNumber: stand.standNumber,
      developmentName: stand.development?.name || 'Unknown',
      branch: stand.branch,
      clientName: client?.name || 'Unknown',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || '',
      standPrice,
      totalPaid,
      balance,
      payments: stand.payments.map((p) => ({
        date: p.createdAt.toISOString(),
        amount: p.amount.toNumber(),
        method: p.method,
        reference: p.reference,
      })),
      installments: installmentPlan?.installments.map((inst) => ({
        number: inst.installmentNo,
        dueDate: inst.dueDate.toISOString(),
        amountDue: inst.amountDue.toNumber(),
        amountPaid: inst.amountPaid.toNumber(),
        status: inst.status,
      })) || [],
      generatedAt: new Date().toISOString(),
    };

    // Generate PDF
    const pdfBuffer = await generatePDF('statement', statementData);

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${stand.standNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating statement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate statement' },
      { status: 500 }
    );
  }
}
