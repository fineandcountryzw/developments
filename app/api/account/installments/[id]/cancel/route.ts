import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/account/installments/[id]/cancel
 * Cancel an installment plan
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

    // Get existing plan
    const plan = await prisma.installmentPlan.findUnique({
      where: { id },
      include: {
        development: { select: { branch: true } },
        client: { select: { branch: true } }
      }
    });

    if (!plan) {
      return apiError('Installment plan not found', 404, ErrorCodes.NOT_FOUND);
    }

    // RBAC: Check branch access for ACCOUNT role
    const userBranch = (session.user as { branch?: string }).branch || 'Harare';
    const planBranch = plan.development.branch || plan.client.branch;
    if (role === 'ACCOUNT' && planBranch !== userBranch && planBranch !== 'all') {
      return apiError('Access denied: Plan not in your branch', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Prevent cancellation if plan is already completed or cancelled
    if (plan.status === 'COMPLETED') {
      return apiError('Cannot cancel a completed plan', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (plan.status === 'CANCELLED') {
      return apiError('Plan is already cancelled', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Update plan status to CANCELLED
    const updatedPlan = await prisma.installmentPlan.update({
      where: { id },
      data: {
        status: 'CANCELLED'
      }
    });

    logger.info('Installment plan cancelled via ACCOUNT API', {
      module: 'API',
      action: 'CANCEL_ACCOUNT_INSTALLMENT',
      planId: id,
      reason,
      cancelledBy: session.user.email
    });

    return apiSuccess({ 
      plan: updatedPlan,
      message: 'Installment plan cancelled successfully'
    });

  } catch (error: any) {
    logger.error('ACCOUNT_INSTALLMENTS Cancel error', error, { module: 'API', action: 'CANCEL_ACCOUNT_INSTALLMENT' });
    return apiError(error.message || 'Failed to cancel installment plan', 500, ErrorCodes.UPDATE_ERROR);
  }
}
