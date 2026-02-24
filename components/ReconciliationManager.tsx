'use client';

import React, { useState, useEffect } from 'react';
import { supabaseMock } from '@/services/supabase';
import { formatDistanceToNow } from 'date-fns';

interface BankStatement {
  id: string;
  branch: string;
  date: string;
  reference: string;
  amount: number;
  matched: boolean;
  matchedTo?: string;
  createdAt: string;
}

interface ReconRecord {
  id: string;
  status: string;
  items: string[];
  branch: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type Tab = 'import' | 'matches' | 'discrepancies' | 'pending' | 'summary';

export function ReconciliationManager() {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [matched, setMatched] = useState<ReconRecord[]>([]);
  const [discrepancies, setDiscrepancies] = useState<ReconRecord[]>([]);
  const [pending, setPending] = useState<ReconRecord[]>([]);
  const [csvData, setCsvData] = useState<string>('');
  const [importedCount, setImportedCount] = useState(0);
  const [filterBranch, setFilterBranch] = useState('Harare');

  useEffect(() => {
    loadReconciliationData();
  }, [filterBranch]);

  const loadReconciliationData = async () => {
    try {
      setLoading(true);
      const result = await supabaseMock.getReconciliationData('all', filterBranch);
      if (result.data) {
        setMatched(result.data.matched || []);
        setDiscrepancies(result.data.discrepancies || []);
        setPending(result.data.pending || []);
        setStatements(result.data.statements || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvData.trim()) {
      setError('Please paste CSV data');
      return;
    }

    try {
      setLoading(true);
      const lines = csvData.trim().split('\n');
      const parsedData = lines.slice(1).map(line => {
        const [date, reference, amount] = line.split(',').map(v => v.trim());
        return { date, reference, amount: parseFloat(amount) };
      }).filter(item => item.date && item.reference && item.amount);

      const result = await supabaseMock.importBankStatements(parsedData, filterBranch);
      if (result.error) {
        setError(result.error);
      } else {
        setImportedCount(result.data?.imported || 0);
        setCsvData('');
        await loadReconciliationData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecon = async (reconId: string, status: string) => {
    try {
      setLoading(true);
      await supabaseMock.updateReconRecord(reconId, status);
      await loadReconciliationData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: statements.length,
    matched: statements.filter(s => s.matched).length,
    unmatched: statements.length - statements.filter(s => s.matched).length,
    rate: statements.length > 0 ? ((statements.filter(s => s.matched).length / statements.length) * 100).toFixed(1) : 0,
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
          <h1 className="text-3xl font-bold">Reconciliation Engine</h1>
          <p className="text-purple-100 mt-2">Match bank statements to payments</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 m-6 rounded">
            {error}
          </div>
        )}

        {importedCount > 0 && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 m-6 rounded">
            Successfully imported {importedCount} bank statements
          </div>
        )}

        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <label className="text-sm font-medium">Branch:</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded"
          >
            <option>Harare</option>
            <option>Bulawayo</option>
            <option>Mutare</option>
          </select>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-8 px-6">
            {(['summary', 'import', 'matches', 'discrepancies', 'pending'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 font-medium border-b-2 ${
                  activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent'
                }`}
              >
                {tab === 'summary' && 'Summary'}
                {tab === 'import' && 'Import'}
                {tab === 'matches' && `Matched (${matched.length})`}
                {tab === 'discrepancies' && `Issues (${discrepancies.length})`}
                {tab === 'pending' && `Pending (${pending.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}

          {activeTab === 'summary' && !loading && (
            <div>
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-gray-600">Total Statements</div></div>
                <div className="bg-green-50 rounded p-4"><div className="text-2xl font-bold">{stats.matched}</div><div className="text-sm text-gray-600">Matched</div></div>
                <div className="bg-yellow-50 rounded p-4"><div className="text-2xl font-bold">{stats.unmatched}</div><div className="text-sm text-gray-600">Unmatched</div></div>
                <div className="bg-purple-50 rounded p-4"><div className="text-2xl font-bold">{stats.rate}%</div><div className="text-sm text-gray-600">Match Rate</div></div>
              </div>
            </div>
          )}

          {activeTab === 'import' && !loading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Import Bank Statements</h2>
              <form onSubmit={handleImportCSV} className="space-y-4">
                <textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="date,reference,amount&#10;2025-01-15,STM-001,5000.00"
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-mono text-sm"
                />
                <button type="submit" disabled={loading} className="bg-purple-600 text-white px-6 py-2 rounded disabled:opacity-50">
                  Import
                </button>
              </form>
            </div>
          )}

          {activeTab === 'matches' && !loading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Matched Records</h2>
              {matched.length === 0 ? (
                <p className="text-gray-500">No matches yet</p>
              ) : (
                <div className="space-y-3">
                  {matched.map(rec => (
                    <div key={rec.id} className="border border-green-200 bg-green-50 rounded p-4">
                      <div className="flex justify-between">
                        <span className="font-mono text-sm">{rec.items.join(' → ')}</span>
                        <span className="text-xs bg-green-100 px-2 py-1 rounded">{rec.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'discrepancies' && !loading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Discrepancies</h2>
              {discrepancies.length === 0 ? (
                <p className="text-gray-500">No discrepancies</p>
              ) : (
                <div className="space-y-3">
                  {discrepancies.map(rec => (
                    <div key={rec.id} className="border border-red-200 bg-red-50 rounded p-4">
                      <div className="flex justify-between items-start">
                        <div><span className="font-mono text-sm">{rec.items.join(' → ')}</span></div>
                        <button
                          onClick={() => handleUpdateRecon(rec.id, 'MANUAL')}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && !loading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Pending</h2>
              {pending.length === 0 ? (
                <p className="text-gray-500">No pending items</p>
              ) : (
                <div className="space-y-3">
                  {pending.map(rec => (
                    <div key={rec.id} className="border border-yellow-200 bg-yellow-50 rounded p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateRecon(rec.id, 'MATCHED')}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateRecon(rec.id, 'DISCREPANCY')}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                        >
                          Flag
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
