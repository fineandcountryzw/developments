import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Pool } from 'pg';
import { jsPDF } from 'jspdf';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Required for jsPDF - Vercel edge runtime does not support Buffer
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/statement
 * Generate developer financial statement (JSON or PDF format)
 * Scoped to logged-in developer's developments only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }
    const userEmail = session.user.email;
    const format = request.nextUrl.searchParams.get('format') || 'json';

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return apiError('Database not configured', 500, ErrorCodes.DB_UNAVAILABLE);
    }

    const pool = new Pool({ connectionString: databaseUrl });

    // Fetch developer's developments with stand counts
    const developmentsQuery = `
      SELECT 
        d.id,
        d.name,
        d.location,
        COALESCE(d.total_stands, 0) as "totalStands",
        d.base_price as "basePrice",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'SOLD'), 0)::int as "soldStands",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'RESERVED'), 0)::int as "reservedStands",
        COALESCE((SELECT COUNT(*) FROM stands s WHERE s.development_id = d.id AND s.status = 'AVAILABLE'), 0)::int as "availableStands"
      FROM developments d
      WHERE d.status = 'Active' AND d.developer_email = $1
      ORDER BY d.created_at DESC
    `;

    const devResult = await pool.query(developmentsQuery, [userEmail]);
    const developments = devResult.rows.map(dev => {
      const totalStands = parseInt(dev.totalStands) || 0;
      const soldStands = parseInt(dev.soldStands) || 0;
      const reservedStands = parseInt(dev.reservedStands) || 0;
      const availableStands = parseInt(dev.availableStands) || 0;
      const basePrice = parseFloat(dev.basePrice) || 25000;
      const totalRevenue = soldStands * basePrice;
      const pendingRevenue = reservedStands * basePrice * 0.3;
      const expectedRevenue = totalRevenue + pendingRevenue;
      const commission = totalRevenue * 0.05;
      const commissionPending = pendingRevenue * 0.05;

      return {
        id: dev.id,
        name: dev.name,
        location: dev.location,
        totalStands,
        soldStands,
        reservedStands,
        availableStands,
        totalRevenue,
        pendingRevenue,
        expectedRevenue,
        commission,
        commissionPending,
        basePrice
      };
    });

    const summary = {
      totalDevelopments: developments.length,
      totalStands: developments.reduce((sum, d) => sum + d.totalStands, 0),
      soldStands: developments.reduce((sum, d) => sum + d.soldStands, 0),
      reservedStands: developments.reduce((sum, d) => sum + d.reservedStands, 0),
      availableStands: developments.reduce((sum, d) => sum + d.availableStands, 0),
      totalRevenue: developments.reduce((sum, d) => sum + d.totalRevenue, 0),
      pendingRevenue: developments.reduce((sum, d) => sum + d.pendingRevenue, 0),
      totalExpectedRevenue: developments.reduce((sum, d) => sum + d.expectedRevenue, 0),
      commissionEarned: developments.reduce((sum, d) => sum + d.commission, 0),
      commissionPending: developments.reduce((sum, d) => sum + d.commissionPending, 0)
    };

    await pool.end();

    const statementData = {
      generatedAt: new Date().toISOString(),
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      developerEmail: userEmail,
      summary,
      developments
    };

    if (format === 'pdf') {
      const pdfBuffer = generateStatementPDF(statementData);
      const filename = `developer-statement-${new Date().toISOString().split('T')[0]}.pdf`;
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } else {
      return apiSuccess(statementData);
    }

  } catch (error: any) {
    logger.error('Developer Statement API Error', error, { module: 'API', action: 'GET_DEVELOPER_STATEMENT' });
    return apiError(error.message || 'Failed to generate statement', 500, ErrorCodes.FETCH_ERROR);
  }
}

function generateStatementPDF(data: any): Buffer {
  const doc = new jsPDF();
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
  const settings = branchSettings.Harare;

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

  doc.setFontSize(8);
  doc.text('Harare HQ', 190, 25, { align: 'right' });
  doc.text(settings.address, 190, 30, { align: 'right' });
  doc.text(settings.phone, 190, 35, { align: 'right' });
  doc.text(settings.email, 190, 40, { align: 'right' });

  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.text('DEVELOPER FINANCIAL STATEMENT', 105, 60, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 68, { align: 'center' });
  doc.text(`Period: ${data.period}`, 105, 74, { align: 'center' });

  let y = 90;
  doc.setLineWidth(0.2);
  doc.line(20, y, 190, y);
  y += 10;

  // Summary
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SUMMARY', 20, y);
  y += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  const summaryItems = [
    ['Total Developments:', data.summary.totalDevelopments.toString()],
    ['Total Stands:', data.summary.totalStands.toString()],
    ['  - Sold:', data.summary.soldStands.toString()],
    ['  - Reserved:', data.summary.reservedStands.toString()],
    ['  - Available:', data.summary.availableStands.toString()],
    ['Total Revenue:', `$${formatNumber(data.summary.totalRevenue)}`],
    ['Pending Revenue:', `$${formatNumber(data.summary.pendingRevenue)}`],
    ['Expected Revenue:', `$${formatNumber(data.summary.totalExpectedRevenue)}`],
    ['Commission Earned:', `$${formatNumber(data.summary.commissionEarned)}`],
    ['Commission Pending:', `$${formatNumber(data.summary.commissionPending)}`],
  ];

  summaryItems.forEach(([label, value]) => {
    doc.text(label, 25, y);
    doc.text(value, 150, y, { align: 'right' });
    y += 6;
  });

  y += 5;
  doc.line(20, y, 190, y);
  y += 10;

  // Development Breakdown
  if (data.developments.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DEVELOPMENT BREAKDOWN', 20, y);
    y += 8;

    data.developments.forEach((dev: any, idx: number) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${idx + 1}. ${dev.name}`, 25, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Location: ${dev.location}`, 30, y);
      y += 5;
      doc.text(`Stands: ${dev.totalStands} (${dev.soldStands} sold, ${dev.reservedStands} reserved, ${dev.availableStands} available)`, 30, y);
      y += 5;
      doc.text(`Revenue: $${formatNumber(dev.totalRevenue)}`, 30, y);
      doc.text(`Pending: $${formatNumber(dev.pendingRevenue)}`, 100, y);
      y += 5;
      doc.text(`Commission: $${formatNumber(dev.commission)}`, 30, y);
      y += 8;
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
