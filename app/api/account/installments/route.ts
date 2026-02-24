import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/installments
 * Get installment plans with details
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      development: {
        branch: branch,
      },
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const [plans, total] = await Promise.all([
      prisma.installmentPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
          development: {
            select: {
              name: true,
            },
          },
          installments: {
            orderBy: { installmentNo: 'asc' },
            select: {
              id: true,
              installmentNo: true,
              amountDue: true,
              amountPaid: true,
              dueDate: true,
              paidDate: true,
              status: true,
            },
          },
        },
      }),
      prisma.installmentPlan.count({ where }),
    ]);

    // Transform to match UI DTO expectations
    const transformedPlans = plans.map((plan: any) => ({
      ...plan,
      // Flatten nested relations for UI
      clientName: plan.client?.name || '',
      clientEmail: plan.client?.email || '',
      clientPhone: plan.client?.phone || '',
      developmentName: plan.development?.name || '',
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
      plans: transformedPlans,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    logger.error('ACCOUNT_INSTALLMENTS Error', error, { module: 'API', action: 'GET_ACCOUNT_INSTALLMENTS' });
    return apiError('Failed to fetch installment plans', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/account/installments
 * Create a new installment plan for a client
 * Requires ACCOUNT or ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = (session.user as { role?: string }).role?.toUpperCase();
    if (!['ACCOUNT', 'ADMIN'].includes(role || '')) {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const body = await request.json();
    const {
      clientId,
      standId,
      developmentId,
      totalAmount,
      depositAmount,
      periodMonths,
      startDate,
      branch
    } = body;

    // Validate required fields
    if (!clientId || !standId || !developmentId || !totalAmount || !periodMonths) {
      return apiError('Missing required fields: clientId, standId, developmentId, totalAmount, periodMonths', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // RBAC: Check branch access for ACCOUNT role
    const userBranch = (session.user as { branch?: string }).branch || 'Harare';
    if (role === 'ACCOUNT' && branch && branch !== userBranch) {
      return apiError('Access denied: Cannot create plans for other branches', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Get stand to validate totalAmount matches stand price
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      select: { id: true, price: true, standNumber: true, branch: true }
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Additional RBAC: Verify stand is in user's branch
    if (role === 'ACCOUNT' && stand.branch !== userBranch && stand.branch !== 'all') {
      return apiError('Access denied: Stand not in your branch', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Validate totalAmount matches stand price
    const standPrice = Number(stand.price);
    const totalAmountNum = Number(totalAmount);
    const priceDifference = Math.abs(standPrice - totalAmountNum);
    const priceTolerance = 0.01;

    if (priceDifference > priceTolerance) {
      return apiError(
        `Total amount ($${totalAmountNum.toLocaleString()}) does not match stand price ($${standPrice.toLocaleString()})`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Get development to verify installment period is allowed
    const development = await prisma.development.findUnique({
      where: { id: developmentId }
    });

    if (!development) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    const allowedPeriods = (development.installmentPeriods as number[]) || [12, 24, 48];
    if (!allowedPeriods.includes(periodMonths)) {
      return apiError(`Invalid period. Allowed: ${allowedPeriods.join(', ')} months`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Calculate installment details
    const depositPercentage = Number(development.depositPercentage) || 30;
    const calculatedDeposit = depositAmount || (totalAmount * depositPercentage / 100);
    const balanceAmount = totalAmount - calculatedDeposit;
    const monthlyAmount = balanceAmount / periodMonths;

    const planStartDate = startDate ? new Date(startDate) : new Date();
    const planEndDate = new Date(planStartDate);
    planEndDate.setMonth(planEndDate.getMonth() + periodMonths);

    // Create the plan with installments in a transaction
    const plan = await prisma.$transaction(async (tx) => {
      const newPlan = await tx.installmentPlan.create({
        data: {
          clientId,
          standId,
          developmentId,
          totalAmount,
          depositAmount: calculatedDeposit,
          depositPaid: false,
          balanceAmount,
          periodMonths,
          monthlyAmount,
          totalPaid: 0,
          remainingBalance: totalAmount,
          paidInstallments: 0,
          status: 'ACTIVE',
          startDate: planStartDate,
          endDate: planEndDate,
          nextDueDate: planStartDate
        }
      });

      // Generate individual installments
      const installments = [];
      for (let i = 1; i <= periodMonths; i++) {
        const dueDate = new Date(planStartDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        installments.push({
          planId: newPlan.id,
          installmentNo: i,
          amountDue: monthlyAmount,
          amountPaid: 0,
          dueDate,
          status: 'PENDING'
        });
      }

      await tx.installment.createMany({ data: installments });

      return newPlan;
    });

    logger.info('Installment plan created via ACCOUNT API', {
      module: 'API',
      action: 'POST_ACCOUNT_INSTALLMENTS',
      planId: plan.id,
      clientId,
      standId,
      branch: userBranch,
      createdBy: session.user.email
    });

    // Fetch the complete plan with installments
    const completePlan = await prisma.installmentPlan.findUnique({
      where: { id: plan.id },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        development: { select: { name: true } },
        installments: { orderBy: { installmentNo: 'asc' } }
      }
    });

    return apiSuccess({
      plan: completePlan,
      message: `Installment plan created: ${periodMonths} months, $${monthlyAmount.toFixed(2)}/month`
    }, 201);

  } catch (error: any) {
    logger.error('ACCOUNT_INSTALLMENTS Create error', error, { module: 'API', action: 'POST_ACCOUNT_INSTALLMENTS' });
    return apiError(error.message || 'Failed to create installment plan', 500, ErrorCodes.CREATE_ERROR);
  }
}
