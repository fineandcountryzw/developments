import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { canAccessContract, type ContractScopeUser } from '@/lib/contract-access-control';
import { generatePDF } from '@/lib/pdf-generator';

export const runtime = 'nodejs';  // Required for Puppeteer

/**
 * GET /api/admin/contracts/[id]/download
 * Download contract as PDF
 * 
 * SECURITY: Enforces role-based access control - users can only
 * download contracts within their authorized scope.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('GET /api/admin/contracts/[id]/download', { module: 'API', action: 'GET_ADMIN_CONTRACT_DOWNLOAD', contractId: id });

    // Auth check
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Build scoped user for access control verification
    const scopedUser: ContractScopeUser = {
      id: user.id || user.email,
      email: user.email,
      role: (user.role?.toUpperCase() || 'ADMIN') as any,
      branch: user.branch,
      clientId: (user as any).clientId
    };

    // SECURITY: Verify user can access this specific contract
    const hasAccess = await canAccessContract(scopedUser, id);
    if (!hasAccess) {
      logger.warn('Contract download access denied', {
        module: 'API',
        action: 'GET_ADMIN_CONTRACT_DOWNLOAD',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Get contract with relations (already verified access)
    // Get contract with relations (already verified access)
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
        template: {
          select: { name: true }
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
    });

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get client and template names
    const templateName = contract.template?.name || contract.templateName || 'Contract';
    const clientName = contract.client?.name || 'Client';
    const standNumber = contract.stand?.standNumber || contract.standId;
    const developmentName = contract.stand?.development?.name || contract.developerName || 'Development';

    // Generate PDF-ready HTML
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${templateName} - ${clientName}</title>
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            background: white;
            color: #333;
            line-height: 1.7;
            font-size: 12pt;
          }
          .document {
            background: white;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
          }
          .header {
            border-bottom: 3px solid #8B7500;
            padding-bottom: 20px;
            margin-bottom: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 24pt;
            color: #8B7500;
            margin-bottom: 10px;
            font-weight: bold;
          }
          .header .company {
            font-size: 14pt;
            color: #333;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .header .meta {
            font-size: 10pt;
            color: #666;
            line-height: 1.6;
          }
          .content {
            margin-bottom: 40px;
            font-size: 11pt;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          .content h1 { font-size: 18pt; color: #8B7500; margin: 25px 0 15px; text-align: center; }
          .content h2 { font-size: 14pt; color: #333; margin: 20px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .content h3 { font-size: 12pt; color: #444; margin: 15px 0 8px; }
          .content p { margin-bottom: 12px; text-align: justify; }
          .content ul, .content ol { margin: 10px 0 10px 25px; }
          .content li { margin-bottom: 6px; }
          .content table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .content th, .content td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10pt; }
          .content th { background: #f5f5f5; font-weight: bold; }
          .content strong { color: #333; }
          .signature-page {
            page-break-before: always;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #8B7500;
          }
          .signature-page h2 {
            font-size: 16pt;
            color: #333;
            margin-bottom: 30px;
            text-align: center;
          }
          .signature-block {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .signer-info {
            font-size: 11pt;
            margin-bottom: 10px;
          }
          .signer-info p { margin-bottom: 5px; }
          .signer-info strong { color: #333; }
          .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            margin-top: 30px;
            margin-bottom: 5px;
          }
          .signature-label {
            font-size: 10pt;
            color: #666;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 10pt;
            font-weight: bold;
          }
          .status-draft { background: #f0f0f0; color: #666; }
          .status-sent { background: #e3f2fd; color: #1976d2; }
          .status-signed { background: #e8f5e9; color: #388e3c; }
          .status-archived { background: #fafafa; color: #999; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 9pt;
            color: #999;
          }
          @media print {
            body { background: white; }
            .document { padding: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- Header -->
          <div class="header">
            <div class="company">Fine & Country Zimbabwe (Private) Limited</div>
            <h1>${templateName}</h1>
            <div class="meta">
              <p><strong>Contract Reference:</strong> ${contract.id}</p>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Stand:</strong> ${standNumber}</p>
              <p><strong>Date Generated:</strong> ${new Date(contract.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><span class="status-badge status-${contract.status.toLowerCase()}">${contract.status}</span></p>
            </div>
          </div>

          <!-- Main Content -->
          <div class="content">
            ${contract.content || '<p>No contract content available.</p>'}
          </div>

          <!-- Signature Page -->
          <div class="signature-page">
            <h2>Signatures</h2>
            
            ${contract.status === 'SIGNED'
        ? `
                <div class="signature-block">
                  <div class="signer-info">
                    <p><strong>CLIENT SIGNATURE</strong></p>
                    <p>Name: ${contract.signedBy || clientName}</p>
                    <p>Status: <span class="status-badge status-signed">SIGNED</span></p>
                    ${contract.signedAt ? `<p>Date Signed: ${new Date(contract.signedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Client Signature</div>
                </div>
                
                <div class="signature-block" style="margin-top: 40px;">
                  <div class="signer-info">
                    <p><strong>COMPANY REPRESENTATIVE</strong></p>
                    <p>Fine & Country Zimbabwe (Private) Limited</p>
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Authorized Signatory</div>
                </div>
              `
        : `
                <div class="signature-block">
                  <div class="signer-info">
                    <p><strong>CLIENT SIGNATURE</strong></p>
                    <p>Name: ${clientName}</p>
                    <p>Status: <span class="status-badge status-${contract.status.toLowerCase()}">${contract.status}</span></p>
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Client Signature</div>
                  <p style="font-size: 9pt; color: #999; margin-top: 5px;">Date: _____________________</p>
                </div>
                
                <div class="signature-block" style="margin-top: 40px;">
                  <div class="signer-info">
                    <p><strong>COMPANY REPRESENTATIVE</strong></p>
                    <p>Fine & Country Zimbabwe (Private) Limited</p>
                  </div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Authorized Signatory</div>
                  <p style="font-size: 9pt; color: #999; margin-top: 5px;">Date: _____________________</p>
                </div>
              `
      }
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>This document is confidential and intended only for the authorized recipient(s).</p>
            <p>Contract Reference: ${contract.id} | Generated: ${new Date().toLocaleString('en-GB')}</p>
            <p style="margin-top: 8px;">© ${new Date().getFullYear()} Fine & Country Zimbabwe (Private) Limited. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generate PDF from HTML using Puppeteer
    const pdfBuffer = await generatePDF('contract', {
      id: contract.id,
      templateName: templateName,
      clientName: clientName,
      standNumber: standNumber || undefined,
      developmentName: developmentName,
      htmlContent: html,  // The HTML we generated above
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.signedAt?.toISOString(),
      signedBy: contract.signedBy ?? undefined
    });

    logger.info('Contract downloaded as PDF', {
      module: 'API',
      action: 'GET_ADMIN_CONTRACT_DOWNLOAD',
      contractId: contract.id,
      pdfSize: pdfBuffer.length
    });

    // Return as downloadable PDF
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${templateName}-${clientName}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    logger.error('CONTRACTS DOWNLOAD ERROR', error, { module: 'API', action: 'GET_ADMIN_CONTRACT_DOWNLOAD' });
    return apiError('Failed to download contract', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}
