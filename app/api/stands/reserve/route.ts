/**
 * Reserve Stand API
 * POST /api/stands/reserve
 * 
 * Reserve a stand for a client.
 * 
 * Body:
 * - standId: string (required)
 * - clientId?: string (existing client)
 * - clientName?: string (create new client)
 * - clientEmail?: string
 * - clientPhone?: string
 * - agentId?: string
 * - reservationFee?: number
 * - expiryDate?: string (ISO date)
 * - notes?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  reserveStand, 
  canUserReserve,
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
    if (!canUserReserve(user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to reserve stands' },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { standId, clientId, clientName, clientEmail, clientPhone, agentId, reservationFee, expiryDate, notes } = body;

    if (!standId) {
      return NextResponse.json(
        { success: false, error: 'standId is required' },
        { status: 400 }
      );
    }

    if (!clientId && !clientName) {
      return NextResponse.json(
        { success: false, error: 'Either clientId or clientName is required' },
        { status: 400 }
      );
    }

    logger.info('POST /api/stands/reserve', {
      module: 'API',
      action: 'RESERVE_STAND',
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

    // Execute reserve action
    const result = await reserveStand(
      {
        standId,
        clientId,
        clientName,
        clientEmail,
        clientPhone,
        agentId,
        reservationFee,
        expiryDate,
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
      message: `Stand ${result.standNumber} reserved successfully`,
      data: result,
    });
  } catch (error: any) {
    logger.error('POST /api/stands/reserve failed', {
      module: 'API',
      action: 'RESERVE_STAND',
      error: error.message,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reserve stand' },
      { status: 500 }
    );
  }
}
