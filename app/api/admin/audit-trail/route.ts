import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-trail
 * Fetch paginated audit trail logs with filtering
 * Queries BOTH activityLog and auditTrail tables for comprehensive logging
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const branch = searchParams.get('branch');
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause for activityLog
    interface ActivityLogWhere {
      branch?: string;
      module?: string;
      action?: string;
      userId?: string;
      OR?: Array<{
        description?: { contains: string; mode: 'insensitive' };
        recordId?: { contains: string; mode: 'insensitive' };
        module?: { contains: string; mode: 'insensitive' };
      }>;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    }
    const activityLogWhere: ActivityLogWhere = {};
    if (branch) activityLogWhere.branch = branch;
    if (module) activityLogWhere.module = module;
    if (action) activityLogWhere.action = action;
    if (userId) activityLogWhere.userId = userId;
    if (search) {
      activityLogWhere.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { recordId: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      activityLogWhere.createdAt = {};
      if (startDate) activityLogWhere.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        activityLogWhere.createdAt.lte = end;
      }
    }

    // Build where clause for auditTrail
    interface AuditTrailWhere {
      branch?: string;
      action?: string;
      userId?: string;
      OR?: Array<{
        description?: { contains: string; mode: 'insensitive' };
        resourceId?: { contains: string; mode: 'insensitive' };
        resourceType?: { contains: string; mode: 'insensitive' };
      }>;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    }
    const auditTrailWhere: AuditTrailWhere = {};
    if (branch) auditTrailWhere.branch = branch;
    if (action) auditTrailWhere.action = action;
    if (userId) auditTrailWhere.userId = userId;
    if (search) {
      auditTrailWhere.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      auditTrailWhere.createdAt = {};
      if (startDate) auditTrailWhere.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        auditTrailWhere.createdAt.lte = end;
      }
    }

    // Fetch logs from both tables
    const [activityLogs, activityTotal] = await Promise.all([
      prisma.activityLog.findMany({
        where: activityLogWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where: activityLogWhere }),
    ]);

    // Fetch user details separately since ActivityLog doesn't have a user relation
    const activityUserIds = Array.from(new Set(activityLogs.map(a => a.userId).filter(Boolean) as string[]));
    const activityUsers = activityUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: activityUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    }) : [];
    const activityUserMap = new Map(activityUsers.map(u => [u.id, u]));

    const [auditTrails, auditTotal] = await Promise.all([
      prisma.auditTrail.findMany({
        where: auditTrailWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditTrail.count({ where: auditTrailWhere }),
    ]);

    // Fetch user details separately since AuditTrail doesn't have a user relation
    const auditUserIds = Array.from(new Set(auditTrails.map(a => a.userId).filter(Boolean) as string[]));
    const auditUsers = auditUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: auditUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    }) : [];
    const auditUserMap = new Map(auditUsers.map(u => [u.id, u]));

    // Transform auditTrail entries to match activityLog format
    const transformedAuditTrails = auditTrails.map((log: any) => ({
      id: log.id,
      userId: log.userId,
      user: log.userId ? auditUserMap.get(log.userId) || null : null,
      action: log.action,
      module: log.resourceType, // resourceType becomes module
      recordId: log.resourceId,
      description: log.description,
      branch: log.branch,
      changes: log.details || null,
      createdAt: log.createdAt,
      source: 'auditTrail', // Track source for debugging
    }));

    // Transform activityLog entries with user data
    const transformedActivityLogs = activityLogs.map((log) => ({
      ...log,
      module: log.module,
      source: 'activityLog',
      user: log.userId ? activityUserMap.get(log.userId) || null : null,
    }));

    // Merge and sort by createdAt descending
    const allLogs = [...transformedAuditTrails, ...transformedActivityLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = activityTotal + auditTotal;

    // Apply pagination after merging
    const paginatedLogs = allLogs.slice(skip, skip + limit);

    // Get unique modules and actions from both tables
    const [activityModules, activityActions, auditActions] = await Promise.all([
      prisma.activityLog.findMany({
        select: { module: true },
        distinct: ['module'],
      }),
      prisma.activityLog.findMany({
        select: { action: true },
        distinct: ['action'],
      }),
      prisma.auditTrail.findMany({
        select: { action: true },
        distinct: ['action'],
      }),
    ]);

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    const allModules = Array.from(new Set([
      ...activityModules.map((m: any) => m.module),
      'USER', // auditTrail resourceTypes
      'INVITATION',
    ]));

    const allActions = Array.from(new Set([
      ...activityActions.map((a: any) => a.action),
      ...auditActions.map((a: any) => a.action),
    ]));

    return NextResponse.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: {
        modules: allModules,
        actions: allActions,
        users,
      },
      debug: {
        activityLogCount: activityTotal,
        auditTrailCount: auditTotal,
      },
    });
  } catch (error) {
    logger.error('Error fetching audit trail', error instanceof Error ? error : undefined, { module: 'API', action: 'GET_AUDIT_TRAIL' });
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/audit-trail
 * Create a new audit log entry
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const { branch, action, module, recordId, description, changes } = body;

    if (!action || !module || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: action, module, description' },
        { status: 400 }
      );
    }

    const log = await prisma.activityLog.create({
      data: {
        branch: branch || 'Harare',
        userId: authResult.user?.id,
        action,
        module,
        recordId: recordId || 'N/A',
        description,
        changes: changes || null,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    logger.error('Error creating audit log', error instanceof Error ? error : undefined, { module: 'API', action: 'POST_AUDIT_TRAIL' });
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}
