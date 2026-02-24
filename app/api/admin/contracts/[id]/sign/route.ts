import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/adminAuth';
import { SignatureManager } from '@/lib/signature-manager';
import { ContractGenerator } from '@/lib/contract-generator';
import { ComplianceChecker } from '@/lib/compliance-checker';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/admin/contracts/:id/sign
 * Record a signature on a contract
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    // For e-signature endpoints, user might be the signer, not admin
    // Handle both authenticated users and public signing links

    const { id } = await params;
    const body = await req.json();
    
    const {
      signatureId,  // ID of the signature request
      signatureData, // Base64 encoded signature
      signerEmail
    } = body;

    if (!signatureId || !signatureData) {
      return apiError('signatureId and signatureData are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get signature request
    const signature = await SignatureManager.getSignature(signatureId);
    if (!signature) {
      return apiError('Signature request not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify it hasn't expired
    if (signature.expiresAt && new Date(signature.expiresAt) < new Date()) {
      return apiError('Signature request has expired', 410, ErrorCodes.VALIDATION_ERROR);
    }

    // Record signature
    const updatedSig = await SignatureManager.recordSignature(
      signatureId,
      signatureData,
      req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined,
      req.headers.get('user-agent') || undefined,
      user?.id
    );

    // Get contract to check if all signatures complete
    const contractWithSigs = await ContractGenerator.getContractWithSignatures(id);
    const allSigned = contractWithSigs.signatures.every((s: any) => s.status === 'signed');

    // If all signatures complete, update contract status
    if (allSigned) {
      await ContractGenerator.updateStatus(id, 'signed', user?.id || 'system');
      
      // Log activity
      await ContractGenerator.logActivity(
        id,
        user?.id || 'system',
        'all_signed',
        {},
        { status: 'signed', completedAt: new Date() },
        req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null
      );
    }

    return apiSuccess({
      signature: updatedSig,
      contractComplete: allSigned,
      message: 'Signature recorded'
    });
  } catch (error: any) {
    logger.error('Sign contract error', error, { module: 'API', action: 'POST_CONTRACT_SIGN' });
    return apiError('Failed to record signature', 500, ErrorCodes.CREATE_ERROR, { details: error.message });
  }
}

/**
 * GET /api/admin/contracts/:id/sign
 * Get signature request details (for public signing page)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const signatureId = new URL(req.url).searchParams.get('signatureId');

    if (!signatureId) {
      return apiError('signatureId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get signature request
    const signature = await SignatureManager.getSignature(signatureId);
    if (!signature) {
      return apiError('Signature request not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify it matches the contract
    if (signature.contractId !== id) {
      return apiError('Invalid signature request', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get contract (minimal info for signing)
    const contract = await ContractGenerator.getContract(id);
    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    return apiSuccess({
      signature: {
        id: signature.id,
        signerName: signature.signerName,
        signerEmail: signature.signerEmail,
        signerRole: signature.signerRole,
        status: signature.status
      },
      contract: {
        title: contract.title,
        content: contract.content
      }
    });
  } catch (error: any) {
    logger.error('Get signature request error', error, { module: 'API', action: 'GET_CONTRACT_SIGN' });
    return apiError('Failed to fetch signature request', 500, ErrorCodes.FETCH_ERROR, { details: error.message });
  }
}