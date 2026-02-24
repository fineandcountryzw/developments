
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { BillingAllocationService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { requireAdminOrAccountant } from '@/lib/access-control';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const paymentId = params.id;

        // Auth check using standard helper
        const authResult = await requireAdminOrAccountant(request, { limit: 10, windowMs: 60000 });
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const body = await request.json();
        const { reason } = body;

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return apiError('Void reason is required', 400, ErrorCodes.VALIDATION_ERROR);
        }

        logger.info('Void payment request received', {
            module: 'API',
            action: 'VOID_PAYMENT',
            paymentId,
            userId: user.id,
            branch: user.branch
        });

        const result = await BillingAllocationService.voidPayment(
            paymentId,
            user.id,
            reason
        );

        if (!result.success) {
            return apiError(result.error || 'Failed to void payment', 400, ErrorCodes.UPDATE_ERROR);
        }

        return apiSuccess({ success: true, message: 'Payment voided successfully' });

    } catch (error) {
        logger.error('Void payment API error', error as Error, {
            module: 'API',
            action: 'VOID_PAYMENT_ERROR',
            // paymentId available in scope if defined before try, but mostly undefined if error happens early
        });
        return apiError('Internal server error', 500, ErrorCodes.INTERNAL_ERROR);
    }
}
