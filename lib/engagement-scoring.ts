/**
 * Engagement Scoring Utilities
 * Functions for calculating and updating engagement scores
 */

import { prisma } from '@/lib/prisma';

export type EngagementTier = 'hot' | 'warm' | 'cold';

/**
 * Calculate engagement score (0-100) based on email activity
 * Formula: (opens * 30) + (clicks * 50) - (bounces * 20) - (unsubscribes * 40)
 * Then normalize to 0-100 scale
 */
function calculateEngagementScore(
  openCount: number,
  clickCount: number,
  bounceCount: number,
  unsubscribeCount: number,
  totalEmailsSent: number
): { score: number; tier: EngagementTier } {
  if (totalEmailsSent === 0) {
    return { score: 0, tier: 'cold' };
  }

  // Weighted scoring
  const rawScore = 
    (openCount * 30) + 
    (clickCount * 50) - 
    (bounceCount * 20) - 
    (unsubscribeCount * 40);

  // Normalize based on emails sent
  const normalizedScore = Math.max(0, Math.min(100, (rawScore / totalEmailsSent) * 10));

  // Determine tier
  let tier: EngagementTier;
  if (normalizedScore >= 60) {
    tier = 'hot';
  } else if (normalizedScore >= 30) {
    tier = 'warm';
  } else {
    tier = 'cold';
  }

  return { score: Math.round(normalizedScore), tier };
}

/**
 * Predict payment probability based on engagement
 * Higher engagement = higher likelihood of payment
 * Score: 0-1 (representing 0-100% probability)
 */
function predictPaymentProbability(
  engagementScore: number,
  openFrequency: number,
  clickFrequency: number,
  daysSinceLastPayment?: number
): number {
  // Base probability from engagement score (0-1)
  let probability = engagementScore / 100;

  // Boost for recent opens (last 7 days)
  if (openFrequency > 0) {
    probability += openFrequency * 0.05;
  }

  // Boost for clicks (more intent)
  if (clickFrequency > 0) {
    probability += clickFrequency * 0.1;
  }

  // Decay for old payments
  if (daysSinceLastPayment && daysSinceLastPayment > 90) {
    probability *= 0.5; // Half probability if hasn't paid in 90+ days
  } else if (daysSinceLastPayment && daysSinceLastPayment <= 30) {
    probability *= 1.5; // 50% boost if recent payer
  }

  // Cap at 1.0 (100%)
  return Math.min(1.0, probability);
}

/**
 * Update engagement score for a recipient
 */
export async function updateEngagementScore(
  recipientEmail: string,
  clientId: string,
  clientName?: string,
  branch = 'Harare'
) {
  try {
    // Get email activity
    const [opens, clicks] = await Promise.all([
      prisma.emailOpen.count({
        where: { recipientEmail }
      }),
      prisma.emailClick.count({
        where: { recipientEmail }
      })
    ]);

    // Get bounce and unsubscribe info
    const bounce = await prisma.bouncePattern.findFirst({
      where: { recipientEmail, clientId }
    });

    const unsubscribe = await prisma.unsubscribeList.findFirst({
      where: { recipientEmail, clientId }
    });

    // Count total emails sent using PaymentAutomationLog
    const totalSent = await prisma.paymentAutomationLog.count({
      where: { recipientEmail, clientId }
    });

    const bounceCount = bounce?.totalBounceCount || 0;
    const unsubscribeCount = unsubscribe ? 1 : 0;

    // Calculate scores
    const { score, tier } = calculateEngagementScore(
      opens,
      clicks,
      bounceCount,
      unsubscribeCount,
      totalSent
    );

    const paymentProbability = predictPaymentProbability(
      score,
      opens > 0 ? 1 : 0,
      clicks > 0 ? 1 : 0,
      undefined // TODO: integrate with payment history
    );

    // Update or create engagement score
    const engagement = await prisma.emailEngagementScore.upsert({
      where: {
        recipientEmail_clientId: {
          recipientEmail,
          clientId
        }
      },
      update: {
        engagementScore: score,
        engagementTier: tier,
        openCount: opens,
        clickCount: clicks,
        bounceCount: bounceCount,
        unsubscribeCount: unsubscribeCount,
        totalEmailsSent: totalSent,
        lastEngagementAt: new Date(),
        predictedPaymentProbability: paymentProbability
      },
      create: {
        recipientEmail,
        clientId,
        clientName,
        engagementScore: score,
        engagementTier: tier,
        openCount: opens,
        clickCount: clicks,
        bounceCount: bounceCount,
        unsubscribeCount: unsubscribeCount,
        totalEmailsSent: totalSent,
        lastEngagementAt: new Date(),
        predictedPaymentProbability: paymentProbability,
        branch
      }
    });

    return engagement;
  } catch (error) {
    console.error('Error updating engagement score:', error);
    throw error;
  }
}

/**
 * Get top engaged recipients (for targeted campaigns)
 */
export async function getTopEngagedRecipients(
  clientId: string,
  limit = 100,
  branch = 'Harare'
) {
  try {
    return await prisma.emailEngagementScore.findMany({
      where: { clientId, branch },
      orderBy: { engagementScore: 'desc' },
      take: limit,
      select: {
        recipientEmail: true,
        engagementScore: true,
        engagementTier: true,
        openCount: true,
        clickCount: true,
        predictedPaymentProbability: true,
        lastEngagementAt: true
      }
    });
  } catch (error) {
    console.error('Error getting top engaged recipients:', error);
    throw error;
  }
}

/**
 * Get at-risk recipients (cold/no engagement)
 */
export async function getAtRiskRecipients(
  clientId: string,
  limit = 100,
  branch = 'Harare'
) {
  try {
    return await prisma.emailEngagementScore.findMany({
      where: {
        clientId,
        branch,
        OR: [
          { engagementTier: 'cold' },
          { lastEngagementAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } }
        ]
      },
      orderBy: { engagementScore: 'asc' },
      take: limit,
      select: {
        recipientEmail: true,
        engagementScore: true,
        engagementTier: true,
        lastEngagementAt: true,
        predictedPaymentProbability: true
      }
    });
  } catch (error) {
    console.error('Error getting at-risk recipients:', error);
    throw error;
  }
}

/**
 * Batch update engagement scores for all recipients
 */
export async function batchUpdateEngagementScores(
  clientId: string,
  branch = 'Harare'
) {
  try {
    // Get all recipients for this client
    const recipients = await prisma.emailEngagementScore.findMany({
      where: { clientId, branch },
      select: { recipientEmail: true }
    });

    const results = await Promise.allSettled(
      recipients.map(r =>
        updateEngagementScore(r.recipientEmail, clientId, undefined, branch)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { successful, failed, total: recipients.length };
  } catch (error) {
    console.error('Error batch updating engagement scores:', error);
    throw error;
  }
}

/**
 * Get engagement trends over time
 */
export async function getEngagementTrends(
  clientId: string,
  days = 30,
  branch = 'Harare'
) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const opens = await prisma.emailOpen.groupBy({
      by: ['createdAt'],
      where: {
        clientId,
        createdAt: { gte: startDate }
      },
      _count: { id: true }
    });

    const clicks = await prisma.emailClick.groupBy({
      by: ['createdAt'],
      where: {
        clientId,
        createdAt: { gte: startDate }
      },
      _count: { id: true }
    });

    return { opens, clicks, period: days };
  } catch (error) {
    console.error('Error getting engagement trends:', error);
    throw error;
  }
}
