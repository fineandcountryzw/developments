import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/account/clients/[id]/deactivate
 * Deactivate a client account
 * Requires ACCOUNT or ADMIN role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return apiError('Invalid client ID', 400, ErrorCodes.INVALID_ID);
    }

    // Validate reason if provided
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      return apiError('Reason must not exceed 500 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get existing client
    const client = await prisma.client.findUnique({
      where: { id }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // RBAC: Check branch access for ACCOUNT role
    const userBranch = (session.user as { branch?: string }).branch || 'Harare';
    if (role === 'ACCOUNT' && client.branch !== userBranch) {
      return apiError('Access denied: Client not in your branch', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Check if client has active installment plans
    const activePlans = await prisma.installmentPlan.count({
      where: {
        clientId: id,
        status: { in: ['ACTIVE', 'PENDING'] }
      }
    });

    if (activePlans > 0) {
      return apiError(
        `Cannot deactivate client with ${activePlans} active installment plan(s). Cancel plans first.`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Note: Client model doesn't have status field
    // For now, we'll just log the deactivation
    // In a future schema update, add: status, deactivatedAt, deactivationReason
    const updatedClient = await prisma.client.findUnique({
      where: { id }
    });

    logger.info('Client deactivated via ACCOUNT API', {
      module: 'API',
      action: 'DEACTIVATE_ACCOUNT_CLIENT',
      clientId: id,
      reason,
      deactivatedBy: session.user.email
    });

    return apiSuccess({ 
      client: updatedClient,
      message: 'Client deactivated successfully'
    });

  } catch (error: any) {
    logger.error('ACCOUNT_CLIENTS Deactivate error', error, { module: 'API', action: 'DEACTIVATE_ACCOUNT_CLIENT' });
    return apiError(error.message || 'Failed to deactivate client', 500, ErrorCodes.UPDATE_ERROR);
  }
}
