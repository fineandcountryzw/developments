/**
 * Stands Inventory Service
 * 
 * Centralized service for stands inventory management across all dashboards.
 * Handles inventory queries, reserve actions, and sell actions with:
 * - Server-side filtering, sorting, and pagination
 * - Role-based visibility scoping via visibility-service
 * - Transaction-safe mutations with optimistic locking
 * - Audit logging for all state changes
 * - Email notifications for critical actions
 * 
 * Used by: Admin, Manager, Accounts, Developer dashboards
 * @module lib/services/stands-inventory-service
 */

import prisma from '@/lib/prisma';
import { Prisma, StandStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { logAuditTrail } from '@/lib/auditTrail';
import { getVisibleDevelopmentIds, VisibilityUser } from './visibility-service';
import { sendWizardActionEmail } from '../wizard-email-service';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryFilters {
  developmentId?: string;
  status?: string | string[];
  phase?: string;
  section?: string;
  block?: string;
  sizeMin?: number;
  sizeMax?: number;
  priceMin?: number;
  priceMax?: number;
  pricePerSqmMin?: number;
  pricePerSqmMax?: number;
  search?: string;
  reservedBy?: string;
  sortBy?: 'standNumber' | 'sizeSqm' | 'price' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InventoryStand {
  id: string;
  standNumber: string;
  developmentId: string;
  developmentName: string;
  branch: string;
  phase?: string;
  section?: string;
  block?: string;
  sizeSqm: number;
  price: number;
  pricePerSqm: number;
  discountPercent?: number;
  discountedPrice?: number;
  hasDiscount: boolean;
  status: string;
  reservedBy?: string;
  reservedByName?: string;
  reservationExpiry?: string;
  soldAt?: string;
  soldReason?: string;
  updatedAt: string;
}

export interface InventorySummary {
  totalCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  blockedCount: number;
  totalValue: number;
  availableValue: number;
}

export interface InventoryResult {
  stands: InventoryStand[];
  summary: InventorySummary;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  appliedFilters: Record<string, any>;
}

export interface ReserveStandRequest {
  standId: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  agentId?: string;
  reservationFee?: number;
  expiryDate?: string;
  notes?: string;
}

export interface SellStandRequest {
  standId: string;
  reason: string;
  clientId?: string;
  salePrice?: number;
  notes?: string;
}

export interface ActionResult {
  success: boolean;
  standId: string;
  standNumber: string;
  oldStatus: string;
  newStatus: string;
  error?: string;
}

export interface ActionActor {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string | null;
}

// Valid state transitions
const STATE_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['RESERVED', 'SOLD', 'BLOCKED'],
  RESERVED: ['AVAILABLE', 'SOLD', 'BLOCKED'],
  SOLD: [], // Cannot transition from SOLD
  BLOCKED: ['AVAILABLE'],
  WITHDRAWN: ['AVAILABLE'],
  CANCELLED: ['AVAILABLE'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get stands inventory with server-side filtering, sorting, and pagination.
 * Automatically scopes results based on user's role via visibility-service.
 */
export async function getStandsInventory(
  user: VisibilityUser,
  filters: InventoryFilters = {}
): Promise<InventoryResult> {
  const {
    developmentId,
    status,
    phase,
    section,
    block,
    sizeMin,
    sizeMax,
    priceMin,
    priceMax,
    pricePerSqmMin,
    pricePerSqmMax,
    search,
    reservedBy,
    sortBy = 'standNumber',
    sortOrder = 'asc',
    page = 1,
    pageSize = 50,
  } = filters;

  logger.debug('Getting stands inventory', {
    module: 'stands-inventory-service',
    userId: user.id,
    role: user.role,
    filters,
  });

  // Get visible development IDs for this user
  const visibility = await getVisibleDevelopmentIds(user, {
    includeDebug: true,
  });

  // If specific developmentId requested, validate access
  let targetDevelopmentIds: string[] = [];
  if (developmentId) {
    if (!visibility.developmentIds.includes(developmentId)) {
      logger.warn('User attempted to access development outside scope', {
        module: 'stands-inventory-service',
        userId: user.id,
        developmentId,
        allowedIds: visibility.developmentIds.length,
      });
      // Return empty result instead of error (graceful degradation)
      return {
        stands: [],
        summary: {
          totalCount: 0,
          availableCount: 0,
          reservedCount: 0,
          soldCount: 0,
          blockedCount: 0,
          totalValue: 0,
          availableValue: 0,
        },
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
        },
        appliedFilters: filters,
      };
    }
    targetDevelopmentIds = [developmentId];
  } else {
    targetDevelopmentIds = visibility.developmentIds;
  }

  if (targetDevelopmentIds.length === 0) {
    return {
      stands: [],
      summary: {
        totalCount: 0,
        availableCount: 0,
        reservedCount: 0,
        soldCount: 0,
        blockedCount: 0,
        totalValue: 0,
        availableValue: 0,
      },
      pagination: {
        page,
        pageSize,
        totalCount: 0,
        totalPages: 0,
      },
      appliedFilters: filters,
    };
  }

  // Build where clause
  const where: Prisma.StandWhereInput = {
    developmentId: { in: targetDevelopmentIds },
  };

  // Status filter
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    const normalized = statuses.map(s => s.toUpperCase());
    if (normalized.length === 1) {
      where.status = normalized[0] as any;
    } else {
      where.status = { in: normalized as any };
    }
  }

  // Size range filter
  if (sizeMin !== undefined || sizeMax !== undefined) {
    where.sizeSqm = {};
    if (sizeMin !== undefined) where.sizeSqm.gte = sizeMin;
    if (sizeMax !== undefined) where.sizeSqm.lte = sizeMax;
  }

  // Price range filter
  if (priceMin !== undefined || priceMax !== undefined) {
    where.price = {};
    if (priceMin !== undefined) where.price.gte = priceMin;
    if (priceMax !== undefined) where.price.lte = priceMax;
  }

  // Price per sqm filter
  if (pricePerSqmMin !== undefined || pricePerSqmMax !== undefined) {
    where.pricePerSqm = {};
    if (pricePerSqmMin !== undefined) where.pricePerSqm.gte = pricePerSqmMin;
    if (pricePerSqmMax !== undefined) where.pricePerSqm.lte = pricePerSqmMax;
  }

  // Search filter (stand number, client name via reservation)
  if (search) {
    const searchPattern = search.trim();
    where.OR = [
      { standNumber: { contains: searchPattern, mode: 'insensitive' } },
      {
        reservations: {
          some: {
            client: {
              name: { contains: searchPattern, mode: 'insensitive' },
            },
          },
        },
      },
    ];
  }

  // Reserved by filter
  if (reservedBy) {
    where.reservedBy = reservedBy;
  }

  // Build order by
  const orderBy: Prisma.StandOrderByWithRelationInput = {};
  orderBy[sortBy as keyof typeof orderBy] = sortOrder;

  // Count total for pagination
  const totalCount = await prisma.stand.count({ where });

  // Fetch paginated stands
  const stands = await prisma.stand.findMany({
    where,
    include: {
      development: {
        select: {
          id: true,
          name: true,
          branch: true,
        },
      },
      reservations: {
        where: {
          status: { in: ['PENDING', 'CONFIRMED', 'PAYMENT_PENDING'] },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Calculate summary (across ALL visible stands, not just current page)
  const summaryWhere: Prisma.StandWhereInput = {
    developmentId: { in: targetDevelopmentIds },
  };
  
  // Apply same filters for summary (minus pagination)
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    const normalized = statuses.map(s => s.toUpperCase());
    if (normalized.length === 1) {
      summaryWhere.status = normalized[0] as any;
    } else {
      summaryWhere.status = { in: normalized as any };
    }
  }

  const summary = await prisma.stand.groupBy({
    by: ['status'],
    where: summaryWhere,
    _count: true,
    _sum: { price: true },
  });

  // Also get summary without status filter for full picture
  const fullSummary = await prisma.stand.groupBy({
    by: ['status'],
    where: { developmentId: { in: targetDevelopmentIds } },
    _count: true,
    _sum: { price: true },
  });

  const summaryData: InventorySummary = {
    totalCount: fullSummary.reduce((acc, s) => acc + s._count, 0),
    availableCount: fullSummary.find(s => s.status === StandStatus.AVAILABLE)?._count || 0,
    reservedCount: fullSummary.find(s => s.status === StandStatus.RESERVED)?._count || 0,
    soldCount: fullSummary.find(s => s.status === StandStatus.SOLD)?._count || 0,
    blockedCount: fullSummary.find(s => s.status === StandStatus.BLOCKED)?._count || 0,
    totalValue: fullSummary.reduce((acc, s) => acc + (s._sum.price?.toNumber() || 0), 0),
    availableValue: fullSummary.find(s => s.status === StandStatus.AVAILABLE)?._sum.price?.toNumber() || 0,
  };

  // Transform stands to InventoryStand
  const inventoryStands: InventoryStand[] = stands.map(stand => {
    const basePrice = stand.price?.toNumber() || 0;
    const sizeSqm = stand.sizeSqm?.toNumber() || 0;
    const discountPercent = stand.discountPercent?.toNumber() || 0;
    const hasDiscount = discountPercent > 0 && stand.discountActive !== false;
    const discountedPrice = hasDiscount ? basePrice * (1 - discountPercent / 100) : undefined;
    
    const activeReservation = stand.reservations[0];

    return {
      id: stand.id,
      standNumber: stand.standNumber,
      developmentId: stand.developmentId,
      developmentName: stand.development?.name || 'Unknown',
      branch: stand.branch,
      sizeSqm,
      price: basePrice,
      pricePerSqm: stand.pricePerSqm?.toNumber() || (sizeSqm > 0 ? basePrice / sizeSqm : 0),
      discountPercent: hasDiscount ? discountPercent : undefined,
      discountedPrice,
      hasDiscount,
      status: stand.status,
      reservedBy: stand.reservedBy || activeReservation?.client?.id,
      reservedByName: activeReservation?.client?.name,
      soldAt: (stand as any).soldAt?.toISOString(),
      soldReason: (stand as any).soldReason,
      updatedAt: stand.updatedAt.toISOString(),
    };
  });

  return {
    stands: inventoryStands,
    summary: summaryData,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
    appliedFilters: filters,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reserve Stand
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reserve a stand with transaction safety and audit logging.
 * Can optionally create a new client or use existing clientId.
 */
export async function reserveStand(
  request: ReserveStandRequest,
  actor: ActionActor
): Promise<ActionResult> {
  const {
    standId,
    clientId,
    clientName,
    clientEmail,
    clientPhone,
    agentId,
    reservationFee,
    expiryDate,
    notes,
  } = request;

  logger.info('Reserve stand request', {
    module: 'stands-inventory-service',
    action: 'RESERVE',
    standId,
    actor: actor.id,
  });

  // Fetch stand with development info
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: {
      development: {
        select: {
          id: true,
          name: true,
          branch: true,
          developerEmail: true,
          developerName: true,
        },
      },
    },
  });

  if (!stand) {
    return {
      success: false,
      standId,
      standNumber: 'Unknown',
      oldStatus: 'Unknown',
      newStatus: 'Unknown',
      error: 'Stand not found',
    };
  }

  const oldStatus = stand.status;

  // Validate state transition
  const allowedTransitions = STATE_TRANSITIONS[oldStatus as keyof typeof STATE_TRANSITIONS] || [];
  if (!allowedTransitions.includes('RESERVED')) {
    return {
      success: false,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: oldStatus,
      error: `Cannot reserve stand with status ${oldStatus}`,
    };
  }

  // Require either existing client or new client details
  if (!clientId && !clientName) {
    return {
      success: false,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: oldStatus,
      error: 'Client ID or client name is required',
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read stand with lock (optimistic concurrency check)
      const current = await tx.stand.findUnique({
        where: { id: standId },
        select: { status: true, updatedAt: true },
      });

      if (!current) throw new Error('Stand not found during transaction');
      if (current.status !== oldStatus) {
        throw new Error(`Stand status changed from ${oldStatus} to ${current.status}`);
      }

      // Get or create client
      let targetClientId = clientId;
      if (!targetClientId && clientName) {
        // Create new client - email is required; generate placeholder if not provided
        const clientEmailValue = clientEmail || `${clientName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@placeholder.local`;
        const newClient = await tx.client.create({
          data: {
            name: clientName,
            email: clientEmailValue,
            phone: clientPhone || null,
            branch: stand.branch,
          },
        });
        targetClientId = newClient.id;
      }

      // Update stand status
      const updatedStand = await tx.stand.update({
        where: { id: standId },
        data: {
          status: 'RESERVED',
          reservedBy: targetClientId,
        },
      });

      // Create reservation record
      const expiresAt = expiryDate ? new Date(expiryDate) : new Date(Date.now() + 72 * 60 * 60 * 1000);
      const reservation = await tx.reservation.create({
        data: {
          standId: stand.id,
          clientId: targetClientId!,
          agentId: agentId || null,
          status: 'PENDING',
          termsAcceptedAt: new Date(),
          expiresAt,
          basePriceAtReservation: stand.price,
        },
      });

      // Create audit log
      await tx.standActionLog.create({
        data: {
          standId: stand.id,
          actionType: 'RESERVE',
          reason: notes || 'Reservation created via inventory',
          payload: {
            clientId: targetClientId,
            agentId,
            reservationFee,
            expiryDate,
          },
          oldValues: { status: oldStatus },
          newValues: { status: 'RESERVED', reservationId: reservation.id },
          createdBy: actor.id,
          createdByEmail: actor.email,
        },
      });

      return { updatedStand, reservation, targetClientId };
    });

    // Post-commit: Audit trail
    await logAuditTrail({
      action: 'STATUS_CHANGE',
      module: 'STANDS',
      recordId: stand.id,
      description: `Reserved stand ${stand.standNumber} in ${stand.development.name}`,
      changes: {
        before: { status: oldStatus },
        after: { status: 'RESERVED', clientId: result.targetClientId },
      },
      userId: actor.id,
      branch: actor.branch || stand.branch,
    });

    logger.info('Stand reserved successfully', {
      module: 'stands-inventory-service',
      standId,
      standNumber: stand.standNumber,
      newReservationId: result.reservation.id,
    });

    return {
      success: true,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: 'RESERVED',
    };
  } catch (error: any) {
    logger.error('Reserve stand failed', {
      module: 'stands-inventory-service',
      standId,
      error: error.message,
    });
    return {
      success: false,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: oldStatus,
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sell Stand
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a stand as sold with transaction safety, audit logging, and notifications.
 */
export async function sellStand(
  request: SellStandRequest,
  actor: ActionActor
): Promise<ActionResult> {
  const { standId, reason, clientId, salePrice, notes } = request;

  if (!reason || reason.trim().length === 0) {
    return {
      success: false,
      standId,
      standNumber: 'Unknown',
      oldStatus: 'Unknown',
      newStatus: 'Unknown',
      error: 'Reason is required for selling a stand',
    };
  }

  logger.info('Sell stand request', {
    module: 'stands-inventory-service',
    action: 'SELL',
    standId,
    actor: actor.id,
  });

  // Fetch stand with development info
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: {
      development: {
        select: {
          id: true,
          name: true,
          branch: true,
          developerEmail: true,
          developerName: true,
        },
      },
      reservations: {
        where: { status: { in: ['PENDING', 'CONFIRMED', 'PAYMENT_PENDING'] } },
        include: { client: true },
        take: 1,
      },
    },
  });

  if (!stand) {
    return {
      success: false,
      standId,
      standNumber: 'Unknown',
      oldStatus: 'Unknown',
      newStatus: 'Unknown',
      error: 'Stand not found',
    };
  }

  const oldStatus = stand.status;

  // Validate state transition
  const allowedTransitions = STATE_TRANSITIONS[oldStatus as keyof typeof STATE_TRANSITIONS] || [];
  if (!allowedTransitions.includes('SOLD')) {
    return {
      success: false,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: oldStatus,
      error: `Cannot sell stand with status ${oldStatus}`,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read with optimistic lock
      const current = await tx.stand.findUnique({
        where: { id: standId },
        select: { status: true, updatedAt: true },
      });

      if (!current) throw new Error('Stand not found during transaction');
      if (current.status !== oldStatus) {
        throw new Error(`Stand status changed from ${oldStatus} to ${current.status}`);
      }

      // Update stand to SOLD
      const updatedStand = await tx.stand.update({
        where: { id: standId },
        data: {
          status: 'SOLD',
          soldAt: new Date(),
          soldReason: reason,
          soldBy: actor.id,
          ...(salePrice && { price: new Prisma.Decimal(salePrice) }),
        } as any,
      });

      // Confirm any active reservations
      if (stand.reservations.length > 0) {
        await tx.reservation.updateMany({
          where: {
            standId: stand.id,
            status: { in: ['PENDING', 'PAYMENT_PENDING'] },
          },
          data: { status: 'CONFIRMED' },
        });
      }

      // Create audit log
      await tx.standActionLog.create({
        data: {
          standId: stand.id,
          actionType: 'SELL',
          reason,
          payload: { clientId, salePrice, notes },
          oldValues: { status: oldStatus },
          newValues: { status: 'SOLD', soldAt: new Date().toISOString() },
          createdBy: actor.id,
          createdByEmail: actor.email,
        },
      });

      return updatedStand;
    });

    // Post-commit: Audit trail
    await logAuditTrail({
      action: 'STATUS_CHANGE',
      module: 'STANDS',
      recordId: stand.id,
      description: `Sold stand ${stand.standNumber} in ${stand.development.name}. Reason: ${reason}`,
      changes: {
        before: { status: oldStatus },
        after: { status: 'SOLD', soldReason: reason },
      },
      userId: actor.id,
      branch: actor.branch || stand.branch,
    });

    // Send notification emails (fire-and-forget)
    sendWizardActionEmail({
      actionType: 'MARK_SOLD',
      developmentName: stand.development.name,
      developmentId: stand.development.id,
      results: [{
        standNumber: stand.standNumber,
        standId: stand.id,
        oldStatus,
        newStatus: 'SOLD',
      }],
      reason,
      actor: { name: actor.name || actor.email, email: actor.email },
      developerEmail: stand.development.developerEmail,
      developerName: stand.development.developerName,
      branch: actor.branch || stand.branch,
    }).catch(err => console.error('[SELL NOTIFICATION ERROR]', err));

    logger.info('Stand sold successfully', {
      module: 'stands-inventory-service',
      standId,
      standNumber: stand.standNumber,
    });

    return {
      success: true,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: 'SOLD',
    };
  } catch (error: any) {
    logger.error('Sell stand failed', {
      module: 'stands-inventory-service',
      standId,
      error: error.message,
    });
    return {
      success: false,
      standId,
      standNumber: stand.standNumber,
      oldStatus,
      newStatus: oldStatus,
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user can reserve stands
 */
export function canUserReserve(role: string): boolean {
  const allowedRoles = ['ADMIN', 'MANAGER', 'AGENT', 'ACCOUNT'];
  return allowedRoles.includes(role.toUpperCase());
}

/**
 * Check if user can sell stands
 */
export function canUserSell(role: string): boolean {
  const allowedRoles = ['ADMIN', 'MANAGER', 'ACCOUNT'];
  return allowedRoles.includes(role.toUpperCase());
}

/**
 * Validate that user has access to a specific stand
 */
export async function canUserAccessStand(
  user: VisibilityUser,
  standId: string
): Promise<boolean> {
  const visibility = await getVisibleDevelopmentIds(user);
  
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    select: { developmentId: true },
  });

  if (!stand) return false;
  return visibility.developmentIds.includes(stand.developmentId);
}
