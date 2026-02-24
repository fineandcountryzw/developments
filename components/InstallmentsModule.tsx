'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar, DollarSign, Download, Clock, CheckCircle2, History, 
  User, Info, ArrowRight, Loader2, FileText, Hash, Search, Plus, X, 
  MapPin, AlertCircle, Building2, CreditCard, Receipt, Eye, CalendarDays,
  TrendingUp, PieChart, Filter, ChevronDown, ChevronUp, Printer, Trash2
} from 'lucide-react';
import { Branch } from '../types';
import { dispatchPaymentRefresh } from '../hooks/usePaymentRefresh';
import { logger } from '@/lib/logger';
import { cachedFetch } from '@/lib/api-cache';
import { useDebounce } from '@/hooks/useDebounce';

// Types for installment system
interface InstallmentPlan {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  developmentId: string;
  developmentName: string;
  standId?: string;
  standNumber?: string;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt?: string;
  periodMonths: number;
  monthlyAmount: number;
  paidAmount: number;
  balance: number;
  nextDueDate?: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
  installments: Installment[];
  receipts: ReceiptSummary[];
  createdAt: string;
  updatedAt: string;
  _warnings?: string[]; // Validation warnings for inconsistencies
}

interface Installment {
  id: string;
  installmentPlanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  paymentId?: string;
  receiptId?: string;
}

interface ReceiptSummary {
  id: string;
  receiptNumber: string;
  amount: number;
  createdAt: string;
  type: string;
}

interface Development {
  id: string;
  name: string;
  installment_periods?: number[];
  deposit_percentage?: number;
  base_price?: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export const InstallmentsModule: React.FC<{ activeBranch?: Branch }> = ({ activeBranch = 'Harare' }) => {
  const { data: session } = useSession();
  const userRole = session?.user?.role?.toUpperCase() || 'CLIENT';
  const isReadOnly = userRole === 'ACCOUNT'; // Accountant is read-only

  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [developmentFilter, setDevelopmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Create plan modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDevelopment, setSelectedDevelopment] = useState<Development | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedStand, setSelectedStand] = useState<{ id: string; standNumber: string; price: number } | null>(null);
  const [availableStands, setAvailableStands] = useState<{ id: string; standNumber: string; price: number }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(12);
  const [planAmount, setPlanAmount] = useState<number>(0);
  const [clientSearch, setClientSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);
  
  // View plan modal
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'DEPOSIT' | 'INSTALLMENT'>('DEPOSIT');
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Delete/cancel modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [activeBranch]);

  // Fetch stands when development is selected
  useEffect(() => {
    const fetchStands = async () => {
      if (selectedDevelopment?.id) {
        try {
          const res = await fetch(`/api/admin/stands?developmentId=${selectedDevelopment.id}`);
          if (res.ok) {
            const data = await res.json();
            // Handle nested response format from apiSuccess
            const standsData = Array.isArray(data.data) ? data.data : 
                              (data.data?.data && Array.isArray(data.data.data)) ? data.data.data : [];
            const stands = standsData.map((s: any) => ({
              id: s.id,
              standNumber: s.standNumber,
              price: Number(s.price) || 0
            }));
            setAvailableStands(stands);
          }
        } catch (err) {
          logger.error('Error fetching stands', err instanceof Error ? err : undefined, { module: 'InstallmentsModule' });
        }
      } else {
        setAvailableStands([]);
        setSelectedStand(null);
      }
    };
    fetchStands();
  }, [selectedDevelopment]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate activeBranch before making API calls
      const validBranches = ['Harare', 'Bulawayo'];
      const branch = activeBranch && validBranches.includes(activeBranch) ? activeBranch : 'Harare';
      
      logger.debug('Fetching data for branch', { module: 'InstallmentsModule', branch });
      
      // Fetch installment plans with caching
      const plansData = await cachedFetch<{ data: InstallmentPlan[]; error?: string }>(
        `/api/admin/installments?branch=${encodeURIComponent(branch)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      
      if (plansData.error) {
        throw new Error(plansData.error);
      }
      
      // Validate response structure
      if (!plansData || typeof plansData !== 'object') {
        logger.error('Invalid plans data structure', undefined, { module: 'InstallmentsModule', plansData });
        throw new Error('Invalid data format received from server');
      }
      
      setPlans(plansData.data || []);
      logger.info('Successfully loaded installment plans', { 
        module: 'InstallmentsModule', 
        count: (plansData.data || []).length 
      });
      
      // Fetch developments with caching
      try {
        const devsData = await cachedFetch<{ data: any[]; developments?: any[] }>('/api/admin/developments', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        setDevelopments(devsData.data || devsData.developments || []);
      } catch (err) {
        logger.error('Failed to fetch developments', err instanceof Error ? err : undefined, { module: 'InstallmentsModule' });
        setDevelopments([]);
      }
      
      // Fetch clients with caching
      try {
        const clientsData = await cachedFetch<{ data: any[] }>('/api/admin/clients', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        setClients(clientsData.data || []);
      } catch (err) {
        logger.error('Failed to fetch clients', err instanceof Error ? err : undefined, { module: 'InstallmentsModule' });
        setClients([]);
      }
      
    } catch (err: any) {
      logger.error('Error fetching data', err, {
        module: 'InstallmentsModule',
        message: err.message,
        name: err.name,
      });
      
      // Check for network errors (CORS, connection issues)
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to load data. Please refresh the page or contact support.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Filter plans (using debounced search query)
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      if (statusFilter !== 'ALL' && plan.status !== statusFilter) return false;
      if (developmentFilter !== 'ALL' && plan.developmentId !== developmentFilter) return false;
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        if (!plan.clientName?.toLowerCase().includes(query) && 
            !plan.clientEmail?.toLowerCase().includes(query) &&
            !plan.standNumber?.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [plans, statusFilter, developmentFilter, debouncedSearchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const total = plans.length;
    const active = plans.filter(p => p.status === 'ACTIVE').length;
    const completed = plans.filter(p => p.status === 'COMPLETED').length;
    const defaulted = plans.filter(p => p.status === 'DEFAULTED').length;
    const totalValue = plans.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalPaid = plans.reduce((sum, p) => sum + p.paidAmount, 0);
    const totalBalance = plans.reduce((sum, p) => sum + p.balance, 0);
    
    return { total, active, completed, defaulted, totalValue, totalPaid, totalBalance };
  }, [plans]);

  // Filter clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => 
      c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(clientSearch.toLowerCase())
    ).slice(0, 5);
  }, [clients, clientSearch]);

  // Create new plan
  const handleCreatePlan = async () => {
    if (!selectedDevelopment || !selectedClient || !selectedStand || !planAmount) {
      alert('Please fill in all required fields (Development, Client, Stand, and Amount)');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const res = await fetch('/api/admin/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          standId: selectedStand.id,
          developmentId: selectedDevelopment.id,
          totalAmount: planAmount,
          periodMonths: selectedPeriod,
          branch: activeBranch
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create plan');
      }
      
      const data = await res.json();
      setPlans(prev => [data.data, ...prev]);
      setIsCreateModalOpen(false);
      resetCreateForm();
      
    } catch (err: any) {
      logger.error('Error creating plan', err, { module: 'InstallmentsModule' });
      alert(err.message || 'Failed to create installment plan');
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedDevelopment(null);
    setSelectedClient(null);
    setSelectedStand(null);
    setSelectedPeriod(12);
    setPlanAmount(0);
    setClientSearch('');
    setPriceWarning(null);
  };

  // Validate plan amount against stand price
  useEffect(() => {
    if (selectedStand && planAmount > 0) {
      const standPrice = selectedStand.price;
      const difference = Math.abs(standPrice - planAmount);
      const tolerance = 0.01;
      
      if (difference > tolerance) {
        setPriceWarning(`Warning: Amount ($${planAmount.toLocaleString()}) does not match stand price ($${standPrice.toLocaleString()}). Stand price is the source of truth.`);
      } else {
        setPriceWarning(null);
      }
    } else {
      setPriceWarning(null);
    }
  }, [selectedStand, planAmount]);

  // Process payment
  const handleProcessPayment = async () => {
    if (!selectedPlan || paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    
    setIsProcessingPayment(true);
    
    try {
      const action = paymentType === 'DEPOSIT' ? 'PAY_DEPOSIT' : 'PAY_INSTALLMENT';
      
      const res = await fetch(`/api/admin/installments/${selectedPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          amount: paymentAmount,
          method: paymentMethod,
          reference: paymentReference,
          installmentId: selectedInstallment?.id
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process payment');
      }
      
      const data = await res.json();
      
      // Handle nested response format from apiSuccess
      const planData = data.data?.data || data.data;
      
      // Update plan in list
      if (planData && planData.id) {
        setPlans(prev => prev.map(p => p.id === planData.id ? planData : p));
        setSelectedPlan(planData);
      }
      
      // Close payment modal
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentReference('');
      setSelectedInstallment(null);
      
      // Dispatch payment refresh event to update all dashboards
      dispatchPaymentRefresh('payment-recorded');
      
      alert('Payment processed successfully!');
      
    } catch (err: any) {
      logger.error('Error processing payment', err, { module: 'InstallmentsModule' });
      alert(err.message || 'Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Delete/Cancel plan
  const handleDeletePlan = async () => {
    if (!deletePlanId) return;

    try {
      setIsDeleting(true);

      const res = await fetch('/api/admin/installments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletePlanId, reason: deleteReason })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete plan');
      }

      // Remove from list
      setPlans(prev => prev.filter(p => p.id !== deletePlanId));
      
      // Close modals
      setIsDeleteModalOpen(false);
      setDeletePlanId(null);
      setDeleteReason('');
      setIsViewModalOpen(false);
      setSelectedPlan(null);
      
      alert('Installment plan deleted/cancelled successfully!');
      
    } catch (err: any) {
      logger.error('Error deleting plan', err, { module: 'InstallmentsModule' });
      alert(err.message || 'Failed to delete plan');
    } finally {
      setIsDeleting(false);
    }
  };

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
      logger.error('Error downloading receipt', err, { module: 'InstallmentsModule', receiptId });
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'DEFAULTED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading installment plans...</span>
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
          onClick={fetchData}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Installment Plans</h1>
          <p className="text-gray-600">
            {isReadOnly ? 'View payment plans and installment progress (Read-Only)' : 'Manage payment plans and track installment progress'}
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FileText className="w-4 h-4" />
            Total Plans
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-blue-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            Active
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Total Collected
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalPaid)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <Clock className="w-4 h-4" />
            Outstanding
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.totalBalance)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client, email, or stand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="DEFAULTED">Defaulted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        
        <select
          value={developmentFilter}
          onChange={(e) => setDevelopmentFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Developments</option>
          {developments.map(dev => (
            <option key={dev.id} value={dev.id}>{dev.name}</option>
          ))}
        </select>
      </div>

      {/* Plans List */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="w-full min-w-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Client</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Development</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Period</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Paid</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Balance</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No installment plans found
                </td>
              </tr>
            ) : (
              filteredPlans.map(plan => (
                <tr key={plan.id} className={`hover:bg-gray-50 ${plan._warnings && plan._warnings.length > 0 ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{plan.clientName}</div>
                    <div className="text-sm text-gray-500">{plan.clientEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{plan.developmentName}</div>
                    {plan.standNumber && (
                      <div className="text-sm text-gray-500">Stand: {plan.standNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{plan.periodMonths} months</div>
                    <div className="text-sm text-gray-500">{formatCurrency(plan.monthlyAmount)}/mo</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(plan.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {formatCurrency(plan.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {formatCurrency(plan.balance)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                      {plan._warnings && plan._warnings.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-amber-600" title={plan._warnings.join('; ')}>
                          <AlertCircle className="w-3 h-3" />
                          <span>{plan._warnings.length} warning{plan._warnings.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsViewModalOpen(true);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            setSelectedPlan(plan);
                            setPaymentType(plan.depositPaid ? 'INSTALLMENT' : 'DEPOSIT');
                            setPaymentAmount(plan.depositPaid ? plan.monthlyAmount : plan.depositAmount);
                            setIsPaymentModalOpen(true);
                          }}
                          className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Record Payment"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}
                      {!isReadOnly && plan.status !== 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setDeletePlanId(plan.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Cancel/Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Create Plan Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Installment Plan</h2>
                <button 
                  onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Development Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Development *
                </label>
                <select
                  value={selectedDevelopment?.id || ''}
                  onChange={(e) => {
                    const dev = developments.find(d => d.id === e.target.value);
                    setSelectedDevelopment(dev || null);
                    if (dev) {
                      setPlanAmount(dev.base_price || 0);
                      const periods = dev.installment_periods || [12, 24, 48];
                      if (!periods.includes(selectedPeriod)) {
                        setSelectedPeriod(periods[0]);
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Development</option>
                  {developments.map(dev => (
                    <option key={dev.id} value={dev.id}>{dev.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Client Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for client..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      if (!e.target.value) setSelectedClient(null);
                    }}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {filteredClients.length > 0 && !selectedClient && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-48 overflow-y-auto">
                      {filteredClients.map(client => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch(client.name);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stand Selection */}
              {selectedDevelopment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stand *
                  </label>
                  <select
                    value={selectedStand?.id || ''}
                    onChange={(e) => {
                      const stand = availableStands.find(s => s.id === e.target.value);
                      if (stand) {
                        setSelectedStand(stand);
                        setPlanAmount(stand.price); // Auto-populate with stand price
                      } else {
                        setSelectedStand(null);
                        setPlanAmount(0);
                      }
                    }}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!selectedDevelopment || availableStands.length === 0}
                  >
                    <option value="">Select Stand</option>
                    {availableStands.map(stand => (
                      <option key={stand.id} value={stand.id}>
                        {stand.standNumber} - ${stand.price.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {availableStands.length === 0 && selectedDevelopment && (
                    <p className="text-xs text-gray-500 mt-1">No stands available for this development</p>
                  )}
                </div>
              )}
              
              {/* Period Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Period *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(selectedDevelopment?.installment_periods || [12, 24, 48]).map(period => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-4 py-2 border rounded-lg text-center transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {period} months
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Total Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount (USD) *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={planAmount}
                    onChange={(e) => setPlanAmount(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      priceWarning ? 'border-amber-300 bg-amber-50' : ''
                    }`}
                    min="0"
                    step="0.01"
                    disabled={!!selectedStand} // Disable if stand is selected (price is auto-populated)
                  />
                </div>
                {priceWarning && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {priceWarning}
                  </p>
                )}
                {selectedStand && !priceWarning && (
                  <p className="text-xs text-green-600 mt-1">✓ Amount matches stand price</p>
                )}
              </div>
              
              {/* Plan Summary */}
              {planAmount > 0 && selectedPeriod && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-gray-900">Plan Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Deposit ({selectedDevelopment?.deposit_percentage || 30}%):</div>
                    <div className="text-right font-medium">
                      {formatCurrency(planAmount * ((selectedDevelopment?.deposit_percentage || 30) / 100))}
                    </div>
                    <div className="text-gray-600">Monthly Payment:</div>
                    <div className="text-right font-medium">
                      {formatCurrency((planAmount * (1 - (selectedDevelopment?.deposit_percentage || 30) / 100)) / selectedPeriod)}
                    </div>
                    <div className="text-gray-600">Total Payments:</div>
                    <div className="text-right font-medium">{selectedPeriod + 1}</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={isCreating || !selectedDevelopment || !selectedClient || !selectedStand || !planAmount || !!priceWarning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Plan Modal */}
      {isViewModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Installment Plan Details</h2>
                  <p className="text-gray-500">{selectedPlan.clientName}</p>
                </div>
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Validation Warnings */}
              {selectedPlan._warnings && selectedPlan._warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-900 mb-2">Validation Warnings</h4>
                      <ul className="space-y-1">
                        {selectedPlan._warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm text-amber-800">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Total Amount</div>
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(selectedPlan.totalAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Paid Amount</div>
                  <div className="text-lg font-bold text-green-600">{formatCurrency(selectedPlan.paidAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Balance</div>
                  <div className="text-lg font-bold text-amber-600">{formatCurrency(selectedPlan.balance)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPlan.status)}`}>
                    {selectedPlan.status}
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Payment Progress</span>
                  <span className="font-medium">{Math.round((selectedPlan.paidAmount / selectedPlan.totalAmount) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (selectedPlan.paidAmount / selectedPlan.totalAmount) * 100)}%` }}
                  />
                </div>
              </div>
              
              {/* Deposit Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Deposit</div>
                    <div className="text-sm text-gray-500">{formatCurrency(selectedPlan.depositAmount)}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedPlan.depositPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedPlan.depositPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
              
              {/* Installments Schedule */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Payment Schedule</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedPlan.installments?.map(installment => (
                    <div 
                      key={installment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          installment.status === 'PAID' ? 'bg-green-100 text-green-800' :
                          installment.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {installment.installmentNumber}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{formatCurrency(installment.amount)}</div>
                          <div className="text-sm text-gray-500">Due: {formatDate(installment.dueDate)}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(installment.status)}`}>
                        {installment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Receipts */}
              {selectedPlan.receipts && selectedPlan.receipts.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Receipts</h3>
                  <div className="space-y-2">
                    {selectedPlan.receipts.map(receipt => (
                      <div 
                        key={receipt.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{receipt.receiptNumber}</div>
                          <div className="text-sm text-gray-500">
                            {receipt.type} • {formatDate(receipt.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{formatCurrency(receipt.amount)}</span>
                          <button
                            onClick={() => handleDownloadReceipt(receipt.id)}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Download Receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              {!isReadOnly && selectedPlan.status !== 'COMPLETED' && selectedPlan.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    setPaymentType(selectedPlan.depositPaid ? 'INSTALLMENT' : 'DEPOSIT');
                    setPaymentAmount(selectedPlan.depositPaid ? selectedPlan.monthlyAmount : selectedPlan.depositAmount);
                    setIsPaymentModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Payment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPaymentType('DEPOSIT');
                      setPaymentAmount(selectedPlan.depositAmount);
                    }}
                    disabled={selectedPlan.depositPaid}
                    className={`px-4 py-2 border rounded-lg text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      paymentType === 'DEPOSIT'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => {
                      setPaymentType('INSTALLMENT');
                      setPaymentAmount(selectedPlan.monthlyAmount);
                    }}
                    disabled={!selectedPlan.depositPaid}
                    className={`px-4 py-2 border rounded-lg text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      paymentType === 'INSTALLMENT'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    Installment
                  </button>
                </div>
              </div>
              
              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="EcoCash">EcoCash</option>
                  <option value="Mukuru">Mukuru</option>
                </select>
              </div>
              
              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction reference..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={isProcessingPayment || paymentAmount <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation Modal */}
      {isDeleteModalOpen && deletePlanId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Cancel/Delete Plan</h2>
                  <p className="text-sm text-gray-500">This action cannot be easily undone</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Are you sure you want to cancel this installment plan? If payments have been made, the plan will be marked as cancelled. Otherwise it will be deleted.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletePlanId(null);
                  setDeleteReason('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlan}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallmentsModule;
