import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/installments
 * Get installment plans related to developer's developments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Get developments where user is the developer
    const developments = await prisma.development.findMany({
      where: {
        developerEmail: session.user.email
      },
      select: { id: true, name: true, basePrice: true, installmentPeriods: true, depositPercentage: true }
    });

    const developmentIds = developments.map(d => d.id);

    // Get installment plans for those developments
    const plans = await prisma.installmentPlan.findMany({
      where: {
        developmentId: { in: developmentIds }
      },
      include: {
        client: {
          select: { name: true, email: true, phone: true }
        },
        development: {
          select: { name: true }
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
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats by development
    const byDevelopment = developments.map(dev => {
      const devPlans = plans.filter(p => p.developmentId === dev.id);
      return {
        developmentId: dev.id,
        developmentName: dev.name,
        allowedPeriods: dev.installmentPeriods || [12, 24, 48],
        depositPercentage: Number(dev.depositPercentage) || 30,
        basePrice: Number(dev.basePrice),
        totalPlans: devPlans.length,
        activePlans: devPlans.filter(p => p.status === 'ACTIVE').length,
        totalExpected: devPlans.reduce((sum, p) => sum + Number(p.totalAmount), 0),
        totalCollected: devPlans.reduce((sum, p) => sum + Number(p.totalPaid), 0),
        outstandingBalance: devPlans.reduce((sum, p) => sum + Number(p.remainingBalance), 0)
      };
    });

    // Calculate upcoming installments (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingInstallments = plans.flatMap(plan => 
      plan.installments
        .filter(i => 
          i.status === 'PENDING' && 
          new Date(i.dueDate) <= thirtyDaysFromNow
        )
        .map(i => ({
          ...i,
          installmentNumber: i.installmentNo,
          amount: Number(i.amountDue) || 0,
          amountPaid: Number(i.amountPaid) || 0,
          paidAt: i.paidDate,
          clientName: plan.client.name,
          developmentName: plan.development.name,
          planId: plan.id
        }))
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Transform plans to match UI DTO expectations
    const transformedPlans = plans.map((plan: any) => ({
      ...plan,
      // Flatten nested relations for UI
      clientName: plan.client?.name || '',
      clientEmail: plan.client?.email || '',
      developmentName: plan.development?.name || '',
      standNumber: plan.stand?.standNumber || '',
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

    // Summary stats
    const summary = {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'ACTIVE').length,
      completedPlans: plans.filter(p => p.status === 'COMPLETED').length,
      totalExpectedRevenue: plans.reduce((sum, p) => sum + Number(p.totalAmount), 0),
      totalCollected: plans.reduce((sum, p) => sum + Number(p.totalPaid), 0),
      outstandingBalance: plans.reduce((sum, p) => sum + Number(p.remainingBalance), 0),
      upcomingCount: upcomingInstallments.length,
      expectedNextMonth: upcomingInstallments.reduce((sum, i) => sum + Number(i.amountDue), 0)
    };

    return apiSuccess({
      data: transformedPlans,
      byDevelopment,
      upcomingInstallments,
      summary
    });

  } catch (error: any) {
    logger.error('Developer Installments API Error', error, { module: 'API', action: 'GET_DEVELOPER_INSTALLMENTS' });
    return apiError(error.message || 'Failed to fetch installment plans', 500, ErrorCodes.FETCH_ERROR);
  }
}
