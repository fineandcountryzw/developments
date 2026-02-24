import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { ContractGenerator } from '@/lib/contract-generator';

/**
 * GET /api/client/documents/download
 * Download client-specific contract documents with version support
 * 
 * Query params:
 * - contractId: The contract ID to download
 * - version: Document version number (default: latest)
 * - type: Document type - 'html' | 'docx' | 'pdf' (default: pdf)
 * 
 * SECURITY: Client can only download their own contracts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const versionParam = searchParams.get('version');
    const documentType = (searchParams.get('type') || 'pdf') as 'html' | 'docx' | 'pdf';
    
    logger.info('GET /api/client/documents/download', {
      module: 'API',
      action: 'CLIENT_DOCUMENT_DOWNLOAD',
      contractId,
      version: versionParam,
      documentType
    });

    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    if (!contractId) {
      return apiError('Contract ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get client's record
    const client = await prisma.client.findFirst({
      where: { email: user.email }
    });

    if (!client) {
      return apiError('Client profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get the contract and verify ownership
    const contract = await prisma.generatedContract.findUnique({
      where: { id: contractId },
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

    // Verify client owns this contract
    if (contract.clientId !== client.id) {
      logger.warn('Client attempted to download another client contract', {
        module: 'API',
        action: 'CLIENT_DOCUMENT_DOWNLOAD',
        contractId,
        clientId: client.id,
        contractClientId: contract.clientId
      });
      return apiError('Access denied to this contract', 403, ErrorCodes.AUTH_REQUIRED);
    }

    // Get template separately for DOCX fields
    const template = contract.template ? await prisma.contractTemplate.findUnique({
      where: { id: contract.template.id }
    }) : null;

    // Type-safe access to DOCX fields
    const templateWithDocx = template ? {
      ...template,
      templateType: (template as any).templateType,
      templateFileUrl: (template as any).templateFileUrl
    } : null;

    const version = versionParam ? parseInt(versionParam) : 1;

    // Try to get specific version from document_versions table
    const versionRecord = await ContractGenerator.getLatestDocumentVersion(contractId, documentType);
    
    if (versionRecord) {
      logger.info('Serving stored document version to client', {
        contractId,
        version: versionRecord.version,
        documentType: versionRecord.documentType
      });

      // Redirect to the storage URL for download
      return NextResponse.redirect(versionRecord.storageUrl);
    }

    // Fallback: Return based on document type
    if (documentType === 'pdf') {
      // For PDF, redirect to the main download endpoint
      const downloadUrl = `/api/admin/contracts/${contractId}/download`;
      return NextResponse.redirect(downloadUrl);
    } else if (documentType === 'docx') {
      // Use templateWithDocx for DOCX-specific fields
      if (templateWithDocx?.templateType === 'docx' && templateWithDocx.templateFileUrl) {
        return NextResponse.redirect(templateWithDocx.templateFileUrl);
      }
      return apiError('DOCX version not available', 404, ErrorCodes.NOT_FOUND);
    } else {
      // Return HTML content
      return new NextResponse(contract.htmlContent || contract.content, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="contract-${contractId}.html"`
        }
      });
    }
  } catch (error: any) {
    logger.error('CLIENT DOCUMENT DOWNLOAD ERROR', error, {
      module: 'API',
      action: 'CLIENT_DOCUMENT_DOWNLOAD'
    });
    return apiError('Failed to download document', 500, ErrorCodes.FETCH_ERROR, {
      details: error.message
    });
  }
}
