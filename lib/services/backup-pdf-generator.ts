/**
 * Backup PDF Generator Service
 * Generates summary PDFs for weekly backups (developer and admin scopes)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";

interface BackupScope {
  scopeType: "DEVELOPER" | "ADMIN";
  scopeId: string;
}

interface DateRange {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

/**
 * Generate backup summary PDF
 */
export async function generateBackupPDF(
  scope: BackupScope,
  dateRange: DateRange
): Promise<Buffer> {
  if (scope.scopeType === "DEVELOPER") {
    return await generateDeveloperBackupPDF(scope, dateRange);
  } else {
    return await generateAdminBackupPDF(dateRange);
  }
}

/**
 * Generate Developer Backup Summary PDF
 */
async function generateDeveloperBackupPDF(
  scope: BackupScope,
  dateRange: DateRange
): Promise<Buffer> {
  const doc = new jsPDF();
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Weekly Backup Summary", 105, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Developer: ${scope.scopeId}`, 105, yPos, { align: "center" });
  yPos += 6;
  doc.text(`Week: ${dateRange.weekLabel}`, 105, yPos, { align: "center" });
  yPos += 6;
  doc.text(
    `Period: ${dateRange.weekStart.toLocaleDateString()} - ${dateRange.weekEnd.toLocaleDateString()}`,
    105,
    yPos,
    { align: "center" }
  );
  yPos += 15;

  // Fetch developer data
  const developments = await prisma.development.findMany({
    where: { developerEmail: scope.scopeId },
  });

  const developmentIds = developments.map((d) => d.id);

  const [totalPayments, totalStands, soldStands, reservedStands, recentPayments] =
    await Promise.all([
      prisma.payment.aggregate({
        where: {
          stand: { developmentId: { in: developmentIds } },
          createdAt: {
            gte: dateRange.weekStart,
            lte: dateRange.weekEnd,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.stand.count({
        where: { developmentId: { in: developmentIds } },
      }),
      prisma.stand.count({
        where: {
          developmentId: { in: developmentIds },
          status: "SOLD",
        },
      }),
      prisma.stand.count({
        where: {
          developmentId: { in: developmentIds },
          status: "RESERVED",
        },
      }),
      prisma.payment.findMany({
        where: {
          stand: { developmentId: { in: developmentIds } },
          createdAt: {
            gte: dateRange.weekStart,
            lte: dateRange.weekEnd,
          },
        },
        include: {
          stand: {
            include: {
              development: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  // KPI Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Key Performance Indicators", 20, yPos);
  yPos += 10;

  const weeklyRevenue = totalPayments._sum?.amount
    ? Number(totalPayments._sum.amount)
    : 0;

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: [
      ["Total Developments", String(developments.length)],
      ["Total Stands", String(totalStands)],
      ["Sold Stands", String(soldStands)],
      ["Reserved Stands", String(reservedStands)],
      ["Payments This Week", String(totalPayments._count._all)],
      [
        "Total Revenue This Week",
        `$${weeklyRevenue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Development Breakdown
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Development Breakdown", 20, yPos);
  yPos += 10;

  const devRows = developments.map((dev) => [
    dev.name,
    String(dev.totalStands || 0),
    String(dev.availableStands || 0),
    dev.status,
    dev.phase,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Development", "Total Stands", "Available", "Status", "Phase"]],
    body: devRows,
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Recent Payments
  if (recentPayments.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Payments", 20, yPos);
    yPos += 10;

    const paymentRows = recentPayments.map((p) => [
      p.createdAt.toLocaleDateString(),
      p.stand?.development?.name || "N/A",
      p.stand?.standNumber || "N/A",
      `$${Number(p.amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      p.method || "N/A",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Development", "Stand", "Amount", "Method"]],
      body: paymentRows,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Footer on all pages
  addFooter(doc);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate Admin Backup Summary PDF
 */
async function generateAdminBackupPDF(dateRange: DateRange): Promise<Buffer> {
  const doc = new jsPDF();
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Admin Weekly Backup Summary", 105, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Week: ${dateRange.weekLabel}`, 105, yPos, { align: "center" });
  yPos += 6;
  doc.text(
    `Period: ${dateRange.weekStart.toLocaleDateString()} - ${dateRange.weekEnd.toLocaleDateString()}`,
    105,
    yPos,
    { align: "center" }
  );
  yPos += 15;

  // Fetch system-wide data
  const [
    developmentsCount,
    totalStands,
    soldStands,
    reservedStands,
    availableStands,
    totalPayments,
    totalPayouts,
    recentPayments,
  ] = await Promise.all([
    prisma.development.count(),
    prisma.stand.count(),
    prisma.stand.count({ where: { status: "SOLD" } }),
    prisma.stand.count({ where: { status: "RESERVED" } }),
    prisma.stand.count({ where: { status: "AVAILABLE" } }),
    prisma.payment.aggregate({
      where: {
        createdAt: {
          gte: dateRange.weekStart,
          lte: dateRange.weekEnd,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.commissionPayout.aggregate({
      where: {
        createdAt: {
          gte: dateRange.weekStart,
          lte: dateRange.weekEnd,
        },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dateRange.weekStart,
          lte: dateRange.weekEnd,
        },
      },
      include: {
        stand: {
          include: {
            development: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  // System KPIs
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("System Overview", 20, yPos);
  yPos += 10;

  const weeklyRevenue = totalPayments._sum?.amount
    ? Number(totalPayments._sum.amount)
    : 0;
  const weeklyPayouts = totalPayouts._sum?.total
    ? Number(totalPayouts._sum.total)
    : 0;

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: [
      ["Total Developments", String(developmentsCount)],
      ["Total Stands", String(totalStands)],
      ["Sold Stands", String(soldStands)],
      ["Reserved Stands", String(reservedStands)],
      ["Available Stands", String(availableStands)],
      ["Payments This Week", String(totalPayments._count._all)],
      [
        "Revenue This Week",
        `$${weeklyRevenue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      ["Payouts This Week", String(totalPayouts._count._all)],
      [
        "Total Payouts",
        `$${weeklyPayouts.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Development Performance
  const developments = await prisma.development.findMany({
    include: {
      _count: {
        select: { stands: true },
      },
    },
  });

  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Development Performance", 20, yPos);
  yPos += 10;

  const devRows = developments.map((dev) => [
    dev.name,
    dev.developerEmail || "N/A",
    String(dev._count.stands),
    dev.status,
    dev.phase,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Development", "Developer", "Stands", "Status", "Phase"]],
    body: devRows,
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Recent Payments
  if (recentPayments.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Payments (This Week)", 20, yPos);
    yPos += 10;

    const paymentRows = recentPayments.map((p) => [
      p.createdAt.toLocaleDateString(),
      (p.stand?.development?.name || "N/A").substring(0, 20),
      p.stand?.standNumber || "N/A",
      `$${Number(p.amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      p.method || "N/A",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Development", "Stand", "Amount", "Method"]],
      body: paymentRows,
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
    });
  }

  // Footer on all pages
  addFooter(doc);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Add footer to all pages
 */
function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Fine & Country Zimbabwe`,
      105,
      295,
      { align: "center" }
    );
  }
}
