
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, DollarSign, Download, Clock, CheckCircle2, History, Calendar,
  Landmark, User, Info, ArrowRight, Wallet, Zap, ShieldCheck, RefreshCw, Loader2,
  FileText, Hash, Search, Plus, X, MapPin, AlertCircle, Building2, Trash2, Ban
} from 'lucide-react';
import { Payment, Client, Invoice, Stand, Development, PaynowStatus, PaymentMethod, PaymentType, Branch } from '../types.ts';
import { getClients, getPayments, getInvoices, getStandsByClient, getDevelopmentById, savePayment } from '../lib/db';
import { generateReceipt } from '../services/pdfService.ts';
import { dispatchPaymentRefresh } from '@/hooks/usePaymentRefresh';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';
import { cachedFetch } from '@/lib/api-cache';
import { useRealtime } from '@/hooks/useRealtime';
import { PageContainer, SectionHeader } from '@/components/layouts';

interface PrefilledStand {
  id: string;
  number: string;
  developmentName: string;
  status: string;
  priceUsd: number;
  areaSqm: number;
}

interface PaymentModuleProps {
  activeBranch?: Branch;
  prefilledStand?: PrefilledStand;
  onPaymentComplete?: () => void;
  embeddedMode?: boolean;
}

export const PaymentModule: React.FC<PaymentModuleProps> = ({ 
  activeBranch = 'Harare', 
  prefilledStand,
  onPaymentComplete,
  embeddedMode = false
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeDevelopment, setActiveDevelopment] = useState<Development | null>(null);
  const [availableStands, setAvailableStands] = useState<Stand[]>([]);
  const [selectedStandId, setSelectedStandId] = useState<string>('');
  const [loadingStands, setLoadingStands] = useState(false);
  
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [paymentType, setPaymentType] = useState<PaymentType>('Deposit');
  const [standNumber, setStandNumber] = useState<string>('');
  const [manualReceiptNo, setManualReceiptNo] = useState('');
  const [office, setOffice] = useState<Branch>(activeBranch);
  const [description, setDescription] = useState('');
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receivedByName, setReceivedByName] = useState<string>(''); // Free text field

  // Void payment modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Filtering and pagination state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  useEffect(() => {
    setOffice(activeBranch);
  }, [activeBranch]);

  // Initialize with prefilled stand from inventory "Sell Now" button
  useEffect(() => {
    if (prefilledStand) {
      logger.debug('Prefilled stand received', { module: 'PaymentModule', prefilledStand });
      setSelectedStandId(prefilledStand.id);
      setStandNumber(prefilledStand.number);
      // Open modal automatically in embedded mode
      if (embeddedMode) {
        setIsModalOpen(true);
      }
    }
  }, [prefilledStand, embeddedMode]);

  // Real-time updates for payments
  const { isConnected: isRealtimeConnected } = useRealtime({
    onPayment: async (event) => {
      if (event.action === 'created' || event.action === 'updated') {
        // Refresh payments list
        const updatedPayments = await getPayments(selectedClient?.id || '');
        setPayments(updatedPayments);
        
        // If payment is for selected client, refresh their payments
        if (selectedClient && event.payload?.clientId === selectedClient.id) {
          const clientPayments = await getPayments(selectedClient.id);
          setPayments(clientPayments);
        }
      } else if (event.action === 'deleted') {
        // Remove payment from list
        setPayments(prev => prev.filter(p => p.id !== event.payload?.id));
      }
    },
    enabled: true
  });

  useEffect(() => {
    getClients().then(setClients);
    getPayments('').then(setPayments);
  }, []);

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    const [inv, pay, clientStands] = await Promise.all([
      getInvoices('sale-1'),
      getPayments(client.id),
      getStandsByClient(client.id)
    ]);
    
    setInvoices(inv);
    setPayments(pay);

    if (clientStands.length > 0) {
      const dev = await getDevelopmentById(clientStands[0].developmentId);
      if (dev) setActiveDevelopment(dev);
    }

    // Fetch stands owned by or reserved for this client
    await fetchClientStands(client.id);
  };

  const fetchClientStands = async (clientId: string) => {
    setLoadingStands(true);
    try {
      // Fetch stands where client is owner or reserver
      const response = await fetch(`/api/admin/stands?clientId=${clientId}`);
      const data = await response.json();
      if (data.success && data.data) {
        setAvailableStands(data.data);
      }
    } catch (error) {
      logger.error('Failed to fetch client stands', error instanceof Error ? error : undefined, { module: 'PaymentModule', clientId });
    } finally {
      setLoadingStands(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone.includes(clientSearch)
    );
  }, [clients, clientSearch]);

  const surcharge = useMemo(() => {
    // 5% bank charge for Bank method only
    return method === 'Bank' ? amount * 0.05 : 0;
  }, [amount, method]);

  const totalToPay = useMemo(() => amount + surcharge, [amount, surcharge]);

  // Calculate payment metrics for KPIs
  const paymentMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      totalPayments: payments.reduce((sum, p) => sum + (p.amountUsd || 0), 0),
      todayTotal: payments
        .filter(p => {
          const payDate = new Date(p.createdAt);
          payDate.setHours(0, 0, 0, 0);
          return payDate.getTime() === today.getTime();
        })
        .reduce((sum, p) => sum + (p.amountUsd || 0), 0),
      monthTotal: payments
        .filter(p => new Date(p.createdAt) >= monthStart)
        .reduce((sum, p) => sum + (p.amountUsd || 0), 0),
      pendingCount: payments.filter(p => p.verificationStatus !== 'Verified').length
    };
  }, [payments]);

  // Filter payments based on status and date range
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Status filter
      if (statusFilter !== 'ALL' && p.verificationStatus !== statusFilter) {
        return false;
      }
      
      // Date range filter
      if (dateFromFilter) {
        const filterDate = new Date(dateFromFilter);
        const paymentDate = new Date(p.createdAt);
        if (paymentDate < filterDate) {
          return false;
        }
      }
      
      if (dateToFilter) {
        const filterDate = new Date(dateToFilter);
        filterDate.setHours(23, 59, 59, 999);
        const paymentDate = new Date(p.createdAt);
        if (paymentDate > filterDate) {
          return false;
        }
      }
      
      return true;
    });
  }, [payments, statusFilter, dateFromFilter, dateToFilter]);

  // Pagination
  const paginatedPayments = useMemo(() => {
    const totalPages = Math.ceil(filteredPayments.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredPayments.length);
    return {
      items: filteredPayments.slice(start, end),
      totalCount: filteredPayments.length,
      totalPages,
      currentPage,
      pageSize
    };
  }, [filteredPayments, currentPage, pageSize]);

  // Export to CSV function
  const exportToCSV = () => {
    if (filteredPayments.length === 0) {
      toast.error('No payments to export');
      return;
    }

    const headers = ['Date', 'Client', 'Stand', 'Type', 'Method', 'Receipt', 'Received By', 'Status', 'Amount', 'Office'];
    const csvContent = [
      headers.join(','),
      ...filteredPayments.map(p => [
        new Date(p.createdAt).toLocaleDateString('en-GB'),
        `"${p.clientName}"`,
        p.standNumber || '-',
        p.paymentType,
        p.paymentMethod,
        p.manualReceiptNo || '-',
        p.receivedByName || '-',
        p.verificationStatus,
        p.amountUsd || 0,
        p.officeLocation || office
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Exported ${filteredPayments.length} payments to CSV`);
  };

  const handleRecordPayment = async () => {
    setIsProcessing(true);

    // Validation: Stand is REQUIRED
    const hasStand = selectedStandId || standNumber;
    if (!hasStand) {
      toast.error('A stand must be selected or entered for every payment');
      setIsProcessing(false);
      return;
    }

    // Validation: Amount and receipt required
    if (amount <= 0 || !manualReceiptNo) {
      toast.error('Please provide Amount and Receipt Number');
      setIsProcessing(false);
      return;
    }

    // Validation: Cash payments must have receivedByName
    if (method === 'Cash' && !receivedByName.trim()) {
      toast.error('Please enter who received the cash payment');
      setIsProcessing(false);
      return;
    }
    
    const year = new Date().getFullYear();
    const officeCode = office === 'Harare' ? 'HRE' : 'BYO';
    const ref = `FC-${officeCode}-${year}-${Math.floor(Math.random() * 9000) + 1000}`;

    const newPayment: Payment = {
      id: Math.random().toString(36).substr(2, 9),
      clientId: selectedClient?.id || 'STAND-ONLY',
      clientName: selectedClient?.name || 'Stand Payment',
      standId: selectedStandId || standNumber,
      standNumber: standNumber || undefined,
      amountUsd: amount,
      surchargeAmount: surcharge,
      paymentMethod: method,
      paymentType: paymentType,
      officeLocation: office,
      reference: ref,
      manualReceiptNo: manualReceiptNo,
      description: description || `${paymentType} payment`,
      createdAt: new Date().toISOString(),
      verificationStatus: 'Pending',
      receivedByName: method === 'Cash' ? receivedByName : undefined
    };

    logger.info('Recording payment', {
      module: 'PaymentModule',
      selectedStandId,
      standNumber,
      paymentStandId: newPayment.standId,
      clientId: newPayment.clientId,
      clientName: newPayment.clientName
    });

    await savePayment(newPayment);
    
    // Auto-generate receipt after payment is recorded
    try {
      const receiptData = {
        clientId: selectedClient?.id || null,
        amount: amount + surcharge,
        paymentMethod: method,
        paymentType: paymentType,
        branch: office,
        receiptNumber: manualReceiptNo,
        paymentId: newPayment.id
      };
      
      const receiptRes = await fetch('/api/admin/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptData)
      });
      
      if (!receiptRes.ok) {
        const errorText = await receiptRes.text();
        logger.warn('Receipt auto-generation failed', { module: 'PaymentModule', error: errorText });
      }
    } catch (error) {
      logger.warn('Failed to auto-generate receipt', { module: 'PaymentModule', error });
    }
    
    setPayments([newPayment, ...payments]);
    
    setAmount(0);
    setPaymentType('Deposit');
    setStandNumber('');
    setManualReceiptNo('');
    setReceivedByName('');
    setDescription('');
    setClientSearch('');
    setSelectedClient(null);
    setSelectedStandId('');
    setIsModalOpen(false);
    setIsProcessing(false);

    // Dispatch global refresh event for all dashboards
    logger.info('Payment recorded successfully, triggering dashboard refresh', { module: 'PaymentModule', paymentId: newPayment.id });
    toast.success('Payment recorded successfully! Email confirmation sent to client.');
    dispatchPaymentRefresh('payment-recorded');
    
    // Call onPaymentComplete callback if in embedded mode
    if (onPaymentComplete) {
      onPaymentComplete();
    }
  };

  // Void payment handler
  const handleVoidPayment = async () => {
    if (!voidPaymentId) return;

    try {
      setIsVoiding(true);

      const res = await fetch('/api/admin/payments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: voidPaymentId, reason: voidReason })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to void payment');
      }

      // Update local state - mark as voided or remove
      setPayments(prev => prev.filter(p => p.id !== voidPaymentId));

      // Close modal
      setVoidModalOpen(false);
      setVoidPaymentId(null);
      setVoidReason('');
      
      toast.success('Payment voided successfully!');
      dispatchPaymentRefresh('payment-voided');

    } catch (err: any) {
      logger.error('Error voiding payment', err, { module: 'PaymentModule', paymentId: voidPaymentId });
      toast.error(err.message || 'Failed to void payment');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <PageContainer className="space-y-4 lg:space-y-6 animate-in fade-in duration-500">
      
      {/* Simplified Header - Hide in embedded mode */}
      {!embeddedMode && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Payment Center</h2>
              <p className="text-sm text-gray-500 mt-1">Record and track all payments</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-fcGold hover:bg-fcGold/[0.9] text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all"
            >
              <Plus size={20} />
              <span>New Payment</span>
            </button>
          </div>

          {/* Payment Metrics KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Payments</span>
                <DollarSign size={16} className="text-fcGold" />
              </div>
              <div className="text-2xl font-bold text-gray-900">${paymentMetrics.totalPayments.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-gray-500 mt-1">{payments.length} records</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Today</span>
                <Zap size={16} className="text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">${paymentMetrics.todayTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-gray-500 mt-1">Current date</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">This Month</span>
                <Calendar size={16} className="text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">${paymentMetrics.monthTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pending</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{paymentMetrics.pendingCount}</div>
              <p className="text-xs text-gray-500 mt-1">Awaiting verification</p>
            </div>
          </div>

          {/* Clean Payment Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <History size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-500">Showing {paginatedPayments.items.length} of {paginatedPayments.totalCount} payments</p>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              title="Export filtered payments to CSV"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
              >
                <option value="ALL">All Status</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">From Date</label>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => {
                  setDateFromFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">To Date</label>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => {
                  setDateToFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setDateFromFilter('');
                  setDateToFilter('');
                  setCurrentPage(1);
                }}
                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-600 uppercase">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Client</th>
                <th className="px-6 py-4 text-left">Stand</th>
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">Method</th>
                <th className="px-6 py-4 text-left">Receipt</th>
                <th className="px-6 py-4 text-left">Received By</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedPayments.items.length > 0 ? (
                 paginatedPayments.items.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                       <div className="text-sm font-medium text-gray-900">{new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                       <div className="text-xs text-gray-500">{p.officeLocation}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-fcGold/[0.1] flex items-center justify-center text-xs font-semibold text-fcGold">
                             {p.clientName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                             <div className="text-sm font-medium text-gray-900">{p.clientName}</div>
                             <div className="text-xs text-gray-500">ID: {p.clientId}</div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {p.stand ? (
                         <div className="space-y-1">
                           <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                             <Building2 size={14} className="text-fcGold" />
                             <span>{p.stand.standNumber}</span>
                           </div>
                           {p.stand.development && (
                             <div className="text-xs text-gray-500">
                               {p.stand.development.name}
                             </div>
                           )}
                         </div>
                       ) : p.standNumber ? (
                         <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                           <Building2 size={14} className="text-gray-400" />
                           <span>{p.standNumber}</span>
                         </div>
                       ) : (
                         <span className="text-xs text-gray-400">—</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                         {p.paymentType}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.paymentMethod === 'Bank' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                             {p.paymentMethod}
                          </span>
                          <div className="text-xs text-gray-500">{p.reference}</div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {p.manualReceiptNo ? (
                         <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                           <FileText size={14} className="text-gray-400" />
                           <span>{p.manualReceiptNo}</span>
                         </div>
                       ) : (
                         <span className="text-xs text-gray-400">—</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       {p.receivedByName ? (
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-fcGold/[0.1] text-fcGold border border-fcGold/[0.2]">
                           <ShieldCheck size={12} />
                           {p.receivedByName}
                         </span>
                       ) : (
                         <span className="text-xs text-gray-400">—</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                         p.verificationStatus === 'Verified' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                       }`}>
                          {p.verificationStatus === 'Verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {p.verificationStatus}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="space-y-1">
                          <div className="text-lg font-bold text-gray-900">${(p.amountUsd || 0).toLocaleString()}</div>
                          {Number(p.surchargeAmount || 0) > 0 && (
                            <div className="text-xs text-amber-600 font-medium">+${Number(p.surchargeAmount || 0).toFixed(2)} fee</div>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => generateReceipt(p, p.clientName || 'Client')}
                              className="text-xs text-fcGold hover:underline font-medium"
                            >
                              Download Receipt
                            </button>
                            <button 
                              onClick={() => {
                                setVoidPaymentId(p.id);
                                setVoidModalOpen(true);
                              }}
                              className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1"
                              title="Void Payment"
                            >
                              <Ban size={12} />
                              Void
                            </button>
                          </div>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                     <div className="flex flex-col items-center gap-4 text-gray-400">
                        <Landmark size={48} />
                        <p className="text-sm font-medium">
                          {filteredPayments.length === 0 && (statusFilter !== 'ALL' || dateFromFilter || dateToFilter)
                            ? 'No payments match your filters'
                            : 'No payments recorded yet'
                          }
                        </p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {paginatedPayments.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Showing <span className="font-semibold">{((paginatedPayments.currentPage - 1) * paginatedPayments.pageSize) + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(paginatedPayments.currentPage * paginatedPayments.pageSize, paginatedPayments.totalCount)}
              </span>{' '}
              of <span className="font-semibold">{paginatedPayments.totalCount}</span> payments
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: paginatedPayments.totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-fcGold text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(paginatedPayments.totalPages, currentPage + 1))}
                disabled={currentPage === paginatedPayments.totalPages}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Simplified Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/[0.5]" onClick={() => (!isProcessing && setIsModalOpen(false))} />
           <div className="relative bg-white w-full max-w-full sm:max-w-2xl xl:max-w-3xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
              
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-fcGold/[0.1] rounded-lg">
                      <Wallet size={24} className="text-fcGold" />
                   </div>
                   <div>
                      <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
                      <p className="text-sm text-gray-500">Enter payment details</p>
                   </div>
                </div>
                <button onClick={() => !isProcessing && setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                 
                 {/* Prefilled Stand Info Banner */}
                 {prefilledStand && (
                   <div className="bg-gradient-to-r from-fcGold/10 to-amber-50 rounded-xl p-5 border-2 border-fcGold/30">
                     <div className="flex items-start gap-4">
                       <div className="p-3 bg-fcGold/20 rounded-xl">
                         <Building2 size={24} className="text-fcGold" />
                       </div>
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className="text-lg font-bold text-gray-900">Selling Stand {prefilledStand.number}</h4>
                           <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                             {prefilledStand.status}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600 mb-2">{prefilledStand.developmentName}</p>
                         <div className="flex items-center gap-4 text-sm">
                           <div className="flex items-center gap-1.5">
                             <DollarSign size={16} className="text-fcGold" />
                             <span className="font-bold text-gray-900">${prefilledStand.priceUsd.toLocaleString()}</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                             <MapPin size={16} className="text-gray-500" />
                             <span className="text-gray-600">{prefilledStand.areaSqm}m²</span>
                           </div>
                         </div>
                       </div>
                     </div>
                     <div className="mt-3 pt-3 border-t border-fcGold/20">
                       <p className="text-xs text-gray-600 font-medium">
                         💡 <strong>Quick Sell Mode:</strong> Select or create a client below to complete this sale
                       </p>
                     </div>
                   </div>
                 )}

                 {/* Client Search */}
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search Client</label>
                    <div className="relative">
                       <Search size={18} className="absolute left-4 top-[50%] -translate-y-[50%] text-gray-400" />
                       <input 
                         type="text"
                         value={clientSearch}
                         onChange={(e) => {
                           setClientSearch(e.target.value);
                           setSelectedClient(null);
                         }}
                         placeholder="Search by name, email or phone..."
                         className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                       />
                       {clientSearch && !selectedClient && filteredClients.length > 0 && (
                         <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                            {filteredClients.map(c => (
                              <button 
                                key={c.id} 
                                onClick={() => handleClientSelect(c)}
                                className="w-full text-left p-4 hover:bg-gray-50 border-b last:border-0 border-gray-100 flex justify-between items-center"
                              >
                                <div className="flex items-center gap-3">
                                   <span className="text-sm font-medium text-gray-900">{c.name}</span>
                                   <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                     c.branch === 'Harare' ? 'bg-gray-100 text-gray-700' : 'bg-fcGold/[0.1] text-fcGold'
                                   }`}>
                                     {c.branch}
                                   </span>
                                   {c.isPortalUser && (
                                       <ShieldCheck size={14} className="text-green-500" />
                                     )}
                                  </div>
                                  <span className="text-xs text-gray-500">{c.phone}</span>
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Payment Details */}
                 <div className="space-y-6 border-t border-gray-200 pt-6">
                    <h4 className="text-sm font-semibold text-gray-900">Payment Details</h4>

                    {/* Stand Selection Dropdown */}
                    {selectedClient && availableStands.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Stand <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Building2 size={18} className="absolute left-4 top-[50%] -translate-y-[50%] text-gray-400" />
                          <select
                            value={selectedStandId}
                            onChange={(e) => setSelectedStandId(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                          >
                            <option value="">Choose a stand...</option>
                            {availableStands.map(stand => (
                              <option key={stand.id} value={stand.id}>
                                {stand.number} - {stand.developmentName} ({stand.status})
                              </option>
                            ))}
                          </select>
                        </div>
                        {loadingStands && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            Loading client stands...
                          </p>
                        )}
                      </div>
                    )}

                    {/* Manual Stand Number (fallback for non-client payments) */}
                    {!selectedClient && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Stand Number <span className="text-gray-400">(if no client selected)</span>
                        </label>
                        <div className="relative">
                          <Building2 size={18} className="absolute left-4 top-[50%] -translate-y-[50%] text-gray-400" />
                          <input 
                            type="text"
                            value={standNumber}
                            onChange={(e) => setStandNumber(e.target.value)}
                            placeholder="e.g. SL001, BB025"
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Payment Type and Amount Row */}
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
                          <select 
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value as any)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                          >
                            <option value="Deposit">Deposit</option>
                            <option value="Installment">Installment</option>
                            <option value="Agreement of Sale Fee">Agreement of Sale Fee</option>
                            <option value="Endowment Fees">Endowment Fees</option>
                            <option value="VAT Fees">VAT Fees</option>
                          </select>
                       </div>

                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
                          <input 
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                            placeholder="0.00"
                          />
                       </div>
                    </div>

                    {/* Payment Method and Branch Row */}
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                          <select 
                            value={method}
                            onChange={(e) => setMethod(e.target.value as any)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank (5% Charge)</option>
                          </select>
                       </div>

                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                          <div className="flex gap-2">
                            {(['Harare', 'Bulawayo'] as Branch[]).map(branch => (
                              <button
                                key={branch}
                                onClick={() => setOffice(branch)}
                                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                  office === branch ? 'bg-fcGold text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {branch}
                              </button>
                            ))}
                          </div>
                       </div>
                    </div>

                    {/* Bank Surcharge Warning */}
                    {method === 'Bank' && amount > 0 && (
                       <div className="flex items-center justify-between bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                          <div className="flex items-center gap-2">
                             <AlertCircle size={16} className="text-amber-600" />
                             <span className="text-sm font-medium text-amber-900">5% Bank Transfer Charge</span>
                          </div>
                          <span className="text-lg font-bold text-amber-600">+${surcharge.toFixed(2)}</span>
                       </div>
                    )}

                    {/* Receipt Number */}
                    <div>
                       <label className="block text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                         <Hash size={16} />
                         Manual Receipt Number (Required)
                       </label>
                       <input 
                         type="text"
                         value={manualReceiptNo}
                         onChange={(e) => setManualReceiptNo(e.target.value)}
                         placeholder="e.g. REC-HRE-2026-001"
                         required
                         className="w-full px-4 py-3 border-2 border-fcGold rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                       />
                    </div>

                    {/* Cash Receiver */}
                    {method === 'Cash' && (
                       <div className="bg-fcGold/[0.05] p-4 rounded-xl border border-fcGold/[0.2]">
                          <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <User size={16} className="text-fcGold" />
                            Who Received Cash (Required)
                          </label>
                          <input 
                            type="text"
                            value={receivedByName}
                            onChange={(e) => setReceivedByName(e.target.value)}
                            placeholder="Enter staff member name"
                            required
                            className="w-full px-4 py-3 border-2 border-fcGold rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none"
                          />
                       </div>
                    )}

                    {/* Optional Notes */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                       <textarea 
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         placeholder="Any additional payment notes..."
                         rows={2}
                         className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none resize-none"
                       />
                    </div>
                 </div>

                 {/* Submit Section */}
                 <div className="border-t border-gray-200 pt-6 space-y-4">
                    {/* Validation Message */}
                    {(!selectedStandId && !standNumber) && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                        <span className="text-sm text-red-700 font-medium">
                          A stand must be selected or entered for this payment
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                       <span className="text-sm font-medium text-gray-600">Total Amount</span>
                       <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">${totalToPay.toLocaleString()}</div>
                          {surcharge > 0 && (
                            <div className="text-xs text-amber-600 font-medium">Includes ${surcharge.toFixed(2)} bank fee</div>
                          )}
                       </div>
                    </div>
                    <button 
                      onClick={handleRecordPayment}
                      disabled={
                        isProcessing || 
                        (!selectedStandId && !standNumber) || 
                        amount <= 0 || 
                        !manualReceiptNo ||
                        (method === 'Cash' && !receivedByName.trim())
                      }
                      className="w-full bg-fcGold hover:bg-fcGold/[0.9] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-all\"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={20} />
                          <span>Record Payment</span>
                        </>
                      )}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Void Payment Modal */}
      {voidModalOpen && voidPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/[0.5]" onClick={() => !isVoiding && setVoidModalOpen(false)} />
           <div className="relative bg-white w-full max-w-full sm:max-w-md rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 bg-red-50">
                <div className="p-2 bg-red-100 rounded-lg">
                   <Ban size={20} className="text-red-600" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-gray-900">Void Payment</h3>
                   <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <p className="text-gray-600">
                  Are you sure you want to void this payment? The payment will be marked as voided and will no longer count towards client totals.
                </p>
                
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Reason for voiding (optional)</label>
                   <textarea 
                     value={voidReason}
                     onChange={(e) => setVoidReason(e.target.value)}
                     placeholder="Enter reason for voiding this payment..."
                     rows={3}
                     className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                   />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button 
                  onClick={() => {
                    setVoidModalOpen(false);
                    setVoidPaymentId(null);
                    setVoidReason('');
                  }}
                  disabled={isVoiding}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleVoidPayment}
                  disabled={isVoiding}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  {isVoiding ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Voiding...</span>
                    </>
                  ) : (
                    <>
                      <Ban size={16} />
                      <span>Void Payment</span>
                    </>
                  )}
                </button>
              </div>
           </div>
        </div>
      )}
    </PageContainer>
  );
};
