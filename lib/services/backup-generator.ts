/**
 * Backup Generator Service
 * Main orchestrator for generating weekly backups
 */

import { prisma } from "@/lib/prisma";
import { generateBackupCSVs } from "./backup-csv-generator";
import { generateBackupPDF } from "./backup-pdf-generator";
import { packageAndUploadBackup } from "./backup-packaging";
type BackupScopeType = "DEVELOPER" | "ADMIN";
type BackupJobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface GenerateBackupParams {
  scopeType: BackupScopeType;
  scopeId: string;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

interface GenerateBackupResult {
  backupJobId: string;
  artifactUrl: string;
  fileSize: number;
}

/**
 * Main entry point: Generate and store a backup
 */
export async function generateBackup(
  params: GenerateBackupParams
): Promise<GenerateBackupResult> {
  const { scopeType, scopeId, weekStart, weekEnd, weekLabel } = params;

  // Check for existing backup (idempotency)
  const existingBackup = await prisma.backupJob.findUnique({
    where: {
      scopeType_scopeId_weekStart: {
        scopeType,
        scopeId,
        weekStart,
      },
    },
  });

  if (existingBackup && existingBackup.status === "COMPLETED") {
    // Return existing backup
    return {
      backupJobId: existingBackup.id,
      artifactUrl: existingBackup.artifactUrl!,
      fileSize: Number(existingBackup.fileSize!),
    };
  }

  // Create or update backup job
  let backupJob = existingBackup;
  if (!backupJob) {
    backupJob = await prisma.backupJob.create({
      data: {
        scopeType,
        scopeId,
        weekStart,
        weekEnd,
        weekLabel,
        status: "PENDING",
      },
    });
  }

  try {
    // Update status to IN_PROGRESS
    await prisma.backupJob.update({
      where: { id: backupJob.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    // Generate CSV files
    const csvFiles = await generateBackupCSVs(
      { scopeType, scopeId },
      { weekStart, weekEnd, weekLabel }
    );

    // Generate PDF summary
    const pdfBuffer = await generateBackupPDF(
      { scopeType, scopeId },
      { weekStart, weekEnd, weekLabel }
    );

    // Package and upload
    const uploadResult = await packageAndUploadBackup(
      { scopeType, scopeId },
      { weekStart, weekEnd, weekLabel },
      { csvFiles, pdfBuffer }
    );

    // Calculate CSV row counts for metadata
    const csvRowCounts: Record<string, number> = {};
    for (const [filename, content] of Object.entries(csvFiles)) {
      const lines = (content as string).split("\n");
      csvRowCounts[filename] = lines.length - 1; // Exclude header
    }

    // Update backup job to COMPLETED
    await prisma.backupJob.update({
      where: { id: backupJob.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        artifactUrl: uploadResult.url,
        artifactKey: uploadResult.key,
        fileSize: BigInt(uploadResult.size),
        metadata: {
          csvRowCounts,
          fileList: Object.keys(csvFiles).concat(["backup_summary.pdf"]),
        },
      },
    });

    return {
      backupJobId: backupJob.id,
      artifactUrl: uploadResult.url,
      fileSize: uploadResult.size,
    };
  } catch (error) {
    // Update backup job to FAILED
    await prisma.backupJob.update({
      where: { id: backupJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

/**
 * Get ISO week dates (Monday start, Sunday end)
 */
export function getISOWeekDates(date: Date): {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
} {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start

  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Calculate ISO week number
  const yearStart = new Date(weekStart.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((weekStart.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7
  );

  const weekLabel = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  return { weekStart, weekEnd, weekLabel };
}

/**
 * List backups for a scope
 */
export async function listBackups(
  scopeType: BackupScopeType,
  scopeId: string,
  limit: number = 50
) {
  return await prisma.backupJob.findMany({
    where: {
      scopeType,
      scopeId,
    },
    orderBy: {
      weekStart: "desc",
    },
    take: limit,
  });
}

/**
 * Get backup by ID with access control
 */
export async function getBackupById(
  backupId: string,
  userId: string,
  userRole: string
) {
  const backup = await prisma.backupJob.findUnique({
    where: { id: backupId },
  });

  if (!backup) {
    throw new Error("Backup not found");
  }

  // Access control
  if (backup.scopeType === "DEVELOPER") {
    // Only the developer or admin can access
    if (userRole !== "admin" && backup.scopeId !== userId) {
      throw new Error("Unauthorized access to backup");
    }
  } else if (backup.scopeType === "ADMIN") {
    // Only admin can access
    if (userRole !== "admin") {
      throw new Error("Unauthorized access to admin backup");
    }
  }

  return backup;
}

/**
 * Record a download for audit trail
 */
export async function recordBackupDownload(
  backupJobId: string,
  userId: string,
  userEmail: string,
  userRole: string,
  ipAddress?: string,
  userAgent?: string
) {
  await prisma.backupDownload.create({
    data: {
      backupJobId,
      userId,
      userEmail,
      userRole,
      ipAddress,
      userAgent,
    },
  });
}
