import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { SignatureManager } from '@/lib/signature-manager';
import { ContractGenerator } from '@/lib/contract-generator';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/admin/contracts/:id/send-for-signature
 * Send contract for signature request
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
      signers = []  // Array of { name, email, role }
    } = body;

    if (!signers || signers.length === 0) {
      return apiError('At least one signer is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get contract
    const contract = await ContractGenerator.getContract(id);
    if (!contract) {
      return apiError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Create signature requests
    const signatures = [];
    for (const signer of signers) {
      const sig = await SignatureManager.createSignatureRequest(
        id,
        signer.name,
        signer.email,
        signer.role || 'buyer'
      );

      // Send signature request email
      await SignatureManager.sendSignatureRequest(
        sig.id,
        signer.email,
        contract.title
      );

      signatures.push(sig);
    }

    // Log activity
    await ContractGenerator.logActivity(
      id,
      user.id,
      'sent_for_signature',
      { status: contract.status },
      { status: 'pending' },
      req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null
    );

    return apiSuccess({
      signatures,
      contractId: id,
      message: 'Signature requests sent'
    });
  } catch (error: any) {
    logger.error('Send for signature error', error, { module: 'API', action: 'POST_CONTRACT_SEND_FOR_SIGNATURE' });
    return apiError('Failed to send signature requests', 500, ErrorCodes.CREATE_ERROR, { details: error.message });
  }
}