import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { canAccessContract, type ContractScopeUser } from '@/lib/contract-access-control';
import { ContractGenerator, type DocumentVersionData } from '@/lib/contract-generator';

/**
 * GET /api/admin/contracts/[id]/document/[version]
 * Download a specific document version
 * 
 * Query params:
 * - version: Document version number (default: latest)
 * - type: Document type - 'html' | 'docx' | 'pdf' (default: pdf)
 * 
 * SECURITY: Enforces role-based access control
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const version = parseInt(searchParams.get('version') || '1');
    const documentType = (searchParams.get('type') || 'pdf') as 'html' | 'docx' | 'pdf';
    
    logger.info('GET /api/admin/contracts/[id]/document/[version]', { 
      module: 'API', 
      action: 'GET_CONTRACT_DOCUMENT',
      contractId: id,
      version,
      documentType
    });

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
      logger.warn('Contract document access denied', {
        module: 'API',
        action: 'GET_CONTRACT_DOCUMENT',
        contractId: id,
        userId: user.id,
        role: user.role
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Get contract with relations
    const contract = await prisma.generatedContract.findUnique({
      where: { id },
      include: {
        template: true,
        client: true,
        stand: {
          include: {
            development: true
          }
        }
      }
    });

    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Try to get specific version from document_versions table
    const versionRecord = await ContractGenerator.getLatestDocumentVersion(id, documentType);
    
    if (versionRecord) {
      // Return the stored document version
      logger.info('Serving stored document version', {
        contractId: id,
        version: versionRecord.version,
        documentType: versionRecord.documentType,
        storageUrl: versionRecord.storageUrl.substring(0, 50) + '...'
      });

      // Redirect to the storage URL for download
      return NextResponse.redirect(versionRecord.storageUrl);
    }

    // Fallback: Generate document on-the-fly
    logger.info('Generating document on-the-fly', {
      contractId: id,
      documentType
    });

    if (documentType === 'pdf') {
      // Generate PDF using the existing endpoint logic
      const downloadResponse = await generatePdfOnTheFly(contract);
      return downloadResponse;
    } else if (documentType === 'docx') {
      // Return DOCX if available in template
      if (contract.template?.templateType === 'docx' && contract.template?.templateFileUrl) {
        return NextResponse.redirect(contract.template.templateFileUrl);
      }
      return apiError('DOCX version not available', 404, ErrorCodes.NOT_FOUND);
    } else {
      // Return HTML content
      return new NextResponse(contract.htmlContent || contract.content, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="contract-${id}.html"`
        }
      });
    }
  } catch (error: any) {
    logger.error('CONTRACT DOCUMENT ERROR', error, { 
      module: 'API', 
      action: 'GET_CONTRACT_DOCUMENT' 
    });
    return apiError('Failed to get contract document', 500, ErrorCodes.FETCH_ERROR, { 
      details: error.message 
    });
  }
}

/**
 * Generate PDF on the fly using the existing download logic
 */
async function generatePdfOnTheFly(contract: any): Promise<NextResponse> {
  const { generatePDF } = await import('@/lib/pdf-generator');
  
  const templateName = contract.template?.name || contract.templateName || 'Contract';
  const clientName = contract.client?.name || 'Client';
  const standNumber = contract.standId;
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
        @page { size: A4; margin: 2cm; }
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
          font-weight: bold;
        }
        .content {
          margin-bottom: 40px;
          font-size: 11pt;
          line-height: 1.8;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 9pt;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <h1>${templateName}</h1>
          <p>Contract Reference: ${contract.id}</p>
          <p>Client: ${clientName}</p>
          <p>Stand: ${standNumber}</p>
          <p>Date: ${new Date(contract.createdAt).toLocaleDateString('en-GB')}</p>
        </div>
        <div class="content">
          ${contract.content || '<p>No contract content available.</p>'}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Fine & Country Zimbabwe</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Generate PDF
  const pdfBuffer = await generatePDF('contract', {
    id: contract.id,
    templateName,
    clientName,
    standNumber: standNumber || undefined,
    developmentName,
    htmlContent: html,
    status: contract.status,
    createdAt: contract.createdAt.toISOString(),
    signedAt: contract.signedAt?.toISOString(),
    signedBy: contract.signedBy ?? undefined
  });

  logger.info('Generated PDF on-the-fly', {
    contractId: contract.id,
    pdfSize: pdfBuffer.length
  });

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${templateName}-${clientName}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
