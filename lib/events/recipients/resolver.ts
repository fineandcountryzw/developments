/**
 * Recipient Resolution Service
 * 
 * Resolves notification recipients based on event type, RBAC, and entity scope.
 * Ensures zero data leakage across roles and branches.
 * 
 * @module lib/events/recipients/resolver
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { UserRole } from '@prisma/client';
import { 
  NotificationEvent, 
  NotificationType, 
  EventConfig 
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ResolvedRecipients {
  /** User IDs to receive in-app notifications */
  userIds: string[];
  /** Email addresses for audit notifications */
  auditRecipients: string[];
  /** Developer emails (for development-specific events) */
  developerEmails: string[];
  /** Client user IDs (for client notifications) */
  clientUserIds: string[];
}

// ============================================================================
// Main Resolver
// ============================================================================

/**
 * Resolve recipients for an event based on configuration and RBAC
 * 
 * @param event - The notification event
 * @param config - Event configuration
 * @returns Resolved recipients
 */
export async function resolveRecipients(
  event: NotificationEvent,
  config: EventConfig
): Promise<ResolvedRecipients> {
  const result: ResolvedRecipients = {
    userIds: [],
    auditRecipients: [],
    developerEmails: [],
    clientUserIds: []
  };

  try {
    // Get branch and development context from event
    const { branch, developmentId } = await getEventContext(event);

    // Resolve role-based recipients
    if (config.recipientRoles.length > 0) {
      const roleRecipients = await getUsersByRoles(config.recipientRoles, branch);
      result.userIds.push(...roleRecipients);
    }

    // Resolve client recipient
    if (config.notifyClient) {
      const clientId = getClientIdFromEvent(event);
      if (clientId) {
        const clientUserId = await getClientUserId(clientId);
        if (clientUserId) {
          result.clientUserIds.push(clientUserId);
          result.userIds.push(clientUserId);
        }
      }
    }

    // Resolve developer recipients
    if (config.notifyDeveloper && developmentId) {
      const developerEmails = await getDeveloperEmails(developmentId);
      result.developerEmails.push(...developerEmails);
      // Note: Developers receive emails, not in-app notifications (they're external)
    }

    // Deduplicate
    result.userIds = [...new Set(result.userIds)];
    result.developerEmails = [...new Set(result.developerEmails)];

    // Set audit recipients
    result.auditRecipients = [process.env.AUDIT_EMAIL_TO || 'developments.zw@fineandcountryerp.com'];

    logger.debug('Recipients resolved', {
      module: 'RecipientResolver',
      action: 'RESOLVE_RECIPIENTS',
      eventType: (event as any).type,
      userCount: result.userIds.length,
      developerCount: result.developerEmails.length
    });

    return result;

  } catch (error) {
    logger.error('Failed to resolve recipients', error as Error, {
      module: 'RecipientResolver',
      action: 'RESOLVE_RECIPIENTS',
      eventType: (event as any).type
    });
    return result;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get users by roles and branch
 */
async function getUsersByRoles(roles: UserRole[], branch?: string): Promise<string[]> {
  const where: any = {
    role: { in: roles },
    isActive: true
  };

  // Branch filtering: ADMIN sees all, others see their branch
  if (branch) {
    where.OR = [
      { branch },
      { role: UserRole.ADMIN } // Admins get all notifications regardless of branch
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true }
  });

  return users.map(u => u.id);
}

/**
 * Get client user ID from client ID
 */
async function getClientUserId(clientId: string): Promise<string | null> {
  // Clients may not have user accounts - check if client has a linked user
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { 
      id: true,
      email: true 
    }
  });

  if (!client) return null;

  // Find user with matching email (client portal users)
  const user = await prisma.user.findFirst({
    where: { 
      email: client.email,
      role: UserRole.CLIENT
    },
    select: { id: true }
  });

  return user?.id || null;
}

/**
 * Get developer emails for a development
 */
async function getDeveloperEmails(developmentId: string): Promise<string[]> {
  const development = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { 
      developerEmail: true,
      developerName: true
    }
  });

  if (development?.developerEmail) {
    return [development.developerEmail];
  }

  return [];
}

/**
 * Extract client ID from event payload
 */
function getClientIdFromEvent(event: NotificationEvent): string | null {
  const e = event as any;
  return e.clientId || null;
}

/**
 * Get branch and development context from event
 */
async function getEventContext(event: NotificationEvent): Promise<{ branch?: string; developmentId?: string }> {
  const e = event as any;
  
  // If developmentId is directly on event
  if (e.developmentId) {
    // Get branch from development
    const development = await prisma.development.findUnique({
      where: { id: e.developmentId },
      select: { branch: true, id: true }
    });
    
    if (development) {
      return { 
        branch: development.branch,
        developmentId: development.id 
      };
    }
  }

  // If standId is on event, get development from stand
  if (e.standId) {
    const stand = await prisma.stand.findUnique({
      where: { id: e.standId },
      include: { development: { select: { branch: true, id: true } } }
    });
    
    if (stand?.development) {
      return {
        branch: stand.development.branch,
        developmentId: stand.development.id
      };
    }
  }

  // If contractId is on event, get from contract
  if (e.contractId) {
    const contract = await prisma.generatedContract.findUnique({
      where: { id: e.contractId },
      include: { 
        stand: { 
          include: { 
            development: { select: { branch: true, id: true } } 
          } 
        } 
      }
    });
    
    if (contract?.stand?.development) {
      return {
        branch: contract.stand.development.branch,
        developmentId: contract.stand.development.id
      };
    }
  }

  return {};
}

// ============================================================================
// Export
// ============================================================================

export default {
  resolveRecipients
};