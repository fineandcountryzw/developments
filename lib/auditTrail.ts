import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'VIEW' 
  | 'EXPORT' 
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'RESERVE'
  | 'CANCEL'
  | 'PAYMENT'
  | 'EMAIL_SENT'
  | 'STATUS_CHANGE';

export type AuditModule = 
  | 'AUTH'
  | 'USERS'
  | 'CLIENTS'
  | 'STANDS'
  | 'DEVELOPMENTS'
  | 'PAYMENTS'
  | 'CONTRACTS'
  | 'RESERVATIONS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'EMAIL'
  | 'AGENTS'
  | 'COMMISSIONS';

interface AuditLogParams {
  action: AuditAction;
  module: AuditModule;
  recordId?: string;
  description: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  branch?: string;
  userId?: string;
}

/**
 * Log an action to the forensic audit trail
 * Call this from any API route or server action to track user activity
 */
export async function logAuditTrail(params: AuditLogParams): Promise<void> {
  try {
    // Get current user from session
    let userId = params.userId;
    let branch = params.branch || 'Harare';

    if (!userId) {
      try {
        const session = await getServerSession(authOptions);
        userId = session?.user?.id;
        // Use user's branch if available
        if (session?.user?.branch) {
          branch = session.user.branch;
        }
      } catch {
        // Session might not be available in some contexts
        userId = 'SYSTEM';
      }
    }

    await prisma.activityLog.create({
      data: {
        branch,
        userId: userId || 'SYSTEM',
        action: params.action,
        module: params.module,
        recordId: params.recordId || 'N/A',
        description: params.description,
        changes: params.changes ?? Prisma.JsonNull,
      },
    });

    console.log(`[AUDIT] ${params.action} on ${params.module}: ${params.description}`);
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AUDIT ERROR]', error);
  }
}

/**
 * Log a user login event
 */
export async function logLogin(userId: string, email: string, branch: string = 'Harare'): Promise<void> {
  await logAuditTrail({
    action: 'LOGIN',
    module: 'AUTH',
    recordId: userId,
    description: `User ${email} logged in`,
    branch,
    userId,
  });
}

/**
 * Log a user logout event
 */
export async function logLogout(userId: string, email: string, branch: string = 'Harare'): Promise<void> {
  await logAuditTrail({
    action: 'LOGOUT',
    module: 'AUTH',
    recordId: userId,
    description: `User ${email} logged out`,
    branch,
    userId,
  });
}

/**
 * Log a record creation
 */
export async function logCreate(
  module: AuditModule,
  recordId: string,
  description: string,
  data?: Record<string, any>
): Promise<void> {
  await logAuditTrail({
    action: 'CREATE',
    module,
    recordId,
    description,
    changes: data ? { after: data } : undefined,
  });
}

/**
 * Log a record update with before/after values
 */
export async function logUpdate(
  module: AuditModule,
  recordId: string,
  description: string,
  before?: Record<string, any>,
  after?: Record<string, any>
): Promise<void> {
  await logAuditTrail({
    action: 'UPDATE',
    module,
    recordId,
    description,
    changes: { before, after },
  });
}

/**
 * Log a record deletion
 */
export async function logDelete(
  module: AuditModule,
  recordId: string,
  description: string,
  deletedData?: Record<string, any>
): Promise<void> {
  await logAuditTrail({
    action: 'DELETE',
    module,
    recordId,
    description,
    changes: deletedData ? { before: deletedData } : undefined,
  });
}

/**
 * Log a payment action
 */
export async function logPayment(
  recordId: string,
  description: string,
  details?: Record<string, any>
): Promise<void> {
  await logAuditTrail({
    action: 'PAYMENT',
    module: 'PAYMENTS',
    recordId,
    description,
    changes: details ? { after: details } : undefined,
  });
}

/**
 * Log an export action
 */
export async function logExport(
  module: AuditModule,
  description: string,
  details?: Record<string, any>
): Promise<void> {
  await logAuditTrail({
    action: 'EXPORT',
    module,
    description,
    changes: details ? { after: details } : undefined,
  });
}
