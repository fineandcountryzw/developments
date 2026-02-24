import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/error-codes";
import { logger } from "@/lib/logger";

/**
 * POST /api/notifications/read
 * Mark specific notifications as read
 * Body: { ids: string[] } or { id: string }
 */
export async function POST(request: NextRequest) {
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
    const { ids, id } = body;

    // Support both single id and array of ids
    const notificationIds = ids || (id ? [id] : []);

    if (!notificationIds.length) {
      return apiError("No notification IDs provided", 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if notifications table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
    } catch (tableError: any) {
      // If table doesn't exist, return success (nothing to mark as read)
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        return apiSuccess({ markedAsRead: 0 });
      }
      throw tableError;
    }

    // Mark notifications as read
    const result = await (prisma as any).notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
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
    logger.error("[Notifications Read POST] Error", error as any, { module: "API", action: "POST_NOTIFICATIONS_READ" });
    return apiError("Failed to mark notifications as read", 500, ErrorCodes.INTERNAL_ERROR, {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}
