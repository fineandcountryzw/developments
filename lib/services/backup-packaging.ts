/**
 * Backup Packaging Service
 * Creates ZIP archives and uploads them to UploadThing
 */

import archiver from "archiver";
import { Readable } from "stream";
import { UTApi } from "uploadthing/server";

interface BackupScope {
  scopeType: "DEVELOPER" | "ADMIN";
  scopeId: string;
}

interface DateRange {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

interface BackupFiles {
  csvFiles: Record<string, string>; // filename -> content
  pdfBuffer: Buffer;
}

interface UploadResult {
  url: string;
  key: string;
  size: number;
}

/**
 * Package backup files into ZIP and upload to UploadThing
 */
export async function packageAndUploadBackup(
  scope: BackupScope,
  dateRange: DateRange,
  files: BackupFiles
): Promise<UploadResult> {
  // Create ZIP archive
  const zipBuffer = await createZIPArchive(scope, dateRange, files);

  // Upload to UploadThing
  const uploadResult = await uploadToUploadThing(
    scope,
    dateRange,
    zipBuffer
  );

  return uploadResult;
}

/**
 * Create ZIP archive from backup files
 */
async function createZIPArchive(
  scope: BackupScope,
  dateRange: DateRange,
  files: BackupFiles
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // Add CSV files
    for (const [filename, content] of Object.entries(files.csvFiles)) {
      archive.append(content, { name: filename });
    }

    // Add PDF summary
    const pdfFilename =
      scope.scopeType === "DEVELOPER"
        ? "backup_summary.pdf"
        : "admin_backup_summary.pdf";
    archive.append(files.pdfBuffer, { name: pdfFilename });

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Upload ZIP to UploadThing
 */
async function uploadToUploadThing(
  scope: BackupScope,
  dateRange: DateRange,
  zipBuffer: Buffer
): Promise<UploadResult> {
  const utapi = new UTApi();

  // Generate filename
  const filename =
    scope.scopeType === "DEVELOPER"
      ? `developer_${scope.scopeId.replace("@", "_at_")}_${dateRange.weekLabel}.zip`
      : `admin_${dateRange.weekLabel}.zip`;

  // Convert Buffer to File
  const file = new File([new Uint8Array(zipBuffer)], filename, {
    type: "application/zip",
  });

  // Upload to UploadThing
  const uploadResponse = await utapi.uploadFiles(file);

  if (uploadResponse.error) {
    throw new Error(`UploadThing upload failed: ${uploadResponse.error.message}`);
  }

  return {
    url: uploadResponse.data.url,
    key: uploadResponse.data.key,
    size: zipBuffer.length,
  };
}

/**
 * Delete backup from UploadThing (cleanup utility)
 */
export async function deleteBackupFromUploadThing(key: string): Promise<void> {
  const utapi = new UTApi();
  await utapi.deleteFiles(key);
}
