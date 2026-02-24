/**
 * Activity Tracking Server Actions
 * 
 * Forensic logging for all critical user actions in the ERP.
 * Every event is permanently recorded with metadata for audit trails.
 */

'use server';

import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getSecurityContext } from '@/lib/security';
import { broadcastActivityUpdate } from '@/lib/realtime';

type ActivityType = 'LOGIN' | 'RESERVATION' | 'PAYMENT_UPLOAD' | 'VERIFICATION' | 'STAND_UPDATE' | 'USER_CREATED' | 'AGENT_ASSIGNED';

// ============================================
// ACTIVITY LOGGING
// ============================================

interface LogActivityInput {
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log a forensic activity event
 */
export async function logActivity(input: LogActivityInput) {
  console.log('[LOG_ACTIVITY][STARTED]', input);

  try {
    // Get authenticated user
    const session = await requireRole(['ADMIN', 'AGENT', 'CLIENT']);
    
    // Capture security context (IP, device, browser)
    const securityContext = await getSecurityContext();
    
    // Merge security context with provided metadata
    const enrichedMetadata = {
      ...(input.metadata || {}),
      security: {
        ipAddress: securityContext.ipAddress,
        deviceType: securityContext.deviceType,
        browser: securityContext.browser,
        os: securityContext.os,
        userAgent: securityContext.userAgent,
        timestamp: securityContext.timestamp,
      },
    };
    
    // Create activity record
    const activity = await prisma.activity.create({
      data: {
        type: input.type,
        description: input.description,
        metadata: enrichedMetadata,
        userId: session.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    console.log('[LOG_ACTIVITY][SUCCESS]', {
      id: activity.id,
      type: activity.type,
      userId: activity.userId,
      ipAddress: securityContext.ipAddress,
    });

    // Broadcast real-time update (errors are handled internally)
    try {
      broadcastActivityUpdate('created', activity);
    } catch (err) {
      console.error('[LOG_ACTIVITY][BROADCAST_ERROR]', err);
    }

    return {
      success: true,
      activity,
    };

  } catch (error) {
    console.error('[LOG_ACTIVITY][ERROR]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log activity',
    };
  }
}

// ============================================
// ACTIVITY FETCHING (Admin Only)
// ============================================

interface GetActivitiesInput {
  limit?: number;
  type?: ActivityType;
  userId?: string;
}

/**
 * Fetch recent activities for admin dashboard
 * ADMIN-only access for security monitoring
 */
export async function getActivities(input: GetActivitiesInput = {}) {
  console.log('[GET_ACTIVITIES][STARTED]', input);

  try {
    // Require ADMIN role
    await requireRole(['ADMIN']);

    const { limit = 20, type, userId } = input;

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;

    // Fetch activities
    const activities = await prisma.activity.findMany({
      where,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
    });

    console.log('[GET_ACTIVITIES][SUCCESS]', {
      count: activities.length,
      types: [...new Set(activities.map(a => a.type))],
    });

    return {
      success: true,
      activities,
    };

  } catch (error) {
    console.error('[GET_ACTIVITIES][ERROR]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activities',
      activities: [],
    };
  }
}

// ============================================
// CONVENIENCE HELPERS
// ============================================

/**
 * Log a login event
 */
export async function logLogin() {
  return logActivity({
    type: 'LOGIN',
    description: 'User logged in',
    metadata: { timestamp: new Date().toISOString() },
  });
}

/**
 * Log a reservation creation
 */
export async function logReservation(standId: string, developmentName: string) {
  return logActivity({
    type: 'RESERVATION',
    description: `Reserved stand in ${developmentName}`,
    metadata: { standId, developmentName },
  });
}

/**
 * Log proof of payment upload
 */
export async function logPaymentUpload(reservationId: string, popUrl: string) {
  return logActivity({
    type: 'PAYMENT_UPLOAD',
    description: 'Uploaded proof of payment',
    metadata: { reservationId, popUrl },
  });
}

/**
 * Log payment verification by agent
 */
export async function logVerification(reservationId: string, standId: string, amount: number) {
  return logActivity({
    type: 'VERIFICATION',
    description: `Verified payment for stand ${standId}`,
    metadata: { reservationId, standId, amount },
  });
}

/**
 * Log stand status update
 */
export async function logStandUpdate(standId: string, oldStatus: string, newStatus: string) {
  return logActivity({
    type: 'STAND_UPDATE',
    description: `Stand status changed: ${oldStatus} → ${newStatus}`,
    metadata: { standId, oldStatus, newStatus },
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(newUserId: string, email: string, role: string) {
  return logActivity({
    type: 'USER_CREATED',
    description: `Created ${role} user: ${email}`,
    metadata: { newUserId, email, role },
  });
}

/**
 * Log agent assignment
 */
export async function logAgentAssigned(clientId: string, agentId: string, agentName: string) {
  return logActivity({
    type: 'AGENT_ASSIGNED',
    description: `Assigned agent: ${agentName}`,
    metadata: { clientId, agentId, agentName },
  });
}
