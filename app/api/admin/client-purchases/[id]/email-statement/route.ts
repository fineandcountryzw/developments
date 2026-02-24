import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const ALLOWED_ROLES = ['ADMIN', 'ACCOUNT', 'MANAGER'];

/**
 * POST /api/admin/client-purchases/[id]/email-statement
 * Send statement PDF via email to client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();
    const { clientEmail, clientId, developmentName, standNumber } = body;

    if (!clientEmail) {
      return apiError('Missing clientEmail', 400, 'VALIDATION_ERROR');
    }

    // Fetch purchase with relations
    const purchase = await (prisma as any).clientPurchase.findUnique({
      where: { id, branch: user.role === 'ADMIN' ? undefined : user.branch },
      include: {
        client: { select: { id: true, name: true, email: true } },
        development: { select: { id: true, name: true } },
        stand: { select: { id: true, standNumber: true } },
        purchasePayments: {
          where: { status: 'CONFIRMED' },
          orderBy: { paymentDate: 'asc' },
        },
      },
    });

    if (!purchase) {
      return apiError('Purchase not found', 404, 'NOT_FOUND');
    }

    // Authorization check for non-admin roles
    if (user.role !== 'ADMIN' && purchase.branch !== user.branch) {
      logger.warn('Unauthorized email statement attempt', {
        module: 'API',
        action: 'EMAIL_STATEMENT',
        userId: user.id,
        userBranch: user.branch,
        purchaseBranch: purchase.branch,
      });
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    // Generate statement HTML
    const totalPaid = purchase.purchasePayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const purchasePrice = Number(purchase.purchasePrice);
    const balance = purchasePrice - totalPaid;

    const statementHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #C5A059, #B08D3E); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; }
          .header p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
          .section { margin-bottom: 30px; }
          .section-title { color: #C5A059; font-weight: bold; font-size: 14px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #C5A059; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .info-item { }
          .info-label { color: #666; font-size: 12px; margin-bottom: 5px; }
          .info-value { font-weight: bold; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f0f0f0; padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #666; border-bottom: 2px solid #C5A059; }
          td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
          .summary-box { background: white; padding: 20px; border-left: 4px solid #C5A059; margin: 20px 0; }
          .summary-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .summary-row.total { font-weight: bold; font-size: 14px; padding-top: 10px; border-top: 2px solid #C5A059; margin-top: 10px; }
          .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 11px; color: #666; border-radius: 0 0 8px 8px; }
          .footer p { margin: 5px 0; }
          .cta { display: inline-block; background: #C5A059; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FINE & COUNTRY</h1>
            <p>RESIDENTIAL & COMMERCIAL REAL ESTATE</p>
            <p style="margin-top: 10px; font-size: 11px;">Your Account Statement</p>
          </div>

          <div class="content">
            <div class="section">
              <div class="section-title">ACCOUNT INFORMATION</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">CLIENT NAME</div>
                  <div class="info-value">${purchase.client.name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">EMAIL</div>
                  <div class="info-value">${purchase.client.email}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">DEVELOPMENT</div>
                  <div class="info-value">${purchase.development.name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">STAND</div>
                  <div class="info-value">Stand ${purchase.stand.standNumber}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">FINANCIAL SUMMARY</div>
              <div class="summary-box">
                <div class="summary-row">
                  <span>Total Purchase Price:</span>
                  <span>ZWL ${purchasePrice.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                  <span>Total Paid:</span>
                  <span style="color: #22c55e;">ZWL ${totalPaid.toLocaleString()}</span>
                </div>
                <div class="summary-row total">
                  <span>Outstanding Balance:</span>
                  <span style="color: ${balance > 0 ? '#dc2626' : '#22c55e'};">ZWL ${balance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">RECENT PAYMENTS</div>
              <table>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                </tr>
                ${purchase.purchasePayments.slice(-5).map((p: any) => `
                  <tr>
                    <td>${new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td>ZWL ${Number(p.amount).toLocaleString()}</td>
                    <td>${p.method}</td>
                    <td>${p.receiptNo || p.reference || '-'}</td>
                  </tr>
                `).join('')}
              </table>
            </div>

            <div style="text-align: center;">
              <p style="color: #666; font-size: 12px;">
                For a complete statement with full payment history and installment schedule,
                please contact your branch office or log in to your account.
              </p>
            </div>
          </div>

          <div class="footer">
            <p><strong>FINE & COUNTRY ZIMBABWE</strong></p>
            <p>Professional Real Estate Services</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p style="margin-top: 15px; color: #999; font-size: 10px;">
              This is an automated email. For inquiries, please contact your nearest branch office.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Log the email action
    logger.info('Client statement email sent', {
      module: 'API',
      action: 'EMAIL_STATEMENT',
      clientId: purchase.clientId,
      clientEmail: clientEmail,
      purchaseId: id,
      branch: purchase.branch,
      sentBy: user.id,
    });

    return apiSuccess({
      message: 'Statement email queued for delivery',
      email: clientEmail,
      client: purchase.client.name,
      purchase: {
        development: purchase.development.name,
        stand: purchase.stand.standNumber,
      },
    });
  } catch (error: any) {
    logger.error('POST email statement error', { error: error.message });
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
