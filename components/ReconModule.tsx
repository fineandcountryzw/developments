
import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, PieChart, CheckCircle2, Clock, AlertCircle,
  ArrowUpRight, Download, Send, RefreshCw, Zap, ShieldCheck,
  User, Briefcase, Filter, Search, Loader2, Mail, Calendar,
  TrendingUp, FileText, ChevronRight, Activity, Server,
  ShieldAlert, Radio, X, FileSpreadsheet, File, Plus, History, Building2
} from 'lucide-react';
import { ReconRecord, Branch, ReconStatus, Development } from '../types.ts';
import { updateReconStatus, BRANCH_SETTINGS } from '../lib/db';
import { generateWeeklyReconPDF, triggerAutomatedMondayBroadcast } from '../services/reconService.ts';

export const ReconModule: React.FC<{ activeBranch: Branch }> = ({ activeBranch }) => {
  const [records, setRecords] = useState<ReconRecord[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState<ReconRecord | null>(null);
  const [bankRef, setBankRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Developer Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>('all');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch developments from API (all active developments for dropdown)
      const devsResponse = await fetch(`/api/admin/developments`);
      const devsData = await devsResponse.json();

      // Fetch ALL payments for recon ledger view using unified API (both CONFIRMED and VERIFIED)
      const paymentsResponse = await fetch(`/api/payments/unified?status=CONFIRMED&limit=1000`);

      if (!paymentsResponse.ok) {
        console.error('[ReconModule] Payments API error:', paymentsResponse.status, paymentsResponse.statusText);
        setRecords([]);
        setDevelopments(devsData.developments || devsData.data || []);
        setIsLoading(false);
        return;
      }

      const paymentsData = await paymentsResponse.json();

      // Get payments array from unified API response
      // The unified API returns { data: { payments: [...], summary: {...} } }
      const paymentsArray = paymentsData.data?.payments || [];

      // Filter for confirmed/verified payments only
      const confirmedPayments = paymentsArray.filter((p: any) =>
        p.status === 'CONFIRMED' || p.status === 'VERIFIED' || p.verificationStatus === 'Verified'
      );

      // Transform payments into recon records format with fee breakdown
      const reconRecords: ReconRecord[] = confirmedPayments.map((p: any) => {
        // Use stored fee breakdown if available, otherwise calculate
        const standPricePortion = p.standPricePortion ? Number(p.standPricePortion) : 0;
        const vatAmount = p.vatAmount ? Number(p.vatAmount) : 0;
        const cessionAmount = p.cessionAmount ? Number(p.cessionAmount) : 0;
        const endowmentAmount = p.endowmentAmount ? Number(p.endowmentAmount) : 0;
        const aosAmount = p.aosAmount ? Number(p.aosAmount) : 0;
        const totalFees = vatAmount + cessionAmount + endowmentAmount + aosAmount;

        // Commission calculation
        const commission = p.surchargeAmount
          ? Number(p.surchargeAmount)
          : standPricePortion > 0
            ? standPricePortion * 0.05
            : (Number(p.amount) || 0) * 0.05;

        // Developer net = stand price portion - commission (fees are NOT part of developer payout)
        const developerNet = standPricePortion > 0
          ? standPricePortion - commission
          : 0;

        return {
          id: p.id,
          verifiedAt: p.confirmedAt || p.verifiedAt || p.createdAt,
          clientName: p.clientName || p.client?.name || 'Unknown',
          assetRef: p.standId || p.standNumber || p.stand?.standNumber || 'N/A',
          totalPaidUsd: Number(p.amount) || 0,
          standPricePortion: standPricePortion,
          vatAmount: vatAmount,
          cessionAmount: cessionAmount,
          endowmentAmount: endowmentAmount,
          aosAmount: aosAmount,
          totalFees: totalFees,
          commissionUsd: commission,
          developerNetUsd: developerNet,
          status: p.settlementStatus || 'PENDING',
          bankReference: p.reference || p.bankReference || null,
        };
      });

      // Get developments array from response (handle both formats)
      const developmentsArray = devsData.developments || devsData.data || [];

      setRecords(reconRecords);
      setDevelopments(developmentsArray);

      console.log('[ReconModule] Data loaded:', {
        developments: developmentsArray.length,
        reconRecords: reconRecords.length,
        totalPayments: paymentsArray.length
      });
    } catch (error) {
      console.error('[ReconModule] Error fetching data:', error);
      setRecords([]);
      setDevelopments([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeBranch]);

  const handleSettle = async () => {
    if (!settleTarget || !bankRef) return;
    setIsProcessing(true);
    await updateReconStatus(settleTarget.id, 'PAID', bankRef);
    await fetchData();
    setIsProcessing(false);
    setSettleTarget(null);
    setBankRef('');
  };

  // Generate Developer Report Handler
  const handleGenerateReport = async (sendEmail = false) => {
    setIsGeneratingReport(true);
    setReportError(null);

    try {
      const params = new URLSearchParams({
        format: reportFormat,
        branch: activeBranch,
        ...(selectedDevelopment !== 'all' && { developmentId: selectedDevelopment })
      });

      if (sendEmail) {
        // POST request for email delivery
        const response = await fetch('/api/admin/developer-reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: reportFormat,
            branch: activeBranch,
            developmentId: selectedDevelopment !== 'all' ? selectedDevelopment : undefined,
            sendEmail: true
          })
        });

        if (!response.ok) throw new Error('Failed to generate report');

        const result = await response.json();
        alert(`✅ Reports generated! ${result.emailsQueued || 0} emails queued for delivery.`);
      } else {
        // GET request for direct download
        const response = await fetch(`/api/admin/developer-reports/generate?${params}`);

        if (!response.ok) throw new Error('Failed to generate report');

        if (reportFormat === 'json') {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          downloadBlob(blob, `developer_report_${new Date().toISOString().split('T')[0]}.json`);
        } else {
          const blob = await response.blob();
          const ext = reportFormat === 'pdf' ? 'pdf' : 'csv';
          downloadBlob(blob, `developer_report_${new Date().toISOString().split('T')[0]}.${ext}`);
        }
      }

      setShowReportModal(false);
    } catch (error) {
      console.error('Report generation error:', error);
      setReportError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalPayments = records.reduce((sum, r) => sum + r.totalPaidUsd, 0);
    const totalCommissions = records.reduce((sum, r) => sum + r.commissionUsd, 0);
    const totalNet = records.reduce((sum, r) => sum + r.developerNetUsd, 0);
    const totalFees = records.reduce((sum, r) => sum + (r.totalFees || 0), 0);
    const totalVAT = records.reduce((sum, r) => sum + (r.vatAmount || 0), 0);
    const pendingCount = records.filter(r => r.status === 'PENDING').length;
    const paidCount = records.filter(r => r.status === 'PAID').length;
    return { totalPayments, totalCommissions, totalNet, totalFees, totalVAT, pendingCount, paidCount };
  }, [records]);

  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in duration-500">

      {/* Simplified Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Recon & Payouts</h2>
          <p className="text-sm text-gray-500 mt-1">Developer settlements and commission tracking</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="bg-fcGold hover:bg-fcGold/[0.9] text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all"
        >
          <FileText size={20} />
          <span>Generate Report</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign size={18} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Payments</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalPayments.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-fcGold/[0.1] rounded-lg">
              <TrendingUp size={18} className="text-fcGold" />
            </div>
            <span className="text-sm font-medium text-gray-600">Commissions (5%)</span>
          </div>
          <div className="text-2xl font-bold text-fcGold">${stats.totalCommissions.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Building2 size={18} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Net to Developers</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalNet.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock size={18} className="text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Pending Settlements</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.pendingCount} <span className="text-sm font-normal text-gray-500">/ {records.length}</span></div>
        </div>
      </div>

      {/* Clean Recon Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-gray-200">
              <History size={20} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Settlement Ledger</h3>
              <p className="text-xs text-gray-500">Verified payments awaiting developer payout</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-600 uppercase">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Client</th>
                <th className="px-6 py-4 text-left">Stand</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-right">Stand Price</th>
                <th className="px-6 py-4 text-right">Fees</th>
                <th className="px-6 py-4 text-right">Commission</th>
                <th className="px-6 py-4 text-right">Net to Dev</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-fcGold" size={32} />
                    <p className="text-sm text-gray-500 mt-2">Loading settlements...</p>
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(rec.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-fcGold/[0.1] flex items-center justify-center text-xs font-semibold text-fcGold">
                          {rec.clientName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{rec.clientName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Building2 size={14} className="text-fcGold" />
                        <span>{rec.assetRef}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-lg font-bold text-gray-900">${rec.totalPaidUsd.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-gray-700">
                        ${(rec.standPricePortion || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-gray-600">
                        ${(rec.totalFees || 0).toLocaleString()}
                        {(rec.vatAmount || 0) > 0 && (
                          <div className="text-xs text-gray-500">VAT: ${rec.vatAmount?.toLocaleString()}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-lg font-bold text-fcGold">${rec.commissionUsd.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-lg font-bold text-gray-700">${rec.developerNetUsd.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${rec.status === 'PAID'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        {rec.status === 'PAID' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {rec.status === 'PENDING' && (
                        <button
                          onClick={() => setSettleTarget(rec)}
                          className="text-sm font-medium text-fcGold hover:underline"
                        >
                          Settle
                        </button>
                      )}
                      {rec.status === 'PAID' && rec.bankReference && (
                        <span className="text-xs text-gray-500">Ref: {rec.bankReference}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                      <PieChart size={48} />
                      <p className="text-sm font-medium">No settlements pending</p>
                      <p className="text-xs">Verified payments will appear here</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Commission Modal */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/[0.5]" onClick={() => !isProcessing && setSettleTarget(null)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/[0.1] rounded-lg">
                  <DollarSign size={20} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Settle Commission</h3>
                  <p className="text-sm text-gray-500">${settleTarget.commissionUsd.toLocaleString()} to pay</p>
                </div>
              </div>
              <button
                onClick={() => !isProcessing && setSettleTarget(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium text-gray-900">{settleTarget.clientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Stand</span>
                  <span className="font-medium text-gray-900">{settleTarget.assetRef}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Payment</span>
                  <span className="font-medium text-gray-900">${settleTarget.totalPaidUsd.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-500">Commission (5%)</span>
                  <span className="font-bold text-fcGold">${settleTarget.commissionUsd.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Reference / Transaction ID</label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="e.g. CABS-REF-1001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSettleTarget(null)}
                  className="flex-1 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettle}
                  disabled={!bankRef || isProcessing}
                  className="flex-1 bg-fcGold hover:bg-fcGold/[0.9] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm Settlement</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/[0.5]" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/[0.1] rounded-lg">
                  <FileText size={20} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Generate Developer Report</h3>
                  <p className="text-sm text-gray-500">Weekly settlement summary</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Development Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Development</label>
                <select
                  value={selectedDevelopment}
                  onChange={(e) => setSelectedDevelopment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                >
                  <option value="all">All Developments</option>
                  {developments.map(dev => (
                    <option key={dev.id} value={dev.id}>{dev.name}</option>
                  ))}
                </select>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Report Format</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setReportFormat('pdf')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${reportFormat === 'pdf'
                      ? 'border-fcGold bg-fcGold/[0.05]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <File size={24} className={reportFormat === 'pdf' ? 'text-fcGold' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${reportFormat === 'pdf' ? 'text-fcGold' : 'text-gray-500'}`}>PDF</span>
                  </button>
                  <button
                    onClick={() => setReportFormat('csv')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${reportFormat === 'csv'
                      ? 'border-fcGold bg-fcGold/[0.05]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <FileSpreadsheet size={24} className={reportFormat === 'csv' ? 'text-fcGold' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${reportFormat === 'csv' ? 'text-fcGold' : 'text-gray-500'}`}>CSV</span>
                  </button>
                  <button
                    onClick={() => setReportFormat('json')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${reportFormat === 'json'
                      ? 'border-fcGold bg-fcGold/[0.05]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <FileText size={24} className={reportFormat === 'json' ? 'text-fcGold' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${reportFormat === 'json' ? 'text-fcGold' : 'text-gray-500'}`}>JSON</span>
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {reportError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle size={16} className="text-red-600" />
                  <span className="text-sm text-red-600">{reportError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleGenerateReport(false)}
                  disabled={isGeneratingReport}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  {isGeneratingReport ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  {isGeneratingReport ? 'Generating...' : 'Download'}
                </button>
                <button
                  onClick={() => handleGenerateReport(true)}
                  disabled={isGeneratingReport}
                  className="flex-1 bg-fcGold hover:bg-fcGold/[0.9] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  {isGeneratingReport ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Mail size={16} />
                  )}
                  {isGeneratingReport ? 'Sending...' : 'Email Report'}
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Reports include last 7 days of settlements, commissions, and payments
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
