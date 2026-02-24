import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/installments
 * Get installment plans for the logged-in client
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Find client by email
    const client = await prisma.client.findFirst({
      where: { email: session.user.email }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    const plans = await prisma.installmentPlan.findMany({
      where: { clientId: client.id },
      include: {
        development: {
          select: { id: true, name: true, location: true }
        },
        installments: {
          orderBy: { installmentNo: 'asc' },
          include: {
            receipt: {
              select: { id: true, receiptNumber: true, createdAt: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summary
    const summary = {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'ACTIVE').length,
      completedPlans: plans.filter(p => p.status === 'COMPLETED').length,
      totalOwed: plans.reduce((sum, p) => sum + Number(p.remainingBalance), 0),
      nextPaymentDue: plans
        .filter(p => p.status === 'ACTIVE' && p.nextDueDate)
        .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())[0]?.nextDueDate
    };

    // Transform to match UI DTO expectations
    const transformedPlans = plans.map((plan: any) => ({
      ...plan,
      // Flatten nested relations for UI
      developmentName: plan.development?.name || '',
      developmentLocation: plan.development?.location || '',
      // Map field names to UI expectations (convert Decimal to number)
      paidAmount: Number(plan.totalPaid) || 0,
      balance: Number(plan.remainingBalance) || 0,
      totalAmount: Number(plan.totalAmount) || 0,
      depositAmount: Number(plan.depositAmount) || 0,
      monthlyAmount: Number(plan.monthlyAmount) || 0,
      // Transform installments to match UI interface
      installments: (plan.installments || []).map((inst: any) => ({
        ...inst,
        installmentNumber: inst.installmentNo,
        installmentPlanId: inst.planId,
        amount: Number(inst.amountDue) || 0,
        amountPaid: Number(inst.amountPaid) || 0,
        paidAt: inst.paidDate,
      })),
    }));

    return apiSuccess({
      data: transformedPlans,
      summary
    });

  } catch (error: any) {
    logger.error('Client Installments API Error', error, { module: 'API', action: 'GET_CLIENT_INSTALLMENTS' });
    return apiError(error.message || 'Failed to fetch installment plans', 500, ErrorCodes.FETCH_ERROR);
  }
}
