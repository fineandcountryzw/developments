import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/managerAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/manager/reports/daily
 * Daily branch report
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch') || user.branch;
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    // Set date range for today
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get daily metrics
    const [
      newReservations,
      paymentsReceived,
      newClients,
      activities,
      totalRevenue
    ] = await Promise.all([
      prisma.reservation.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          stand: {
            branch: branch
          }
        }
      }),
      prisma.payment.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          officeLocation: branch,
          status: 'CONFIRMED'
        }
      }),
      prisma.client.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          branch: branch
        }
      }),
      prisma.activity.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          user: {
            branch: branch
          }
        }
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          officeLocation: branch,
          status: 'CONFIRMED'
        },
        _sum: {
          amount: true
        }
      })
    ]);

    const report = {
      branch,
      date: date.toISOString().split('T')[0],
      metrics: {
        newReservations,
        paymentsReceived,
        newClients,
        activities,
        totalRevenue: totalRevenue._sum?.amount || 0
      }
    };

    return apiSuccess(report);
  } catch (error: any) {
    logger.error('Error generating daily report', error, { module: 'API', action: 'GET_DAILY_REPORT' });
    return apiError(error.message || 'Failed to generate report', 500, ErrorCodes.FETCH_ERROR);
  }
}
