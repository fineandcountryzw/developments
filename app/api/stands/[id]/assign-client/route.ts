/**
 * Assign Client to Stand API
 * POST /api/stands/[id]/assign-client
 * 
 * Links a client to a stand, updates related sales and payments,
 * generates a client statement, and recalculates dashboard stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AssignClientRequest {
  clientId?: string;
  createClient?: {
    fullName: string;
    phone?: string;
    email?: string;
    nationalId?: string;
    address?: string;
    dateOfBirth?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

async function generateClientStatement(
  clientId: string,
  standId: string
): Promise<void> {
  // Fetch all data needed for statement
  const sale = await prisma.offlineSale.findFirst({
    where: { standId },
    include: {
      stand: {
        include: {
          development: {
            include: { developer: true },
          },
        },
      },
      client: true,
      payments: { orderBy: { paymentDate: 'asc' } },
    },
  });

  if (!sale) return;

  try {
    // Import jsPDF dynamically (server-side)
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Generate PDF content
    doc.setFontSize(16);
    doc.text('Client Account Statement', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Client: ${sale.client?.name || 'Unknown'}`, 20, 40);
    doc.text(`Stand: ${sale.stand.standNumber}`, 20, 50);
    doc.text(`Development: ${sale.stand.development.name}`, 20, 60);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);

    // Payment history
    let y = 90;
    doc.text('Payment History:', 20, y);
    y += 10;

    sale.payments.forEach((payment, idx) => {
      doc.text(
        `${idx + 1}. ${payment.paymentDate.toLocaleDateString()} - $${Number(payment.amount).toLocaleString()}`,
        25,
        y
      );
      y += 8;
    });

    // Save PDF as bytes
    const pdfBytes = doc.output('arraybuffer');

    // Save to database
    await prisma.clientStatement.create({
      data: {
        id: uuidv4(),
        clientId,
        standId,
        saleId: sale.id,
        pdfData: Buffer.from(pdfBytes),
        generatedAt: new Date(),
        periodStart: sale.saleDate,
        periodEnd: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to generate statement:', error);
    // Don't fail the whole operation if statement generation fails
  }
}

async function recalculateDashboardStats(): Promise<void> {
  // This could trigger a background job or update cached stats
  // For now, we'll just log it
  console.log('Dashboard stats recalculation triggered');
}

// ─────────────────────────────────────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: standId } = await params;
    const body: AssignClientRequest = await request.json();

    // Validate request
    if (!body.clientId && !body.createClient) {
      return NextResponse.json(
        { error: 'Either clientId or createClient data is required' },
        { status: 400 }
      );
    }

    let finalClientId = body.clientId;

    // Create new client if provided
    if (!body.clientId && body.createClient) {
      const newClient = await prisma.client.create({
        data: {
          id: uuidv4(),
          name: body.createClient.fullName,
          phone: body.createClient.phone || '',
          email: body.createClient.email || `imported.${body.createClient.fullName.toLowerCase().replace(/\s+/g, '.')}@legacy.import`,
          nationalId: body.createClient.nationalId,
          branch: 'Harare',
          isProspect: false,
          updatedAt: new Date(),
        },
      });
      finalClientId = newClient.id;
    }

    if (!finalClientId) {
      return NextResponse.json(
        { error: 'Failed to create or find client' },
        { status: 400 }
      );
    }

    // Execute updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Link client to stand
      const stand = await tx.stand.update({
        where: { id: standId },
        data: { 
          clientId: finalClientId,
          updatedAt: new Date(),
        },
        include: {
          development: true,
        },
      });

      // 2. Link client to offline sale
      await tx.offlineSale.updateMany({
        where: { standId },
        data: { 
          clientId: finalClientId,
          updatedAt: new Date(),
        },
      });

      // 3. Link client to offline payments (via sale)
      const sales = await tx.offlineSale.findMany({
        where: { standId },
        select: { id: true },
      });

      for (const sale of sales) {
        await tx.offlinePayment.updateMany({
          where: { offlineSaleId: sale.id },
          data: { 
            notes: {
              set: `Payment for ${stand.standNumber} - Client assigned`,
            },
          },
        });
      }

      // 4. Update or create client-stand relationship record if you have one
      // This is optional depending on your schema

      return { stand, clientId: finalClientId };
    });

    // 5. Auto-generate client statement (outside transaction to not block)
    try {
      await generateClientStatement(finalClientId, standId);
    } catch (stmtError) {
      console.error('Statement generation failed:', stmtError);
      // Don't fail the whole request if statement fails
    }

    // 6. Recalculate dashboard stats
    await recalculateDashboardStats();

    return NextResponse.json({
      success: true,
      stand: result.stand,
      clientId: result.clientId,
      message: 'Client assigned successfully',
    });

  } catch (error) {
    console.error('Assign client error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to assign client',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
