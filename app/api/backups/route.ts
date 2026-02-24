/**
 * GET /api/backups
 * List backups for the current user (developer or admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { listBackups } from "@/lib/services/backup-generator";

type BackupScopeType = "DEVELOPER" | "ADMIN";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    // Determine scope
    const isAdmin = user.role?.toUpperCase() === "ADMIN";

    let backups;

    if (isAdmin) {
      // Admin can see both developer and admin backups
      const searchParams = request.nextUrl.searchParams;
      const scopeType = searchParams.get("scopeType") as BackupScopeType | null;
      const scopeId = searchParams.get("scopeId");

      if (scopeType && scopeId) {
        // Filter by specific scope
        backups = await listBackups(scopeType, scopeId);
      } else {
        // Show admin backups by default
        backups = await listBackups("ADMIN", "admin");
      }
    } else {
      // Developer can only see their own backups
      backups = await listBackups("DEVELOPER", user.email!);
    }

    return NextResponse.json({
      backups,
      user: {
        email: user.email,
        role: isAdmin ? "admin" : "developer",
      },
    });
  } catch (error) {
    console.error("Error fetching backups:", error);
    return NextResponse.json(
      { error: "Failed to fetch backups" },
      { status: 500 }
    );
  }
}
