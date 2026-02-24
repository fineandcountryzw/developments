/**
 * Bounce Handling Utilities
 * Functions for processing bounces, categorizing them, and managing suppression
 */

import { prisma } from '@/lib/prisma';

export type BounceType = 'soft' | 'hard' | 'spam' | 'unsubscribe';

/**
 * Process a bounce event from email service
 * Categorizes bounce type and updates suppression if needed
 */
export async function processBounce({
  recipientEmail,
  clientId,
  bounceType,
  bounceReason,
  smtpCode,
  branch = 'Harare'
}: {
  recipientEmail: string;
  clientId: string;
  bounceType: BounceType;
  bounceReason?: string;
  smtpCode?: string;
  branch?: string;
}) {
  try {
    const bounce = await prisma.bouncePattern.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail,
          clientId
        }
      },
      update: {
        bounceType,
        lastBounceAt: new Date(),
        bounceReason: bounceReason || undefined,
        smtpCode: smtpCode || undefined,
        consecutiveBounces: bounceType === 'soft' 
          ? { increment: 1 }
          : { set: 1 }, // Reset count for hard bounces
        totalBounceCount: { increment: 1 }
      },
      create: {
        recipientEmail,
        clientId,
        bounceType,
        lastBounceAt: new Date(),
        bounceReason,
        smtpCode,
        consecutiveBounces: 1,
        totalBounceCount: 1,
        branch
      }
    });

    // Auto-suppress after 3 hard bounces or 5 soft bounces
    const shouldSuppress = 
      (bounceType === 'hard' && bounce.totalBounceCount >= 3) ||
      (bounceType === 'soft' && bounce.totalBounceCount >= 5) ||
      bounceType === 'spam';

    if (shouldSuppress && !bounce.shouldSuppress) {
      await prisma.bouncePattern.update({
        where: { id: bounce.id },
        data: {
          shouldSuppress: true,
          suppressedAt: new Date(),
          suppressedReason: `Auto-suppressed: ${bounceType} bounce (${bounce.totalBounceCount} total)`
        }
      });

      // Add to unsubscribe list
      await prisma.unsubscribeList.upsert({
        where: {
          recipientEmail_clientId: {
            recipientEmail,
            clientId
          }
        },
        update: {
          reason: bounceType
        },
        create: {
          recipientEmail,
          clientId,
          reason: bounceType,
          description: `Auto-suppressed after ${bounceType} bounce`,
          unsubscribedAt: new Date(),
          unsubscribedBy: 'automatic',
          branch
        }
      });

      return { suppressed: true, bounce };
    }

    return { suppressed: false, bounce };
  } catch (error) {
    console.error('Error processing bounce:', error);
    throw error;
  }
}

/**
 * Check if a recipient should be suppressed
 * Returns true if recipient is on suppression list
 */
export async function shouldSuppressRecipient(
  recipientEmail: string,
  clientId?: string
): Promise<boolean> {
  try {
    // Check bounce pattern
    const bounceSuppression = await prisma.bouncePattern.findFirst({
      where: {
        recipientEmail,
        shouldSuppress: true,
        ...(clientId && { clientId })
      }
    });

    if (bounceSuppression) return true;

    // Check unsubscribe list
    const unsubscribed = await prisma.unsubscribeList.findFirst({
      where: {
        recipientEmail,
        ...(clientId && { clientId })
      }
    });

    return !!unsubscribed;
  } catch (error) {
    console.error('Error checking suppression:', error);
    return false;
  }
}

/**
 * Get bounce statistics for a client
 */
export async function getBounceStats(clientId: string, branch = 'Harare') {
  try {
    const [total, hardBounces, softBounces, suppressed] = await Promise.all([
      prisma.bouncePattern.count({
        where: { clientId, branch }
      }),
      prisma.bouncePattern.count({
        where: { clientId, bounceType: 'hard', branch }
      }),
      prisma.bouncePattern.count({
        where: { clientId, bounceType: 'soft', branch }
      }),
      prisma.bouncePattern.count({
        where: { clientId, shouldSuppress: true, branch }
      })
    ]);

    return {
      total,
      hardBounces,
      softBounces,
      suppressed,
      suppressionRate: total > 0 ? (suppressed / total * 100).toFixed(2) : '0'
    };
  } catch (error) {
    console.error('Error getting bounce stats:', error);
    throw error;
  }
}

/**
 * Batch suppress recipients (for list imports or cleanup)
 */
export async function batchSuppressRecipients(
  recipientEmails: string[],
  clientId: string,
  reason: string,
  branch = 'Harare'
) {
  try {
    const results = await Promise.allSettled(
      recipientEmails.map(email =>
        prisma.bouncePattern.upsert({
          where: {
            recipientEmail_clientId: {
              recipientEmail: email,
              clientId
            }
          },
          update: {
            shouldSuppress: true,
            suppressedAt: new Date(),
            suppressedReason: reason
          },
          create: {
            recipientEmail: email,
            clientId,
            bounceType: 'hard',
            lastBounceAt: new Date(),
            shouldSuppress: true,
            suppressedAt: new Date(),
            suppressedReason: reason,
            branch
          }
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { successful, failed, total: recipientEmails.length };
  } catch (error) {
    console.error('Error batch suppressing recipients:', error);
    throw error;
  }
}

/**
 * Unsuppress a recipient (remove from suppression list)
 */
export async function unsuppressRecipient(
  recipientEmail: string,
  clientId: string
) {
  try {
    const [bounceUpdate, unsubscribeDelete] = await Promise.all([
      prisma.bouncePattern.updateMany({
        where: { recipientEmail, clientId },
        data: {
          shouldSuppress: false,
          suppressedAt: null,
          suppressedReason: null,
          consecutiveBounces: 0
        }
      }),
      prisma.unsubscribeList.deleteMany({
        where: { recipientEmail, clientId }
      })
    ]);

    return {
      bounceUpdated: bounceUpdate.count,
      unsubscribeDeleted: unsubscribeDelete.count
    };
  } catch (error) {
    console.error('Error unsuppressing recipient:', error);
    throw error;
  }
}
