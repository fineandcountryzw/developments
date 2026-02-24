import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/access-control';
import { getDataFilter } from '@/lib/dashboard-permissions';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/client/reservations
 * Get reservations for the authenticated client
 * Role-based access: Clients can only see their own reservations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Verify CLIENT role
    if (user.role?.toUpperCase() !== 'CLIENT') {
      return apiError('Forbidden - Client access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Get role-based data filter - ensures clients only see their own data
    const dataFilter = getDataFilter(user.role, user.id);

    // Get client record to match by email/phone for unclaimed reservations
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { email: user.email.toLowerCase().trim() },
        ],
      },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });

    const clientId = client?.id || dataFilter?.clientId || user.id;
    const clientEmail = client?.email?.toLowerCase().trim() || user.email.toLowerCase().trim();
    const clientPhone = client?.phone?.trim().replace(/\s/g, '');

    // Get client's reservations (by clientId/userId AND also by email/phone for unclaimed)
    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          // Directly linked reservations
          {
            OR: [
              { clientId: clientId },
              { userId: user.id },
            ],
          },
          // Unclaimed reservations matching email/phone (within last 30 days)
          {
            AND: [
              {
                OR: [
                  { userId: null },
                  { clientId: null },
                ],
              },
              {
                OR: [
                  {
                    client: {
                      email: {
                        equals: clientEmail,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  ...(clientPhone
                    ? [
                        {
                          client: {
                            phone: {
                              contains: clientPhone,
                              mode: 'insensitive' as const,
                            },
                          },
                        },
                      ]
                    : []),
                ],
              },
              {
                status: {
                  in: ['PENDING', 'CONFIRMED'],
                },
              },
              {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
        ],
      },
      include: {
        stand: {
          select: {
            standNumber: true,
            development: {
              select: {
                name: true,
                location: true,
                termsPdfUrl: true,
                refundPdfUrl: true,
              }
            }
          }
        },
        agent: {
          select: {
            name: true,
            phone: true,
            email: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(reservations);
  } catch (error: any) {
    logger.error('Error fetching client reservations', error, { module: 'API', action: 'GET_CLIENT_RESERVATIONS' });
    return apiSuccess([], 200); // Return 200 with empty data to prevent dashboard errors
  }
}
