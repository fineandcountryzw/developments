import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/error-codes";
import { logger } from "@/lib/logger";

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Check if notifications table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
    } catch (tableError: any) {
      // If table doesn't exist, return 0
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        return apiSuccess({ unreadCount: 0 });
      }
      throw tableError;
    }

    // Get unread count
    const unreadCount = await (prisma as any).notification.count({
      where: {
        recipientUserId: session.user.id,
        isRead: false,
      },
    });

    return apiSuccess({ unreadCount });
  } catch (error) {
    logger.error("[Notifications Unread-Count GET] Error", error as any, { module: "API", action: "GET_NOTIFICATIONS_UNREAD_COUNT" });
    return apiError("Failed to fetch unread count", 500, ErrorCodes.INTERNAL_ERROR, {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}
