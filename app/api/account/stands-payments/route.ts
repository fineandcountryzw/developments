import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};
    
    if (branch && branch !== 'all') {
      where.branch = branch;
    }

    // Get stands with their related data
    const stands = await prisma.stand.findMany({
      where,
      include: {
        development: {
          select: {
            name: true,
            branch: true,
          },
        },
        payments: {
          where: {
            status: 'confirmed',
          },
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
        },
        installmentPlans: {
          include: {
            installments: {
              select: {
                id: true,
                amountDue: true,
                amountPaid: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
        generatedContracts: {
          select: {
            id: true,
            status: true,
            signedAt: true,
          },
        },
        reservations: {
          where: {
            status: 'CONFIRMED',
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data for frontend
    const transformedStands = stands.map((stand) => {
      const totalPaid = stand.payments.reduce((sum: number, p: { amount: { toNumber(): number } }) => sum + p.amount.toNumber(), 0);
      const standPrice = stand.price?.toNumber() || 0;
      const balance = standPrice - totalPaid;
      
      // Calculate payment status
      let paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
      if (balance <= 0) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      }
      
      // Check for overdue installments
      const installmentPlan = stand.installmentPlans[0];
      if (installmentPlan?.installments) {
        const hasOverdue = installmentPlan.installments.some(
          (inst: { status: string; dueDate: Date }) => inst.status === 'overdue' || 
            (inst.status === 'pending' && new Date(inst.dueDate) < new Date())
        );
        if (hasOverdue && balance > 0) {
          paymentStatus = 'overdue';
        }
      }

      // Calculate installment progress
      const totalInstallments = installmentPlan?.installments?.length || 0;
      const paidInstallments = installmentPlan?.installments?.filter(
        (inst: { status: string }) => inst.status === 'paid'
      ).length || 0;

      // Get last payment date
      const lastPaymentDate = stand.payments.length > 0 
        ? stand.payments[stand.payments.length - 1].createdAt.toISOString()
        : null;

      // Get next due date
      const nextDueInstallment = installmentPlan?.installments
        ?.filter((inst: { status: string }) => inst.status === 'pending')
        .sort((a: { dueDate: Date }, b: { dueDate: Date }) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      const nextDueDate = nextDueInstallment?.dueDate?.toISOString() || null;

      // Get client from confirmed reservation
      const client = stand.reservations[0]?.client;
      
      // Get contract status
      const contract = stand.generatedContracts[0];

      return {
        standId: stand.id,
        standNumber: stand.standNumber,
        developmentName: stand.development?.name || 'Unknown',
        clientName: client?.name || 'No Client',
        clientEmail: client?.email || '',
        standPrice,
        totalPaid,
        balance,
        paymentStatus,
        lastPaymentDate,
        nextDueDate,
        installmentPlan: !!installmentPlan,
        totalInstallments,
        paidInstallments,
        contractStatus: contract?.signedAt ? 'signed' : 
                       contract?.id ? 'pending' : 'none',
      };
    });

    // Filter by status if specified
    let filteredStands = transformedStands;
    if (status && status !== 'all') {
      filteredStands = transformedStands.filter((s) => s.paymentStatus === status);
    }

    // Filter by search if specified
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStands = filteredStands.filter(
        (s) =>
          s.standNumber.toLowerCase().includes(searchLower) ||
          s.developmentName.toLowerCase().includes(searchLower) ||
          s.clientName.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredStands,
    });
  } catch (error) {
    console.error('Error fetching stands payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stands payments' },
      { status: 500 }
    );
  }
}
