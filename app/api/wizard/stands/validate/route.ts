/**
 * POST /api/wizard/stands/validate
 * Validate and preview stand numbers before executing wizard actions.
 * Returns matched stands with their current status/price for preview.
 */

import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON body', 400, ErrorCodes.PARSE_ERROR);
    }

    const { developmentId, standNumbers } = body;

    if (!developmentId || typeof developmentId !== 'string') {
      return apiError('developmentId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!Array.isArray(standNumbers) || standNumbers.length === 0) {
      return apiError('standNumbers must be a non-empty array', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Scope check for managers
    if (user.role === 'MANAGER') {
      const dev = await prisma.development.findUnique({
        where: { id: developmentId },
        select: { branch: true },
      });

      if (!dev) {
        return apiError('Development not found', 404, ErrorCodes.DEVELOPMENT_NOT_FOUND);
      }

      if (user.branch && dev.branch !== user.branch) {
        return apiError(
          'You can only manage developments in your branch',
          403,
          ErrorCodes.ACCESS_DENIED
        );
      }
    }

    const uniqueNumbers = [...new Set(standNumbers.map((s: string) => s.trim().toUpperCase()))].filter(Boolean);

    // Fetch matching stands
    const stands = await prisma.stand.findMany({
      where: {
        developmentId,
        standNumber: { in: uniqueNumbers },
      },
      orderBy: { standNumber: 'asc' },
    });

    const foundNumbers = new Set(stands.map((s) => s.standNumber));
    const notFound = uniqueNumbers.filter((n) => !foundNumbers.has(n));

    // Categorize stands
    const available = stands.filter((s) => s.status === 'AVAILABLE');
    const reserved = stands.filter((s) => s.status === 'RESERVED');
    const sold = stands.filter((s) => s.status === 'SOLD');
    const withdrawn = stands.filter((s) => s.status === 'WITHDRAWN');
    // Note: BLOCKED and CANCELLED statuses may not exist until migration is applied
    const blocked = stands.filter((s) => (s.status as string) === 'BLOCKED');
    const cancelled = stands.filter((s) => (s.status as string) === 'CANCELLED');

    return apiSuccess({
      stands: stands.map((s) => {
        const stand = s as any; // Type assertion for new fields
        return {
          id: s.id,
          standNumber: s.standNumber,
          status: s.status,
          price: Number(s.price),
          pricePerSqm: s.pricePerSqm ? Number(s.pricePerSqm) : null,
          sizeSqm: s.sizeSqm ? Number(s.sizeSqm) : null,
          discountPercent: s.discountPercent ? Number(s.discountPercent) : null,
          discountAmount: stand.discountAmount ? Number(stand.discountAmount) : null,
          discountedPrice: stand.discountedPrice ? Number(stand.discountedPrice) : null,
          discountActive: s.discountActive,
          soldAt: stand.soldAt || null,
          reservedBy: s.reservedBy,
          canSell: ['AVAILABLE', 'RESERVED'].includes(s.status),
          canDiscount: !['WITHDRAWN', 'CANCELLED'].includes(s.status as string),
        };
      }),
      notFound,
      summary: {
        total: uniqueNumbers.length,
        found: stands.length,
        notFound: notFound.length,
        byStatus: {
          available: available.length,
          reserved: reserved.length,
          sold: sold.length,
          withdrawn: withdrawn.length,
          blocked: blocked.length,
          cancelled: cancelled.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[WIZARD VALIDATE ERROR]', error);
    return apiError(error.message || 'Validation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
