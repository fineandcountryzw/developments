'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePaymentRefresh } from '@/hooks/usePaymentRefresh';
import { DashboardHeader, DashboardTabs, KPICard, StatusBadge, type TabItem } from '@/components/dashboards/shared';
import { DeveloperInventoryTab } from '@/components/dashboards/developer/InventoryTab';
import { PageContainer, KPIGrid } from '@/components/layouts';
import { ContractViewer } from '@/components/ContractViewer';
import BackupDashboard from '@/components/dashboards/BackupDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  MapPin, TrendingUp, DollarSign, Users, FileText,
  Calendar, ChevronRight, Download, Home, PieChart, BarChart3, Eye, 
  CheckCircle2, Clock, AlertCircle, Wallet, CreditCard, ArrowUpRight, 
  ArrowDownRight, Filter, RefreshCw, Database, HardDrive, CloudUpload, 
  CalendarDays, Banknote, Trash2, X, Search, Package, Tag, AlertTriangle, Bell
} from 'lucide-react';

interface DevelopmentSummary {
  id: string;
  name: string;
  location: string;
  totalStands: number;
  soldStands: number;
  reservedStands: number;
  availableStands: number;
  totalRevenue: number;
  pendingPayments: number;
  commissionDue: number;
  lastSaleDate: string | null;
}

interface PaymentRecord {
  id: string;
  date: string;
  developmentName: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  type?: 'PAYOUT';
  status?: 'CLEARED' | 'PENDING' | 'PROCESSING';
}

interface ChartDataPoint {
  month: string;
  revenue: number;
  standsSold: number;
}

interface Buyer {
  name: string;
  email: string;
  purchaseCount: number;
  totalSpent: number;
  standNumbers: Array<{ number: string; development: string; price: number }>;
}

interface Stand {
  id: string;
  standNumber: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
  price: number;
  sizeSqm?: number;
  development?: {
    id: string;
    name: string;
    location: string;
  };
}

interface DeveloperStats {
  totalDevelopments: number;
  totalStands: number;
  totalSold: number;
  totalRevenue: number;
  pendingPayouts: number;
  thisMonthSales: number;
  lastMonthSales: number;
  averagePricePerStand: number;
  expectedRevenueThisMonth: number;
  expectedInstallmentsThisMonth: number;
  projectedMonthlyRevenue: number;
}

export function DeveloperDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [developments, setDevelopments] = useState<DevelopmentSummary[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<DeveloperStats | null>(null);
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [error, setError] = useState<string | null>(null);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'developments' | 'payments' | 'backup' | 'contracts' | 'inventory'>('overview');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [showBuyersModal, setShowBuyersModal] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Inventory state
  const [inventoryData, setInventoryData] = useState<{
    stands: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: { total: number; available: number; reserved: number; sold: number; blocked: number };
  }>({
    stands: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    summary: { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 }
  });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryFilters, setInventoryFilters] = useState({
    developmentId: '',
    status: '',
    search: '',
    sortBy: 'standNumber' as 'standNumber' | 'sizeSqm' | 'price' | 'updatedAt' | 'status',
    sortOrder: 'asc' as 'asc' | 'desc',
  });
  
  // Contracts state
  const [contractsData, setContractsData] = useState<{
    contracts: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: { total: number; draft: number; sent: number; signed: number; totalValue: number; totalPaid: number };
  }>({
    contracts: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    summary: { total: 0, draft: 0, sent: 0, signed: 0, totalValue: 0, totalPaid: 0 }
  });
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractPage, setContractPage] = useState(1);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  
  // Stand management state
  const [showStandModal, setShowStandModal] = useState(false);
  const [selectedDevelopmentForStands, setSelectedDevelopmentForStands] = useState<string | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [standsLoading, setStandsLoading] = useState(false);
  const [standSearchQuery, setStandSearchQuery] = useState('');
  const [standToRemove, setStandToRemove] = useState<Stand | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [clientName, setClientName] = useState('');
  const [salePrice, setSalePrice] = useState('');

  useEffect(() => {
    fetchDeveloperData();
    fetchChartData();
    fetchPayments(); // Fetch payments for Overview sidebar
  }, [dateFilter]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    } else if (activeTab === 'contracts') {
      fetchContracts();
    } else if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [activeTab, contractPage, inventoryPage]);

  // Listen for payment refresh events and auto-refresh dashboard
  usePaymentRefresh(() => fetchDeveloperData(), [dateFilter]);

  const fetchDeveloperData = async () => {
    if (!loading) setRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      // Fetch developments from API
      const devResponse = await fetch(`/api/developer/developments?period=${dateFilter}`);
      const devData = await devResponse.json();
      
      console.log('[DeveloperDashboard] API Response:', devData);
      
      if (devData.error) {
        throw new Error(devData.error);
      }
      
      if (devData.developments && devData.developments.length > 0) {
        setDevelopments(devData.developments);
        console.log('[DeveloperDashboard] Loaded developments:', devData.developments.length);
      } else {
        setDevelopments([]);
      }
      
      if (devData.stats) {
        setStats(devData.stats);
      }
    } catch (err: any) {
      console.error('Error fetching developer data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      let startDate = new Date();
      switch (dateFilter) {
        case '7d': startDate.setDate(startDate.getDate() - 7); break;
        case '30d': startDate.setDate(startDate.getDate() - 30); break;
        case '90d': startDate.setDate(startDate.getDate() - 90); break;
        case 'all': startDate = new Date('2000-01-01'); break;
      }
      const startDateStr = startDate.toISOString().split('T')[0];

      const response = await fetch(`/api/developer/payments?startDate=${startDateStr}&endDate=${endDate}&limit=50`);
      const data = await response.json();
      
      if (data.payments) {
        const mapped: PaymentRecord[] = data.payments.map((p: any) => ({
          id: p.id,
          date: p.payment_date,
          developmentName: p.development_name || 'Unknown',
          amount: p.amount,
          paymentMethod: p.payment_method,
          referenceNumber: p.reference_number,
          type: 'PAYOUT' as const,
          status: 'CLEARED' as const
        }));
        setRecentPayments(mapped);
      }
    } catch (err: any) {
      console.error('Error fetching payments:', err);
    }
  };

  const fetchContracts = async () => {
    setContractsLoading(true);
    try {
      const params = new URLSearchParams({
        page: contractPage.toString(),
        limit: '50'
      });

      const response = await fetch(`/api/developer/contracts?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('Failed to fetch contracts:', errorData.error || errorData.message || `HTTP ${response.status}`);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success && data.data) {
        setContractsData({
          contracts: data.data.contracts || [],
          pagination: data.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
          summary: data.data.summary || { total: 0, draft: 0, sent: 0, signed: 0, totalValue: 0, totalPaid: 0 }
        });
      } else {
        console.error('Failed to fetch contracts:', data.error || data.message);
        setContractsData({
          contracts: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          summary: { total: 0, draft: 0, sent: 0, signed: 0, totalValue: 0, totalPaid: 0 }
        });
      }
    } catch (err: any) {
      console.error('Error fetching contracts:', err);
      setContractsData({
        contracts: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        summary: { total: 0, draft: 0, sent: 0, signed: 0, totalValue: 0, totalPaid: 0 }
      });
    } finally {
      setContractsLoading(false);
    }
  };

  const fetchInventory = async () => {
    setInventoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: inventoryPage.toString(),
        pageSize: '50',
        sortBy: inventoryFilters.sortBy,
        sortOrder: inventoryFilters.sortOrder,
      });

      if (inventoryFilters.developmentId) params.append('developmentId', inventoryFilters.developmentId);
      if (inventoryFilters.status) params.append('status', inventoryFilters.status);
      if (inventoryFilters.search) params.append('search', inventoryFilters.search);

      const response = await fetch(`/api/stands/inventory?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('Failed to fetch inventory:', errorData.error || errorData.message || `HTTP ${response.status}`);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        setInventoryData({
          stands: data.stands || [],
          pagination: data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
          summary: data.summary || { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 }
        });
      } else {
        console.error('Failed to fetch inventory:', data.error || data.message);
        setInventoryData({
          stands: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          summary: { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 }
        });
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setInventoryData({
        stands: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        summary: { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 }
      });
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const period = dateFilter === '7d' ? '3m' : dateFilter === '30d' ? '6m' : dateFilter === '90d' ? '12m' : '12m';
      const response = await fetch(`/api/developer/chart-data?period=${period}`);
      const data = await response.json();
      if (data.success && data.data) {
        setChartData(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching chart data:', err);
    }
  };

  const handleBackup = async (type: 'full' | 'developments' | 'payments') => {
    setBackupInProgress(true);
    try {
      const response = await fetch('/api/developer/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${type}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setLastBackup(new Date().toISOString());
      } else {
        throw new Error('Backup failed');
      }
    } catch (err) {
      console.error('Backup error:', err);
      alert('Failed to create backup. Please try again.');
    } finally {
      setBackupInProgress(false);
    }
  };

  // Fetch stands for a development
  const fetchStands = async (developmentId: string) => {
    setStandsLoading(true);
    try {
      const response = await fetch(`/api/developer/stands?developmentId=${developmentId}`);
      const data = await response.json();
      if (data.data) {
        setStands(data.data);
      }
    } catch (err) {
      console.error('Error fetching stands:', err);
    } finally {
      setStandsLoading(false);
    }
  };

  // Open stand management modal
  const openStandManagement = (developmentId: string) => {
    setSelectedDevelopmentForStands(developmentId);
    setShowStandModal(true);
    fetchStands(developmentId);
  };

  // Mark stand as sold
  const handleMarkAsSold = async () => {
    if (!standToRemove) return;
    
    try {
      const response = await fetch('/api/developer/stands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: standToRemove.id,
          status: 'SOLD',
          reason: removeReason,
          clientName,
          salePrice: salePrice || standToRemove.price
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Stand ${standToRemove.standNumber} marked as SOLD successfully!`);
        setStandToRemove(null);
        setRemoveReason('');
        setClientName('');
        setSalePrice('');
        // Refresh stands and dashboard data
        if (selectedDevelopmentForStands) {
          fetchStands(selectedDevelopmentForStands);
        }
        fetchDeveloperData();
      } else {
        throw new Error(data.error || 'Failed to update stand');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Withdraw stand from inventory
  const handleWithdrawStand = async (stand: Stand) => {
    if (!confirm(`Are you sure you want to withdraw stand ${stand.standNumber} from inventory?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/developer/stands', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: stand.id,
          reason: 'Withdrawn by developer'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Stand ${stand.standNumber} withdrawn from inventory!`);
        if (selectedDevelopmentForStands) {
          fetchStands(selectedDevelopmentForStands);
        }
        fetchDeveloperData();
      } else {
        throw new Error(data.error || 'Failed to withdraw stand');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Filter stands by search query
  const filteredStands = stands.filter(stand => 
    stand.standNumber.toLowerCase().includes(standSearchQuery.toLowerCase()) ||
    stand.status.toLowerCase().includes(standSearchQuery.toLowerCase())
  );

  // Quick Action Handlers
  const handleDownloadStatement = async () => {
    try {
      const response = await fetch('/api/developer/statement?format=pdf', {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate statement');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(`Error downloading statement: ${err.message}`);
    }
  };

  const handleExportSalesReport = async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      const response = await fetch(`/api/developer/report/sales?format=${format}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(`Error exporting report: ${err.message}`);
    }
  };

  const handleViewBuyers = async () => {
    setShowBuyersModal(true);
    setBuyersLoading(true);
    try {
      const response = await fetch('/api/developer/buyers');
      if (!response.ok) {
        throw new Error('Failed to fetch buyers');
      }
      const data = await response.json();
      if (data.buyers) {
        setBuyers(data.buyers);
      }
    } catch (err: any) {
      console.error('Error fetching buyers:', err);
      setBuyers([]);
    } finally {
      setBuyersLoading(false);
    }
  };

  const handleNotificationSettings = () => {
    setShowNotificationModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'developments', label: 'Developments', icon: Home },
    { id: 'inventory', label: 'Stands Inventory', icon: Package },
    { id: 'contracts', label: 'Contracts', icon: FileText },
    { id: 'payments', label: 'Payments & Statements', icon: CreditCard },
    { id: 'backup', label: 'Backup & Data', icon: Database },
  ];

  const salesGrowth = stats ? ((stats.thisMonthSales - stats.lastMonthSales) / Math.max(stats.lastMonthSales, 1) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader 
          title="Developer Portal"
          subtitle="Land Owner Dashboard"
        />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C5A059] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        title="Developer Portal"
        subtitle={`Welcome back, ${session?.user?.name?.split(' ')[0] || 'Developer'}! • All amounts USD`}
        onRefresh={fetchDeveloperData}
        refreshing={refreshing}
        actions={
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#C5A059] bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        }
      />

      {/* Tabs */}
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      />

      {/* Main Content */}
      <PageContainer>
        {/* Stats Cards - Using shared component */}
        <KPIGrid className="mb-6 sm:mb-8">
          <KPICard
            title="Total Revenue"
            value={formatCurrency(stats?.totalRevenue || 0)}
            icon={DollarSign}
            variant="gradient"
            color="green"
            trend={salesGrowth > 0 ? 'up' : 'down'}
            trendValue={`${salesGrowth > 0 ? '+' : ''}${salesGrowth.toFixed(0)}%`}
          />

          <KPICard
            title="Expected Revenue"
            value={formatCurrency(stats?.expectedRevenueThisMonth || 0)}
            subtitle="Based on pending sales & reservations"
            icon={CalendarDays}
            variant="gradient"
            color="emerald"
            trend="neutral"
            trendValue="This Month"
          />

          <KPICard
            title="Expected Installments"
            value={formatCurrency(stats?.expectedInstallmentsThisMonth || 0)}
            subtitle="Due installment payments this month"
            icon={Banknote}
            variant="gradient"
            color="indigo"
            trend="neutral"
            trendValue="Installments"
          />

          <KPICard
            title="Pending Payouts"
            value={formatCurrency(stats?.pendingPayouts || 0)}
            icon={Wallet}
            variant="gradient"
            color="amber"
            trend="neutral"
            trendValue="Pending"
          />

          <KPICard
            title="Stands Sold"
            value={`${stats?.totalSold || 0} / ${stats?.totalStands || 0}`}
            icon={Home}
            variant="gradient"
            color="blue"
            trend="up"
            trendValue={`${stats?.thisMonthSales || 0} this month`}
          />

          <KPICard
            title="Avg. Price / Stand"
            value={formatCurrency(stats?.averagePricePerStand || 0)}
            icon={TrendingUp}
            variant="gradient"
            color="purple"
          />
        </KPIGrid>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Charts */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (USD)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Stands Sold</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="standsSold" fill="#3b82f6" name="Stands Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Developments List */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Your Developments</h3>
                  <button 
                    onClick={() => setActiveTab('developments')}
                    className="text-xs sm:text-sm text-[#C5A059] hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight size={16} />
                  </button>
                </div>

            <div className="space-y-4">
              {developments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
                  <Home className="w-12 h-12 sm:w-14 sm:h-14 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <h4 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">No developments yet</h4>
                  <p className="text-xs sm:text-sm text-gray-500">Your developments will appear here once added to the system.</p>
                </div>
              ) : developments.map((dev) => (
                <div 
                  key={dev.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedDev(selectedDev === dev.id ? null : dev.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 truncate">{dev.name}</h4>
                      <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin size={14} /> <span className="truncate">{dev.location}</span>
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold text-green-600">{formatCurrency(dev.totalRevenue)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Total Revenue</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-500">Sales Progress</span>
                      <span className="font-semibold text-gray-900">
                        {Math.round((dev.soldStands / dev.totalStands) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div 
                          className="bg-green-500 h-full" 
                          style={{ width: `${(dev.soldStands / dev.totalStands) * 100}%` }}
                        />
                        <div 
                          className="bg-amber-400 h-full" 
                          style={{ width: `${(dev.reservedStands / dev.totalStands) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                    <div>
                      <p className="text-base sm:text-lg font-bold text-green-600">{dev.soldStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Sold</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-amber-500">{dev.reservedStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Reserved</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-blue-500">{dev.availableStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Available</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-gray-900">{dev.totalStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Total</p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedDev === dev.id && (
                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-amber-50 rounded-xl p-4">
                          <p className="text-xs text-amber-600 mb-1">Pending Payments</p>
                          <p className="text-xl font-bold text-amber-700">{formatCurrency(dev.pendingPayments)}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4">
                          <p className="text-xs text-green-600 mb-1">Commission Due</p>
                          <p className="text-xl font-bold text-green-700">{formatCurrency(dev.commissionDue)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Last sale: {dev.lastSaleDate ? formatDate(dev.lastSaleDate) : 'No sales yet'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openStandManagement(dev.id); }}
                            className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                          >
                            <Package size={14} /> Manage Stands
                          </button>
                          <button className="text-sm text-[#C5A059] font-medium hover:underline flex items-center gap-1">
                            View Details <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Recent Payments */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base font-bold text-gray-900">Recent Payouts</h3>
                <button 
                  onClick={() => setActiveTab('payments')}
                  className="text-xs text-[#C5A059] hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {recentPayments.length === 0 ? (
                  <div className="py-6 sm:py-8 text-center">
                    <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-xs sm:text-sm text-gray-500">No recent payments</p>
                  </div>
                ) : recentPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 flex-shrink-0">
                        <Wallet size={14} className="text-green-600 sm:w-4 sm:h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{payment.developmentName}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">{formatDate(payment.date)}</p>
                        {payment.referenceNumber && (
                          <p className="text-[10px] sm:text-xs text-gray-400 truncate">Ref: {payment.referenceNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
                      <StatusBadge status={payment.status?.toLowerCase() || 'cleared'} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backup & Data Management */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Backup & Data</h3>
                {lastBackup && (
                  <span className="text-xs text-gray-500">Last: {formatDate(lastBackup)}</span>
                )}
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => handleBackup('full')}
                  disabled={backupInProgress}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Database size={18} className="text-cyan-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Full Backup</p>
                    <p className="text-xs text-gray-500">All developments & payments data</p>
                  </div>
                  {backupInProgress && <RefreshCw size={16} className="animate-spin text-gray-400" />}
                </button>
                
                <button 
                  onClick={() => handleBackup('developments')}
                  disabled={backupInProgress}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <HardDrive size={18} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Backup Developments</p>
                    <p className="text-xs text-gray-500">Export developments only</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleBackup('payments')}
                  disabled={backupInProgress}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <CloudUpload size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Backup Payments</p>
                    <p className="text-xs text-gray-500">Export payment records</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleDownloadStatement}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <FileText size={16} className="text-blue-600 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">Download Statement</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Get your financial summary</p>
                  </div>
                </button>
                
                <div className="w-full">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 mb-2">Export Sales Report</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExportSalesReport('csv')}
                      className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs sm:text-sm font-medium"
                    >
                      <Download size={14} className="sm:w-4 sm:h-4" /> CSV
                    </button>
                    <button 
                      onClick={() => handleExportSalesReport('pdf')}
                      className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm font-medium"
                    >
                      <FileText size={14} className="sm:w-4 sm:h-4" /> PDF
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={handleViewBuyers}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-purple-50 transition-colors text-left group"
                >
                  <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors flex-shrink-0">
                    <Users size={16} className="text-purple-600 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">View Buyers</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">See who bought your stands</p>
                  </div>
                </button>
                
                <button 
                  onClick={handleNotificationSettings}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-amber-50 transition-colors text-left group"
                >
                  <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors flex-shrink-0">
                    <Bell size={16} className="text-amber-600 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">Notification Settings</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Manage alerts & emails</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Support Card */}
            <div className="bg-gradient-to-br from-[#C5A059] to-[#8B6914] rounded-2xl p-4 sm:p-6 text-white">
              <h3 className="text-base font-bold mb-2">Need Help?</h3>
              <p className="text-sm text-white/80 mb-4">
                Contact your account manager for any questions about your developments.
              </p>
              <a 
                href="mailto:support@fineandcountry.co.zw?subject=Developer Portal Support"
                className="w-full bg-white text-[#C5A059] font-semibold py-2 rounded-xl hover:bg-gray-100 transition-colors text-center block"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
        </div>
        )}

        {activeTab === 'developments' && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">All Developments</h2>
            <div className="space-y-4">
              {developments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
                  <Home className="w-12 h-12 sm:w-14 sm:h-14 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <h4 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">No developments yet</h4>
                  <p className="text-xs sm:text-sm text-gray-500">Your developments will appear here once added to the system.</p>
                </div>
              ) : developments.map((dev) => (
                <div 
                  key={dev.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 truncate">{dev.name}</h4>
                      <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin size={14} /> <span className="truncate">{dev.location}</span>
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold text-green-600">{formatCurrency(dev.totalRevenue)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Total Revenue</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                    <div>
                      <p className="text-base sm:text-lg font-bold text-green-600">{dev.soldStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Sold</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-amber-500">{dev.reservedStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Reserved</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-blue-500">{dev.availableStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Available</p>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-bold text-gray-900">{dev.totalStands}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Total</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setSelectedDevelopmentForStands(dev.id); setShowStandModal(true); fetchStands(dev.id); }}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                    >
                      <Package size={14} /> Manage Stands
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Payments & Statements</h2>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Recent Payouts</h3>
                <button 
                  onClick={fetchPayments}
                  className="text-xs text-[#C5A059] hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <div className="space-y-3">
                {recentPayments.length === 0 ? (
                  <div className="py-8 text-center">
                    <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-500">No recent payouts</p>
                  </div>
                ) : recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100">
                        <Wallet size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{payment.developmentName}</p>
                        <p className="text-xs text-gray-500">{formatDate(payment.date)}</p>
                        {payment.paymentMethod && (
                          <p className="text-xs text-gray-400">Method: {payment.paymentMethod}</p>
                        )}
                        {payment.referenceNumber && (
                          <p className="text-xs text-gray-400">Ref: {payment.referenceNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
                      <StatusBadge status={payment.status?.toLowerCase() || 'cleared'} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-3 sm:mb-4">Statements & Reports</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleDownloadStatement}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-blue-50 transition-colors text-left"
                >
                  <FileText size={16} className="text-blue-600 sm:w-[18px] sm:h-[18px]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">Download Statement</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Get your financial summary (PDF)</p>
                  </div>
                </button>
                <div className="pt-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 mb-2">Export Sales Report</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExportSalesReport('csv')}
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs sm:text-sm font-medium"
                    >
                      CSV
                    </button>
                    <button 
                      onClick={() => handleExportSalesReport('pdf')}
                      className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            {selectedContractId ? (
              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedContractId(null)}
                  className="mb-4"
                >
                  ← Back to Contracts List
                </Button>
                <ContractViewer contractId={selectedContractId} />
              </div>
            ) : (
              <>
                {/* Contracts Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <KPICard
                    title="Total Contracts"
                    value={contractsData.summary.total}
                    icon={FileText}
                    color="blue"
                    subtitle={`$${(contractsData.summary.totalValue / 1000).toFixed(0)}K total value`}
                  />
                  <KPICard
                    title="Draft"
                    value={contractsData.summary.draft}
                    icon={Clock}
                    color="amber"
                    subtitle="Pending signature"
                  />
                  <KPICard
                    title="Sent"
                    value={contractsData.summary.sent}
                    icon={FileText}
                    color="blue"
                    subtitle="Awaiting signatures"
                  />
                  <KPICard
                    title="Signed"
                    value={contractsData.summary.signed}
                    icon={CheckCircle2}
                    color="green"
                    subtitle="Active contracts"
                  />
                  <KPICard
                    title="Total Paid"
                    value={`$${(contractsData.summary.totalPaid / 1000).toFixed(0)}K`}
                    icon={DollarSign}
                    color="green"
                    subtitle={`${contractsData.summary.totalValue > 0 ? ((contractsData.summary.totalPaid / contractsData.summary.totalValue) * 100).toFixed(1) : 0}% collected`}
                  />
                </div>

                {/* Contracts Table */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Contract Management</CardTitle>
                        <CardDescription>Contracts for your developments</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchContracts()}
                        disabled={contractsLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${contractsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {contractsLoading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-500">Loading contracts...</p>
                      </div>
                    ) : contractsData.contracts.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 text-lg">No contracts found</p>
                        <p className="text-gray-400">Contracts will appear here once created for your developments</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <div className="inline-block min-w-full align-middle">
                            <table className="w-full text-xs sm:text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="text-left p-2 sm:p-3 font-semibold">Status</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold">Client</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden sm:table-cell">Property</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden md:table-cell">Development</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold">Value</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden lg:table-cell">Paid</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden lg:table-cell">Balance</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden xl:table-cell">Progress</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold hidden xl:table-cell">Created</th>
                                  <th className="text-left p-2 sm:p-3 font-semibold">Actions</th>
                                </tr>
                              </thead>
                            <tbody>
                              {contractsData.contracts.map((contract: any) => (
                                <tr key={contract.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2 sm:p-3">
                                    <div className="flex items-center gap-2">
                                      {contract.status === 'DRAFT' && (
                                        <span className="px-2 py-1 text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                          Draft
                                        </span>
                                      )}
                                      {contract.status === 'SIGNED' && (
                                        <span className="px-2 py-1 text-[10px] sm:text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                          Signed
                                        </span>
                                      )}
                                      {['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(contract.status) && (
                                        <span className="px-2 py-1 text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                          {contract.status.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    <div>
                                      <div className="font-medium text-gray-900 truncate">{contract.client?.name || 'N/A'}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 truncate">{contract.client?.email || ''}</div>
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3 hidden sm:table-cell">
                                    <div>
                                      <div className="font-medium">Stand {contract.stand?.standNumber || 'N/A'}</div>
                                      <div className="text-xs text-gray-500">
                                        {contract.stand?.sizeSqm ? `${Number(contract.stand.sizeSqm)} sqm` : ''}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3 hidden md:table-cell">
                                    <div>
                                      <div className="font-medium">{contract.stand?.development?.name || 'N/A'}</div>
                                      <div className="text-xs text-gray-500">{contract.stand?.development?.location || ''}</div>
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    <div className="font-medium">
                                      ${contract.paymentSummary?.totalPrice ? (contract.paymentSummary.totalPrice / 1000).toFixed(0) : 0}K
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3 hidden lg:table-cell">
                                    <div className="text-green-600 font-medium">
                                      ${contract.paymentSummary?.paidAmount ? (contract.paymentSummary.paidAmount / 1000).toFixed(0) : 0}K
                                    </div>
                                    {contract.paymentSummary?.paymentCount && (
                                      <div className="text-xs text-gray-500">
                                        {contract.paymentSummary.paymentCount} payment{contract.paymentSummary.paymentCount !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 sm:p-3 hidden lg:table-cell">
                                    <div className={`font-medium ${
                                      (contract.paymentSummary?.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                      ${contract.paymentSummary?.remainingBalance ? (contract.paymentSummary.remainingBalance / 1000).toFixed(0) : 0}K
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3 hidden xl:table-cell">
                                    {contract.paymentSummary?.progress !== undefined && (
                                      <>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                          <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${Math.min(contract.paymentSummary.progress, 100)}%` }}
                                          ></div>
                                        </div>
                                        <div className="text-xs text-gray-600 text-center">
                                          {contract.paymentSummary.progress.toFixed(1)}%
                                        </div>
                                      </>
                                    )}
                                  </td>
                                  <td className="p-2 sm:p-3 hidden xl:table-cell">
                                    <div className="text-xs text-gray-500">
                                      {new Date(contract.createdAt).toLocaleDateString()}
                                    </div>
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setSelectedContractId(contract.id)}
                                      className="text-[10px] sm:text-xs px-2 py-1"
                                    >
                                      <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-1" />
                                      <span className="hidden sm:inline">View</span>
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        </div>

                        {/* Pagination */}
                        {contractsData.pagination.totalPages > 1 && (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 sm:mt-6">
                            <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
                              Showing {((contractsData.pagination.page - 1) * contractsData.pagination.limit) + 1} to{' '}
                              {Math.min(contractsData.pagination.page * contractsData.pagination.limit, contractsData.pagination.total)} of{' '}
                              {contractsData.pagination.total} contracts
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setContractPage(prev => Math.max(1, prev - 1));
                                }}
                                disabled={contractPage === 1 || contractsLoading}
                                className="text-xs px-2 sm:px-3"
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setContractPage(prev => prev + 1);
                                }}
                                disabled={contractPage >= contractsData.pagination.totalPages || contractsLoading}
                                className="text-xs px-2 sm:px-3"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === 'backup' && (
          <BackupDashboard userRole="developer" userEmail={session?.user?.email || ''} />
        )}

        {/* Stands Inventory Tab */}
        {activeTab === 'inventory' && (
          <DeveloperInventoryTab
            inventoryLoading={inventoryLoading}
            inventoryData={inventoryData}
            inventoryFilters={inventoryFilters}
            setInventoryFilters={setInventoryFilters}
            inventoryPage={inventoryPage}
            setInventoryPage={setInventoryPage}
            developments={developments}
            onRefresh={() => fetchInventory()}
            onStandAction={(stand) => {
              setStandToRemove(stand);
              setSelectedDevelopmentForStands(stand.development?.id || null);
            }}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        )}

      </PageContainer>

      {/* Stand Management Modal */}
      {showStandModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-full sm:max-w-2xl xl:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">Manage Stands</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {developments.find(d => d.id === selectedDevelopmentForStands)?.name || 'Development'}
                </p>
              </div>
              <button 
                onClick={() => { setShowStandModal(false); setStandToRemove(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0 ml-2"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]" />
                <input
                  type="text"
                  placeholder="Search by stand number or status..."
                  value={standSearchQuery}
                  onChange={(e) => setStandSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
            </div>

            {/* Stands List */}
            <div className="flex-1 overflow-y-auto p-4">
              {standsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C5A059]"></div>
                </div>
              ) : filteredStands.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No stands found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStands.map((stand) => (
                    <div 
                      key={stand.id}
                      className={`p-4 rounded-xl border ${
                        stand.status === 'AVAILABLE' ? 'border-green-200 bg-green-50' :
                        stand.status === 'RESERVED' ? 'border-amber-200 bg-amber-50' :
                        stand.status === 'SOLD' ? 'border-red-200 bg-red-50' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900">{stand.standNumber}</span>
                        <StatusBadge status={stand.status.toLowerCase()} size="sm" />
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {formatCurrency(stand.price || 0)}
                        {stand.sizeSqm && ` • ${stand.sizeSqm} m²`}
                      </p>
                      
                      {stand.status === 'AVAILABLE' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStandToRemove(stand)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <Tag size={12} /> Mark as Sold
                          </button>
                          <button
                            onClick={() => handleWithdrawStand(stand)}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                      
                      {stand.status === 'RESERVED' && (
                        <button
                          onClick={() => setStandToRemove(stand)}
                          className="w-full px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <Tag size={12} /> Complete Sale
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-green-600">● {stands.filter(s => s.status === 'AVAILABLE').length} Available</span>
                <span className="text-amber-600">● {stands.filter(s => s.status === 'RESERVED').length} Reserved</span>
                <span className="text-red-600">● {stands.filter(s => s.status === 'SOLD').length} Sold</span>
              </div>
              <span className="text-gray-500">Total: {stands.length} stands</span>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Sold Confirmation Modal */}
      {standToRemove && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mark Stand as Sold</h3>
                <p className="text-sm text-gray-500">Stand {standToRemove.standNumber}</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              This will remove the stand from available inventory and mark it as sold.
              This action will reflect across all dashboards (admin, agent, client).
            </p>
            
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter buyer's name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (USD)</label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder={String(standToRemove.price || 25000)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setStandToRemove(null); setClientName(''); setSalePrice(''); setRemoveReason(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsSold}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                Confirm Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Buyers Modal */}
      {showBuyersModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-full sm:max-w-2xl xl:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-gray-900">Buyers</h2>
                <p className="text-xs sm:text-sm text-gray-500">Clients who purchased stands from your developments</p>
              </div>
              <button 
                onClick={() => { setShowBuyersModal(false); setBuyers([]); }}
                className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0 ml-2"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {buyersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C5A059]"></div>
                </div>
              ) : buyers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={36} className="mx-auto mb-4 opacity-50 sm:w-12 sm:h-12" />
                  <p className="text-sm">No buyers found</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {buyers.map((buyer, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">{buyer.name || 'Unknown'}</p>
                          <p className="text-xs sm:text-sm text-gray-500 truncate">{buyer.email || 'N/A'}</p>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="font-bold text-sm sm:text-base text-green-600">{formatCurrency(buyer.totalSpent)}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500">{buyer.purchaseCount} stand{buyer.purchaseCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {buyer.standNumbers.length > 0 && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
                          <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-2">Stands:</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {buyer.standNumbers.map((stand, sIdx) => (
                              <span key={sIdx} className="text-[10px] sm:text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {stand.number} ({stand.development}) - {formatCurrency(stand.price)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-full sm:max-w-md p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-amber-100 rounded-xl flex-shrink-0">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Notification Settings</h3>
                <p className="text-xs sm:text-sm text-gray-500">Coming soon</p>
              </div>
            </div>
            <div className="mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                Notification settings will be available soon. You'll be able to customize:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  Email alerts for new sales
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  Payment notifications
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  Sale alerts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  System updates
                </li>
              </ul>
            </div>
            <button
              onClick={() => setShowNotificationModal(false)}
              className="w-full px-3 sm:px-4 py-2 bg-[#C5A059] text-white text-sm sm:text-base font-medium rounded-xl hover:bg-opacity-90 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              © 2026 Fine & Country Zimbabwe. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-900">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900">Terms of Service</a>
              <a href="#" className="hover:text-gray-900">Help Center</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
