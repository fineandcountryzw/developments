'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  DollarSign, Download, CheckCircle2, AlertTriangle, Loader2,
  Search, RefreshCw, Eye, ArrowUpDown, ArrowRight, XCircle,
  Calendar, Building2, User, Hash, ChevronDown, ChevronUp,
  FileText, CreditCard, CircleDot
} from 'lucide-react';
import { Branch } from '../types';
import { logger } from '@/lib/logger';
import { VoidPaymentModal } from '@/components/modals/VoidPaymentModal';
import { useDebounce } from '@/hooks/useDebounce';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  paymentId: string;
  paymentRef: string;
  paymentDate: string;
  paymentAmount: number;
  paymentStatus: string;
  clientId: string;
  clientName: string;
  standId: string | null;
  developmentName: string | null;
  allocations: Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    installmentNo: number | null;
    allocatedAt: string;
    allocatedBy: string | null;
  }>;
  totalAllocated: number;
  unallocatedAmount: number;
}

interface ReconciliationIssue {
  type: 'UNALLOCATED_PAYMENT' | 'MISMATCHED_TOTALS' | 'ORPHANED_ALLOCATION';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  paymentId?: string;
  planId?: string;
  amount?: number;
  suggestedAction?: string;
}

interface ReconciliationSummary {
  totalPayments: number;
  totalAllocated: number;
  unallocatedAmount: number;
  issueCount: number;
  issues: ReconciliationIssue[];
}

interface ReconciliationReport {
  paymentId: string;
  paymentAmount: number;
  totalAllocated: number;
  discrepancy: number;
  status: 'BALANCED' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED';
  installmentPlanId: string | null;
  planTotalPaid: number | null;
  sumOfInstallmentPayments: number | null;
  planDiscrepancy: number | null;
}

interface AllocationDetail {
  id: string;
  paymentId: string;
  amount: number;
  allocationType: string;
  allocationStatus: string;
  installmentNo?: number;
  clientName: string;
  createdAt: string;
  allocatedBy?: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const BillingModule: React.FC<{ activeBranch?: Branch }> = ({ activeBranch = 'Harare' }) => {
  const { data: session } = useSession();
  const userRole = session?.user?.role?.toUpperCase() || 'ADMIN';
  const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';

  // State
  const [activeTab, setActiveTab] = useState<'ledger' | 'reconciliation' | 'allocations'>('ledger');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [allocations, setAllocations] = useState<AllocationDetail[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'client'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ───────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ───────────────────────────────────────────────────────────────────────────

  const fetchLedger = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);

      // Use unified payments API to get payments from both Payment and PaymentTransaction tables
      const res = await fetch(`/api/payments/unified?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch ledger');
      }

      // Map unified payments to ledger entries format
      const payments = json.data?.payments || [];
      setLedgerEntries(payments.map((p: any) => ({
        id: p.id,
        paymentId: p.id,
        paymentRef: p.reference || 'N/A',
        paymentDate: p.postedAt || p.createdAt,
        paymentAmount: p.amount,
        paymentStatus: p.status,
        clientId: p.clientId,
        clientName: p.clientName,
        standId: p.standId,
        developmentName: p.developmentName,
        allocations: p.allocations || [],
        totalAllocated: p.totalAllocated,
        unallocatedAmount: p.unallocatedAmount
      })));
    } catch (err) {
      logger.error('Failed to fetch ledger', err instanceof Error ? err : undefined, { module: 'BILLING_UI' });
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo]);

  const fetchAllocations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/billing/allocations?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch allocations');
      }

      const items = Array.isArray(json.data?.allocations) ? json.data.allocations : [];
      setAllocations(items.map((alloc: any) => ({
        id: alloc.id,
        paymentId: alloc.paymentId,
        amount: Number(alloc.amount),
        allocationType: alloc.type,
        allocationStatus: alloc.status,
        installmentNo: alloc.installment?.installmentNo ?? alloc.installmentNo ?? undefined,
        clientName: alloc.payment?.clientName || 'Unknown',
        createdAt: alloc.allocatedAt || alloc.createdAt,
        allocatedBy: alloc.allocatedBy || undefined,
        notes: alloc.notes || undefined
      })));
    } catch (err) {
      logger.error('Failed to fetch allocations', err instanceof Error ? err : undefined, { module: 'BILLING_UI' });
      setError(err instanceof Error ? err.message : 'Failed to load allocations');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const fetchReconciliation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/admin/billing/reconcile');
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch reconciliation');
      }

      const reports: ReconciliationReport[] = Array.isArray(json.data?.reports) ? json.data.reports : [];
      const paymentReports = reports.filter(report => report.paymentId !== 'PLAN_CHECK');
      const totalPayments = paymentReports.reduce((sum, report) => sum + Number(report.paymentAmount), 0);
      const totalAllocated = paymentReports.reduce((sum, report) => sum + Number(report.totalAllocated), 0);
      const unallocatedAmount = totalPayments - totalAllocated;

      const issues: ReconciliationIssue[] = reports
        .filter(report => report.status !== 'BALANCED' || (report.planDiscrepancy !== null && report.planDiscrepancy !== 0))
        .map(report => {
          const discrepancy = report.planDiscrepancy !== null ? report.planDiscrepancy : report.discrepancy;
          const amount = Math.abs(discrepancy || 0);
          const isPlanReport = report.paymentId === 'PLAN_CHECK';

          if (isPlanReport) {
            return {
              type: 'MISMATCHED_TOTALS',
              severity: 'ERROR',
              message: `Installment plan totals do not match installment payments`,
              planId: report.installmentPlanId || undefined,
              amount,
              suggestedAction: 'Review installment payments and plan totals'
            };
          }

          if (report.status === 'UNDER_ALLOCATED') {
            return {
              type: 'UNALLOCATED_PAYMENT',
              severity: 'WARNING',
              message: `Payment ${report.paymentId.slice(0, 8)} is under-allocated`,
              paymentId: report.paymentId,
              planId: report.installmentPlanId || undefined,
              amount,
              suggestedAction: 'Allocate remaining balance to the plan'
            };
          }

          return {
            type: 'MISMATCHED_TOTALS',
            severity: 'ERROR',
            message: `Payment ${report.paymentId.slice(0, 8)} is over-allocated`,
            paymentId: report.paymentId,
            planId: report.installmentPlanId || undefined,
            amount,
            suggestedAction: 'Reverse excess allocations'
          };
        });

      setReconciliation({
        totalPayments,
        totalAllocated,
        unallocatedAmount,
        issueCount: issues.length,
        issues
      });
    } catch (err) {
      logger.error('Failed to fetch reconciliation', err instanceof Error ? err : undefined, { module: 'BILLING_UI' });
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch based on active tab
  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    } else if (activeTab === 'allocations') {
      fetchAllocations();
    } else if (activeTab === 'reconciliation') {
      fetchReconciliation();
    }
  }, [activeTab, fetchLedger, fetchAllocations, fetchReconciliation]);

  // Void Payment State
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const handleVoidClick = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setIsVoidModalOpen(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  const handleReverseAllocation = async (allocationId: string, reason: string) => {
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/admin/billing/allocations/${allocationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to reverse allocation');
      }

      // Refresh allocations
      fetchAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reverse allocation');
    }
  };

  const handleAutoAllocate = async (paymentId: string, planId: string) => {
    if (!isAdmin) return;

    try {
      const res = await fetch('/api/admin/billing/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          installmentPlanId: planId,
          mode: 'auto'
        })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to auto-allocate');
      }

      // Refresh
      fetchReconciliation();
      fetchAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-allocate');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SORTING & FILTERING
  // ───────────────────────────────────────────────────────────────────────────

  const sortedLedger = useMemo(() => {
    const sorted = [...ledgerEntries].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
      } else if (sortField === 'amount') {
        cmp = a.paymentAmount - b.paymentAmount;
      } else if (sortField === 'client') {
        cmp = a.clientName.localeCompare(b.clientName);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [ledgerEntries, sortField, sortDir]);

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSort = (field: 'date' | 'amount' | 'client') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  const formatCurrency = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'text-red-600 bg-red-50';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      APPLIED: 'bg-green-100 text-green-800',
      REVERSED: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-green-100 text-green-800',
      VOIDED: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-[#B8860B]" />
              Billing &amp; Allocations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Unified payment ledger, allocations, and reconciliation
            </p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'ledger') fetchLedger();
              else if (activeTab === 'allocations') fetchAllocations();
              else fetchReconciliation();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#B8860B] text-white rounded-lg hover:bg-[#9A7209] transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b">
          {(['ledger', 'allocations', 'reconciliation'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === tab
                ? 'border-[#B8860B] text-[#B8860B]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'ledger' && 'Payment Ledger'}
              {tab === 'allocations' && 'Allocations'}
              {tab === 'reconciliation' && 'Reconciliation'}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#B8860B]" />
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        ) : (
          <>
            {/* ─────────────────────────────────────────────────────────────────
                LEDGER TAB
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'ledger' && (
              <div className="bg-white rounded-xl shadow-sm border">
                {/* Filters */}
                <div className="p-4 border-b flex flex-wrap gap-4 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search client, development..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-left text-sm text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-gray-900">
                            Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">
                          <button onClick={() => toggleSort('client')} className="flex items-center gap-1 hover:text-gray-900">
                            Client
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium text-right">
                          <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:text-gray-900 ml-auto">
                            Amount
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedLedger.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            No ledger entries found
                          </td>
                        </tr>
                      ) : (
                        sortedLedger.map(entry => (
                          <React.Fragment key={entry.id}>
                            <tr className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {formatDate(entry.paymentDate)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${'bg-blue-100 text-blue-700'
                                  }`}>
                                  <CreditCard className="h-3 w-3" />
                                  PAYMENT
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-900">{entry.clientName}</span>
                                </div>
                                {entry.developmentName && (
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <Building2 className="h-3 w-3" />
                                    {entry.developmentName}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                                {entry.paymentRef || entry.paymentId}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-medium text-gray-900">
                                {formatCurrency(entry.paymentAmount)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(entry.paymentStatus)}`}>
                                  {entry.paymentStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => toggleExpand(entry.id)}
                                    className="p-1 hover:bg-gray-100 rounded transition"
                                    title="View Details"
                                  >
                                    {expandedRows.has(entry.id) ? (
                                      <ChevronUp className="h-4 w-4 text-gray-500" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-500" />
                                    )}
                                  </button>
                                  {entry.paymentStatus !== 'VOIDED' && (
                                    <button
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Void Payment"
                                      onClick={() => handleVoidClick(entry.paymentId)}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expandedRows.has(entry.id) && (
                              <tr className="bg-gray-50">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">Reference:</span>
                                      <span className="ml-2 font-mono text-gray-700">{entry.paymentRef || entry.paymentId.slice(0, 8)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Allocated:</span>
                                      <span className="ml-2 text-gray-700">{formatCurrency(entry.totalAllocated)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Unallocated:</span>
                                      <span className="ml-2 text-gray-700">{formatCurrency(entry.unallocatedAmount)}</span>
                                    </div>
                                  </div>
                                  {entry.allocations.length > 0 && (
                                    <div className="mt-4">
                                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Allocations</div>
                                      <div className="space-y-2">
                                        {entry.allocations.map(allocation => (
                                          <div key={allocation.id} className="flex items-center justify-between text-sm">
                                            <div className="text-gray-600">
                                              {allocation.type} {allocation.installmentNo ? `#${allocation.installmentNo}` : ''}
                                            </div>
                                            <div className="text-gray-700 font-mono">{formatCurrency(allocation.amount)}</div>
                                            <div className={`px-2 py-0.5 rounded-full text-xs ${getStatusBadge(allocation.status)}`}>
                                              {allocation.status}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm text-gray-600">
                  <span>{sortedLedger.length} entries</span>
                  <span className="font-medium">
                    Total: {formatCurrency(sortedLedger.reduce((sum, e) => sum + e.paymentAmount, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                ALLOCATIONS TAB
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'allocations' && (
              <div className="bg-white rounded-xl shadow-sm border">
                {/* Filters */}
                <div className="p-4 border-b flex gap-4 items-center">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="APPLIED">Applied</option>
                    <option value="REVERSED">Reversed</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-left text-sm text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Installment</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Allocated By</th>
                        {isAdmin && <th className="px-4 py-3 font-medium text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allocations.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-500">
                            <CircleDot className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            No allocations found
                          </td>
                        </tr>
                      ) : (
                        allocations.map(alloc => (
                          <tr key={alloc.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(alloc.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {alloc.clientName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                {alloc.allocationType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {alloc.installmentNo ? `#${alloc.installmentNo}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm font-medium text-gray-900">
                              {formatCurrency(alloc.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(alloc.allocationStatus)}`}>
                                {alloc.allocationStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {alloc.allocatedBy || 'System'}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-center">
                                {alloc.allocationStatus === 'APPLIED' && (
                                  <button
                                    onClick={() => {
                                      const reason = prompt('Reason for reversal:');
                                      if (reason) handleReverseAllocation(alloc.id, reason);
                                    }}
                                    className="p-1 hover:bg-red-100 rounded transition text-red-600"
                                    title="Reverse Allocation"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                RECONCILIATION TAB
            ───────────────────────────────────────────────────────────────── */}
            {activeTab === 'reconciliation' && reconciliation && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="text-sm text-gray-500 mb-1">Total Payments</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reconciliation.totalPayments)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="text-sm text-gray-500 mb-1">Total Allocated</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reconciliation.totalAllocated)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="text-sm text-gray-500 mb-1">Unallocated</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(reconciliation.unallocatedAmount)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="text-sm text-gray-500 mb-1">Issues Found</div>
                    <div className={`text-2xl font-bold ${reconciliation.issueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {reconciliation.issueCount}
                    </div>
                  </div>
                </div>

                {/* Issues List */}
                <div className="bg-white rounded-xl shadow-sm border">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Reconciliation Issues
                    </h3>
                  </div>

                  {reconciliation.issues.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                      <p className="text-gray-600 font-medium">All payments are fully reconciled!</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {reconciliation.issues.map((issue, idx) => (
                        <div key={idx} className={`p-4 ${getSeverityColor(issue.severity)}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{issue.message}</div>
                              {issue.amount && (
                                <div className="text-sm mt-1">
                                  Amount: {formatCurrency(issue.amount)}
                                </div>
                              )}
                              {issue.suggestedAction && (
                                <div className="text-sm mt-1 opacity-80">
                                  Suggested: {issue.suggestedAction}
                                </div>
                              )}
                            </div>
                            {isAdmin && issue.paymentId && issue.planId && issue.type === 'UNALLOCATED_PAYMENT' && (
                              <button
                                onClick={() => handleAutoAllocate(issue.paymentId!, issue.planId!)}
                                className="px-3 py-1 bg-[#B8860B] text-white text-sm rounded-lg hover:bg-[#9A7209] flex items-center gap-1"
                              >
                                <ArrowRight className="h-4 w-4" />
                                Auto-Allocate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <VoidPaymentModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        onSuccess={() => {
          fetchLedger();
        }}
        paymentId={selectedPaymentId || ''}
      />
    </div>
  );
};

export default BillingModule;
