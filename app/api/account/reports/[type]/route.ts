import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { generatePDF } from '@/lib/pdf-generator';

// Force Node.js runtime for Puppeteer PDF generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/account/reports/[type]
 * Generate financial reports in PDF or CSV format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';
    const format = searchParams.get('format') || 'csv';

    let data: unknown[] = [];
    let headers: string[] = [];
    let reportTitle = '';

    switch (type) {
      case 'revenue': {
        reportTitle = 'Revenue Report';
        headers = ['Date', 'Reference', 'Client', 'Amount', 'Type', 'Method', 'Status'];
        
        const payments = await prisma.payment.findMany({
          where: {
            officeLocation: branch,
            status: 'CONFIRMED',
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });

        data = payments.map((p) => ({
          Date: new Date(p.createdAt).toLocaleDateString(),
          Reference: p.reference,
          Client: p.clientName,
          Amount: Number(p.amount),
          Type: p.paymentType,
          Method: p.method,
          Status: p.status,
        }));
        break;
      }

      case 'payments': {
        reportTitle = 'Payments Report';
        headers = ['Date', 'Reference', 'Client', 'Amount', 'Type', 'Method', 'Status', 'Verified'];
        
        const payments = await prisma.payment.findMany({
          where: { officeLocation: branch },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });

        data = payments.map((p) => ({
          Date: new Date(p.createdAt).toLocaleDateString(),
          Reference: p.reference,
          Client: p.clientName,
          Amount: Number(p.amount),
          Type: p.paymentType,
          Method: p.method,
          Status: p.status,
          Verified: p.verificationStatus,
        }));
        break;
      }

      case 'outstanding': {
        reportTitle = 'Outstanding Balances Report';
        headers = ['Client', 'Stand', 'Development', 'Total Amount', 'Paid', 'Balance', 'Next Due Date', 'Status'];
        
        const plans = await prisma.installmentPlan.findMany({
          where: {
            status: { in: ['ACTIVE', 'DEFAULTED'] },
            development: { branch },
          },
          include: {
            client: { select: { name: true } },
            development: { select: { name: true } },
          },
          orderBy: { remainingBalance: 'desc' },
        });

        data = plans.map((p) => ({
          Client: p.client?.name || 'N/A',
          Stand: p.standId,
          Development: p.development?.name || 'N/A',
          'Total Amount': Number(p.totalAmount),
          Paid: Number(p.totalPaid),
          Balance: Number(p.remainingBalance),
          'Next Due Date': p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString() : '-',
          Status: p.status,
        }));
        break;
      }

      case 'commissions': {
        reportTitle = 'Commission Report';
        headers = ['Agent', 'Month', 'Total Amount', 'Status', 'Paid Date'];
        
        const commissions = await prisma.commissionPayout.findMany({
          where: { branch },
          orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
        });

        const agentIds = [...new Set(commissions.map((c) => c.agentId))];
        const agents = await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        });
        const agentMap = new Map(agents.map((a) => [a.id, a.name]));

        data = commissions.map((c) => ({
          Agent: agentMap.get(c.agentId) || 'Unknown',
          Month: c.month,
          'Total Amount': Number(c.total),
          Status: c.status,
          'Paid Date': c.paidAt ? new Date(c.paidAt).toLocaleDateString() : '-',
        }));
        break;
      }

      case 'installments': {
        reportTitle = 'Installment Status Report';
        headers = ['Client', 'Stand', 'Development', 'Period', 'Monthly Amount', 'Progress', 'Next Due', 'Status'];
        
        const plans = await prisma.installmentPlan.findMany({
          where: {
            development: { branch },
          },
          include: {
            client: { select: { name: true } },
            development: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        data = plans.map((p) => {
          const progress = p.totalAmount && Number(p.totalAmount) > 0 
            ? Math.round((Number(p.totalPaid) / Number(p.totalAmount)) * 100)
            : 0;
          return {
            Client: p.client?.name || 'N/A',
            Stand: p.standId,
            Development: p.development?.name || 'N/A',
            Period: `${p.periodMonths} months`,
            'Monthly Amount': Number(p.monthlyAmount),
            Progress: `${progress}%`,
            'Next Due': p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString() : '-',
            Status: p.status,
          };
        });
        break;
      }

      case 'inventory': {
        reportTitle = 'Inventory Report';
        headers = ['Development', 'Location', 'Stand Number', 'Price', 'Size (sqm)', 'Status'];
        
        const stands = await prisma.stand.findMany({
          where: { branch },
          include: {
            development: { select: { name: true, location: true } },
          },
          orderBy: [{ developmentId: 'asc' }, { standNumber: 'asc' }],
        });

        data = stands.map((s) => ({
          Development: s.development?.name || 'N/A',
          Location: s.development?.location || 'N/A',
          'Stand Number': s.standNumber,
          Price: Number(s.price),
          'Size (sqm)': s.sizeSqm ? Number(s.sizeSqm) : '-',
          Status: s.status,
        }));
        break;
      }

      case 'statements': {
        reportTitle = 'Client Statements Report';
        headers = ['Client', 'Email', 'Phone', 'Total Contract Value', 'Total Paid', 'Outstanding Balance', 'Stands Owned'];
        
        const clients = await prisma.client.findMany({
          where: { branch },
          include: {
            payments: { where: { verificationStatus: 'Verified' } },
            reservations: {
              include: {
                stand: { select: { price: true } },
              },
            },
          },
        });

        data = clients.map((client) => {
          const totalPaid = client.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const totalContractValue = client.reservations.reduce((sum, r) => sum + (Number(r.stand?.price) || 0), 0);
          const outstandingBalance = Math.max(0, totalContractValue - totalPaid);

          return {
            Client: client.name,
            Email: client.email,
            Phone: client.phone,
            'Total Contract Value': totalContractValue,
            'Total Paid': totalPaid,
            'Outstanding Balance': outstandingBalance,
            'Stands Owned': client.reservations.length,
          };
        });
        break;
      }

      default:
        return apiError('Invalid report type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (format === 'csv') {
      // Generate CSV
      const csvRows = [headers.join(',')];
      
      for (const row of data as Record<string, unknown>[]) {
        const values = headers.map((h) => {
          const val = row[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val;
        });
        csvRows.push(values.join(','));
      }

      const csv = csvRows.join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-report-${branch}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (format === 'pdf') {
      // Generate PDF using Puppeteer
      const reportData = {
        title: reportTitle,
        branch,
        generatedAt: new Date().toISOString(),
        headers,
        data: data as Record<string, unknown>[],
      };

      const pdfBuffer = await generatePDF('report', reportData);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${type}-report-${branch}-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    }

    // For any other format, return JSON
    return apiSuccess({
      title: reportTitle,
      branch,
      generatedAt: new Date().toISOString(),
      headers,
      data,
    });
  } catch (error: any) {
    logger.error('ACCOUNT_REPORTS Error', error, { module: 'API', action: 'GET_ACCOUNT_REPORTS', reportType: type });
    return apiError('Failed to generate report', 500, ErrorCodes.FETCH_ERROR);
  }
}
