'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, DollarSign, TrendingDown } from 'lucide-react';

interface FeeItem {
  name: string;
  value: number;
  percentage?: number;
  description?: string;
}

interface FeeBreakdown {
  standId: string;
  standNumber: string;
  developmentName: string;
  standPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  netStandPriceAfterDiscount?: number;
  agreementOfSaleAmount: number;
  endowmentAmount: number;
  cessionAmount: number;
  adminAmount?: number;
  vatAmount: number;
  vatRate: number;
  subtotal: number;
  totalAmount: number;
  depositAmount: number;
  depositPercent: number;
  balanceAmount: number;
  monthlyInstallment: number;
  installmentMonths: number;
  feesEnabled: {
    vatEnabled: boolean;
    aosEnabled: boolean;
    endowmentEnabled: boolean;
    cessionsEnabled: boolean;
    adminFeeEnabled?: boolean;
  };
}

export function StandFeeCalculator({
  standId,
  standNumber,
  developmentName,
  defaultDeposit = 30,
  defaultMonths = 24,
}: {
  standId: string;
  standNumber: string;
  developmentName: string;
  defaultDeposit?: number;
  defaultMonths?: number;
}) {
  const [breakdown, setBreakdown] = useState<FeeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositPercent, setDepositPercent] = useState(defaultDeposit);
  const [installmentMonths, setInstallmentMonths] = useState(defaultMonths);

  useEffect(() => {
    async function fetchBreakdown() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/stands/${standId}/fee-breakdown?depositPercent=${depositPercent}&installmentMonths=${installmentMonths}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        // API returns { success: true, data: { ... } }
        setBreakdown(data?.data || null);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch fee breakdown:', err);
        setError('Unable to load payment breakdown');
      } finally {
        setLoading(false);
      }
    }

    fetchBreakdown();
  }, [standId, depositPercent, installmentMonths]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !breakdown) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Unable to load payment breakdown</p>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const feeItems: FeeItem[] = [
    { name: 'Stand Price', value: breakdown.standPrice },
    ...(breakdown.discountPercent && breakdown.discountPercent > 0 && (breakdown.discountAmount || 0) > 0
      ? [{ name: `Discount`, value: -(breakdown.discountAmount || 0), percentage: breakdown.discountPercent }]
      : []),
    ...(breakdown.feesEnabled.aosEnabled && breakdown.agreementOfSaleAmount > 0
      ? [{ name: 'Agreement of Sale Fee', value: breakdown.agreementOfSaleAmount }]
      : []),
    ...(breakdown.feesEnabled.endowmentEnabled && breakdown.endowmentAmount > 0
      ? [{ name: 'Endowment Fee', value: breakdown.endowmentAmount }]
      : []),
    ...(breakdown.feesEnabled.cessionsEnabled && breakdown.cessionAmount > 0
      ? [{ name: 'Cession Fee', value: breakdown.cessionAmount }]
      : []),
    ...(breakdown.feesEnabled.adminFeeEnabled && (breakdown.adminAmount || 0) > 0
      ? [{ name: 'Admin Fee', value: breakdown.adminAmount || 0 }]
      : []),
    ...(breakdown.feesEnabled.vatEnabled && breakdown.vatAmount > 0
      ? [{ 
          name: 'VAT',
          value: breakdown.vatAmount,
          percentage: breakdown.vatRate,
          description: `${breakdown.vatRate}% of subtotal`
        }]
      : []),
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Stand {breakdown.standNumber}
          </h3>
          <p className="text-sm text-gray-600">{breakdown.developmentName}</p>
        </div>

        {/* Deposit Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-900">Deposit Percentage</label>
            <span className="text-sm font-semibold text-blue-600">{depositPercent}%</span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>30%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Installment Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Payment Plan (months)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[6, 12, 24, 36, 48].map((months) => (
              <button
                key={months}
                onClick={() => setInstallmentMonths(months)}
                className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  installmentMonths === months
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {months}m
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 my-6"></div>

        {/* Fee Breakdown */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-900 mb-3">Cost Breakdown</p>
          <div className="space-y-2">
            {feeItems.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">
                  {item.name}
                  {item.percentage && <span className="text-gray-400 text-xs ml-1">({item.percentage}%)</span>}
                </span>
                <span className="font-medium text-gray-900">${item.value.toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 flex justify-between">
              <span className="font-semibold text-gray-900">Subtotal</span>
              <span className="font-semibold text-gray-900">${breakdown.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center font-semibold text-blue-600 py-2 bg-blue-50 px-3 rounded-md">
              <span>Total Cost</span>
              <span className="text-lg">${breakdown.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        <div className="bg-green-50 rounded-md p-4 border border-green-200">
          <p className="text-sm font-medium text-green-900 mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Payment Schedule
          </p>
          <div className="space-y-2 text-sm text-green-800">
            <div className="flex justify-between">
              <span>Deposit ({depositPercent}%)</span>
              <span className="font-semibold">${breakdown.depositAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Balance to Finance</span>
              <span className="font-semibold">${breakdown.balanceAmount.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-green-200 flex justify-between font-semibold">
              <span>Monthly Payment ({breakdown.installmentMonths} months)</span>
              <span>${breakdown.monthlyInstallment.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
