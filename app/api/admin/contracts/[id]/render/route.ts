import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { canAccessContract, type ContractScopeUser } from '@/lib/contract-access-control';
import { Prisma } from '@prisma/client';
import { generatePDF } from '@/lib/pdf-generator';

export const runtime = 'nodejs';  // Required for Puppeteer

// Type for contract with relations
type GeneratedContractWithRelations = Prisma.GeneratedContractGetPayload<{
  include: {
    template: true;
    client: true;
    stand: {
      include: {
        development: true;
      };
    };
  };
}> & {
  templateSnapshot?: unknown;
};

/**
 * POST /api/admin/contracts/[id]/render
 * Render contract to HTML (can be printed as PDF)
 * 
 * SECURITY: Enforces role-based access control
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('POST /api/admin/contracts/[id]/render', { module: 'API', action: 'POST_ADMIN_CONTRACT_RENDER', contractId: id });

    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Build scoped user for access control
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch,
      clientId: (user as any).clientId
    };

    // SECURITY: Verify user can access this contract
    const hasAccess = await canAccessContract(scopedUser, id);
    if (!hasAccess) {
      logger.warn('Contract render access denied', {
        module: 'API',
        action: 'POST_ADMIN_CONTRACT_RENDER',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Get contract
    // Get contract
    // NOTE: Using select to avoid fetching missing columns (isOffline, etc.)
    const contract = await prisma.generatedContract.findUnique({
      where: { id },
      select: {
        id: true,
        templateName: true,
        standId: true,
        developerName: true,
        content: true,
        status: true,
        createdAt: true,
        signedAt: true,
        signedBy: true,
        templateSnapshot: true,
        template: {
          select: { name: true, content: true }
        },
        client: {
          select: { name: true }
        },
        stand: {
          select: {
            id: true,
            standNumber: true,
            development: {
              select: { name: true }
            }
          }
        }
      }
    }) as GeneratedContractWithRelations | null;

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Use template snapshot if available (for versioning), otherwise use current template
    const templateSnapshot = contract.templateSnapshot as Record<string, unknown> | null;
    const templateName = (templateSnapshot?.name as string) || (contract.template?.name) || 'Contract';
    const templateContent = contract.content || (templateSnapshot?.content as string) || (contract.template?.content) || '<p>No contract content available.</p>';

    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${templateName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
          }
          .document {
            background: white;
            max-width: 900px;
            margin: 0 auto;
            padding: 60px 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            line-height: 1.8;
          }
          .header {
            border-bottom: 3px solid #8B7500;
            padding-bottom: 30px;
            margin-bottom: 40px;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            color: #8B7500;
            margin-bottom: 15px;
          }
          .header .meta {
            font-size: 13px;
            color: #666;
            line-height: 1.6;
          }
          .content {
            margin-bottom: 50px;
            font-size: 15px;
            line-height: 1.9;
            white-space: pre-wrap;
          }
          .content p { margin-bottom: 15px; }
          .signature-page {
            page-break-before: always;
            margin-top: 80px;
            padding-top: 40px;
            border-top: 2px solid #ccc;
          }
          .signature-page h2 {
            font-size: 20px;
            color: #333;
            margin-bottom: 40px;
            border-bottom: 1px solid #8B7500;
            padding-bottom: 10px;
          }
          .signature-block {
            margin-bottom: 50px;
            page-break-inside: avoid;
          }
          .signer-info {
            font-size: 14px;
            margin-bottom: 15px;
          }
          .signer-info strong { color: #333; }
          .signer-info .label { color: #666; font-size: 13px; }
          .signature-line {
            border-bottom: 1px solid #000;
            width: 250px;
            margin-top: 35px;
            margin-bottom: 5px;
          }
          .signature-label {
            font-size: 12px;
            color: #666;
          }
          .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 12px;
            color: #999;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            margin: 5px 0;
          }
          .status-draft { background: #f0f0f0; color: #666; }
          .status-sent { background: #e3f2fd; color: #1976d2; }
          .status-signed { background: #e8f5e9; color: #388e3c; }
          .status-archived { background: #fafafa; color: #999; }
          @media print {
            body { background: white; padding: 0; }
            .document { box-shadow: none; padding: 40px; max-width: 100%; }
            .footer { text-align: right; }
            a { text-decoration: none; color: #333; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- Header -->
          <div class="header">
            <h1>${contract.template?.name || 'Contract'}</h1>
            <div class="meta">
              <p><strong>Contract ID:</strong> ${contract.id}</p>
              <p><strong>Client:</strong> ${contract.client?.name || 'Not specified'}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p><span class="status-badge status-${contract.status}">${contract.status.toUpperCase()}</span></p>
            </div>
          </div>

          <!-- Main Content -->
          <div class="content">
            ${contract.content || '<p>No contract content available.</p>'}
          </div>

          <!-- Signature Page -->
          <div class="signature-page">
            <h2>Signature Page</h2>
            ${contract.status === 'SIGNED'
        ? `
                <div class="signature-block">
                  <div class="signer-info">
                    <p><strong>Client:</strong></p>
                    <p>${contract.signedBy || contract.client?.name || 'Unknown'}</p>
                    <p><span class="label">Status:</span>
                      <span class="status-badge status-signed">
                        SIGNED
                      </span>
                    </p>
                    ${contract.signedAt ? `<p><span class="label">Signed:</span> ${new Date(contract.signedAt).toLocaleDateString()} at ${new Date(contract.signedAt).toLocaleTimeString()}</p>` : ''}
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Signature</div>
                </div>
              `
        : `
                <div class="signature-block">
                  <div class="signer-info">
                    <p><strong>Client:</strong></p>
                    <p>${contract.client?.name || 'Not assigned'}</p>
                    <p><span class="label">Status:</span>
                      <span class="status-badge status-${contract.status.toLowerCase()}">
                        ${contract.status}
                      </span>
                    </p>
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Signature</div>
                </div>
              `
      }
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>This is a confidential document intended only for the authorized recipient(s).</p>
            <p>Generated on ${new Date().toLocaleString()} | Contract ID: ${contract.id}</p>
            <p style="margin-top: 10px;">© 2025 Fine & Country Zimbabwe. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generate PDF from HTML using Puppeteer
    const pdfBuffer = await generatePDF('contract', {
      id: contract.id,
      templateName: contract.template?.name || 'Contract',
      clientName: contract.client?.name || 'Not specified',
      standNumber: contract.stand?.standNumber || contract.standId,
      developmentName: contract.stand?.development?.name || contract.developerName || 'Development',
      htmlContent: html,  // The HTML we generated above
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.signedAt?.toISOString(),
      signedBy: contract.signedBy ?? undefined
    });

    logger.info('Contract rendered as PDF', {
      module: 'API',
      action: 'POST_ADMIN_CONTRACT_RENDER',
      contractId: contract.id,
      pdfSize: pdfBuffer.length
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contract-${contract.id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    logger.error('CONTRACTS ERROR', error, { module: 'API', action: 'POST_ADMIN_CONTRACT_RENDER' });
    return apiError('Failed to render contract', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}
