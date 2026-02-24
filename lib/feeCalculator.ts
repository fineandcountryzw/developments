/**
 * Fee Calculator Service
 * Handles all fee calculations for stand purchases
 * Supports: VAT, Agreement of Sale, Endowment, Cession, Additional Fees
 */

import { calcTotals } from '@/lib/financials';

// Type definitions for fee calculations
type Development = {
  vatPercentage: number | null;
  vatEnabled: boolean;
  aosEnabled: boolean;
  aosFee: number | null;
  endowmentEnabled: boolean;
  endowmentFee: number | null;
  cessionsEnabled: boolean;
  cessionFee: number | null;
  adminFeeEnabled?: boolean | null;
  adminFee?: number | null;
  depositPercentage: number;
  installmentPeriods: string | null;
  commissionModel: any;
};

type Stand = {
  price: number;
  standNumber: string;
  discountPercent?: any;
  discountActive?: any;
};

export interface FeeBreakdown {
  // Base (pre-discount) stand price
  standPrice: number;
  // Discount transparency
  discountPercent: number;
  discountAmount: number;
  netStandPriceAfterDiscount: number;
  vatAmount: number;
  vatRate: number;
  agreementOfSaleAmount: number;
  endowmentAmount: number;
  cessionAmount: number;
  adminAmount: number;
  additionalFees: { name: string; amount: number }[];
  subtotal: number;
  totalAmount: number;

  // Transparency for payout reporting
  commissionAmount: number;
  payoutToDeveloper: number;
  platformFeesRetained: number;
}

export interface PaymentTerms {
  depositAmount: number;
  depositPercent: number;
  balanceAmount: number;
  installmentMonths: number;
  monthlyInstallment: number;
}

export interface CompleteFeeBreakdown extends FeeBreakdown, PaymentTerms {}

export interface PaymentAllocation {
  principal: number;
  vat: number;
  agreementOfSale: number;
  endowment: number;
  cession: number;
  admin?: number;
}

export class FeeCalculator {
  /**
   * Calculate complete fee breakdown for a stand
   */
  static calculateStandFees(
    standPrice: number,
    development: Development,
    stand?: Stand | null
  ): FeeBreakdown {
    // Convert standPrice to number if it's a Decimal
    const price = typeof standPrice === 'number' ? standPrice : Number(standPrice);

    // Additional fees (reserved for future extension)
    const additionalFees: { name: string; amount: number }[] = [];

    // Single source of truth totals
    const totals = calcTotals({
      baseStandPrice: price,
      discount: {
        discountPercent: stand?.discountPercent ? Number(stand.discountPercent) : 0,
        discountActive: stand?.discountActive !== false,
      },
      feeConfig: {
        vatEnabled: development.vatEnabled !== false,
        vatRatePercent: Number(development.vatPercentage || 15.5),
        aosEnabled: !!development.aosEnabled,
        aosFeeAmount: Number(development.aosFee || 0),
        endowmentEnabled: !!development.endowmentEnabled,
        endowmentFeeAmount: Number(development.endowmentFee || 0),
        cessionFeeEnabled: !!development.cessionsEnabled,
        cessionFeeAmount: Number(development.cessionFee || 0),
        adminFeeEnabled: development.adminFeeEnabled === true,
        adminFeeAmount: Number(development.adminFee || 0),
        commissionModel: development.commissionModel || null,
      },
    });

    return {
      standPrice: totals.basePrice,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      netStandPriceAfterDiscount: totals.netStandPriceAfterDiscount,
      vatAmount: totals.vatAmount,
      vatRate: totals.vatRatePercent,
      agreementOfSaleAmount: totals.aosFee,
      endowmentAmount: totals.endowmentFee,
      cessionAmount: totals.cessionFee,
      adminAmount: totals.adminFee,
      additionalFees,
      subtotal: totals.subTotalBeforeVAT,
      totalAmount: totals.grandTotal,
      commissionAmount: totals.commissionAmount,
      payoutToDeveloper: totals.payoutToDeveloper,
      platformFeesRetained: totals.platformFeesRetained,
    };
  }

  /**
   * Calculate Agreement of Sale fee
   */
  private static calculateAgreementOfSale(
    standPrice: number,
    development: Development
  ): number {
    if (!development.aosEnabled) return 0;

    const aosFee = Number(development.aosFee || 0);
    return aosFee;
  }

  /**
   * Calculate Endowment fee
   */
  private static calculateEndowment(
    standPrice: number,
    development: Development
  ): number {
    if (!development.endowmentEnabled) return 0;

    const endowmentFee = Number(development.endowmentFee || 0);
    return endowmentFee;
  }

  /**
   * Calculate Cession fee
   */
  private static calculateCession(
    standPrice: number,
    development: Development
  ): number {
    if (!development.cessionsEnabled) return 0;

    const cessionFee = Number(development.cessionFee || 0);
    return cessionFee;
  }

  /**
   * Calculate payment terms (deposit and installments)
   */
  static calculatePaymentTerms(
    totalAmount: number,
    depositPercent: number,
    months: number
  ): PaymentTerms {
    const depositAmount = (totalAmount * depositPercent) / 100;
    const balanceAmount = totalAmount - depositAmount;
    const monthlyInstallment = months > 0 ? balanceAmount / months : balanceAmount;

    return {
      depositAmount: Math.round(depositAmount * 100) / 100,
      depositPercent,
      balanceAmount: Math.round(balanceAmount * 100) / 100,
      installmentMonths: months,
      monthlyInstallment: Math.round(monthlyInstallment * 100) / 100,
    };
  }

  /**
   * Calculate complete breakdown with payment terms
   */
  static calculateComplete(
    standPrice: number,
    development: Development,
    depositPercent?: number,
    installmentMonths?: number,
    stand?: Stand | null
  ): CompleteFeeBreakdown {
    const feeBreakdown = this.calculateStandFees(standPrice, development, stand);

    const deposit = depositPercent || Number(development.depositPercentage || 30);
    const defaultInstallments = development.installmentPeriods 
      ? JSON.parse(development.installmentPeriods as string)?.[0] ?? 12
      : 12;
    const months = installmentMonths || defaultInstallments;

    const paymentTerms = this.calculatePaymentTerms(
      feeBreakdown.totalAmount,
      deposit,
      months
    );

    return {
      ...feeBreakdown,
      ...paymentTerms,
    };
  }

  /**
   * Allocate a payment proportionally across all fee types
   */
  static allocatePayment(
    paymentAmount: number,
    feeBreakdown: FeeBreakdown
  ): PaymentAllocation {
    const total = feeBreakdown.totalAmount;

    // Calculate ratios
    const principalRatio = feeBreakdown.standPrice / total;
    const vatRatio = feeBreakdown.vatAmount / total;
    const agreementOfSaleRatio = feeBreakdown.agreementOfSaleAmount / total;
    const endowmentRatio = feeBreakdown.endowmentAmount / total;
    const cessionRatio = feeBreakdown.cessionAmount / total;
    const adminRatio = (feeBreakdown as any).adminAmount ? (feeBreakdown as any).adminAmount / total : 0;

    return {
      principal: Math.round(paymentAmount * principalRatio * 100) / 100,
      vat: Math.round(paymentAmount * vatRatio * 100) / 100,
      agreementOfSale: Math.round(paymentAmount * agreementOfSaleRatio * 100) / 100,
      endowment: Math.round(paymentAmount * endowmentRatio * 100) / 100,
      cession: Math.round(paymentAmount * cessionRatio * 100) / 100,
      ...(adminRatio > 0 ? { admin: Math.round(paymentAmount * adminRatio * 100) / 100 } : {}),
    };
  }

  /**
   * Calculate commission for agent
   */
  static calculateCommission(standPrice: number, development: Development): number {
    const commissionModel = development.commissionModel as any;

    if (!commissionModel) {
      // Default: 5% of stand price
      return Math.round((standPrice * 5) / 100 * 100) / 100;
    }

    if (commissionModel.type === 'fixed') {
      return Number(commissionModel.fixedAmount || 0);
    } else if (commissionModel.type === 'percentage') {
      const percentage = Number(commissionModel.percentage || 5);
      return Math.round((standPrice * percentage) / 100 * 100) / 100;
    }

    return 0;
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
