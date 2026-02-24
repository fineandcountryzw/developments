/**
 * Financial totals calculation (single source of truth)
 *
 * Goals:
 * - Consistent fee + VAT calculations across UI, APIs, dashboards, and reporting
 * - Explicit line items (including discount + payout)
 * - Backward compatible defaults (disabled fees => 0)
 */

export type FeeConfig = {
  // VAT
  vatEnabled?: boolean;
  vatRatePercent?: number; // e.g. 15.5

  // Fixed fees
  aosEnabled?: boolean;
  aosFeeAmount?: number;

  endowmentEnabled?: boolean;
  endowmentFeeAmount?: number;

  cessionFeeEnabled?: boolean;
  cessionFeeAmount?: number;

  adminFeeEnabled?: boolean;
  adminFeeAmount?: number;

  // Commission model (for developer payout estimates)
  commissionModel?: { type: 'fixed' | 'percentage'; fixedAmount?: number; percentage?: number } | null;
};

export type DiscountConfig = {
  discountPercent?: number | null; // 0-100
  discountActive?: boolean | null;
};

export type CalcTotalsInput = {
  baseStandPrice: number;
  feeConfig: FeeConfig;
  discount?: DiscountConfig;
};

export type CalcTotalsOutput = {
  basePrice: number;

  discountPercent: number;
  discountAmount: number;
  netStandPriceAfterDiscount: number;

  aosFee: number;
  endowmentFee: number;
  cessionFee: number;
  adminFee: number;

  subTotalBeforeVAT: number; // stand (net) + enabled fixed fees
  vatRatePercent: number;
  vatEnabled: boolean;
  vatAmount: number; // VAT on subtotal (consistent with existing FeeCalculator)

  grandTotal: number; // subtotal + VAT

  // Transparency for payouts
  commissionAmount: number;
  payoutToDeveloper: number; // net stand price after discount - commission (fees/VAT excluded)
  platformFeesRetained: number; // AOS + Endowment + Cession + Admin (VAT excluded; commission excluded)
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function calculateCommission(standNetPrice: number, commissionModel?: FeeConfig['commissionModel']): number {
  if (!commissionModel) {
    // Backward compatible default: 5%
    return round2((standNetPrice * 5) / 100);
  }
  if (commissionModel.type === 'fixed') {
    return round2(safeNumber(commissionModel.fixedAmount, 0));
  }
  if (commissionModel.type === 'percentage') {
    const pct = safeNumber(commissionModel.percentage, 5);
    return round2((standNetPrice * pct) / 100);
  }
  return 0;
}

/**
 * Calculate full transparent totals.
 *
 * VAT rule (current system behavior via FeeCalculator):
 * - VAT is applied to the subtotal: stand price + enabled fixed fees
 */
export function calcTotals(input: CalcTotalsInput): CalcTotalsOutput {
  const basePrice = round2(Math.max(0, safeNumber(input.baseStandPrice, 0)));

  const vatEnabled = input.feeConfig.vatEnabled !== false;
  const vatRatePercent = round2(Math.max(0, safeNumber(input.feeConfig.vatRatePercent, 15.5)));

  const aosFee = input.feeConfig.aosEnabled ? round2(Math.max(0, safeNumber(input.feeConfig.aosFeeAmount, 0))) : 0;
  const endowmentFee = input.feeConfig.endowmentEnabled ? round2(Math.max(0, safeNumber(input.feeConfig.endowmentFeeAmount, 0))) : 0;
  const cessionFee = input.feeConfig.cessionFeeEnabled ? round2(Math.max(0, safeNumber(input.feeConfig.cessionFeeAmount, 0))) : 0;
  const adminFee = input.feeConfig.adminFeeEnabled ? round2(Math.max(0, safeNumber(input.feeConfig.adminFeeAmount, 0))) : 0;

  const discountPercent = clampPercent(
    input.discount?.discountActive === false ? 0 : safeNumber(input.discount?.discountPercent, 0)
  );
  const discountAmount = round2((basePrice * discountPercent) / 100);
  const netStandPriceAfterDiscount = round2(Math.max(0, basePrice - discountAmount));

  const subTotalBeforeVAT = round2(netStandPriceAfterDiscount + aosFee + endowmentFee + cessionFee + adminFee);
  const vatAmount = vatEnabled ? round2((subTotalBeforeVAT * vatRatePercent) / 100) : 0;
  const grandTotal = round2(subTotalBeforeVAT + vatAmount);

  const commissionAmount = calculateCommission(netStandPriceAfterDiscount, input.feeConfig.commissionModel);
  const payoutToDeveloper = round2(Math.max(0, netStandPriceAfterDiscount - commissionAmount));

  const platformFeesRetained = round2(aosFee + endowmentFee + cessionFee + adminFee);

  return {
    basePrice,
    discountPercent,
    discountAmount,
    netStandPriceAfterDiscount,
    aosFee,
    endowmentFee,
    cessionFee,
    adminFee,
    subTotalBeforeVAT,
    vatRatePercent,
    vatEnabled,
    vatAmount,
    grandTotal,
    commissionAmount,
    payoutToDeveloper,
    platformFeesRetained,
  };
}

