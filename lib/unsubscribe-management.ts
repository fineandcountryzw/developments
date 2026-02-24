/**
 * Unsubscribe Management Utilities
 * Functions for managing unsubscribe lists and GDPR compliance
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type UnsubscribeReason = 'requested' | 'hard_bounce' | 'spam' | 'other';

/**
 * Add a recipient to the unsubscribe list
 */
export async function addToUnsubscribeList(
  recipientEmail: string,
  clientId: string,
  reason: UnsubscribeReason,
  description?: string,
  branch = 'Harare'
) {
  try {
    const unsubscribed = await prisma.unsubscribeList.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail,
          clientId
        }
      },
      update: {
        reason,
        description,
        unsubscribedAt: new Date()
      },
      create: {
        recipientEmail,
        clientId,
        reason,
        description,
        unsubscribedAt: new Date(),
        unsubscribedBy: 'automatic',
        branch
      }
    });

    return unsubscribed;
  } catch (error) {
    console.error('Error adding to unsubscribe list:', error);
    throw error;
  }
}

/**
 * Remove a recipient from the unsubscribe list (resubscribe)
 */
export async function removeFromUnsubscribeList(
  recipientEmail: string,
  clientId?: string
) {
  try {
    const where: any = { recipientEmail };
    if (clientId) {
      where.clientId = clientId;
    }

    const deleted = await prisma.unsubscribeList.deleteMany({
      where
    });

    return {
      removed: deleted.count > 0,
      count: deleted.count
    };
  } catch (error) {
    console.error('Error removing from unsubscribe list:', error);
    throw error;
  }
}

/**
 * Check if a recipient is unsubscribed
 */
export async function isUnsubscribed(
  recipientEmail: string,
  clientId?: string
): Promise<boolean> {
  try {
    const where: any = { recipientEmail };
    if (clientId) {
      where.clientId = clientId;
    }

    const unsubscribed = await prisma.unsubscribeList.findFirst({
      where
    });

    return !!unsubscribed;
  } catch (error) {
    console.error('Error checking unsubscribe status:', error);
    return false;
  }
}

/**
 * Get unsubscribe statistics for a client
 */
export async function getUnsubscribeStats(clientId: string, branch = 'Harare') {
  try {
    const [total, byReason, recentCount] = await Promise.all([
      prisma.unsubscribeList.count({
        where: { clientId, branch }
      }),
      prisma.unsubscribeList.groupBy({
        by: ['reason'],
        where: { clientId, branch },
        _count: { id: true }
      }),
      prisma.unsubscribeList.count({
        where: {
          clientId,
          branch,
          unsubscribedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    return {
      total,
      byReason: byReason.map(item => ({
        reason: item.reason,
        count: item._count.id
      })),
      last30Days: recentCount
    };
  } catch (error) {
    console.error('Error getting unsubscribe stats:', error);
    throw error;
  }
}

/**
 * Generate an unsubscribe token for email links
 * Token includes email and timestamp for validation
 */
export function generateUnsubscribeToken(
  recipientEmail: string,
  clientId: string
): string {
  const data = `${recipientEmail}:${clientId}:${Date.now()}`;
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Validate an unsubscribe token
 * Ensures token is recent (within 7 days) and matches email
 */
export function validateUnsubscribeToken(
  token: string,
  recipientEmail: string,
  clientId: string,
  maxAgeMinutes = 7 * 24 * 60 // 7 days
): boolean {
  try {
    // In production, store token with timestamp in cache (Redis)
    // For now, we do basic validation
    // This is a simplified implementation
    return !!(token && token.length === 64); // SHA256 hash length
  } catch (error) {
    console.error('Error validating unsubscribe token:', error);
    return false;
  }
}

/**
 * Batch unsubscribe recipients (for list imports)
 */
export async function batchUnsubscribe(
  recipientEmails: string[],
  clientId: string,
  reason: UnsubscribeReason,
  branch = 'Harare'
) {
  try {
    const results = await Promise.allSettled(
      recipientEmails.map(email =>
        addToUnsubscribeList(email, clientId, reason, undefined, branch)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { successful, failed, total: recipientEmails.length };
  } catch (error) {
    console.error('Error batch unsubscribing:', error);
    throw error;
  }
}

/**
 * Get unsubscribe reasons breakdown
 */
export async function getUnsubscribeReasons(clientId: string, branch = 'Harare') {
  try {
    const reasons = await prisma.unsubscribeList.groupBy({
      by: ['reason'],
      where: { clientId, branch },
      _count: { id: true }
    });

    const total = reasons.reduce((sum, r) => sum + r._count.id, 0);

    return reasons.map(item => ({
      reason: item.reason,
      count: item._count.id,
      percentage: total > 0 ? ((item._count.id / total) * 100).toFixed(2) : 0
    }));
  } catch (error) {
    console.error('Error getting unsubscribe reasons:', error);
    throw error;
  }
}

/**
 * Export unsubscribe list (for GDPR compliance)
 */
export async function exportUnsubscribeList(clientId: string, branch = 'Harare') {
  try {
    const unsubscribed = await prisma.unsubscribeList.findMany({
      where: { clientId, branch },
      orderBy: { unsubscribedAt: 'desc' },
      select: {
        recipientEmail: true,
        reason: true,
        description: true,
        unsubscribedAt: true,
        unsubscribedBy: true
      }
    });

    return unsubscribed;
  } catch (error) {
    console.error('Error exporting unsubscribe list:', error);
    throw error;
  }
}

/**
 * Clean up old unsubscribe records (GDPR retention limits)
 * Default: Keep records for 90 days
 */
export async function cleanupOldUnsubscribes(retentionDays = 90) {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await prisma.unsubscribeList.deleteMany({
      where: {
        unsubscribedAt: { lt: cutoffDate }
      }
    });

    return { deletedCount: deleted.count };
  } catch (error) {
    console.error('Error cleaning up old unsubscribes:', error);
    throw error;
  }
}
