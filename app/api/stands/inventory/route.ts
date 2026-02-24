/**
 * Stands Inventory API
 * GET /api/stands/inventory
 * 
 * Unified endpoint for stands inventory across all dashboards.
 * Automatically scopes data based on user's role.
 * 
 * Query Parameters:
 * - developmentId: Filter by specific development
 * - status: Filter by status (AVAILABLE, RESERVED, SOLD, BLOCKED)
 * - search: Search by stand number or client name
 * - sizeMin/sizeMax: Filter by size range
 * - priceMin/priceMax: Filter by price range
 * - sortBy: standNumber, sizeSqm, price, updatedAt, status
 * - sortOrder: asc, desc
 * - page: Page number (default 1)
 * - pageSize: Page size (default 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  getStandsInventory, 
  InventoryFilters,
  canUserReserve,
  canUserSell,
} from '@/lib/services/stands-inventory-service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('GET /api/stands/inventory', {
      module: 'API',
      action: 'GET_STANDS_INVENTORY',
      userId: user.id,
      role: user.role,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const filters: InventoryFilters = {
      developmentId: searchParams.get('developmentId') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as InventoryFilters['sortBy']) || 'standNumber',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200),
    };

    // Optional numeric filters
    const sizeMin = searchParams.get('sizeMin');
    const sizeMax = searchParams.get('sizeMax');
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');

    if (sizeMin) filters.sizeMin = parseFloat(sizeMin);
    if (sizeMax) filters.sizeMax = parseFloat(sizeMax);
    if (priceMin) filters.priceMin = parseFloat(priceMin);
    if (priceMax) filters.priceMax = parseFloat(priceMax);

    // Get inventory using centralized service
    const result = await getStandsInventory(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
      filters
    );

    // Attach permission info for UI
    const permissions = {
      canReserve: canUserReserve(user.role),
      canSell: canUserSell(user.role),
    };

    return NextResponse.json({
      success: true,
      ...result,
      permissions,
    });
  } catch (error: any) {
    logger.error('GET /api/stands/inventory failed', {
      module: 'API',
      action: 'GET_STANDS_INVENTORY',
      error: error.message,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}
