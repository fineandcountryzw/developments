/**
 * POST /api/backups/[id]/email
 * Re-send backup notification email
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getBackupById } from "@/lib/services/backup-generator";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
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
        { error: "Backup is not ready" },
        { status: 400 }
      );
    }

    if (!backup.artifactUrl) {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 }
      );
    }

    // Prepare email
    const recipientEmail = backup.scopeType === "DEVELOPER" ? backup.scopeId : user.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: "Recipient email not found" }, { status: 500 });
    }
    const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/backups/${backup.id}/download`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .metadata { background: white; padding: 15px; border-radius: 6px; margin-top: 20px; }
            .metadata-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Weekly Backup Ready</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your weekly backup for <strong>${backup.weekLabel}</strong> is ready for download.</p>
              
              <div class="metadata">
                <h3>Backup Details</h3>
                <div class="metadata-row">
                  <span>Week:</span>
                  <span><strong>${backup.weekLabel}</strong></span>
                </div>
                <div class="metadata-row">
                  <span>Period:</span>
                  <span>${backup.weekStart.toLocaleDateString()} - ${backup.weekEnd.toLocaleDateString()}</span>
                </div>
                <div class="metadata-row">
                  <span>File Size:</span>
                  <span>${formatFileSize(Number(backup.fileSize || 0))}</span>
                </div>
                <div class="metadata-row">
                  <span>Generated:</span>
                  <span>${backup.completedAt?.toLocaleString()}</span>
                </div>
              </div>

              <a href="${downloadUrl}" class="button">Download Backup</a>

              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                <strong>Note:</strong> This backup contains CSV files and a PDF summary. 
                The download link is valid and secure.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    await resend.emails.send({
      from: "DevelopmentSFC <noreply@developmentsfc.com>",
      to: recipientEmail,
      subject: `Weekly Backup Ready - ${backup.weekLabel}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: `Email sent to ${recipientEmail}`,
    });
  } catch (error) {
    console.error("Error sending backup email:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: "Failed to send email",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
