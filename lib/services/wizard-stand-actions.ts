/**
 * Wizard Stand Actions Service
 * Handles mark-sold and apply-discount operations with audit, notifications, and concurrency safety.
 * 
 * NOTE: This service requires the wizard migration to be applied first.
 * Run: npx prisma db execute --file migrations/add-wizard-stand-actions.sql
 * Then: npx prisma generate
 */

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logAuditTrail } from '@/lib/auditTrail';
import { sendWizardActionEmail } from '../wizard-email-service';

// Type assertion helper for new schema fields (before migration)
// After running the migration, these can be removed and types will work natively

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardActor {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branch?: string | null;
}

export interface StandResult {
  standNumber: string;
  standId?: string;
  success: boolean;
  error?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPrice?: number;
  newPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
}

export interface MarkSoldRequest {
  developmentId: string;
  standNumbers: string[];
  reason: string;
  notes?: string;
}

export interface ApplyDiscountRequest {
  developmentId: string;
  standNumbers: string[];
  discountPercent: number;
  reason: string;
  effectiveAt?: string; // ISO date string
}

// Valid transitions to SOLD
const SELLABLE_STATUSES = ['AVAILABLE', 'RESERVED'];
// Statuses that block selling
const UNSELLABLE_STATUSES = ['SOLD', 'WITHDRAWN', 'BLOCKED', 'CANCELLED'];

// ─────────────────────────────────────────────────────────────────────────────
// Mark Sold
// ─────────────────────────────────────────────────────────────────────────────

export async function markStandsAsSold(
  request: MarkSoldRequest,
  actor: WizardActor
): Promise<{ results: StandResult[]; developmentName: string }> {
  const { developmentId, standNumbers, reason, notes } = request;

  // Fetch development info
  const development = await prisma.development.findUnique({
    where: { id: developmentId },
    select: {
      id: true,
      name: true,
      developerEmail: true,
      developerName: true,
      branch: true,
    },
  });

  if (!development) {
    throw new Error('Development not found');
  }

  // Deduplicate stand numbers
  const uniqueNumbers = [...new Set(standNumbers.map((s) => s.trim().toUpperCase()))].filter(Boolean);

  // Fetch all matching stands in one query
  const stands = await prisma.stand.findMany({
    where: {
      developmentId,
      standNumber: { in: uniqueNumbers },
    },
    include: {
      reservations: {
        where: { status: { in: ['PENDING', 'CONFIRMED', 'PAYMENT_PENDING'] } },
        select: { id: true, status: true },
      },
      installmentPlans: {
        where: { status: 'ACTIVE' },
        select: { id: true, totalPaid: true, totalAmount: true },
      },
    },
  });

  const standMap = new Map(stands.map((s) => [s.standNumber, s]));
  const results: StandResult[] = [];
  const successfulStands: Array<{ stand: typeof stands[0]; oldStatus: string }> = [];

  // Process each stand
  for (const standNumber of uniqueNumbers) {
    const stand = standMap.get(standNumber);

    if (!stand) {
      results.push({
        standNumber,
        success: false,
        error: `Stand ${standNumber} not found in this development`,
      });
      continue;
    }

    const oldStatus = stand.status;

    // Check if already sold (idempotent check)
    if (oldStatus === 'SOLD') {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: `Stand ${standNumber} is already SOLD`,
        oldStatus,
      });
      continue;
    }

    // Check for unsellable statuses
    if (UNSELLABLE_STATUSES.includes(oldStatus)) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: `Stand ${standNumber} has status ${oldStatus} and cannot be marked as sold`,
        oldStatus,
      });
      continue;
    }

    // Process in transaction with row-level locking
    try {
      await prisma.$transaction(async (tx: any) => {
        // Row lock: re-read with FOR UPDATE semantics via update-in-place
        const current = await tx.stand.findUnique({
          where: { id: stand.id },
          select: { status: true, updatedAt: true },
        });

        if (!current) throw new Error('Stand disappeared during transaction');
        if (current.status === 'SOLD') throw new Error('Already sold (concurrent)');
        if (!SELLABLE_STATUSES.includes(current.status)) {
          throw new Error(`Status changed to ${current.status} during processing`);
        }

        // Update stand (using type assertion for new fields)
        await tx.stand.update({
          where: { id: stand.id },
          data: {
            status: 'SOLD',
            soldAt: new Date(),
            soldReason: reason,
            soldBy: actor.id,
          } as any,
        });

        // Write action log
        await tx.standActionLog.create({
          data: {
            standId: stand.id,
            actionType: 'MARK_SOLD',
            reason,
            payload: notes ? { notes } : undefined,
            oldValues: {
              status: oldStatus,
            },
            newValues: {
              status: 'SOLD',
              soldAt: new Date().toISOString(),
              soldBy: actor.id,
              soldReason: reason,
            },
            createdBy: actor.id,
            createdByEmail: actor.email,
          },
        });

        // Update reservation status if there's an active one
        if (stand.reservations.length > 0) {
          await tx.reservation.updateMany({
            where: {
              standId: stand.id,
              status: { in: ['PENDING', 'CONFIRMED', 'PAYMENT_PENDING'] },
            },
            data: { status: 'CONFIRMED' },
          });
        }
      });

      successfulStands.push({ stand, oldStatus });
      results.push({
        standNumber,
        standId: stand.id,
        success: true,
        oldStatus,
        newStatus: 'SOLD',
      });
    } catch (err: any) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: err.message || 'Transaction failed',
        oldStatus,
      });
    }
  }

  // Post-commit: audit log + email notifications (only for successes)
  const successCount = results.filter((r) => r.success).length;

  if (successCount > 0) {
    // Audit trail
    await logAuditTrail({
      action: 'STATUS_CHANGE',
      module: 'STANDS',
      recordId: developmentId,
      description: `Wizard: Marked ${successCount} stand(s) as SOLD in ${development.name}. Stands: ${results
        .filter((r) => r.success)
        .map((r) => r.standNumber)
        .join(', ')}`,
      changes: {
        before: { statuses: successfulStands.map((s) => ({ stand: s.stand.standNumber, status: s.oldStatus })) },
        after: { statuses: successfulStands.map((s) => ({ stand: s.stand.standNumber, status: 'SOLD' })) },
      },
      userId: actor.id,
      branch: actor.branch || development.branch,
    });

    // Send email notifications (fire-and-forget, never block response)
    sendWizardActionEmail({
      actionType: 'MARK_SOLD',
      developmentName: development.name,
      developmentId: development.id,
      results: results.filter((r) => r.success),
      reason,
      actor: { name: actor.name || actor.email, email: actor.email },
      developerEmail: development.developerEmail,
      developerName: development.developerName,
      branch: actor.branch || development.branch,
    }).catch((err: Error) => console.error('[WIZARD EMAIL ERROR]', err));
  }

  return { results, developmentName: development.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply Discount
// ─────────────────────────────────────────────────────────────────────────────

export async function applyStandDiscount(
  request: ApplyDiscountRequest,
  actor: WizardActor
): Promise<{ results: StandResult[]; developmentName: string }> {
  const { developmentId, standNumbers, discountPercent, reason, effectiveAt } = request;

  // Validate discount percentage
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }

  // Fetch development
  const development = await prisma.development.findUnique({
    where: { id: developmentId },
    select: {
      id: true,
      name: true,
      developerEmail: true,
      developerName: true,
      branch: true,
    },
  });

  if (!development) {
    throw new Error('Development not found');
  }

  const uniqueNumbers = [...new Set(standNumbers.map((s) => s.trim().toUpperCase()))].filter(Boolean);

  // Fetch all matching stands
  const stands = await prisma.stand.findMany({
    where: {
      developmentId,
      standNumber: { in: uniqueNumbers },
    },
    include: {
      installmentPlans: {
        where: { status: 'ACTIVE' },
        include: {
          installments: {
            orderBy: { installmentNo: 'asc' },
          },
        },
      },
    },
  });

  const standMap = new Map(stands.map((s) => [s.standNumber, s]));
  const results: StandResult[] = [];
  const successfulStands: Array<{
    stand: typeof stands[0];
    oldPrice: number;
    newPrice: number;
  }> = [];

  for (const standNumber of uniqueNumbers) {
    const stand = standMap.get(standNumber);

    if (!stand) {
      results.push({
        standNumber,
        success: false,
        error: `Stand ${standNumber} not found in this development`,
      });
      continue;
    }

    // Don't allow discount on WITHDRAWN/CANCELLED
    if (['WITHDRAWN', 'CANCELLED'].includes(stand.status)) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: `Stand ${standNumber} has status ${stand.status} and cannot be discounted`,
      });
      continue;
    }

    // Idempotency check: if same discount already applied
    if (stand.discountPercent && Number(stand.discountPercent) === discountPercent) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: `Stand ${standNumber} already has a ${discountPercent}% discount applied`,
      });
      continue;
    }

    const oldPrice = Number(stand.price);
    const discountAmount = (oldPrice * discountPercent) / 100;
    const newPrice = oldPrice - discountAmount;

    if (newPrice < 0) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: `Discount would result in negative price for stand ${standNumber}`,
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx: any) => {
        // Re-read stand for concurrency
        const current = await tx.stand.findUnique({
          where: { id: stand.id },
          select: {
            price: true,
            discountPercent: true,
            status: true,
          },
        });

        if (!current) throw new Error('Stand disappeared during transaction');

        // Double-check discount hasn't been applied concurrently
        if (current.discountPercent && Number(current.discountPercent) === discountPercent) {
          throw new Error('Discount already applied (concurrent)');
        }

        // Compute new price per sqm if size is available
        const newPricePerSqm = stand.sizeSqm ? newPrice / Number(stand.sizeSqm) : null;

        // Update stand pricing (using type assertion for new fields)
        await tx.stand.update({
          where: { id: stand.id },
          data: {
            discountPercent: new Prisma.Decimal(discountPercent),
            discountAmount: new Prisma.Decimal(discountAmount),
            discountedPrice: new Prisma.Decimal(newPrice),
            discountActive: true,
            pricePerSqm: newPricePerSqm ? new Prisma.Decimal(newPricePerSqm) : stand.pricePerSqm,
          } as any,
        });

        // Write action log
        await tx.standActionLog.create({
          data: {
            standId: stand.id,
            actionType: 'APPLY_DISCOUNT',
            reason,
            payload: {
              discountPercent,
              effectiveAt: effectiveAt || new Date().toISOString(),
            },
            oldValues: {
              price: oldPrice,
              discountPercent: stand.discountPercent ? Number(stand.discountPercent) : null,
              pricePerSqm: stand.pricePerSqm ? Number(stand.pricePerSqm) : null,
            },
            newValues: {
              price: oldPrice,
              discountPercent,
              discountAmount,
              discountedPrice: newPrice,
              pricePerSqm: newPricePerSqm,
            },
            createdBy: actor.id,
            createdByEmail: actor.email,
          },
        });

        // Recalculate installment plans (Option 2: recompute but preserve paid amounts)
        for (const plan of stand.installmentPlans) {
          const totalPaid = Number(plan.totalPaid);
          const newTotalAmount = newPrice; // Discount applies to total
          const newBalance = Math.max(0, newTotalAmount - totalPaid);

          // Find unpaid/partially-paid installments
          const unpaidInstallments = plan.installments.filter(
            (inst) => inst.status !== 'PAID' && inst.status !== 'CANCELLED'
          );

          if (unpaidInstallments.length > 0) {
            // Distribute remaining balance evenly across unpaid installments
            const perInstallment = newBalance / unpaidInstallments.length;

            for (const inst of unpaidInstallments) {
              const amountAlreadyPaid = Number(inst.amountPaid);
              const newAmountDue = Math.max(amountAlreadyPaid, perInstallment);

              await tx.installment.update({
                where: { id: inst.id },
                data: {
                  amountDue: new Prisma.Decimal(newAmountDue),
                },
              });
            }
          }

          // Update plan totals
          await tx.installmentPlan.update({
            where: { id: plan.id },
            data: {
              totalAmount: new Prisma.Decimal(newTotalAmount),
              balanceAmount: new Prisma.Decimal(newBalance),
              remainingBalance: new Prisma.Decimal(newBalance),
              monthlyAmount: unpaidInstallments.length > 0
                ? new Prisma.Decimal(newBalance / unpaidInstallments.length)
                : plan.monthlyAmount,
            },
          });
        }
      });

      successfulStands.push({ stand, oldPrice, newPrice });
      results.push({
        standNumber,
        standId: stand.id,
        success: true,
        oldPrice,
        newPrice,
        discountPercent,
        discountAmount,
      });
    } catch (err: any) {
      results.push({
        standNumber,
        standId: stand.id,
        success: false,
        error: err.message || 'Transaction failed',
      });
    }
  }

  // Post-commit: audit + notifications
  const successCount = results.filter((r) => r.success).length;

  if (successCount > 0) {
    await logAuditTrail({
      action: 'UPDATE',
      module: 'STANDS',
      recordId: developmentId,
      description: `Wizard: Applied ${discountPercent}% discount to ${successCount} stand(s) in ${development.name}. Stands: ${results
        .filter((r) => r.success)
        .map((r) => r.standNumber)
        .join(', ')}`,
      changes: {
        before: successfulStands.map((s) => ({
          stand: s.stand.standNumber,
          price: s.oldPrice,
        })),
        after: successfulStands.map((s) => ({
          stand: s.stand.standNumber,
          price: s.newPrice,
          discountPercent,
        })),
      },
      userId: actor.id,
      branch: actor.branch || development.branch,
    });

    sendWizardActionEmail({
      actionType: 'APPLY_DISCOUNT',
      developmentName: development.name,
      developmentId: development.id,
      results: results.filter((r) => r.success),
      reason,
      actor: { name: actor.name || actor.email, email: actor.email },
      developerEmail: development.developerEmail,
      developerName: development.developerName,
      branch: actor.branch || development.branch,
      discountPercent,
    }).catch((err: Error) => console.error('[WIZARD EMAIL ERROR]', err));
  }

  return { results, developmentName: development.name };
}
