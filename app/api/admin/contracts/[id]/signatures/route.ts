import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { SignatureManager } from '@/lib/signature-manager';
import { ContractGenerator } from '@/lib/contract-generator';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/contracts/:id/signatures
 * Get all signatures for a contract
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Verify contract exists
    const contract = await ContractGenerator.getContract(id);
    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get all signatures
    const signatures = await SignatureManager.getContractSignatures(id);

    // Calculate summary
    const total = signatures.length;
    const signed = signatures.filter(s => s.status === 'signed').length;
    const pending = signatures.filter(s => s.status === 'pending').length;
    const declined = signatures.filter(s => s.status === 'declined').length;

    return apiSuccess({
      contractId: id,
      summary: {
        total,
        signed,
        pending,
        declined,
        percentage: total > 0 ? Math.round((signed / total) * 100) : 0
      },
      signatures: signatures.map(s => ({
        id: s.id,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        signerRole: s.signerRole,
        status: s.status,
        sentAt: s.sentAt,
        signedAt: s.signedAt,
        expiresAt: s.expiresAt
      }))
    });
  } catch (error: any) {
    logger.error('Get signatures error', error, { module: 'API', action: 'GET_CONTRACT_SIGNATURES' });
    return apiError('Failed to fetch signatures', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}

/**
 * POST /api/admin/contracts/:id/signatures
 * Add a new signature request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;
    const body = await req.json();
    
    const {
      signerName,
      signerEmail,
      signerRole = 'buyer'
    } = body;

    if (!signerName || !signerEmail) {
      return apiError('signerName and signerEmail are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify contract exists
    const contract = await ContractGenerator.getContract(id);
    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Create signature request
    const signature = await SignatureManager.createSignatureRequest(
      id,
      signerName,
      signerEmail,
      signerRole
    );

    // Send email
    await SignatureManager.sendSignatureRequest(
      signature.id,
      signerEmail,
      contract.title
    );

    return apiSuccess({
      signature,
      message: 'Signature request sent'
    }, 201);
  } catch (error: any) {
    logger.error('Create signature error', error, { module: 'API', action: 'POST_CONTRACT_SIGNATURES' });
    return apiError('Failed to create signature request', 500, ErrorCodes.CREATE_ERROR, { details: error.message });
  }
}