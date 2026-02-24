/**
 * GET /api/backups/[id]/download
 * Download a backup file with access control and audit logging
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import {
  getBackupById,
  recordBackupDownload,
} from "@/lib/services/backup-generator";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const isAdmin = user.role?.toUpperCase() === "ADMIN";
    const userRole = isAdmin ? "admin" : "developer";

    // Get backup with access control
    const backup = await getBackupById(id, user.email!, userRole);

    if (backup.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Backup is not ready for download" },
        { status: 400 }
      );
    }

    if (!backup.artifactUrl) {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 }
      );
    }

    // Record download for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    await recordBackupDownload(
      backup.id,
      user.id || user.email || '',
      user.email!,
      userRole,
      ipAddress,
      userAgent
    );

    // Return signed URL (UploadThing URLs are already accessible)
    return NextResponse.json({
      downloadUrl: backup.artifactUrl,
      filename: `backup_${backup.weekLabel}_${backup.scopeId}.zip`,
      fileSize: Number(backup.fileSize),
      weekLabel: backup.weekLabel,
    });
  } catch (error) {
    console.error("Error downloading backup:", error);

    if (
      error instanceof Error &&
      error.message.includes("Unauthorized")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to download backup" },
      { status: 500 }
    );
  }
}
