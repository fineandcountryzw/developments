/**
 * POST /api/wizard/stands/mark-sold
 * Mark one or many stands as SOLD.
 * Requires ADMIN or MANAGER role. Managers scoped to their branch developments.
 */

import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/access-control';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { markStandsAsSold } from '@/lib/services/wizard-stand-actions';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Auth: require ADMIN or MANAGER
    const authResult = await requireManager();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    // Parse body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON body', 400, ErrorCodes.PARSE_ERROR);
    }

    const { developmentId, standNumbers, reason, notes } = body;

    // Validate required fields
    if (!developmentId || typeof developmentId !== 'string') {
      return apiError('developmentId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!Array.isArray(standNumbers) || standNumbers.length === 0) {
      return apiError('standNumbers must be a non-empty array', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (standNumbers.length > 100) {
      return apiError('Maximum 100 stands per request', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return apiError('reason is required (minimum 3 characters)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate all stand numbers are strings
    for (const sn of standNumbers) {
      if (typeof sn !== 'string' || sn.trim().length === 0) {
        return apiError('All stand numbers must be non-empty strings', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Scope check: managers can only act on developments in their branch
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

    // Execute
    const result = await markStandsAsSold(
      {
        developmentId,
        standNumbers: standNumbers.map((s: string) => s.trim()),
        reason: reason.trim(),
        notes: notes?.trim(),
      },
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branch: user.branch,
      }
    );

    const successCount = result.results.filter((r) => r.success).length;
    const failCount = result.results.filter((r) => !r.success).length;

    return apiSuccess({
      message: `${successCount} stand(s) marked as SOLD, ${failCount} failed`,
      developmentName: result.developmentName,
      results: result.results,
      summary: {
        total: result.results.length,
        success: successCount,
        failed: failCount,
      },
    });
  } catch (error: any) {
    console.error('[WIZARD MARK-SOLD ERROR]', error);
    return apiError(
      error.message || 'Failed to mark stands as sold',
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
