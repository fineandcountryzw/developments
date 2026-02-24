'use client';

import React, { useState, useEffect } from 'react';
import { supabaseMock } from '@/services/supabase';
import { format } from 'date-fns';

type TabType = 'summary' | 'calculations' | 'payouts' | 'approvals' | 'history';

export default function CommissionManager() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedStatus, setSelectedStatus] = useState('CALCULATED');
  const [branch, setBranch] = useState('HARARE');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form states
  const [agentId, setAgentId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [percentage, setPercentage] = useState('2.5');
  const [selectedPayoutId, setSelectedPayoutId] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('APPROVED');

  // Fetch commissions
  useEffect(() => {
    const fetchCommissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseMock.getCommissions(
          selectedMonth,
          selectedStatus,
          branch
        );
        if (error) {
          setMessage(`Error: ${error}`);
        } else {
          setCommissions(data || []);
        }
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (activeTab === 'calculations' || activeTab === 'approvals') {
      fetchCommissions();
    }
  }, [activeTab, selectedMonth, selectedStatus, branch]);

  // Fetch payouts
  useEffect(() => {
    const fetchPayouts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseMock.getCommissions(
          selectedMonth,
          undefined,
          branch
        );
        if (error) {
          setMessage(`Error: ${error}`);
        } else {
          setPayouts(data || []);
        }
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'payouts') {
      fetchPayouts();
    }
  }, [activeTab, selectedMonth, branch]);

  // Handle calculate commission
  const handleCalculateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabaseMock.calculateCommission(
        agentId,
        paymentId,
        parseFloat(paymentAmount),
        parseFloat(percentage),
        selectedMonth
      );
      if (error) {
        setMessage(`Error: ${error}`);
      } else {
        setMessage(`✅ Commission calculated: ${data?.amount || 'pending'}`);
        setAgentId('');
        setPaymentId('');
        setPaymentAmount('');
        setPercentage('2.5');
        // Refresh
        const { data: newData } = await supabaseMock.getCommissions(
          selectedMonth,
          'CALCULATED',
          branch
        );
        setCommissions(newData || []);
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle approve commission
  const handleApproveCommission = async (commissionId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabaseMock.approveCommission(commissionId);
      if (error) {
        setMessage(`Error: ${error}`);
      } else {
        setMessage('✅ Commission approved');
        // Refresh
        const { data: newData } = await supabaseMock.getCommissions(
          selectedMonth,
          'CALCULATED',
          branch
        );
        setCommissions(newData || []);
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle update payout
  const handleUpdatePayout = async () => {
    if (!selectedPayoutId) {
      setMessage('Please select a payout');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabaseMock.updateCommissionPayout(
        selectedPayoutId,
        payoutStatus
      );
      if (error) {
        setMessage(`Error: ${error}`);
      } else {
        setMessage(`✅ Payout status updated to ${payoutStatus}`);
        setSelectedPayoutId('');
        // Refresh
        const { data: newData } = await supabaseMock.getCommissions(selectedMonth, undefined, branch);
        setPayouts(newData || []);
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const total = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const approved = commissions
      .filter(c => c.status === 'APPROVED')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const pending = commissions
      .filter(c => c.status === 'CALCULATED')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    
    return { total, approved, pending };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Commission Manager</h2>
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="text-black px-3 py-1 rounded"
            >
              <option>HARARE</option>
              <option>BULAWAYO</option>
              <option>MUTARE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-black px-3 py-1 rounded"
            />
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded text-purple-800">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {[
            { id: 'summary', label: '💰 Summary' },
            { id: 'calculations', label: '🧮 Calculations' },
            { id: 'payouts', label: '💳 Payouts' },
            { id: 'approvals', label: '✅ Approvals' },
            { id: 'history', label: '📜 History' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-3 font-semibold ${
                activeTab === tab.id
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-purple-50">
            <p className="text-sm text-gray-600">Total Commissions</p>
            <p className="text-3xl font-bold text-purple-600">USD {totals.total.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedMonth}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-3xl font-bold text-green-600">USD {totals.approved.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Ready to pay</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
            <p className="text-sm text-gray-600">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-600">USD {totals.pending.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{commissions.filter(c => c.status === 'CALCULATED').length} items</p>
          </div>
        </div>
      )}

      {/* Calculations Tab */}
      {activeTab === 'calculations' && (
        <div className="space-y-4">
          <form onSubmit={handleCalculateCommission} className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Calculate New Commission</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Agent ID</label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Agent ID"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment ID</label>
                <input
                  type="text"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="Payment ID"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Commission % (default 2.5%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="2.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            {paymentAmount && percentage && (
              <div className="p-3 bg-white rounded border border-blue-200">
                <p className="text-sm text-gray-600">Estimated Commission</p>
                <p className="text-2xl font-bold text-blue-600">
                  USD {((parseFloat(paymentAmount) * parseFloat(percentage)) / 100).toFixed(2)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? 'Calculating...' : 'Calculate Commission'}
            </button>
          </form>

          {/* Commissions List */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Commissions ({selectedStatus})</h3>
            <div className="flex gap-2 mb-3">
              {['CALCULATED', 'APPROVED', 'PAID'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedStatus === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {loading ? (
              <div>Loading...</div>
            ) : commissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Agent ID</th>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">%</th>
                      <th className="px-3 py-2 text-right">Commission</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((comm) => (
                      <tr key={comm.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{comm.agentId}</td>
                        <td className="px-3 py-2">{comm.paymentId}</td>
                        <td className="px-3 py-2 text-right">USD {comm.amount?.toFixed(2) || '0.00'}</td>
                        <td className="px-3 py-2 text-center">{comm.percentage}%</td>
                        <td className="px-3 py-2 text-right font-semibold">USD {(comm.amount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            comm.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            comm.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {comm.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {comm.status === 'CALCULATED' && (
                            <button
                              onClick={() => handleApproveCommission(comm.id)}
                              disabled={loading}
                              className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500">No commissions found</div>
            )}
          </div>
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Commission Payouts</h3>
            
            {loading ? (
              <div>Loading...</div>
            ) : payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Agent ID</th>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Total Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-left">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{payout.agentId}</td>
                        <td className="px-3 py-2">{payout.month}</td>
                        <td className="px-3 py-2 text-right font-semibold">USD {payout.total?.toFixed(2) || '0.00'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            payout.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            payout.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{payout.paidAt ? format(new Date(payout.paidAt), 'MMM dd, yyyy') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500">No payouts found</div>
            )}
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Commission Approval Workflow</h3>
            
            <div className="p-3 bg-white border border-blue-200 rounded">
              <p className="text-sm">
                Pending Approval: <strong>{commissions.filter(c => c.status === 'CALCULATED').length}</strong>
              </p>
              <p className="text-sm">
                Total Amount: <strong>USD {totals.pending.toFixed(2)}</strong>
              </p>
            </div>

            {commissions.filter(c => c.status === 'CALCULATED').length > 0 && (
              <div>
                <button
                  onClick={() => {
                    // Bulk approve logic
                    commissions
                      .filter(c => c.status === 'CALCULATED')
                      .forEach(c => handleApproveCommission(c.id));
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  Approve All Pending
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold">Commission History</h3>
          <div className="text-gray-600">
            <p>📜 Historical commission records</p>
            <ul className="mt-2 space-y-2 list-disc list-inside text-sm">
              <li>View paid commissions by date</li>
              <li>Track commission trends over time</li>
              <li>Export history for reconciliation</li>
              <li>Audit commission approvals</li>
            </ul>
          </div>
          <button className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
            📥 Export History (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
