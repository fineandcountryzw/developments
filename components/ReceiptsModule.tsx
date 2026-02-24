'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, Download, Search, Filter, Calendar, DollarSign, User,
  Building2, FileText, Eye, Loader2, AlertCircle, X, Printer
} from 'lucide-react';
import { Branch } from '../types';

interface ReceiptData {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentType: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  developmentId?: string;
  developmentName?: string;
  standId?: string;
  standNumber?: string;
  installmentPlanId?: string;
  installmentNumber?: number;
  issuedBy: string;
  branch: string;
  pdfUrl?: string;
  createdAt: string;
}

export const ReceiptsModule: React.FC<{ activeBranch?: Branch }> = ({ activeBranch = 'Harare' }) => {
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('ALL');
  
  // View receipt modal
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Fetch receipts
  useEffect(() => {
    fetchReceipts();
  }, [activeBranch]);

  const fetchReceipts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('branch', activeBranch);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      
      const res = await fetch(`/api/admin/receipts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch receipts');
      
      const data = await res.json();
      setReceipts(data.data || []);
      
    } catch (err: any) {
      console.error('Error fetching receipts:', err);
      setError(err.message || 'Failed to load receipts');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!receipt.receiptNumber?.toLowerCase().includes(query) &&
            !receipt.clientName?.toLowerCase().includes(query) &&
            !receipt.clientEmail?.toLowerCase().includes(query) &&
            !receipt.standNumber?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Payment type filter
      if (paymentTypeFilter !== 'ALL' && receipt.paymentType !== paymentTypeFilter) {
        return false;
      }
      
      return true;
    });
  }, [receipts, searchQuery, paymentTypeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = receipts.length;
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const deposits = receipts.filter(r => r.paymentType === 'Deposit').length;
    const installments = receipts.filter(r => r.paymentType === 'Installment').length;
    
    return { total, totalAmount, deposits, installments };
  }, [receipts]);

  // Download receipt
  const handleDownloadReceipt = async (receiptId: string) => {
    try {
      const res = await fetch(`/api/admin/receipts/${receiptId}?format=pdf`);
      if (!res.ok) throw new Error('Failed to download receipt');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Error downloading receipt:', err);
      alert('Failed to download receipt');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format date with time
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading receipts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-6 h-6 text-red-600 mb-2" />
        <h3 className="text-lg font-semibold text-red-800">Error Loading Data</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={fetchReceipts}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
        <p className="text-gray-600">View and download payment receipts</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Receipt className="w-4 h-4" />
            Total Receipts
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <DollarSign className="w-4 h-4" />
            Total Amount
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalAmount)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-blue-500 text-sm">
            <FileText className="w-4 h-4" />
            Deposits
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.deposits}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Calendar className="w-4 h-4" />
            Installments
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{stats.installments}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt #, client, or stand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="From"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="To"
          />
          <button
            onClick={fetchReceipts}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
        
        <select
          value={paymentTypeFilter}
          onChange={(e) => setPaymentTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Types</option>
          <option value="Deposit">Deposits</option>
          <option value="Installment">Installments</option>
          <option value="Full Payment">Full Payments</option>
        </select>
      </div>

      {/* Receipts List */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Receipt #</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Client</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Method</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No receipts found
                </td>
              </tr>
            ) : (
              filteredReceipts.map(receipt => (
                <tr key={receipt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-gray-900">{receipt.receiptNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{receipt.clientName}</div>
                    <div className="text-sm text-gray-500">{receipt.clientEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      receipt.paymentType === 'Deposit' ? 'bg-blue-100 text-blue-800' :
                      receipt.paymentType === 'Installment' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {receipt.paymentType}
                    </span>
                    {receipt.installmentNumber && (
                      <span className="ml-1 text-sm text-gray-500">#{receipt.installmentNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{receipt.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(receipt.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {formatDate(receipt.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setIsViewModalOpen(true);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(receipt.id)}
                        className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* View Receipt Modal */}
      {isViewModalOpen && selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Receipt Details</h2>
                  <p className="text-gray-500 font-mono">{selectedReceipt.receiptNumber}</p>
                </div>
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Amount */}
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Amount</div>
                <div className="text-3xl font-bold text-green-600">{formatCurrency(selectedReceipt.amount)}</div>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Client</div>
                  <div className="font-medium">{selectedReceipt.clientName}</div>
                  <div className="text-gray-500">{selectedReceipt.clientEmail}</div>
                </div>
                <div>
                  <div className="text-gray-500">Payment Type</div>
                  <div className="font-medium">{selectedReceipt.paymentType}</div>
                  {selectedReceipt.installmentNumber && (
                    <div className="text-gray-500">Installment #{selectedReceipt.installmentNumber}</div>
                  )}
                </div>
                <div>
                  <div className="text-gray-500">Payment Method</div>
                  <div className="font-medium">{selectedReceipt.paymentMethod}</div>
                </div>
                <div>
                  <div className="text-gray-500">Reference</div>
                  <div className="font-medium">{selectedReceipt.paymentReference || '-'}</div>
                </div>
                {selectedReceipt.developmentName && (
                  <div>
                    <div className="text-gray-500">Development</div>
                    <div className="font-medium">{selectedReceipt.developmentName}</div>
                  </div>
                )}
                {selectedReceipt.standNumber && (
                  <div>
                    <div className="text-gray-500">Stand</div>
                    <div className="font-medium">{selectedReceipt.standNumber}</div>
                  </div>
                )}
                <div>
                  <div className="text-gray-500">Issued By</div>
                  <div className="font-medium">{selectedReceipt.issuedBy}</div>
                </div>
                <div>
                  <div className="text-gray-500">Date</div>
                  <div className="font-medium">{formatDateTime(selectedReceipt.createdAt)}</div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadReceipt(selectedReceipt.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptsModule;
