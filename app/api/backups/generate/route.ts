/**
 * POST /api/backups/generate
 * Trigger backup generation (manual or scheduled)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import {
  generateBackup,
  getISOWeekDates,
} from "@/lib/services/backup-generator";

type BackupScopeType = "DEVELOPER" | "ADMIN";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const isAdmin = user.role?.toUpperCase() === "ADMIN";

    const body = await request.json();
    const { scopeType, scopeId, weekDate } = body;

    // Access control
    if (scopeType === "ADMIN" && !isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    if (scopeType === "DEVELOPER") {
      if (!isAdmin && scopeId !== user.email) {
        return NextResponse.json(
          { error: "Cannot generate backup for another developer" },
          { status: 403 }
        );
      }
    }

    // Get ISO week dates
    const targetDate = weekDate ? new Date(weekDate) : new Date();
    const { weekStart, weekEnd, weekLabel } = getISOWeekDates(targetDate);

    // Generate backup
    const result = await generateBackup({
      scopeType: scopeType as BackupScopeType,
      scopeId: scopeId || user.email,
      weekStart,
      weekEnd,
      weekLabel,
    });

    return NextResponse.json({
      success: true,
      backupJobId: result.backupJobId,
      artifactUrl: result.artifactUrl,
      fileSize: result.fileSize,
      weekLabel,
    });
  } catch (error) {
    console.error("Error generating backup:", error);
    return NextResponse.json(
      {
        error: "Failed to generate backup",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
