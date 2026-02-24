/**
 * Stand Actions Wizard Component
 * A multi-step wizard for bulk stand operations: Mark as Sold & Apply Discount
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle2, XCircle, ChevronRight, ChevronLeft, DollarSign, Tag } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WizardAction = 'MARK_SOLD' | 'APPLY_DISCOUNT';

interface Development {
  id: string;
  name: string;
  branch: string;
}

interface ValidatedStand {
  id: string;
  standNumber: string;
  status: string;
  price: number;
  discountPercent: number | null;
  discountedPrice: number | null;
  canSell: boolean;
  canDiscount: boolean;
}

interface StandResult {
  standNumber: string;
  success: boolean;
  error?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPrice?: number;
  newPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
}

interface WizardState {
  step: number;
  action: WizardAction | null;
  developmentId: string;
  standNumbersInput: string;
  reason: string;
  notes: string;
  discountPercent: number;
  effectiveAt: string;
  validatedStands: ValidatedStand[];
  notFoundStands: string[];
  results: StandResult[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  action: null,
  developmentId: '',
  standNumbersInput: '',
  reason: '',
  notes: '',
  discountPercent: 10,
  effectiveAt: new Date().toISOString().split('T')[0],
  validatedStands: [],
  notFoundStands: [],
  results: [],
  loading: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function StandActionsWizard({
  developments,
  onClose,
}: {
  developments: Development[];
  onClose: () => void;
}) {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const parsedStandNumbers = useMemo(() => {
    return state.standNumbersInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [state.standNumbersInput]);

  const selectedDevelopment = useMemo(
    () => developments.find((d) => d.id === state.developmentId),
    [developments, state.developmentId]
  );

  // Step navigation
  const canProceed = useCallback(() => {
    switch (state.step) {
      case 1:
        return state.action !== null;
      case 2:
        return state.developmentId !== '' && parsedStandNumbers.length > 0;
      case 3:
        if (!state.reason || state.reason.trim().length < 3) return false;
        if (state.action === 'APPLY_DISCOUNT') {
          return state.discountPercent > 0 && state.discountPercent <= 100;
        }
        return true;
      case 4:
        return state.validatedStands.length > 0;
      default:
        return false;
    }
  }, [state, parsedStandNumbers]);

  // Validate stands (Step 2 → Step 3)
  const validateStands = async () => {
    updateState({ loading: true, error: null });

    try {
      const res = await fetch('/api/wizard/stands/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developmentId: state.developmentId,
          standNumbers: parsedStandNumbers,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      updateState({
        validatedStands: data.data.stands,
        notFoundStands: data.data.notFound,
        loading: false,
        step: 3,
      });
    } catch (err: any) {
      updateState({ error: err.message, loading: false });
    }
  };

  // Execute action (Step 4 → Step 5)
  const executeAction = async () => {
    updateState({ loading: true, error: null });

    // Filter stands that can be processed
    const eligibleStands = state.validatedStands.filter((s) =>
      state.action === 'MARK_SOLD' ? s.canSell : s.canDiscount
    );

    if (eligibleStands.length === 0) {
      updateState({
        error: 'No eligible stands to process',
        loading: false,
      });
      return;
    }

    const endpoint =
      state.action === 'MARK_SOLD'
        ? '/api/wizard/stands/mark-sold'
        : '/api/wizard/stands/apply-discount';

    const payload: any = {
      developmentId: state.developmentId,
      standNumbers: eligibleStands.map((s) => s.standNumber),
      reason: state.reason.trim(),
    };

    if (state.action === 'MARK_SOLD' && state.notes) {
      payload.notes = state.notes.trim();
    }

    if (state.action === 'APPLY_DISCOUNT') {
      payload.discountPercent = state.discountPercent;
      payload.effectiveAt = state.effectiveAt;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Action failed');
      }

      updateState({
        results: data.data.results,
        loading: false,
        step: 5,
      });
    } catch (err: any) {
      updateState({ error: err.message, loading: false });
    }
  };

  const handleNext = async () => {
    if (state.step === 2) {
      await validateStands();
    } else if (state.step === 4) {
      await executeAction();
    } else {
      updateState({ step: state.step + 1 });
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      updateState({ step: state.step - 1, error: null });
    }
  };

  const handleReset = () => {
    setState(INITIAL_STATE);
  };

  // Export results to CSV
  const exportResults = () => {
    const rows = [
      ['Stand Number', 'Success', 'Error', 'Old Value', 'New Value'].join(','),
      ...state.results.map((r) => {
        const oldVal = r.oldStatus || r.oldPrice?.toString() || '';
        const newVal = r.newStatus || r.newPrice?.toString() || '';
        return [r.standNumber, r.success, r.error || '', oldVal, newVal].join(',');
      }),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizard-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-auto max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-400">Stand Actions Wizard</h2>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  s === state.step
                    ? 'bg-amber-500 text-white'
                    : s < state.step
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-slate-400'
                }`}
              >
                {s < state.step ? '✓' : s}
              </div>
              {s < 5 && (
                <div
                  className={`w-8 h-0.5 ${
                    s < state.step ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 overflow-y-auto">
        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{state.error}</span>
          </div>
        )}

        {/* Step 1: Choose Action */}
        {state.step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Choose Action</h3>
            <p className="text-sm text-gray-600">Select the wizard action you want to perform on stands.</p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                type="button"
                onClick={() => updateState({ action: 'MARK_SOLD' })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  state.action === 'MARK_SOLD'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Tag className="w-8 h-8 text-green-600 mb-2" />
                <h4 className="font-medium text-gray-900">Mark as Sold</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Mark stands as SOLD with reason and notify stakeholders.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateState({ action: 'APPLY_DISCOUNT' })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  state.action === 'APPLY_DISCOUNT'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-8 h-8 text-blue-600 mb-2" />
                <h4 className="font-medium text-gray-900">Apply Discount</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Apply a percentage discount to stand prices.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Development & Enter Stand Numbers */}
        {state.step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Select Development & Stands</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Development</label>
              <select
                value={state.developmentId}
                onChange={(e) => updateState({ developmentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="">Select a development...</option>
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.branch})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stand Numbers <span className="text-gray-400">(one per line, or comma-separated)</span>
              </label>
              <textarea
                value={state.standNumbersInput}
                onChange={(e) => updateState({ standNumbersInput: e.target.value })}
                placeholder="e.g., A1&#10;A2&#10;B3, B4, B5"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {parsedStandNumbers.length} stand(s) detected
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Reason & Details */}
        {state.step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Enter Details</h3>

            {/* Validation summary */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Development:</span>
                <span className="font-medium">{selectedDevelopment?.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Stands found:</span>
                <span className="font-medium text-green-600">{state.validatedStands.length}</span>
              </div>
              {state.notFoundStands.length > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Not found:</span>
                  <span className="font-medium text-red-600">{state.notFoundStands.length}</span>
                </div>
              )}
            </div>

            {state.notFoundStands.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-1">Stands not found:</p>
                <p className="text-xs text-red-600 font-mono">{state.notFoundStands.join(', ')}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={state.reason}
                onChange={(e) => updateState({ reason: e.target.value })}
                placeholder="Enter the reason for this action..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {state.action === 'MARK_SOLD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={state.notes}
                  onChange={(e) => updateState({ notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            )}

            {state.action === 'APPLY_DISCOUNT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Percentage <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={state.discountPercent}
                      onChange={(e) =>
                        updateState({ discountPercent: parseFloat(e.target.value) || 0 })
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={state.effectiveAt}
                    onChange={(e) => updateState({ effectiveAt: e.target.value })}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Review & Confirm */}
        {state.step === 4 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Review & Confirm</h3>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Action:</strong>{' '}
                {state.action === 'MARK_SOLD' ? 'Mark as Sold' : `Apply ${state.discountPercent}% Discount`}
              </p>
              <p className="text-sm text-amber-800 mt-1">
                <strong>Development:</strong> {selectedDevelopment?.name}
              </p>
              <p className="text-sm text-amber-800 mt-1">
                <strong>Reason:</strong> {state.reason}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Stands to be processed ({state.validatedStands.filter((s) =>
                  state.action === 'MARK_SOLD' ? s.canSell : s.canDiscount
                ).length}):
              </h4>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stand</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {state.action === 'MARK_SOLD' ? 'Eligible' : 'Price'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.validatedStands.map((s) => {
                      const eligible = state.action === 'MARK_SOLD' ? s.canSell : s.canDiscount;
                      return (
                        <tr key={s.id} className={eligible ? '' : 'bg-gray-50 text-gray-400'}>
                          <td className="px-3 py-2 font-mono">{s.standNumber}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                s.status === 'AVAILABLE'
                                  ? 'bg-green-100 text-green-700'
                                  : s.status === 'RESERVED'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : s.status === 'SOLD'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {state.action === 'MARK_SOLD' ? (
                              eligible ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )
                            ) : (
                              `$${s.price?.toLocaleString() || '—'}`
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {state.action === 'APPLY_DISCOUNT' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>Preview:</strong> {state.discountPercent}% discount will be applied.
                <br />
                <span className="text-xs text-blue-600">
                  Existing installment plans will be recalculated (preserving paid amounts).
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Results */}
        {state.step === 5 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Results</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {state.results.filter((r) => r.success).length}
                </div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">
                  {state.results.filter((r) => !r.success).length}
                </div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stand</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {state.results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{r.standNumber}</td>
                      <td className="px-3 py-2">
                        {r.success ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" /> Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.error ||
                          (r.oldStatus
                            ? `${r.oldStatus} → ${r.newStatus}`
                            : r.oldPrice
                            ? `$${r.oldPrice.toLocaleString()} → $${r.newPrice?.toLocaleString()}`
                            : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={exportResults}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-amber-100 hover:bg-amber-200 rounded-lg text-sm font-medium text-amber-700 transition-colors"
              >
                New Action
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {state.step < 5 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            onClick={state.step === 1 ? onClose : handleBack}
            disabled={state.loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {state.step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || state.loading}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              canProceed() && !state.loading
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {state.loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : state.step === 4 ? (
              <>
                Confirm & Execute
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {state.step === 5 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default StandActionsWizard;
