import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireManager, getAuthenticatedUser } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/installments
 * List all installment plans with optional filters
 * Access: Admin, Manager, Accountant (read-only)
 */
export async function GET(request: NextRequest) {
  try {
    // Allow Admin, Manager, or Accountant (ACCOUNT) access
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError('Unauthorized - Authentication required', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const role = user.role?.toUpperCase();
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNT') {
      return apiError('Unauthorized – Admin, Manager, or Accountant access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const clientId = request.nextUrl.searchParams.get('clientId');
    const developmentId = request.nextUrl.searchParams.get('developmentId');
    const status = request.nextUrl.searchParams.get('status');
    const branch = request.nextUrl.searchParams.get('branch');

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (developmentId) where.developmentId = developmentId;
    if (status) where.status = status;
    if (branch) where.client = { branch };

    const plans = await prisma.installmentPlan.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true, branch: true }
        },
        development: {
          select: { id: true, name: true, location: true, basePrice: true }
        },
        stand: {
          select: { id: true, standNumber: true, price: true }
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

    // Calculate stats
    const stats = {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'ACTIVE').length,
      completedPlans: plans.filter(p => p.status === 'COMPLETED').length,
      totalExpectedRevenue: plans.reduce((sum, p) => sum + Number(p.totalAmount), 0),
      totalCollected: plans.reduce((sum, p) => sum + Number(p.totalPaid), 0),
      overdueInstallments: plans.reduce((sum, p) => 
        sum + p.installments.filter(i => i.status === 'OVERDUE').length, 0
      )
    };

    // Add validation warnings for inconsistencies (for Accountant/Admin visibility)
    const plansWithWarnings = plans.map((plan: any) => {
      const warnings: string[] = [];
      
      // Check if totalPaid + remainingBalance = totalAmount
      const calculatedTotal = Number(plan.totalPaid) + Number(plan.remainingBalance);
      const totalAmount = Number(plan.totalAmount);
      const balanceDifference = Math.abs(calculatedTotal - totalAmount);
      const tolerance = 0.01;
      
      if (balanceDifference > tolerance) {
        warnings.push(`Balance inconsistency: totalPaid ($${Number(plan.totalPaid).toLocaleString()}) + remainingBalance ($${Number(plan.remainingBalance).toLocaleString()}) = $${calculatedTotal.toLocaleString()}, but totalAmount = $${totalAmount.toLocaleString()}. Difference: $${balanceDifference.toFixed(2)}`);
      }

      // Check if deposit + installments = totalAmount
      const depositAmount = Number(plan.depositAmount);
      const totalInstallments = plan.installments.reduce((sum: number, inst: any) => sum + Number(inst.amountDue), 0);
      const calculatedFromInstallments = depositAmount + totalInstallments;
      const installmentDifference = Math.abs(calculatedFromInstallments - totalAmount);
      
      if (installmentDifference > tolerance) {
        warnings.push(`Installment calculation mismatch: deposit ($${depositAmount.toLocaleString()}) + total installments ($${totalInstallments.toLocaleString()}) = $${calculatedFromInstallments.toLocaleString()}, but totalAmount = $${totalAmount.toLocaleString()}. Difference: $${installmentDifference.toFixed(2)}`);
      }

      // Check if stand price matches totalAmount (if stand exists)
      if (plan.standId && plan.stand) {
        const standPrice = Number(plan.stand.price || 0);
        const priceDifference = Math.abs(standPrice - totalAmount);
        if (priceDifference > tolerance) {
          warnings.push(`Stand price mismatch: stand price ($${standPrice.toLocaleString()}) does not match totalAmount ($${totalAmount.toLocaleString()}). Difference: $${priceDifference.toFixed(2)}`);
        }
      }

      return {
        ...plan,
        _warnings: warnings.length > 0 ? warnings : undefined
      };
    });

    // Transform to match UI DTO expectations
    const transformedPlans = plansWithWarnings.map((plan: any) => ({
      ...plan,
      // Flatten nested relations for UI
      clientName: plan.client?.name || '',
      clientEmail: plan.client?.email || '',
      clientPhone: plan.client?.phone || '',
      developmentName: plan.development?.name || '',
      developmentLocation: plan.development?.location || '',
      standNumber: plan.stand?.standNumber || '',
      // Map field names to UI expectations (convert Decimal to number)
      paidAmount: Number(plan.totalPaid) || 0,
      balance: Number(plan.remainingBalance) || 0,
      totalAmount: Number(plan.totalAmount) || 0,
      depositAmount: Number(plan.depositAmount) || 0,
      monthlyAmount: Number(plan.monthlyAmount) || 0,
      balanceAmount: Number(plan.balanceAmount) || 0,
      // Transform installments to match UI interface
      installments: (plan.installments || []).map((inst: any) => ({
        ...inst,
        installmentNumber: inst.installmentNo,
        installmentPlanId: inst.planId,
        amount: Number(inst.amountDue) || 0,
        amountDue: Number(inst.amountDue) || 0,
        amountPaid: Number(inst.amountPaid) || 0,
        paidAt: inst.paidDate,
      })),
      // Empty receipts array (receipts are on installments, not plan)
      receipts: []
    }));

    return apiSuccess({
      data: transformedPlans,
      stats
    });

  } catch (error: any) {
    logger.error('Installments API Error', error, { module: 'API', action: 'GET_ADMIN_INSTALLMENTS' });
    return apiError(error.message || 'Failed to fetch installment plans', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/installments
 * Create a new installment plan for a client
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const {
      clientId,
      standId,
      developmentId,
      totalAmount,
      depositAmount,
      periodMonths,
      startDate
    } = body;

    // Validate required fields
    if (!clientId || !standId || !developmentId || !totalAmount || !periodMonths) {
      return apiError('Missing required fields: clientId, standId, developmentId, totalAmount, periodMonths', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get stand to validate totalAmount matches stand price
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      select: { id: true, price: true, standNumber: true }
    });

    if (!stand) {
      return apiError('Stand not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Validate totalAmount matches stand price (source of truth)
    const standPrice = Number(stand.price);
    const totalAmountNum = Number(totalAmount);
    const priceDifference = Math.abs(standPrice - totalAmountNum);
    const priceTolerance = 0.01; // Allow $0.01 difference for rounding

    if (priceDifference > priceTolerance) {
      return apiError(
        `Total amount ($${totalAmountNum.toLocaleString()}) does not match stand price ($${standPrice.toLocaleString()}). Stand price is the source of truth.`,
        400,
        ErrorCodes.VALIDATION_ERROR,
        {
          code: 'PRICE_MISMATCH',
          standPrice,
          providedAmount: totalAmountNum,
          difference: priceDifference
        }
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
      return apiError(`Invalid period. Allowed periods: ${allowedPeriods.join(', ')} months`, 400, ErrorCodes.VALIDATION_ERROR);
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
      // Create the installment plan
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

    // Fetch the complete plan with installments
    const completePlan = await prisma.installmentPlan.findUnique({
      where: { id: plan.id },
      include: {
        client: true,
        development: true,
        installments: { orderBy: { installmentNo: 'asc' } }
      }
    });

    return apiSuccess({
      plan: completePlan,
      message: `Installment plan created: ${periodMonths} months, $${monthlyAmount.toFixed(2)}/month`
    }, 201);

  } catch (error: any) {
    logger.error('Installments API Create error', error, { module: 'API', action: 'POST_ADMIN_INSTALLMENTS' });
    return apiError(error.message || 'Failed to create installment plan', 500, ErrorCodes.CREATE_ERROR);
  }
}

/**
 * DELETE /api/admin/installments
 * Cancel/void an installment plan
 * Access: Admin, Manager only (Accountant is read-only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Only Admin and Manager can delete (Accountant is read-only)
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id, reason } = await request.json();

    if (!id) {
      return apiError('Installment plan ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get plan first
    const plan = await prisma.installmentPlan.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, branch: true } },
        installments: true
      }
    });

    if (!plan) {
      return apiError('Installment plan not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if plan has any payments - if so, soft delete by setting status
    const paidInstallments = plan.installments.filter(i => Number(i.amountPaid) > 0);
    
    if (paidInstallments.length > 0) {
      // Soft delete - just change status to CANCELLED
      const cancelledPlan = await prisma.installmentPlan.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          branch: plan.client?.branch || 'HEAD_OFFICE',
          userId: null,
          action: 'DELETE',
          module: 'INSTALLMENTS',
          recordId: plan.id,
          description: `Installment plan cancelled (soft): ${plan.client?.name} - ${plan.installments.length} installments - Reason: ${reason || 'Not specified'}`,
          changes: JSON.stringify({ cancelled: true, reason, cancelledBy: user?.email, hadPayments: true })
        }
      });

      return apiSuccess({
        plan: cancelledPlan,
        message: 'Installment plan cancelled (has existing payments)'
      });
    }

    // Hard delete - no payments made yet
    await prisma.$transaction(async (tx) => {
      // Delete all installments first
      await tx.installment.deleteMany({ where: { planId: id } });
      // Delete the plan
      await tx.installmentPlan.delete({ where: { id } });
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: plan.client?.branch || 'HEAD_OFFICE',
        userId: null,
        action: 'DELETE',
        module: 'INSTALLMENTS',
        recordId: plan.id,
        description: `Installment plan deleted: ${plan.client?.name} - Reason: ${reason || 'Not specified'}`,
        changes: JSON.stringify({ deleted: true, reason, deletedBy: user?.email })
      }
    });

    return apiSuccess({
      message: 'Installment plan deleted successfully'
    });

  } catch (error: any) {
    logger.error('Installments API Delete error', error, { module: 'API', action: 'DELETE_ADMIN_INSTALLMENTS' });
    return apiError(error.message || 'Failed to delete installment plan', 500, ErrorCodes.DELETE_ERROR);
  }
}
