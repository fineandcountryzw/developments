/**
 * Sell Stand API
 * POST /api/stands/sell
 * 
 * Mark a stand as sold.
 * 
 * Body:
 * - standId: string (required)
 * - reason: string (required)
 * - clientId?: string
 * - salePrice?: number
 * - notes?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  sellStand, 
  canUserSell,
  canUserAccessStand,
} from '@/lib/services/stands-inventory-service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    if (!canUserSell(user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to sell stands' },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { standId, reason, clientId, salePrice, notes } = body;

    if (!standId) {
      return NextResponse.json(
        { success: false, error: 'standId is required' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'reason is required' },
        { status: 400 }
      );
    }

    logger.info('POST /api/stands/sell', {
      module: 'API',
      action: 'SELL_STAND',
      userId: user.id,
      standId,
    });

    // Check access to stand
    const hasAccess = await canUserAccessStand(
      { id: user.id, email: user.email, role: user.role, branch: user.branch },
      standId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this stand' },
        { status: 403 }
      );
    }

    // Execute sell action
    const result = await sellStand(
      {
        standId,
        reason,
        clientId,
        salePrice,
        notes,
      },
      {
        id: user.id,
        email: user.email,
        name: user.name || null,
        role: user.role,
        branch: user.branch,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Stand ${result.standNumber} marked as sold`,
      data: result,
    });
  } catch (error: any) {
    logger.error('POST /api/stands/sell failed', {
      module: 'API',
      action: 'SELL_STAND',
      error: error.message,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sell stand' },
      { status: 500 }
    );
  }
}
