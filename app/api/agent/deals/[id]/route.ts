import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAgent } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/agent/deals/:id
 * Get detailed information about a specific deal including related data
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAgent();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Get the deal with full details
    const deal = await prisma.stand.findUnique({
      where: { id },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        reservations: {
          where: { agentId: user.id },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });

    if (!deal) {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    // Verify agent has access to this deal
    const hasAccess = deal.reservations && deal.reservations.length > 0;
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Calculate commission (5% of stand price)
    const commission = (deal.price as any) * 0.05;

    // Get installment plan if exists
    const installmentPlan = await prisma.installmentPlan.findFirst({
      where: {
        standId: deal.id
      },
      include: {
        installments: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    return apiSuccess({
      id: deal.id,
      standNumber: deal.standNumber,
      development: deal.development,
      price: deal.price,
      status: deal.status,
      reservation: deal.reservations[0] || null,
      installmentPlan: installmentPlan,
      commission: {
        rate: 0.05,
        amount: commission,
        status: deal.status === 'SOLD' ? 'earned' : 'pending'
      },
      summary: {
        totalInstallments: installmentPlan?.installments.length || 0
      }
    });

  } catch (error: any) {
    logger.error('Error fetching deal details', error, { module: 'API', action: 'GET_AGENT_DEAL' });
    return apiError(error.message || 'Failed to fetch deal details', 500, ErrorCodes.FETCH_ERROR);
  }
}
