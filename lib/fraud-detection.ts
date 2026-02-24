/**
 * Fraud Detection System
 * 
 * Analyzes activity patterns to detect suspicious behavior:
 * - Multiple reservations from same IP
 * - Rapid-fire reservation attempts
 * - Unusual device switching
 */

'use server';

import prisma from '@/lib/prisma';

export interface FraudAlert {
  type: 'multiple_reservations' | 'rapid_attempts' | 'device_switching' | 'suspicious_ip';
  severity: 'low' | 'medium' | 'high';
  message: string;
  ipAddress: string;
  userId?: string;
  count: number;
  timeWindow: string;
}

/**
 * Check for multiple reservations from same IP address
 */
export async function checkMultipleReservationsFromIP(
  ipAddress: string,
  timeWindowMinutes: number = 60
): Promise<FraudAlert | null> {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  // Query activities for RESERVATION type from this IP
  const activities = await prisma.activity.findMany({
    where: {
      type: 'RESERVATION',
      createdAt: {
        gte: cutoff,
      },
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      metadata: true,
    },
  });

  // Filter by IP address (stored in metadata.security.ipAddress)
  const matchingActivities = activities.filter((activity) => {
    if (activity.metadata && typeof activity.metadata === 'object') {
      const metadata = activity.metadata as any;
      return metadata.security?.ipAddress === ipAddress;
    }
    return false;
  });

  // Flag as suspicious if > 3 reservations from same IP
  if (matchingActivities.length > 3) {
    return {
      type: 'multiple_reservations',
      severity: matchingActivities.length > 5 ? 'high' : 'medium',
      message: `${matchingActivities.length} reservations from same IP in ${timeWindowMinutes} minutes`,
      ipAddress,
      count: matchingActivities.length,
      timeWindow: `${timeWindowMinutes}m`,
    };
  }

  return null;
}

/**
 * Check for rapid-fire reservation attempts (bot-like behavior)
 */
export async function checkRapidReservationAttempts(
  userId: string,
  timeWindowMinutes: number = 10
): Promise<FraudAlert | null> {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      type: 'RESERVATION',
      createdAt: {
        gte: cutoff,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      createdAt: true,
      metadata: true,
    },
  });

  // Check if reservations are too close together (< 30 seconds)
  let rapidAttempts = 0;
  for (let i = 1; i < activities.length; i++) {
    const timeDiff = activities[i].createdAt.getTime() - activities[i - 1].createdAt.getTime();
    if (timeDiff < 30000) {
      // Less than 30 seconds
      rapidAttempts++;
    }
  }

  if (rapidAttempts > 2) {
    const ipAddress =
      activities[0]?.metadata &&
      typeof activities[0].metadata === 'object' &&
      (activities[0].metadata as any).security?.ipAddress;

    return {
      type: 'rapid_attempts',
      severity: 'high',
      message: `${rapidAttempts} rapid reservation attempts detected (< 30s apart)`,
      ipAddress: ipAddress || 'unknown',
      userId,
      count: rapidAttempts,
      timeWindow: `${timeWindowMinutes}m`,
    };
  }

  return null;
}

/**
 * Check for unusual device switching (same user, multiple devices)
 */
export async function checkDeviceSwitching(
  userId: string,
  timeWindowHours: number = 24
): Promise<FraudAlert | null> {
  const cutoff = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      type: 'RESERVATION',
      createdAt: {
        gte: cutoff,
      },
    },
    select: {
      metadata: true,
    },
  });

  // Extract unique device types and IPs
  const devices = new Set<string>();
  const ips = new Set<string>();

  activities.forEach((activity) => {
    if (activity.metadata && typeof activity.metadata === 'object') {
      const metadata = activity.metadata as any;
      if (metadata.security?.deviceType) {
        devices.add(metadata.security.deviceType);
      }
      if (metadata.security?.ipAddress) {
        ips.add(metadata.security.ipAddress);
      }
    }
  });

  // Flag if user switched between 3+ different devices/IPs
  if (devices.size >= 3 || ips.size >= 3) {
    return {
      type: 'device_switching',
      severity: 'medium',
      message: `User switched between ${devices.size} devices and ${ips.size} IPs`,
      ipAddress: Array.from(ips).join(', '),
      userId,
      count: Math.max(devices.size, ips.size),
      timeWindow: `${timeWindowHours}h`,
    };
  }

  return null;
}

/**
 * Run all fraud checks for a user
 */
export async function runFraudChecks(userId: string, ipAddress: string): Promise<FraudAlert[]> {
  const alerts: FraudAlert[] = [];

  // Check 1: Multiple reservations from same IP
  const ipAlert = await checkMultipleReservationsFromIP(ipAddress, 60);
  if (ipAlert) alerts.push(ipAlert);

  // Check 2: Rapid reservation attempts
  const rapidAlert = await checkRapidReservationAttempts(userId, 10);
  if (rapidAlert) alerts.push(rapidAlert);

  // Check 3: Device switching
  const deviceAlert = await checkDeviceSwitching(userId, 24);
  if (deviceAlert) alerts.push(deviceAlert);

  return alerts;
}

/**
 * Get fraud alerts for admin dashboard
 */
export async function getFraudAlerts(limit: number = 10): Promise<FraudAlert[]> {
  // This would typically query a dedicated fraud_alerts table
  // For now, we'll analyze recent activities

  const recentReservations = await prisma.activity.findMany({
    where: {
      type: 'RESERVATION',
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
    take: 100,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      userId: true,
      metadata: true,
    },
  });

  // Group by IP address
  const ipMap = new Map<string, number>();
  recentReservations.forEach((activity) => {
    if (activity.metadata && typeof activity.metadata === 'object') {
      const metadata = activity.metadata as any;
      const ip = metadata.security?.ipAddress;
      if (ip) {
        ipMap.set(ip, (ipMap.get(ip) || 0) + 1);
      }
    }
  });

  // Find suspicious IPs (> 3 reservations)
  const alerts: FraudAlert[] = [];
  ipMap.forEach((count, ip) => {
    if (count > 3) {
      alerts.push({
        type: 'multiple_reservations',
        severity: count > 5 ? 'high' : 'medium',
        message: `${count} reservations from same IP in last hour`,
        ipAddress: ip,
        count,
        timeWindow: '1h',
      });
    }
  });

  return alerts.slice(0, limit);
}
