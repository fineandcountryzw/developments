/**
 * Contract Access Control
 *
 * Centralized access control logic for contracts visibility.
 * Ensures proper role-based scoping across all dashboards.
 *
 * VISIBILITY RULES:
 * - ADMIN: All contracts (all branches)
 * - MANAGER: All contracts in their branch (or all if branch='all')
 * - DEVELOPER: Contracts linked to their developments (via Stand → Development)
 * - AGENT: Contracts for clients assigned to them (via Client.agentId)
 * - CLIENT: Only their own contracts (via clientId match)
 *
 * TEMPLATE MANAGEMENT RULES:
 * - ADMIN: Manage global templates + all development-specific templates
 * - MANAGER: Manage global templates + their branch's development templates
 * - DEVELOPER: View global templates + manage their own development's templates (if permission granted)
 * - AGENT/CLIENT: View-only access to templates
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type UserRole = 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'AGENT' | 'CLIENT' | 'ACCOUNTANT';

export interface ContractScopeUser {
  id: string;
  email: string;
  role: UserRole;
  branch?: string;
  clientId?: string;  // For CLIENT role
  agentId?: string;   // For AGENT role (usually same as id)
  developerId?: string; // For DEVELOPER role
}

export interface ContractQueryFilters {
  status?: string;
  branch?: string;
  clientId?: string;
  developmentId?: string;
  agentId?: string;
  standId?: string;
  dateFrom?: string;
  dateTo?: string;
  signedOnly?: boolean;
  includeArchived?: boolean;
}

export interface TemplateQueryFilters {
  status?: string;
  branch?: string;
  developmentId?: string;
  includeGlobal?: boolean;
  search?: string;
}

export interface ContractWhereClause {
  AND?: any[];
  OR?: any[];
  branch?: string;
  status?: any;
  clientId?: any;
  standId?: any;
  createdAt?: any;
}

/**
 * Build Prisma WHERE clause for contract queries based on user role
 * 
 * This function ensures:
 * - Server-side access control (not client-side filtering)
 * - Both signed and unsigned contracts are included by default
 * - Proper scoping per role
 */
export async function buildContractScopeWhere(
  user: ContractScopeUser,
  filters: ContractQueryFilters = {}
): Promise<ContractWhereClause> {
  const whereClause: ContractWhereClause = {};
  const andConditions: Array<{ [key: string]: any }> = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE-BASED SCOPING (enforced server-side)
  // ═══════════════════════════════════════════════════════════════════════════

  const role = user.role?.toUpperCase() as UserRole;

  switch (role) {
    case 'ADMIN':
      // ADMIN: No restrictions, can see all contracts
      logger.debug('Contract scope: ADMIN - no restrictions', { userId: user.id });
      break;

    case 'MANAGER':
      // MANAGER: All contracts in their branch (or all if branch filter is 'all')
      if (filters.branch && filters.branch !== 'all') {
        whereClause.branch = filters.branch;
      } else if (user.branch && !filters.branch) {
        // Default to user's branch if no filter specified
        whereClause.branch = user.branch;
      }
      logger.debug('Contract scope: MANAGER', { userId: user.id, branch: whereClause.branch });
      break;

    case 'ACCOUNTANT':
      // ACCOUNTANT: Same as Manager - all contracts in branch
      if (filters.branch && filters.branch !== 'all') {
        whereClause.branch = filters.branch;
      } else if (user.branch) {
        whereClause.branch = user.branch;
      }
      logger.debug('Contract scope: ACCOUNTANT', { userId: user.id, branch: whereClause.branch });
      break;

    case 'DEVELOPER':
      // DEVELOPER: Contracts linked to their developments
      // Chain: GeneratedContract → Stand → Development
      const developerDevelopments = await getDeveloperDevelopmentIds(user.id, user.email);
      
      if (developerDevelopments.length > 0) {
        // Get stands for these developments
        const developerStands = await prisma.stand.findMany({
          where: { developmentId: { in: developerDevelopments } },
          select: { id: true }
        });
        const standIds = developerStands.map(s => s.id);
        
        if (standIds.length > 0) {
          whereClause.standId = { in: standIds };
        } else {
          // No stands found - return empty result
          whereClause.standId = { in: [] };
        }
      } else {
        // No developments found for this developer - return empty result
        whereClause.standId = { in: [] };
      }
      logger.debug('Contract scope: DEVELOPER', { 
        userId: user.id, 
        developmentCount: developerDevelopments.length 
      });
      break;

    case 'AGENT':
      // AGENT: Contracts for clients assigned to them
      // Chain: GeneratedContract → Client.agentId
      const agentClients = await prisma.client.findMany({
        where: { agentId: user.id },
        select: { id: true }
      });
      const agentClientIds = agentClients.map(c => c.id);
      
      if (agentClientIds.length > 0) {
        whereClause.clientId = { in: agentClientIds };
      } else {
        // No clients found - return empty result
        whereClause.clientId = { in: [] };
      }
      logger.debug('Contract scope: AGENT', { 
        userId: user.id, 
        clientCount: agentClientIds.length 
      });
      break;

    case 'CLIENT':
      // CLIENT: Only their own contracts
      // Need to find the client record for this user
      const clientRecord = await getClientForUser(user.id, user.email, user.clientId);
      
      if (clientRecord) {
        whereClause.clientId = clientRecord.id;
      } else {
        // No client record - return empty result
        whereClause.clientId = { in: [] };
      }
      logger.debug('Contract scope: CLIENT', { 
        userId: user.id, 
        clientId: clientRecord?.id 
      });
      break;

    default:
      // Unknown role - deny all access
      logger.warn('Contract scope: Unknown role - denying access', { 
        userId: user.id, 
        role: user.role 
      });
      whereClause.clientId = { in: [] };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL FILTERS (applied on top of role scoping)
  // ═══════════════════════════════════════════════════════════════════════════

  // Status filter
  if (filters.status && filters.status !== 'ALL') {
    whereClause.status = filters.status;
  }

  // Exclude archived by default unless explicitly included
  if (!filters.includeArchived && !filters.status) {
    andConditions.push({ status: { not: 'ARCHIVED' } });
  }

  // Branch filter (only for ADMIN who can override)
  if (role === 'ADMIN' && filters.branch && filters.branch !== 'all') {
    whereClause.branch = filters.branch;
  }

  // Client ID filter - only allow if it NARROWS existing scope (not widens)
  if (filters.clientId) {
    if (whereClause.clientId) {
      // Role already set a clientId constraint
      // Only allow if filters.clientId is within the allowed set
      if (typeof whereClause.clientId === 'object' && 'in' in whereClause.clientId) {
        const allowedIds = whereClause.clientId.in as string[];
        if (allowedIds.includes(filters.clientId)) {
          whereClause.clientId = filters.clientId; // Narrow to single client
        }
        // Else: silently ignore - don't widen scope
      }
      // If clientId is a single value, don't allow override
    } else if (['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role)) {
      // High-privilege roles can filter to any client
      whereClause.clientId = filters.clientId;
    }
    // Else: ignore filter for other roles (DEVELOPER uses standId, not clientId)
  }

  // Stand ID filter - same logic
  if (filters.standId) {
    if (whereClause.standId) {
      // Role already set a standId constraint (DEVELOPER)
      if (typeof whereClause.standId === 'object' && 'in' in whereClause.standId) {
        const allowedIds = whereClause.standId.in as string[];
        if (allowedIds.includes(filters.standId)) {
          whereClause.standId = filters.standId; // Narrow to single stand
        }
        // Else: silently ignore
      }
    } else if (['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role)) {
      // High-privilege roles can filter to any stand
      whereClause.standId = filters.standId;
    }
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    whereClause.createdAt = {};
    if (filters.dateFrom) {
      whereClause.createdAt.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      whereClause.createdAt.lte = new Date(filters.dateTo);
    }
  }

  // Signed only filter (optional - NOT applied by default)
  if (filters.signedOnly) {
    andConditions.push({ status: 'SIGNED' });
  }

  // Add AND conditions if any
  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  return whereClause;
}

/**
 * Get development IDs for a developer user
 * Links via User → Development (if developerEmail matches)
 */
async function getDeveloperDevelopmentIds(userId: string, userEmail: string): Promise<string[]> {
  // First try: Check if there's a Development with matching developerEmail
  const developmentsByEmail = await prisma.development.findMany({
    where: { developerEmail: userEmail },
    select: { id: true }
  });

  if (developmentsByEmail.length > 0) {
    return developmentsByEmail.map(d => d.id);
  }

  // Second try: Check if user has a branch and get all developments in that branch
  // This is a fallback for developers who manage all developments in their branch
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { branch: true, role: true }
  });

  if (user?.role === 'DEVELOPER' && user.branch) {
    const branchDevelopments = await prisma.development.findMany({
      where: { branch: user.branch },
      select: { id: true }
    });
    return branchDevelopments.map(d => d.id);
  }

  return [];
}

/**
 * Get client record for a user
 * Handles the case where userId might be linked to a client record
 */
async function getClientForUser(
  userId: string, 
  userEmail: string,
  clientId?: string
): Promise<{ id: string } | null> {
  // If clientId is provided directly, use it
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true }
    });
    return client;
  }

  // Try to find client by email match
  const clientByEmail = await prisma.client.findFirst({
    where: { email: userEmail },
    select: { id: true }
  });

  if (clientByEmail) {
    return clientByEmail;
  }

  // Try to find by checking if there's a user with isPortalUser linked
  const clientAsPortalUser = await prisma.client.findFirst({
    where: { 
      email: userEmail,
      isPortalUser: true
    },
    select: { id: true }
  });

  return clientAsPortalUser;
}

/**
 * Check if user can access a specific contract
 * Used for single-contract operations (view, download, sign)
 */
export async function canAccessContract(
  user: ContractScopeUser,
  contractId: string
): Promise<boolean> {
  // Build the scoped where clause
  const scopeWhere = await buildContractScopeWhere(user, {});

  // Check if the contract exists within the scope
  const contract = await prisma.generatedContract.findFirst({
    where: {
      id: contractId,
      ...scopeWhere
    },
    select: { id: true }
  });

  return !!contract;
}

/**
 * Get contracts with proper scoping and pagination
 */
export async function getScopedContracts(
  user: ContractScopeUser,
  filters: ContractQueryFilters & { page?: number; limit?: number }
): Promise<{
  contracts: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = Math.max(filters.page || 1, 1);
  const limit = Math.min(filters.limit || 50, 200);
  const offset = (page - 1) * limit;

  const whereClause = await buildContractScopeWhere(user, filters);

  const [contracts, total] = await Promise.all([
    prisma.generatedContract.findMany({
      where: whereClause,
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true, agentId: true }
        },
        template: {
          select: { id: true, name: true }
        },
        stand: {
          include: {
            development: {
              select: { id: true, name: true, location: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.generatedContract.count({ where: whereClause })
  ]);

  return {
    contracts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build Prisma WHERE clause for template queries based on user role
 *
 * Template visibility rules:
 * - All users can see global templates (isGlobal = true)
 * - Users can see development-specific templates they have access to
 * - ADMIN/MANAGER: All templates in their scope
 * - DEVELOPER: Global templates + their development's templates
 * - AGENT/CLIENT: Global templates only (view-only)
 */
export async function buildTemplateScopeWhere(
  user: ContractScopeUser,
  filters: TemplateQueryFilters = {}
): Promise<any> {
  const whereClause: any = {};
  const andConditions: any[] = [];

  const role = user.role?.toUpperCase() as UserRole;

  // Base condition: templates must be either global or in allowed developments
  const developmentConditions: any[] = [{ isGlobal: true }];

  switch (role) {
    case 'ADMIN':
      // ADMIN: Can see all templates including all development-specific
      // No additional restrictions needed beyond global flag
      developmentConditions.push({ isGlobal: false }); // Include non-global too
      break;

    case 'MANAGER':
      // MANAGER: Global templates + templates for developments in their branch
      if (user.branch) {
        const branchDevelopments = await prisma.development.findMany({
          where: { branch: user.branch },
          select: { id: true }
        });
        const developmentIds = branchDevelopments.map(d => d.id);
        if (developmentIds.length > 0) {
          developmentConditions.push({
            developmentId: { in: developmentIds }
          });
        }
      }
      break;

    case 'DEVELOPER':
      // DEVELOPER: Global templates + their development's templates
      const developerDevelopmentIds = await getDeveloperDevelopmentIds(user.id, user.email);
      if (developerDevelopmentIds.length > 0) {
        developmentConditions.push({
          developmentId: { in: developerDevelopmentIds }
        });
      }
      break;

    case 'AGENT':
    case 'CLIENT':
    case 'ACCOUNTANT':
      // AGENT/CLIENT/ACCOUNTANT: Global templates only
      // No additional development conditions
      break;

    default:
      // Unknown role: global templates only
      logger.warn('Template scope: Unknown role - global templates only', {
        userId: user.id,
        role: user.role
      });
  }

  // Apply development scope condition
  if (developmentConditions.length > 1) {
    andConditions.push({ OR: developmentConditions });
  } else {
    andConditions.push(developmentConditions[0]);
  }

  // Status filter
  if (filters.status && filters.status !== 'ALL') {
    andConditions.push({ status: filters.status });
  }

  // Branch filter (for ADMIN who can override)
  if (role === 'ADMIN' && filters.branch && filters.branch !== 'all') {
    andConditions.push({ branch: filters.branch });
  } else if (role !== 'ADMIN' && user.branch) {
    // Non-admin users see templates for their branch
    andConditions.push({
      OR: [
        { branch: user.branch },
        { isGlobal: true } // Global templates may not have branch set
      ]
    });
  }

  // Development ID filter (if explicitly requested and allowed)
  if (filters.developmentId) {
    // Check if user has access to this development
    const canAccessDevelopment = await checkDevelopmentAccess(user, filters.developmentId);
    if (canAccessDevelopment) {
      andConditions.push({ developmentId: filters.developmentId });
    }
  }

  // Search filter
  if (filters.search) {
    andConditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ]
    });
  }

  // Combine all conditions
  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  return whereClause;
}

/**
 * Check if user can manage (create/update/delete) a template
 *
 * Permission rules:
 * - ADMIN: Can manage all templates
 * - MANAGER: Can manage global templates + their branch's development templates
 * - DEVELOPER: Can manage their own development's templates only
 * - AGENT/CLIENT: Cannot manage templates (view-only)
 */
export async function canManageTemplate(
  user: ContractScopeUser,
  developmentId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const role = user.role?.toUpperCase() as UserRole;

  switch (role) {
    case 'ADMIN':
      return { allowed: true };

    case 'MANAGER':
      if (!developmentId) {
        // Managing global templates
        return { allowed: true };
      }
      // Check if development is in manager's branch
      const development = await prisma.development.findFirst({
        where: {
          id: developmentId,
          branch: user.branch
        },
        select: { id: true }
      });
      if (development) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Development not in your branch'
      };

    case 'DEVELOPER':
      if (!developmentId) {
        return {
          allowed: false,
          reason: 'Developers can only manage development-specific templates'
        };
      }
      // Check if this is the developer's development
      const developerDevelopments = await getDeveloperDevelopmentIds(user.id, user.email);
      if (developerDevelopments.includes(developmentId)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Not your development'
      };

    case 'AGENT':
    case 'CLIENT':
    case 'ACCOUNTANT':
      return {
        allowed: false,
        reason: 'View-only access to templates'
      };

    default:
      return {
        allowed: false,
        reason: 'Unknown role'
      };
  }
}

/**
 * Check if user can view a specific template
 */
export async function canViewTemplate(
  user: ContractScopeUser,
  templateId: string
): Promise<boolean> {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    select: { isGlobal: true, developmentId: true }
  });

  if (!template) {
    return false;
  }

  // Global templates are viewable by all
  if (template.isGlobal) {
    return true;
  }

  // Development-specific templates require access check
  if (template.developmentId) {
    return checkDevelopmentAccess(user, template.developmentId);
  }

  return false;
}

/**
 * Check if user has access to a specific development
 */
async function checkDevelopmentAccess(
  user: ContractScopeUser,
  developmentId: string
): Promise<boolean> {
  const role = user.role?.toUpperCase() as UserRole;

  switch (role) {
    case 'ADMIN':
      return true;

    case 'MANAGER':
      const development = await prisma.development.findFirst({
        where: {
          id: developmentId,
          branch: user.branch
        },
        select: { id: true }
      });
      return !!development;

    case 'DEVELOPER':
      const developerDevelopments = await getDeveloperDevelopmentIds(user.id, user.email);
      return developerDevelopments.includes(developmentId);

    case 'AGENT':
    case 'CLIENT':
    case 'ACCOUNTANT':
      // These roles don't have development-specific access
      return false;

    default:
      return false;
  }
}

/**
 * Check if user can upload DOCX template for a template
 * 
 * Permission rules for DOCX uploads:
 * - ADMIN: Can upload to any template
 * - MANAGER: Can upload to templates in their branch or global templates
 * - DEVELOPER: Can upload to their development's templates only
 * - AGENT/CLIENT: Cannot upload DOCX templates
 */
export async function canUploadDocxTemplate(
  user: ContractScopeUser,
  templateId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const role = user.role?.toUpperCase() as UserRole;

  // Get the template
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    include: { development: { select: { id: true, branch: true, developerEmail: true } } }
  });

  if (!template) {
    return { allowed: false, reason: 'Template not found' };
  }

  // AGENT, CLIENT, ACCOUNTANT cannot upload DOCX templates
  if (['AGENT', 'CLIENT', 'ACCOUNTANT'].includes(role)) {
    return { allowed: false, reason: 'View-only access to templates' };
  }

  // ADMIN can upload to any template
  if (role === 'ADMIN') {
    return { allowed: true };
  }

  // MANAGER can upload to global templates or templates in their branch
  if (role === 'MANAGER') {
    if (template.isGlobal) {
      return { allowed: true };
    }
    if (template.development?.branch === user.branch) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: 'You can only upload DOCX templates for templates in your branch' 
    };
  }

  // DEVELOPER can upload to their development's templates only
  if (role === 'DEVELOPER') {
    if (!template.developmentId) {
      return { 
        allowed: false, 
        reason: 'Developers can only upload DOCX templates for development-specific templates' 
      };
    }

    // Check if this is the developer's development
    const developerDevelopments = await getDeveloperDevelopmentIds(user.id, user.email);
    if (developerDevelopments.includes(template.developmentId)) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Not your development' };
  }

  return { allowed: false, reason: 'Unknown role' };
}

/**
 * Check if user can delete DOCX template for a template
 * Same permissions as upload - ability to upload implies ability to delete
 */
export async function canDeleteDocxTemplate(
  user: ContractScopeUser,
  templateId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Delete permissions are the same as upload permissions
  return canUploadDocxTemplate(user, templateId);
}

export default {
  buildContractScopeWhere,
  canAccessContract,
  getScopedContracts,
  buildTemplateScopeWhere,
  canManageTemplate,
  canViewTemplate,
  canUploadDocxTemplate,
  canDeleteDocxTemplate
};
