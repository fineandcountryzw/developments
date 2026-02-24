/**
 * Wizard Page Component
 * Wrapper for Stand Actions Wizard that handles development fetching and modal state.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Wand2, AlertCircle, RefreshCw } from 'lucide-react';
import { StandActionsWizard } from './StandActionsWizard';

interface Development {
  id: string;
  name: string;
  branch: string;
}

interface WizardPageProps {
  activeBranch?: string;
}

export function WizardPage({ activeBranch = 'Harare' }: WizardPageProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchDevelopments = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/developments?branch=${activeBranch}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch developments');
      }

      setDevelopments(
        (data.data || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          branch: d.branch || activeBranch,
        }))
      );
    } catch (err: any) {
      console.error('[WizardPage] Error fetching developments:', err);
      setError(err.message || 'Failed to load developments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevelopments();
  }, [activeBranch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-sm">Loading developments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-medium text-red-800 mb-2">Error Loading Data</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDevelopments}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Wizard Actions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Perform bulk operations on stands with audit tracking and notifications.
          </p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mark as Sold Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
            <Wand2 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Mark Stands as Sold</h3>
          <p className="text-sm text-gray-600 mb-4">
            Bulk-mark stands as SOLD with a reason. Notifies Accounts and Developer automatically.
          </p>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>• Supports multiple stand numbers</li>
            <li>• Validates status transitions</li>
            <li>• Sends email notifications</li>
            <li>• Full audit trail</li>
          </ul>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Start Wizard
          </button>
        </div>

        {/* Apply Discount Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
            <Wand2 className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Apply Discounts</h3>
          <p className="text-sm text-gray-600 mb-4">
            Apply percentage discounts to stand prices. Automatically recalculates installments.
          </p>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>• Percentage-based discounts</li>
            <li>• Adjusts installment plans</li>
            <li>• Preserves paid amounts</li>
            <li>• Logs to Accounts ledger</li>
          </ul>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Start Wizard
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl border border-slate-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">How It Works</h3>
          <div className="text-sm text-gray-600 space-y-3">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs flex items-center justify-center font-medium">1</span>
              <span>Choose an action (Sell / Discount)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs flex items-center justify-center font-medium">2</span>
              <span>Select development & enter stand numbers</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs flex items-center justify-center font-medium">3</span>
              <span>Provide reason and review changes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs flex items-center justify-center font-medium">4</span>
              <span>Confirm & execute with full audit trail</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {developments.length} development(s) available in {activeBranch}
          </span>
          <button
            onClick={fetchDevelopments}
            className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsWizardOpen(false)}
          />
          {/* Wizard */}
          <div className="relative z-10">
            <StandActionsWizard
              developments={developments}
              onClose={() => setIsWizardOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default WizardPage;
