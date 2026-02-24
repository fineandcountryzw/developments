/**
 * Settlement Calculator Service
 * 
 * Calculates accurate developer payouts by properly accounting for all fees:
 * - Stand price portion (goes to developer)
 * - Commission (deducted from stand price)
 * - VAT, AOS, Endowment, Cession fees (NOT to developer)
 * 
 * This ensures settlement calculations match FeeCalculator and are accurate.
 */

import { FeeCalculator, FeeBreakdown } from './feeCalculator';
import prisma from './prisma';

export interface SettlementBreakdown {
  totalPayment: number;
  standPricePortion: number;
  vatAmount: number;
  cessionAmount: number;
  endowmentAmount: number;
  aosAmount: number;
  totalFees: number; // VAT + AOS + Endowment + Cession
  commission: number;
  developerNet: number;
}

export interface PaymentFeeData {
  standPricePortion: number | null;
  vatAmount: number | null;
  cessionAmount: number | null;
  endowmentAmount: number | null;
  aosAmount: number | null;
  feeCalculation: any;
  developmentId: string | null;
}

export class SettlementCalculator {
  /**
   * Calculate fee breakdown for a payment
   * Uses FeeCalculator to ensure consistency
   */
  static async calculatePaymentFees(
    paymentAmount: number,
    standId: string | null,
    developmentId: string | null,
    paymentType: string
  ): Promise<PaymentFeeData> {
    // If no stand or development, can't calculate fees
    if (!standId || !developmentId) {
      return {
        standPricePortion: null,
        vatAmount: null,
        cessionAmount: null,
        endowmentAmount: null,
        aosAmount: null,
        feeCalculation: null,
        developmentId: developmentId
      };
    }

    try {
      // Fetch stand and development
      const stand = await prisma.stand.findUnique({
        where: { id: standId },
        include: { development: true }
      });

      if (!stand || !stand.development) {
        return {
          standPricePortion: null,
          vatAmount: null,
          cessionAmount: null,
          endowmentAmount: null,
          aosAmount: null,
          feeCalculation: null,
          developmentId: developmentId
        };
      }

      const development = stand.development;
      const standPrice = Number(stand.price);

      // Calculate full fee breakdown
      const feeBreakdown = FeeCalculator.calculateStandFees(
        standPrice,
        development as any,
        stand as any
      );

      // Determine payment allocation based on payment type
      let allocation: {
        standPrice: number;
        vat: number;
        aos: number;
        endowment: number;
        cession: number;
      };

      if (paymentType === 'VAT Fees') {
        // Payment is specifically for VAT
        allocation = {
          standPrice: 0,
          vat: paymentAmount,
          aos: 0,
          endowment: 0,
          cession: 0
        };
      } else if (paymentType === 'Agreement of Sale Fee') {
        // Payment is specifically for AOS
        allocation = {
          standPrice: 0,
          vat: 0,
          aos: paymentAmount,
          endowment: 0,
          cession: 0
        };
      } else if (paymentType === 'Endowment Fees') {
        // Payment is specifically for Endowment
        allocation = {
          standPrice: 0,
          vat: 0,
          aos: 0,
          endowment: paymentAmount,
          cession: 0
        };
      } else {
        // Deposit or Installment - allocate proportionally
        const proportionalAllocation = FeeCalculator.allocatePayment(
          paymentAmount,
          feeBreakdown
        );
        allocation = {
          standPrice: proportionalAllocation.principal,
          vat: proportionalAllocation.vat,
          aos: proportionalAllocation.agreementOfSale,
          endowment: proportionalAllocation.endowment,
          cession: proportionalAllocation.cession
        };
      }

      return {
        standPricePortion: allocation.standPrice,
        vatAmount: allocation.vat,
        cessionAmount: allocation.cession,
        endowmentAmount: allocation.endowment,
        aosAmount: allocation.aos,
        feeCalculation: {
          feeBreakdown,
          allocation,
          paymentType,
          calculatedAt: new Date().toISOString()
        },
        developmentId: developmentId
      };
    } catch (error) {
      console.error('[SettlementCalculator] Error calculating fees:', error);
      return {
        standPricePortion: null,
        vatAmount: null,
        cessionAmount: null,
        endowmentAmount: null,
        aosAmount: null,
        feeCalculation: { error: 'Failed to calculate fees' },
        developmentId: developmentId
      };
    }
  }

  /**
   * Calculate settlement breakdown for a payment
   * Uses stored fee breakdown if available, otherwise calculates
   */
  static calculateSettlement(payment: any, development?: any): SettlementBreakdown {
    const totalPayment = Number(payment.amount || 0);
    
    // Use stored fee breakdown if available
    const standPricePortion = payment.standPricePortion 
      ? Number(payment.standPricePortion) 
      : 0;
    const vatAmount = payment.vatAmount ? Number(payment.vatAmount) : 0;
    const cessionAmount = payment.cessionAmount ? Number(payment.cessionAmount) : 0;
    const endowmentAmount = payment.endowmentAmount ? Number(payment.endowmentAmount) : 0;
    const aosAmount = payment.aosAmount ? Number(payment.aosAmount) : 0;

    // Calculate commission (5% of stand price portion, or use surchargeAmount)
    const commission = payment.surchargeAmount 
      ? Number(payment.surchargeAmount)
      : standPricePortion > 0 
        ? standPricePortion * 0.05 
        : totalPayment * 0.05; // Fallback to 5% of total if no stand price

    // Developer net = stand price portion - commission
    // Fees (VAT, AOS, etc.) are NOT part of developer payout
    const developerNet = standPricePortion > 0 
      ? standPricePortion - commission
      : 0; // If no stand price portion, developer gets nothing

    const totalFees = vatAmount + cessionAmount + endowmentAmount + aosAmount;

    return {
      totalPayment,
      standPricePortion,
      vatAmount,
      cessionAmount,
      endowmentAmount,
      aosAmount,
      totalFees,
      commission,
      developerNet
    };
  }

  /**
   * Calculate settlement for multiple payments (aggregate)
   */
  static calculateAggregateSettlement(payments: any[]): SettlementBreakdown {
    const breakdowns = payments.map(p => this.calculateSettlement(p));
    
    return {
      totalPayment: breakdowns.reduce((sum, b) => sum + b.totalPayment, 0),
      standPricePortion: breakdowns.reduce((sum, b) => sum + b.standPricePortion, 0),
      vatAmount: breakdowns.reduce((sum, b) => sum + b.vatAmount, 0),
      cessionAmount: breakdowns.reduce((sum, b) => sum + b.cessionAmount, 0),
      endowmentAmount: breakdowns.reduce((sum, b) => sum + b.endowmentAmount, 0),
      aosAmount: breakdowns.reduce((sum, b) => sum + b.aosAmount, 0),
      totalFees: breakdowns.reduce((sum, b) => sum + b.totalFees, 0),
      commission: breakdowns.reduce((sum, b) => sum + b.commission, 0),
      developerNet: breakdowns.reduce((sum, b) => sum + b.developerNet, 0)
    };
  }
}
