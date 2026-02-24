import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/error-codes";
import { logger } from "@/lib/logger";

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401, ErrorCodes.AUTH_REQUIRED);
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

    // Mark all unread notifications as read
    const result = await (prisma as any).notification.updateMany({
      where: {
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
    logger.error("[Notifications Read-All POST] Error", error as any, { module: "API", action: "POST_NOTIFICATIONS_READ_ALL" });
    return apiError("Failed to mark all notifications as read", 500, ErrorCodes.INTERNAL_ERROR, {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}
