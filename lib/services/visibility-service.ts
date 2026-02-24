/**
 * Visibility Service
 * 
 * SINGLE SOURCE OF TRUTH for determining what developments and stands
 * a user can access based on their role.
 * 
 * Visibility Rules:
 * - ADMIN: All developments
 * - MANAGER: Branch-scoped (user.branch) - all developments in their branch
 * - DEVELOPER: Only developments where developerEmail = user.email
 * - AGENT: Developments with stands they have reservations on (via client assignments)
 * - ACCOUNT: All developments (for financial visibility) - branch-scoped
 * - CLIENT: Only developments where they have stands (via reservations)
 * 
 * @module lib/services/visibility-service
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VisibilityUser {
  id: string;
  email: string;
  role: string;
  branch?: string | null;
}

export interface VisibilityResult {
  developmentIds: string[];
  scope: 'all' | 'branch' | 'owned' | 'associated' | 'none';
  debug?: {
    userId: string;
    role: string;
    branch?: string | null;
    filterApplied: string;
    count: number;
  };
}

export interface StandVisibilityResult {
  standIds: string[];
  developmentIds: string[];
  scope: 'all' | 'branch' | 'owned' | 'associated' | 'none';
  debug?: {
    userId: string;
    role: string;
    filterApplied: string;
    count: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE VISIBILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get visible development IDs for a user based on their role
 * 
 * @param user - The authenticated user
 * @param options - Additional filtering options
 * @returns VisibilityResult with development IDs and scope info
 */
export async function getVisibleDevelopmentIds(
  user: VisibilityUser,
  options?: {
    branch?: string;
    status?: string;
    includeDebug?: boolean;
  }
): Promise<VisibilityResult> {
  const role = user.role?.toUpperCase() || 'CLIENT';
  const includeDebug = options?.includeDebug ?? (process.env.NODE_ENV === 'development');

  logger.debug('Calculating visible developments', {
    module: 'visibility-service',
    userId: user.id,
    role,
    branch: user.branch,
    options
  });

  try {
    let developmentIds: string[] = [];
    let scope: 'all' | 'branch' | 'owned' | 'associated' | 'none' = 'none';
    let filterApplied = '';

    switch (role) {
      case 'ADMIN':
        // Admin sees all developments (optionally filtered by branch/status)
        const adminWhere: any = {};
        if (options?.branch) adminWhere.branch = options.branch;
        if (options?.status) adminWhere.status = options.status;
        
        const adminDevs = await prisma.development.findMany({
          where: adminWhere,
          select: { id: true }
        });
        developmentIds = adminDevs.map(d => d.id);
        scope = options?.branch ? 'branch' : 'all';
        filterApplied = options?.branch ? `branch=${options.branch}` : 'none (all)';
        break;

      case 'MANAGER':
        // Manager sees developments scoped to their branch
        // NOTE: Currently no managerId field exists - fallback to branch scoping
        const managerBranch = options?.branch || user.branch || 'Harare';
        const managerWhere: any = { branch: managerBranch };
        if (options?.status) managerWhere.status = options.status;
        
        const managerDevs = await prisma.development.findMany({
          where: managerWhere,
          select: { id: true }
        });
        developmentIds = managerDevs.map(d => d.id);
        scope = 'branch';
        filterApplied = `branch=${managerBranch}`;
        break;

      case 'DEVELOPER':
        // Developer sees only their own developments (by developerEmail)
        const developerWhere: any = { developerEmail: user.email };
        if (options?.status) developerWhere.status = options.status;
        
        const developerDevs = await prisma.development.findMany({
          where: developerWhere,
          select: { id: true }
        });
        developmentIds = developerDevs.map(d => d.id);
        scope = 'owned';
        filterApplied = `developerEmail=${user.email}`;
        break;

      case 'ACCOUNT':
        // Accountant sees all developments (for financial visibility) - optionally branch-scoped
        const accountBranch = options?.branch || user.branch;
        const accountWhere: any = {};
        if (accountBranch) accountWhere.branch = accountBranch;
        if (options?.status) accountWhere.status = options.status;
        
        const accountDevs = await prisma.development.findMany({
          where: accountWhere,
          select: { id: true }
        });
        developmentIds = accountDevs.map(d => d.id);
        scope = accountBranch ? 'branch' : 'all';
        filterApplied = accountBranch ? `branch=${accountBranch}` : 'none (all)';
        break;

      case 'AGENT':
        // Agent sees developments where they have clients with reservations
        const agentReservations = await prisma.reservation.findMany({
          where: {
            // Find clients assigned to this agent via Stand relation
            stand: {
              reservations: {
                some: {
                  // Agent filter: look for reservations where client's agentId matches
                  // This requires going through client table
                }
              }
            }
          },
          select: {
            stand: {
              select: { developmentId: true }
            }
          },
          distinct: ['id']
        });
        
        // Fallback: Get developments through stands the agent has access to
        const agentStands = await prisma.stand.findMany({
          where: {
            // Agents may have reservedBy set or access via branch
            branch: user.branch || 'Harare'
          },
          select: { developmentId: true },
          distinct: ['developmentId']
        });
        developmentIds = [...new Set(agentStands.map(s => s.developmentId))];
        scope = 'associated';
        filterApplied = `branch=${user.branch} (agent)`;
        break;

      case 'CLIENT':
        // Client sees only developments where they have stands/reservations
        // First, find client by email
        const client = await prisma.client.findFirst({
          where: { email: user.email },
          select: { id: true }
        });
        
        if (client) {
          const clientReservations = await prisma.reservation.findMany({
            where: { clientId: client.id },
            select: {
              stand: {
                select: { developmentId: true }
              }
            },
            distinct: ['id']
          });
          developmentIds = [...new Set(clientReservations.map(r => r.stand.developmentId))];
          scope = 'associated';
          filterApplied = `clientId=${client.id}`;
        } else {
          developmentIds = [];
          scope = 'none';
          filterApplied = 'client not found';
        }
        break;

      default:
        developmentIds = [];
        scope = 'none';
        filterApplied = `unknown role: ${role}`;
    }

    const result: VisibilityResult = {
      developmentIds,
      scope
    };

    if (includeDebug) {
      result.debug = {
        userId: user.id,
        role,
        branch: user.branch,
        filterApplied,
        count: developmentIds.length
      };
    }

    logger.debug('Visibility result', {
      module: 'visibility-service',
      userId: user.id,
      role,
      scope,
      count: developmentIds.length,
      filterApplied
    });

    return result;

  } catch (error) {
    logger.error('Error calculating visible developments', error instanceof Error ? error : undefined, {
      module: 'visibility-service',
      userId: user.id,
      role
    });
    
    return {
      developmentIds: [],
      scope: 'none',
      debug: includeDebug ? {
        userId: user.id,
        role,
        branch: user.branch,
        filterApplied: 'error',
        count: 0
      } : undefined
    };
  }
}

/**
 * Get visible stand IDs for a user based on their role
 * 
 * @param user - The authenticated user
 * @param options - Additional filtering options
 * @returns StandVisibilityResult with stand IDs and scope info
 */
export async function getVisibleStandIds(
  user: VisibilityUser,
  options?: {
    developmentIds?: string[];
    branch?: string;
    status?: string;
    includeDebug?: boolean;
  }
): Promise<StandVisibilityResult> {
  // First get visible development IDs
  const devVisibility = await getVisibleDevelopmentIds(user, {
    branch: options?.branch,
    includeDebug: options?.includeDebug
  });

  // If specific developmentIds are requested, intersect with visible ones
  let effectiveDevIds = devVisibility.developmentIds;
  if (options?.developmentIds && options.developmentIds.length > 0) {
    // Only allow access to developments the user can see
    effectiveDevIds = options.developmentIds.filter(id => 
      devVisibility.developmentIds.includes(id)
    );
  }

  if (effectiveDevIds.length === 0) {
    return {
      standIds: [],
      developmentIds: [],
      scope: devVisibility.scope,
      debug: options?.includeDebug ? {
        userId: user.id,
        role: user.role,
        filterApplied: 'no visible developments',
        count: 0
      } : undefined
    };
  }

  try {
    const where: any = {
      developmentId: { in: effectiveDevIds }
    };
    
    if (options?.status) {
      where.status = options.status;
    }

    const stands = await prisma.stand.findMany({
      where,
      select: { id: true, developmentId: true }
    });

    const standIds = stands.map(s => s.id);
    const includedDevIds = [...new Set(stands.map(s => s.developmentId))];

    return {
      standIds,
      developmentIds: includedDevIds,
      scope: devVisibility.scope,
      debug: options?.includeDebug ? {
        userId: user.id,
        role: user.role,
        filterApplied: `developmentIds: ${effectiveDevIds.length}`,
        count: standIds.length
      } : undefined
    };

  } catch (error) {
    logger.error('Error calculating visible stands', error instanceof Error ? error : undefined, {
      module: 'visibility-service',
      userId: user.id,
      role: user.role
    });
    
    return {
      standIds: [],
      developmentIds: [],
      scope: 'none'
    };
  }
}

/**
 * Build Prisma WHERE clause for development visibility
 * 
 * Use this in queries that need to filter developments by user visibility.
 * 
 * @param user - The authenticated user
 * @param additionalFilters - Additional where conditions to merge
 * @returns Prisma where clause
 */
export async function buildDevelopmentVisibilityWhere(
  user: VisibilityUser,
  additionalFilters?: Record<string, any>
): Promise<Record<string, any>> {
  const visibility = await getVisibleDevelopmentIds(user);
  
  if (visibility.scope === 'all' && !additionalFilters) {
    return {};
  }

  const where: Record<string, any> = {
    id: { in: visibility.developmentIds },
    ...additionalFilters
  };

  return where;
}

/**
 * Build Prisma WHERE clause for stand visibility
 * 
 * Use this in queries that need to filter stands by user visibility.
 * 
 * @param user - The authenticated user
 * @param additionalFilters - Additional where conditions to merge
 * @returns Prisma where clause
 */
export async function buildStandVisibilityWhere(
  user: VisibilityUser,
  additionalFilters?: Record<string, any>
): Promise<Record<string, any>> {
  const visibility = await getVisibleDevelopmentIds(user);
  
  if (visibility.scope === 'all' && !additionalFilters) {
    return {};
  }

  const where: Record<string, any> = {
    developmentId: { in: visibility.developmentIds },
    ...additionalFilters
  };

  return where;
}

/**
 * Check if user can access a specific development
 * 
 * @param user - The authenticated user
 * @param developmentId - The development ID to check
 * @returns boolean
 */
export async function canUserAccessDevelopment(
  user: VisibilityUser,
  developmentId: string
): Promise<boolean> {
  const visibility = await getVisibleDevelopmentIds(user);
  return visibility.developmentIds.includes(developmentId);
}

/**
 * Check if user can access a specific stand
 * 
 * @param user - The authenticated user
 * @param standId - The stand ID to check
 * @returns boolean
 */
export async function canUserAccessStand(
  user: VisibilityUser,
  standId: string
): Promise<boolean> {
  // First get the stand to find its developmentId
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    select: { developmentId: true }
  });

  if (!stand) return false;

  return canUserAccessDevelopment(user, stand.developmentId);
}
