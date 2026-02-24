/**
 * Backup CSV Generator Service
 * Generates CSV files for weekly backups (developer and admin scopes)
 * Uses PaymentAllocation ledger to prevent double-counting
 */

import { prisma } from "@/lib/prisma";
import { getStandsWithFinancials } from "@/lib/services/stands-financial-service";

interface BackupScope {
  scopeType: "DEVELOPER" | "ADMIN";
  scopeId: string; // developer_email or "admin"
}

interface DateRange {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

/**
 * Generate all CSV files for a backup job
 */
export async function generateBackupCSVs(
  scope: BackupScope,
  dateRange: DateRange
): Promise<Record<string, string>> {
  const csvFiles: Record<string, string> = {};

  // 1. Developments CSV
  csvFiles["developments.csv"] = await generateDevelopmentsCSV(scope);

  // 2. Stands CSV
  csvFiles["stands.csv"] = await generateStandsCSV(scope);

  // 3. Reservations CSV
  csvFiles["reservations.csv"] = await generateReservationsCSV(scope);

  // 4. Contracts CSV
  csvFiles["contracts.csv"] = await generateContractsCSV(scope);

  // 5. Payments CSV
  csvFiles["payments.csv"] = await generatePaymentsCSV(scope);

  // 6. Receipts CSV
  csvFiles["receipts.csv"] = await generateReceiptsCSV(scope);

  // 7. Installments CSV
  csvFiles["installments.csv"] = await generateInstallmentsCSV(scope);

  // 8. Allocations CSV
  csvFiles["allocations.csv"] = await generateAllocationsCSV(scope);

  // 9. Payouts CSV (admin only)
  if (scope.scopeType === "ADMIN") {
    csvFiles["payouts.csv"] = await generatePayoutsCSV();
  }

  // 10. Reconciliation Summary CSV
  csvFiles["recon_summary.csv"] = await generateReconSummaryCSV(scope);

  return csvFiles;
}

/**
 * 1. Developments CSV
 */
async function generateDevelopmentsCSV(scope: BackupScope): Promise<string> {
  const where: any = scope.scopeType === "DEVELOPER"
    ? { developerEmail: scope.scopeId }
    : {};

  const developments = await prisma.development.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "id", "name", "developer_email", "developer_name", "branch", "location",
    "status", "phase", "total_stands", "available_stands", "base_price",
    "price_per_sqm", "total_area_sqm", "vat_percentage", "deposit_percentage",
    "description", "features", "created_at", "updated_at",
  ];

  const rows = developments.map((dev) => [
    dev.id,
    escapeCSV(dev.name),
    escapeCSV(dev.developerEmail || ""),
    escapeCSV(dev.developerName || ""),
    escapeCSV(dev.branch),
    escapeCSV(dev.location),
    escapeCSV(dev.status),
    escapeCSV(dev.phase),
    dev.totalStands || 0,
    dev.availableStands || 0,
    dev.basePrice || 0,
    dev.pricePerSqm || 0,
    dev.totalAreaSqm || 0,
    dev.vatPercentage || 0,
    dev.depositPercentage || 0,
    escapeCSV(dev.description || ""),
    escapeCSV(JSON.stringify(dev.features || [])),
    dev.createdAt.toISOString(),
    dev.updatedAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 2. Stands CSV - Uses financial service for accurate totals
 */
async function generateStandsCSV(scope: BackupScope): Promise<string> {
  let developmentIds: string[] | undefined;

  if (scope.scopeType === "DEVELOPER") {
    const devs = await prisma.development.findMany({
      where: { developerEmail: scope.scopeId },
      select: { id: true },
    });
    developmentIds = devs.map((d) => d.id);
  }

  const stands = await getStandsWithFinancials({
    developmentIds,
  });

  const headers = [
    "stand_id", "stand_number", "development_id", "development_name", "branch",
    "client_id", "client_name", "client_email", "stand_price", "total_paid",
    "balance", "outstanding", "arrears", "payment_status",
    "last_payment_date", "next_due_date", "total_installments", "paid_installments",
    "pending_installments", "overdue_installments", "contract_status",
  ];

  const rows = stands.map((stand) => [
    stand.standId,
    escapeCSV(stand.standNumber),
    stand.developmentId,
    escapeCSV(stand.developmentName),
    escapeCSV(stand.branch),
    escapeCSV(stand.clientId || ""),
    escapeCSV(stand.clientName || ""),
    escapeCSV(stand.clientEmail || ""),
    stand.standPrice || 0,
    stand.totalPaid || 0,
    stand.balance || 0,
    stand.outstanding || 0,
    stand.arrears || 0,
    escapeCSV(stand.paymentStatus || ""),
    stand.lastPaymentDate || "",
    stand.nextDueDate || "",
    stand.totalInstallments || 0,
    stand.paidInstallments || 0,
    stand.pendingInstallments || 0,
    stand.overdueInstallments || 0,
    escapeCSV(stand.contractStatus || ""),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 3. Reservations CSV
 */
async function generateReservationsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.stand = {
      development: { developerEmail: scope.scopeId },
    };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      stand: { include: { development: true } },
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "stand_id", "stand_number", "development_name",
    "client_id", "status", "pop_url", "base_price_at_reservation",
    "final_price_at_reservation", "expires_at", "created_at",
  ];

  const rows = reservations.map((res) => [
    res.id,
    res.standId,
    escapeCSV(res.stand?.standNumber || ""),
    escapeCSV(res.stand?.development?.name || ""),
    escapeCSV(res.clientId || ""),
    escapeCSV(res.status),
    escapeCSV(res.popUrl || ""),
    res.basePriceAtReservation?.toString() || "",
    res.finalPriceAtReservation?.toString() || "",
    res.expiresAt?.toISOString() || "",
    res.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 4. Contracts CSV
 */
async function generateContractsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.stand = {
      development: { developerEmail: scope.scopeId },
    };
  }

  const contracts = await prisma.generatedContract.findMany({
    where,
    include: {
      stand: { include: { development: true } },
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "stand_id", "stand_number", "development_name",
    "client_id", "template_name", "status", "branch",
    "signed_at", "signed_by",
    "created_at",
  ];

  const rows = contracts.map((contract) => [
    contract.id,
    contract.standId,
    escapeCSV(contract.stand?.standNumber || ""),
    escapeCSV(contract.stand?.development?.name || ""),
    escapeCSV(contract.clientId || ""),
    escapeCSV(contract.templateName || ""),
    escapeCSV(contract.status),
    escapeCSV(contract.branch),
    contract.signedAt?.toISOString() || "",
    escapeCSV(contract.signedBy || ""),
    contract.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 5. Payments CSV
 */
async function generatePaymentsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.stand = {
      development: { developerEmail: scope.scopeId },
    };
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      stand: { include: { development: true } },
      receipt: true,
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "client_id", "client_name", "stand_id", "stand_number",
    "development_name", "amount", "surcharge_amount", "payment_type",
    "method", "reference", "status", "verification_status",
    "office_location", "receipt_number", "confirmed_at",
    "received_by_name", "description", "created_at",
  ];

  const rows = payments.map((payment) => [
    payment.id,
    escapeCSV(payment.clientId || ""),
    escapeCSV(payment.clientName || ""),
    payment.standId,
    escapeCSV(payment.stand?.standNumber || ""),
    escapeCSV(payment.stand?.development?.name || ""),
    payment.amount?.toString() || "0",
    payment.surchargeAmount?.toString() || "0",
    escapeCSV(payment.paymentType || ""),
    escapeCSV(payment.method || ""),
    escapeCSV(payment.reference || ""),
    escapeCSV(payment.status),
    escapeCSV(payment.verificationStatus || ""),
    escapeCSV(payment.officeLocation || ""),
    escapeCSV(payment.receipt?.receiptNumber || ""),
    payment.confirmedAt?.toISOString() || "",
    escapeCSV(payment.receivedByName || ""),
    escapeCSV(payment.description || ""),
    payment.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 6. Receipts CSV
 */
async function generateReceiptsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.payment = {
      stand: {
        development: { developerEmail: scope.scopeId },
      },
    };
  }

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      payment: {
        include: {
          stand: { include: { development: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "receipt_number", "payment_id", "client_id", "client_name",
    "client_email", "amount", "payment_method", "payment_type",
    "stand_number", "development_name", "branch",
    "received_by", "status", "pdf_url", "created_at",
  ];

  const rows = receipts.map((receipt) => [
    receipt.id,
    escapeCSV(receipt.receiptNumber),
    receipt.paymentId,
    escapeCSV(receipt.clientId || ""),
    escapeCSV(receipt.clientName || ""),
    escapeCSV(receipt.clientEmail || ""),
    receipt.amount?.toString() || "0",
    escapeCSV(receipt.paymentMethod || ""),
    escapeCSV(receipt.paymentType || ""),
    escapeCSV(receipt.standNumber || ""),
    escapeCSV(receipt.developmentName || ""),
    escapeCSV(receipt.branch || ""),
    escapeCSV(receipt.receivedBy || ""),
    escapeCSV(receipt.status),
    escapeCSV(receipt.pdfUrl || ""),
    receipt.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 7. Installments CSV
 */
async function generateInstallmentsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.plan = {
      stand: {
        development: { developerEmail: scope.scopeId },
      },
    };
  }

  const installments = await prisma.installment.findMany({
    where,
    include: {
      plan: {
        include: {
          stand: { include: { development: true } },
          client: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const headers = [
    "id", "plan_id", "installment_no", "stand_number",
    "development_name", "client_id", "amount_due", "amount_paid",
    "due_date", "paid_date", "status", "created_at",
  ];

  const rows = installments.map((inst) => [
    inst.id,
    inst.planId,
    inst.installmentNo,
    escapeCSV(inst.plan?.stand?.standNumber || ""),
    escapeCSV(inst.plan?.stand?.development?.name || ""),
    escapeCSV(inst.plan?.clientId || ""),
    inst.amountDue?.toString() || "0",
    inst.amountPaid?.toString() || "0",
    inst.dueDate.toISOString(),
    inst.paidDate?.toISOString() || "",
    escapeCSV(inst.status),
    inst.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 8. Allocations CSV (PaymentAllocation ledger)
 */
async function generateAllocationsCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    where.payment = {
      stand: {
        development: { developerEmail: scope.scopeId },
      },
    };
  }

  const allocations = await prisma.paymentAllocation.findMany({
    where,
    include: {
      payment: {
        include: {
          stand: { include: { development: true } },
        },
      },
      installment: true,
    },
    orderBy: { allocatedAt: "desc" },
  });

  const headers = [
    "id", "payment_id", "stand_number", "development_name",
    "installment_id", "installment_no", "amount", "allocation_type",
    "allocation_status", "allocated_at", "allocated_by",
    "notes", "created_at",
  ];

  const rows = allocations.map((alloc) => [
    alloc.id,
    alloc.paymentId,
    escapeCSV(alloc.payment?.stand?.standNumber || ""),
    escapeCSV(alloc.payment?.stand?.development?.name || ""),
    alloc.installmentId || "",
    alloc.installment?.installmentNo || "",
    alloc.amount?.toString() || "0",
    escapeCSV(alloc.allocationType || ""),
    escapeCSV(alloc.allocationStatus || ""),
    alloc.allocatedAt?.toISOString() || "",
    escapeCSV(alloc.allocatedBy || ""),
    escapeCSV(alloc.notes || ""),
    alloc.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 9. Payouts CSV (Admin only - CommissionPayout)
 */
async function generatePayoutsCSV(): Promise<string> {
  const payouts = await prisma.commissionPayout.findMany({
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "agent_id", "month", "total", "status",
    "branch", "paid_at", "notes", "created_at",
  ];

  const rows = payouts.map((payout) => [
    payout.id,
    escapeCSV(payout.agentId),
    escapeCSV(payout.month),
    payout.total?.toString() || "0",
    escapeCSV(payout.status),
    escapeCSV(payout.branch),
    payout.paidAt?.toISOString() || "",
    escapeCSV(payout.notes || ""),
    payout.createdAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

/**
 * 10. Reconciliation Summary CSV
 */
async function generateReconSummaryCSV(scope: BackupScope): Promise<string> {
  const where: any = {};

  if (scope.scopeType === "DEVELOPER") {
    const devBranches = await prisma.development.findMany({
      where: { developerEmail: scope.scopeId },
      select: { branch: true },
      distinct: ["branch"],
    });
    const branches = devBranches.map((d) => d.branch);
    if (branches.length > 0) {
      where.branch = { in: branches };
    }
  }

  const reconRecords = await prisma.reconRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id", "status", "branch", "notes", "created_at", "updated_at",
  ];

  const rows = reconRecords.map((recon) => [
    recon.id,
    escapeCSV(recon.status),
    escapeCSV(recon.branch),
    escapeCSV(recon.notes || ""),
    recon.createdAt.toISOString(),
    recon.updatedAt.toISOString(),
  ]);

  return formatCSV(headers, rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCSV(headers: string[], rows: any[][]): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    row
      .map((cell) => {
        if (typeof cell === "string") return cell;
        return escapeCSV(String(cell));
      })
      .join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}
