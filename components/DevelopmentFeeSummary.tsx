'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, DollarSign, Info } from 'lucide-react';

interface Fee {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  description: string;
  mandatory: boolean;
}

interface PaymentTerms {
  minimumDeposit: number;
  installmentOptions: number[];
}

interface FeeSummary {
  id: string;
  name: string;
  fees: Fee[];
  paymentTerms: PaymentTerms;
}

export function DevelopmentFeeSummary({ 
  developmentId, 
  standPrice = 100000 
}: { 
  developmentId: string; 
  standPrice?: number;
}) {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeeSummary() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/developments/${developmentId}/fee-summary`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setSummary(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch fee summary:', err);
        setError('Unable to load fee information');
      } finally {
        setLoading(false);
      }
    }

    fetchFeeSummary();
  }, [developmentId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Unable to load fees</p>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate example total
  const exampleSubtotal = standPrice + 
    summary.fees
      .filter(f => f.mandatory && f.type === 'fixed')
      .reduce((sum, f) => sum + f.value, 0);
  
  const vatFee = summary.fees.find(f => f.type === 'percentage');
  const exampleVat = vatFee ? exampleSubtotal * (vatFee.value / 100) : 0;
  const exampleTotal = exampleSubtotal + exampleVat;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">{summary.name} - Costs Breakdown</h3>
          <Info className="h-5 w-5 text-gray-400" />
        </div>

        {/* Fee List */}
        <div className="space-y-3 mb-6">
          {summary.fees.map((fee, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{fee.name}</p>
                <p className="text-xs text-gray-600">{fee.description}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-semibold text-gray-900">
                  {fee.type === 'percentage' ? `${fee.value}%` : `$${fee.value.toFixed(2)}`}
                </p>
                {fee.mandatory && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                    Mandatory
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 my-6"></div>

        {/* Example Calculation */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-900 mb-3">Example (Based on ${standPrice.toLocaleString()})</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Stand Price</span>
              <span className="font-medium text-gray-900">${standPrice.toFixed(2)}</span>
            </div>
            {summary.fees
              .filter(f => f.mandatory && f.type === 'fixed')
              .map((fee, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{fee.name}</span>
                  <span className="font-medium text-gray-900">${fee.value.toFixed(2)}</span>
                </div>
              ))}
            {vatFee && (
              <div className="flex justify-between">
                <span className="text-gray-600">VAT ({vatFee.value}%)</span>
                <span className="font-medium text-gray-900">${exampleVat.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-semibold text-blue-600">${exampleTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="bg-blue-50 rounded-md p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payment Options
          </p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Minimum Deposit: {summary.paymentTerms.minimumDeposit}%</li>
            <li>• Installment Plans: {summary.paymentTerms.installmentOptions.join(', ')} months</li>
          </ul>
          <p className="text-xs text-blue-700 mt-3 italic">
            Contact us for a personalized quote based on your specific requirements.
          </p>
        </div>
      </div>
    </div>
  );
}
