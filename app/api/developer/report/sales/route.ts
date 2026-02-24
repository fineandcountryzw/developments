import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/developer/report/sales
 * Generate sales report in CSV or JSON format
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const format = request.nextUrl.searchParams.get('format') || 'csv';
    const period = request.nextUrl.searchParams.get('period') || '30d';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date('2000-01-01');
        break;
    }

    // Fetch sold stands for this developer's developments only
    const soldStands = await prisma.stand.findMany({
      where: {
        status: {
          equals: 'SOLD' as any
        },
        updatedAt: {
          gte: startDate
        },
        development: {
          developerEmail: session.user.email
        }
      },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true,
            basePrice: true,
            developerEmail: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculate totals
    const totalSales = soldStands.length;
    const totalRevenue = soldStands.reduce((sum, s) => sum + (typeof s.price === 'number' ? s.price : parseFloat(String(s.price || 0))), 0);
    const averagePrice = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Extract unique buyers/clients
    const buyersMap = new Map();
    
    const salesByBuyer = soldStands.map(stand => {
      const price = typeof stand.price === 'number' ? stand.price : parseFloat(String(stand.price || 0));
      return {
        standNumber: stand.standNumber,
        development: stand.development?.name || 'Unknown',
        location: stand.development?.location || 'Unknown',
        price: price,
        basePrice: stand.development?.basePrice ? (typeof stand.development.basePrice === 'number' ? stand.development.basePrice : parseFloat(String(stand.development.basePrice))) : 0,
        saleDate: stand.updatedAt?.toISOString().split('T')[0] || 'N/A',
        client: stand.reservedBy || 'Unknown',
        commission: price * 0.05
      };
    });

    const reportData = {
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalSales: totalSales,
        totalRevenue,
        averagePrice,
        totalCommission: totalRevenue * 0.05
      },
      sales: salesByBuyer
    };

    if (format === 'csv') {
      const csv = generateCSV(reportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sales-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else if (format === 'pdf') {
      const pdfBuffer = generateSalesReportPDF(reportData);
      const filename = `sales-report-${new Date().toISOString().split('T')[0]}.pdf`;
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } else {
      return apiSuccess(reportData);
    }

  } catch (error: any) {
    logger.error('Developer Sales Report API Error', error, { module: 'API', action: 'GET_DEVELOPER_SALES_REPORT' });
    return apiError(error.message || 'Failed to generate report', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * Generate CSV content
 */
function generateCSV(data: any): string {
  const headers = [
    'Stand Number',
    'Development',
    'Location',
    'Sale Price',
    'Base Price',
    'Sale Date',
    'Client',
    'Commission (5%)'
  ];

  const rows = data.sales.map((sale: any) => [
    sale.standNumber,
    sale.development,
    sale.location,
    sale.price,
    sale.basePrice,
    sale.saleDate,
    sale.client,
    sale.commission.toFixed(2)
  ]);

  // Add summary rows
  rows.push([]);
  rows.push(['SUMMARY', '', '', '', '', '', '', '']);
  rows.push(['Total Sales:', data.summary.totalSales, '', '', '', '', '', '']);
  rows.push(['Total Revenue:', '', formatNumber(data.summary.totalRevenue), '', '', '', '', '']);
  rows.push(['Average Price:', '', formatNumber(data.summary.averagePrice), '', '', '', '', '']);
  rows.push(['Total Commission (5%):', '', formatNumber(data.summary.totalCommission), '', '', '', '', '']);

  const csvContent = [
    headers.join(','),
    ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Generate PDF using jsPDF
 */
function generateSalesReportPDF(data: any): Buffer {
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
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 31, { align: 'center' });
  doc.setLineWidth(0.8);
  doc.line(20, 37, 190, 37);

  doc.setFontSize(8);
  doc.text('Harare HQ', 190, 20, { align: 'right' });
  doc.text(settings.address, 190, 25, { align: 'right' });
  doc.text(settings.phone, 190, 30, { align: 'right' });
  doc.text(settings.email, 190, 35, { align: 'right' });

  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.text('SALES REPORT', 105, 50, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleDateString()}`, 105, 57, { align: 'center' });
  doc.text(`Period: ${data.period}`, 105, 63, { align: 'center' });

  let y = 75;
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
    ['Total Sales:', data.summary.totalSales.toString()],
    ['Total Revenue:', `$${formatNumber(data.summary.totalRevenue)}`],
    ['Average Price:', `$${formatNumber(data.summary.averagePrice)}`],
    ['Total Commission (5%):', `$${formatNumber(data.summary.totalCommission)}`],
  ];

  summaryItems.forEach(([label, value]) => {
    doc.text(label, 25, y);
    doc.text(value, 150, y, { align: 'right' });
    y += 6;
  });

  y += 5;
  doc.line(20, y, 190, y);
  y += 10;

  // Sales Details
  if (data.sales.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SALES DETAILS', 20, y);
    y += 8;

    // Table header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Stand', 25, y);
    doc.text('Development', 50, y);
    doc.text('Price', 120, y);
    doc.text('Date', 145, y);
    doc.text('Commission', 165, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    data.sales.forEach((sale: any, idx: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(sale.standNumber, 25, y);
      doc.text(sale.development.substring(0, 25), 50, y);
      doc.text(`$${formatNumber(sale.price)}`, 120, y);
      doc.text(sale.saleDate, 145, y);
      doc.text(`$${formatNumber(sale.commission)}`, 165, y);
      y += 6;
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
}
