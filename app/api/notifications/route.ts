import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/error-codes";
import { logger } from "@/lib/logger";

/**
 * GET /api/notifications
 * List notifications with pagination
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - unreadOnly: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401, ErrorCodes.AUTH_REQUIRED);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Validate pagination
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(100, Math.max(1, limit));
    const skip = (validatedPage - 1) * validatedLimit;

    // Check if notifications table exists by attempting a raw query first
    try {
      await prisma.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
    } catch (tableError: any) {
      // If table doesn't exist, return empty response
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        return apiSuccess(
          {
            notifications: [],
            unreadCount: 0,
          },
          200,
          {
            page: validatedPage,
            limit: validatedLimit,
            total: 0,
            pages: 0,
            hasMore: false,
          }
        );
      }
      throw tableError;
    }

    // Build where clause using the correct Prisma field names (mapped to snake_case in DB)
    const where: any = {
      recipientUserId: session.user.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    // Fetch notifications with count
    const [notifications, totalCount] = await Promise.all([
      (prisma as any).notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: validatedLimit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      (prisma as any).notification.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const unreadCount = await (prisma as any).notification.count({
      where: {
        recipientUserId: session.user.id,
        isRead: false,
      },
    });

    return apiSuccess(
      {
        notifications,
        unreadCount,
      },
      200,
      {
        page: validatedPage,
        limit: validatedLimit,
        total: totalCount,
        pages: totalPages,
        hasMore: validatedPage < totalPages,
      }
    );
  } catch (error) {
    logger.error("[Notifications GET] Error", error as any, { module: "API", action: "GET_NOTIFICATIONS" });
    return apiError("Failed to fetch notifications", 500, ErrorCodes.INTERNAL_ERROR, {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

/**
 * PATCH /api/notifications
 * Mark notification(s) as read
 * Body:
 * - { notificationId: string } OR
 * - { markAll: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401, ErrorCodes.AUTH_REQUIRED);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, ErrorCodes.PARSE_ERROR);
    }

    // Check if notifications table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
    } catch (tableError: any) {
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        return apiSuccess({ markedAsRead: 0 });
      }
      throw tableError;
    }

    const markAll = body?.markAll === true;
    const notificationId = typeof body?.notificationId === "string" ? body.notificationId : null;

    if (!markAll && !notificationId) {
      return apiError("notificationId is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await (prisma as any).notification.updateMany({
      where: {
        ...(markAll ? {} : { id: notificationId }),
        recipientUserId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return apiSuccess({ markedAsRead: result.count });
  } catch (error) {
    logger.error("[Notifications PATCH] Error", error as any, { module: "API", action: "PATCH_NOTIFICATIONS" });
    return apiError("Failed to update notifications", 500, ErrorCodes.INTERNAL_ERROR, {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}
