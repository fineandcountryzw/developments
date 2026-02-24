/**
 * Admin Diagnostics API - "Forensic Pulse"
 * 
 * Systems Reliability Endpoint
 * Tests health and performance of all external dependencies:
 * - Neon PostgreSQL (latency, cold start detection)
 * - Better Auth (active sessions)
 * - Resend (email delivery success rate)
 * - UploadThing (API validation, storage usage)
 * 
 * Security: ADMIN role required
 * Caching: 30-second cache for dashboard refresh
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DiagnosticResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    database: DatabaseHealth;
    auth: AuthHealth;
    email: EmailHealth;
    storage: StorageHealth;
  };
  metrics: {
    activeHolds: number;
    leadVelocity: LeadVelocityData;
  };
}

interface DatabaseHealth {
  status: 'operational' | 'degraded' | 'offline';
  latencyMs: number;
  coldStart: boolean;
  connectionPool: {
    active: number;
    idle: number;
  };
  error?: string;
}

interface AuthHealth {
  status: 'operational' | 'degraded' | 'offline';
  activeSessions24h: number;
  totalUsers: number;
  error?: string;
}

interface EmailHealth {
  status: 'operational' | 'degraded' | 'offline';
  deliveryRate: number;
  last50Emails: {
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
  };
  error?: string;
}

interface StorageHealth {
  status: 'operational' | 'degraded' | 'offline';
  storageUsagePercent: number;
  totalFiles: number;
  error?: string;
}

interface LeadVelocityData {
  last7Days: Array<{
    date: string;
    reservations: number;
    confirmations: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEON DATABASE DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  
  try {
    // Test connection with raw query
    await prisma.$queryRaw`SELECT 1 as ping`;
    
    const latencyMs = Date.now() - startTime;
    const coldStart = latencyMs > 1000;
    
    // Check connection pool stats (Prisma internal)
    const poolStats = {
      active: 1, // Simplified - Prisma manages this internally
      idle: 0,
    };
    
    logger.info('DIAGNOSTICS DATABASE', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      latency_ms: latencyMs,
      cold_start: coldStart,
      status: coldStart ? 'degraded' : 'operational',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: coldStart ? 'degraded' : 'operational',
      latencyMs,
      coldStart,
      connectionPool: poolStats,
    };
    
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('DIAGNOSTICS DATABASE ERROR', error, {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'offline',
      latencyMs,
      coldStart: false,
      connectionPool: { active: 0, idle: 0 },
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BETTER AUTH DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

async function checkAuthHealth(): Promise<AuthHealth> {
  try {
    // Count active sessions (non-expired) and total users
    const now = new Date();
    
    let activeSessions = 0;
    let totalUsers = 0;
    
    // Try session count - may fail if table doesn't exist
    try {
      activeSessions = await prisma.session.count({
        where: {
          expires: {
            gt: now,
          },
        },
      });
    } catch (e: any) {
      logger.warn('DIAGNOSTICS AUTH Session table may not exist', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error: e });
      activeSessions = 0;
    }
    
    // Get total users
    try {
      totalUsers = await prisma.user.count();
    } catch (e: any) {
      logger.warn('DIAGNOSTICS AUTH Error counting users', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error: e });
      totalUsers = 0;
    }
    
    logger.info('DIAGNOSTICS AUTH', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      active_sessions: activeSessions,
      total_users: totalUsers,
      status: 'operational',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'operational',
      activeSessions24h: activeSessions,
      totalUsers,
    };
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('DIAGNOSTICS AUTH ERROR', error, {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'offline',
      activeSessions24h: 0,
      totalUsers: 0,
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND EMAIL DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

async function checkEmailHealth(): Promise<EmailHealth> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    return {
      status: 'offline',
      deliveryRate: 0,
      last50Emails: { sent: 0, delivered: 0, failed: 0, pending: 0 },
      error: 'RESEND_API_KEY not configured',
    };
  }
  
  try {
    // Fetch recent emails from Resend API
    const response = await fetch('https://api.resend.com/emails?limit=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }
    
    const data = await response.json();
    const emails = data.data || [];
    
    // Filter for purchase confirmation emails
    const confirmationEmails = emails.filter((email: any) => 
      email.subject?.includes('Purchase Confirmed') || 
      email.tags?.some((tag: any) => tag.value === 'purchase-confirmation')
    );
    
    // Calculate delivery stats
    const stats = {
      sent: confirmationEmails.length,
      delivered: confirmationEmails.filter((e: any) => e.last_event === 'delivered').length,
      failed: confirmationEmails.filter((e: any) => 
        e.last_event === 'bounced' || e.last_event === 'complained'
      ).length,
      pending: confirmationEmails.filter((e: any) => 
        e.last_event === 'queued' || e.last_event === 'sent'
      ).length,
    };
    
    const deliveryRate = stats.sent > 0 
      ? (stats.delivered / stats.sent) * 100 
      : 100;
    
    const status = deliveryRate >= 95 ? 'operational' : 'degraded';
    
    logger.info('DIAGNOSTICS EMAIL', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      delivery_rate: deliveryRate.toFixed(2),
      stats,
      status,
      timestamp: new Date().toISOString(),
    });
    
    return {
      status,
      deliveryRate,
      last50Emails: stats,
    };
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('DIAGNOSTICS EMAIL ERROR', error, {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'offline',
      deliveryRate: 0,
      last50Emails: { sent: 0, delivered: 0, failed: 0, pending: 0 },
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOADTHING DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

async function checkStorageHealth(): Promise<StorageHealth> {
  const UPLOADTHING_SECRET = process.env.UPLOADTHING_SECRET;
  
  if (!UPLOADTHING_SECRET) {
    return {
      status: 'offline',
      storageUsagePercent: 0,
      totalFiles: 0,
      error: 'UPLOADTHING_SECRET not configured',
    };
  }
  
  try {
    // Verify API key and get usage stats
    const response = await fetch('https://api.uploadthing.com/v6/getUsageInfo', {
      method: 'POST',
      headers: {
        'X-Uploadthing-Api-Key': UPLOADTHING_SECRET,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`UploadThing API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Calculate storage usage percentage
    const totalAppBytes = data.totalBytes || 0;
    const appLimitBytes = data.appLimitBytes || 1073741824; // 1GB default
    const usagePercent = (totalAppBytes / appLimitBytes) * 100;
    
    const status = usagePercent < 80 ? 'operational' : 'degraded';
    
    logger.info('DIAGNOSTICS STORAGE', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      usage_percent: usagePercent.toFixed(2),
      total_files: data.filesUploaded || 0,
      status,
      timestamp: new Date().toISOString(),
    });
    
    return {
      status,
      storageUsagePercent: usagePercent,
      totalFiles: data.filesUploaded || 0,
    };
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('DIAGNOSTICS STORAGE ERROR', error, {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 'offline',
      storageUsagePercent: 0,
      totalFiles: 0,
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS METRICS
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveHolds(): Promise<number> {
  try {
    const count = await prisma.reservation.count({
      where: {
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });
    
    return count;
  } catch (error: any) {
    logger.warn('DIAGNOSTICS ACTIVE_HOLDS Reservation table may have issues', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error });
    return 0;
  }
}

async function getLeadVelocity(): Promise<LeadVelocityData> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    let reservations: { createdAt: Date }[] = [];
    let confirmations: { updatedAt: Date }[] = [];
    
    try {
      [reservations, confirmations] = await Promise.all([
        prisma.reservation.findMany({
          where: {
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
          select: {
            createdAt: true,
          },
        }),
        prisma.reservation.findMany({
          where: {
            status: 'CONFIRMED',
            updatedAt: {
              gte: sevenDaysAgo,
            },
          },
          select: {
            updatedAt: true,
          },
        }),
      ]);
    } catch (e: any) {
      logger.warn('DIAGNOSTICS LEAD_VELOCITY Reservation queries failed', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error: e });
      reservations = [];
      confirmations = [];
    }
    
    // Group by date
    const velocityMap = new Map<string, { reservations: number; confirmations: number }>();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      velocityMap.set(dateKey, { reservations: 0, confirmations: 0 });
    }
    
    reservations.forEach(r => {
      const dateKey = r.createdAt.toISOString().split('T')[0];
      const existing = velocityMap.get(dateKey);
      if (existing) {
        existing.reservations++;
      }
    });
    
    confirmations.forEach(c => {
      const dateKey = c.updatedAt.toISOString().split('T')[0];
      const existing = velocityMap.get(dateKey);
      if (existing) {
        existing.confirmations++;
      }
    });
    
    const last7Days = Array.from(velocityMap.entries())
      .map(([date, data]) => ({
        date,
        reservations: data.reservations,
        confirmations: data.confirmations,
      }))
      .reverse();
    
    return { last7Days };
    
  } catch (error: any) {
    logger.error('DIAGNOSTICS LEAD_VELOCITY ERROR', error, { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS' });
    return { last7Days: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN API HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate and authorize
    const authResult = await requireAdmin();
    if (authResult.error) {
      logger.error('DIAGNOSTICS UNAUTHORIZED', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', timestamp: new Date().toISOString(), reason: 'Admin access required' });
      return authResult.error;
    }
    const currentUser = authResult.user;
    
    logger.info('DIAGNOSTICS STARTED', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      admin_id: currentUser.id,
      admin_email: currentUser.email?.substring(0, 3) + '***',
      timestamp: new Date().toISOString(),
    });
    
    // Run all diagnostics in parallel
    const [database, auth, email, storage, activeHolds, leadVelocity] = await Promise.all([
      checkDatabaseHealth(),
      checkAuthHealth(),
      checkEmailHealth(),
      checkStorageHealth(),
      getActiveHolds(),
      getLeadVelocity(),
    ]);
    
    // Get business metrics from database with defensive error handling
    let usersCount = 0;
    let developmentsCount = 0;
    let standsCount = 0;
    let reservationsCount = 0;
    let activities: any[] = [];
    
    try {
      [usersCount, developmentsCount, standsCount, reservationsCount] = await Promise.all([
        prisma.user.count().catch(() => 0),
        prisma.development.count().catch(() => 0),
        prisma.stand.count().catch(() => 0),
        prisma.reservation.count().catch(() => 0),
      ]);
    } catch (e: any) {
      logger.warn('DIAGNOSTICS Error counting records', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error: e });
    }
    
    // Try to get audit logs, but don't fail if table doesn't exist
    try {
      activities = await prisma.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    } catch (e: any) {
      logger.warn('DIAGNOSTICS AuditLog table may not exist', { module: 'API', action: 'GET_ADMIN_DIAGNOSTICS', error: e });
      activities = [];
    }
    
    // Determine overall system status
    const allServices = [database.status, auth.status, email.status, storage.status];
    const hasOffline = allServices.includes('offline');
    const hasDegraded = allServices.includes('degraded');
    
    const overallStatus = hasOffline ? 'critical' : hasDegraded ? 'degraded' : 'healthy';
    
    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      services: {
        database,
        auth,
        email,
        storage,
      },
      metrics: {
        activeHolds,
        leadVelocity,
      },
    };
    
    // Return response in format expected by client component (CommandCenter.tsx)
    const responseData = {
      timestamp: result.timestamp,
      overallStatus: result.status,
      database: {
        status: database.status,
        latencyMs: database.latencyMs,
        coldStart: database.coldStart,
        connectionPool: database.connectionPool,
        error: database.error,
      },
      auth: {
        status: auth.status,
        activeSessions24h: auth.activeSessions24h,
        totalUsers: auth.totalUsers,
        error: auth.error,
      },
      email: {
        status: email.status,
        deliveryRate: email.deliveryRate,
        lastChecked: new Date().toISOString(),
        last50Emails: email.last50Emails,
        error: email.error,
      },
      storage: {
        status: storage.status,
        usagePercent: storage.storageUsagePercent,
        totalBytes: storage.totalFiles * 1024 * 1024, // Estimate
        storageUsagePercent: storage.storageUsagePercent,
        totalFiles: storage.totalFiles,
        error: storage.error,
      },
      businessMetrics: {
        activeHolds,
        leadVelocity: leadVelocity.last7Days,
      },
    };
    
    const duration = Date.now() - startTime;
    
    logger.info('DIAGNOSTICS COMPLETED', {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      overall_status: overallStatus,
      metrics: {
        users: usersCount,
        developments: developmentsCount,
        stands: standsCount,
        reservations: reservationsCount,
        activities: activities.length,
      },
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('DIAGNOSTICS ERROR', error, {
      module: 'API',
      action: 'GET_ADMIN_DIAGNOSTICS',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    
    if (errorMessage.includes('Forbidden')) {
      return new Response(
        JSON.stringify({ error: 'Access denied. ADMIN role required.' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
