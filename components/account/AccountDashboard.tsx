'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardHeader, DashboardTabs, KPICard, type TabItem } from '@/components/dashboards/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Users, Package, FileText, TrendingUp, Calendar,
  CreditCard, AlertTriangle, Download, RefreshCw, ChevronDown,
  Building2, BarChart3, PieChart as PieChartIcon, Receipt, Wallet,
  Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight,
  Filter, Search, Eye, Printer, Home
} from 'lucide-react';
import StandsPaymentsTab from './StandsPaymentsTab';
import RecordPaymentModal from './RecordPaymentModal';
import DeveloperPayoutsTab from './DeveloperPayoutsTab';
import { StandsInventoryView } from '@/components/stands';
import { VoidPaymentModal } from '@/components/modals/VoidPaymentModal';

// Types
interface User {
  name: string;
  email: string;
  role: string;
  branch: string;
}

interface AccountDashboardProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'overview' | 'inventory' | 'stands' | 'payments' | 'clients' | 'developer-payouts' | 'commissions' | 'reports';

// Internal StatCard for tab components (kept for backward compatibility)
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'gold'
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'gold' | 'green' | 'red' | 'blue' | 'purple';
}) => {
  const colorClasses = {
    gold: 'bg-[#B8860B]/10 text-[#B8860B]',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
            {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> :
              trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> : null}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default function AccountDashboard({ user, onLogout }: AccountDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [branch, setBranch] = useState(user.branch || 'Harare');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    overdueAmount: 0,
    totalClients: 0,
    activeInstallments: 0,
    availableStands: 0,
    pendingCommissions: 0,
    confirmedPayments: 0,
  });
  const [revenueData, setRevenueData] = useState<any>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/account/stats?branch=${branch}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch]);

  const fetchRevenueData = useCallback(async () => {
    try {
      const res = await fetch(`/api/account/revenue?branch=${branch}&period=${selectedPeriod}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRevenueData(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
    }
  }, [branch, selectedPeriod]);

  // Fetch dashboard stats
  useEffect(() => {
    fetchStats();
    if (activeTab === 'overview') {
      fetchRevenueData();
    }
  }, [branch, activeTab, selectedPeriod, fetchStats, fetchRevenueData]);

  // Define tabs for DashboardTabs component
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'stands', label: 'Stands', icon: Home },
    { id: 'payments', label: 'Payments', icon: CreditCard, badge: stats.pendingPayments },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'developer-payouts', label: 'Developer Payouts', icon: Building2 },
    { id: 'commissions', label: 'Commissions', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Accounts Dashboard"
          subtitle={`Financial Management - ${branch}`}
        />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B8860B] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Accounts Dashboard"
        subtitle={`Financial Management - ${branch} • All amounts USD`}
        onRefresh={fetchStats}
        refreshing={refreshing}
        actions={
          <div className="flex items-center gap-3">
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                <SelectItem value="Harare">Harare Branch</SelectItem>
                <SelectItem value="Bulawayo">Bulawayo Branch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
      />

      <main className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Period Selector */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Select value={selectedPeriod} onValueChange={(value: 'week' | 'month' | 'quarter') => setSelectedPeriod(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* KPI Cards - Using shared component */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                  title="Total Revenue"
                  value={formatCurrency(revenueData?.thisMonthRevenue || stats.totalRevenue)}
                  subtitle={revenueData?.monthlyTrend ? `${revenueData.monthlyTrend} vs last month` : 'This month'}
                  icon={DollarSign}
                  variant="gradient"
                  color="green"
                  trend={revenueData?.monthlyTrend && parseFloat(revenueData.monthlyTrend) >= 0 ? "up" : "down"}
                  trendValue={revenueData?.monthlyTrend || "+0%"}
                />

                <KPICard
                  title="Pending Payments"
                  value={stats.pendingPayments}
                  subtitle={formatCurrency(stats.overdueAmount)}
                  icon={CreditCard}
                  variant="gradient"
                  color="amber"
                  trend="neutral"
                  trendValue="Requires attention"
                />

                <KPICard
                  title="Collection Rate"
                  value={(stats.confirmedPayments + stats.pendingPayments) > 0
                    ? `${Math.round((stats.confirmedPayments / (stats.confirmedPayments + stats.pendingPayments)) * 100)}%`
                    : '0%'}
                  subtitle={`${stats.confirmedPayments} confirmed`}
                  icon={CheckCircle}
                  variant="gradient"
                  color="blue"
                  trend="up"
                  trendValue="Efficiency"
                />

                <KPICard
                  title="Active Clients"
                  value={stats.totalClients}
                  subtitle="Across all properties"
                  icon={Users}
                  variant="gradient"
                  color="purple"
                  trend="up"
                  trendValue="Active"
                />
              </div>

              {/* Charts Row */}
              {revenueData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Trend Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue Trend</CardTitle>
                      <CardDescription>Monthly revenue over the last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueData.monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="month"
                            stroke="#888"
                            fontSize={12}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                          />
                          <YAxis
                            stroke="#888"
                            fontSize={12}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip
                            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                            labelFormatter={(label) => `Month: ${new Date(label).toLocaleDateString()}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Payment Type Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue by Payment Type</CardTitle>
                      <CardDescription>Breakdown by transaction type this month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={revenueData.revenueByType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="revenue"
                          >
                            {revenueData.revenueByType.map((entry: any, index: number) => {
                              const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Daily Revenue Chart */}
              {revenueData && revenueData.dailyRevenue && revenueData.dailyRevenue.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Revenue</CardTitle>
                    <CardDescription>{selectedPeriod === 'week' ? 'This week' : selectedPeriod === 'quarter' ? 'This quarter' : 'This month'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#888"
                          fontSize={12}
                          tickFormatter={(value) => new Date(value).getDate().toString()}
                        />
                        <YAxis
                          stroke="#888"
                          fontSize={12}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                        />
                        <Tooltip
                          formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                          labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeTab === 'inventory' && (
            <StandsInventoryView role="account" title="Stands Inventory" subtitle="Available stands for sale" />
          )}

          {activeTab === 'stands' && (
            <StandsPaymentsTab branch={branch} />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab
              branch={branch}
              formatCurrency={formatCurrency}
              onRecordPayment={() => setIsRecordPaymentOpen(true)}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsTab branch={branch} />
          )}

          {activeTab === 'developer-payouts' && (
            <DeveloperPayoutsTab branch={branch} />
          )}

          {activeTab === 'commissions' && (
            <CommissionsTab branch={branch} formatCurrency={formatCurrency} />
          )}

          {activeTab === 'reports' && (
            <ReportsTab branch={branch} />
          )}
        </div>
      </main>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        onSuccess={() => {
          fetchStats();
          setIsRecordPaymentOpen(false);
        }}
        branch={branch}
      />
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  stats,
  loading,
  formatCurrency,
  branch,
  onRecordPayment
}: {
  stats: {
    totalRevenue: number;
    pendingPayments: number;
    overdueAmount: number;
    totalClients: number;
    activeInstallments: number;
    availableStands: number;
    pendingCommissions: number;
    confirmedPayments: number;
  };
  loading: boolean;
  formatCurrency: (amount: number) => string;
  branch: string;
  onRecordPayment: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Total Revenue"
          value={loading ? '...' : formatCurrency(stats.totalRevenue)}
          subtitle="This month"
          color="gold"
          trend="up"
          trendValue="+12%"
        />
        <StatCard
          icon={Clock}
          title="Pending Payments"
          value={loading ? '...' : stats.pendingPayments}
          subtitle="Awaiting confirmation"
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          title="Overdue Amount"
          value={loading ? '...' : formatCurrency(stats.overdueAmount)}
          subtitle="Needs follow-up"
          color="red"
        />
        <StatCard
          icon={CheckCircle}
          title="Confirmed Payments"
          value={loading ? '...' : stats.confirmedPayments}
          subtitle="This month"
          color="green"
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Total Clients"
          value={loading ? '...' : stats.totalClients}
          subtitle={`${branch} branch`}
          color="purple"
        />
        <StatCard
          icon={Calendar}
          title="Active Installments"
          value={loading ? '...' : stats.activeInstallments}
          subtitle="Payment plans"
          color="blue"
        />
        <StatCard
          icon={Package}
          title="Available Stands"
          value={loading ? '...' : stats.availableStands}
          subtitle="In inventory"
          color="green"
        />
        <StatCard
          icon={Wallet}
          title="Pending Commissions"
          value={loading ? '...' : formatCurrency(stats.pendingCommissions)}
          subtitle="To be paid"
          color="gold"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={onRecordPayment}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition-all"
          >
            <CreditCard className="w-6 h-6 text-[#B8860B]" />
            <span className="text-sm font-medium text-gray-700">Record Payment</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition-all">
            <Receipt className="w-6 h-6 text-[#B8860B]" />
            <span className="text-sm font-medium text-gray-700">Generate Receipt</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition-all">
            <Download className="w-6 h-6 text-[#B8860B]" />
            <span className="text-sm font-medium text-gray-700">Export Report</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition-all">
            <Users className="w-6 h-6 text-[#B8860B]" />
            <span className="text-sm font-medium text-gray-700">Add Client</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <p className="text-gray-500 text-sm text-center py-8">
            Loading recent activity...
          </p>
        </div>
      </div>
    </div>
  );
}

// Payments Tab Component
function PaymentsTab({
  branch,
  formatCurrency,
  onRecordPayment
}: {
  branch: string;
  formatCurrency: (amount: number) => string;
  onRecordPayment: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Void Payment State
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, [branch, filter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Use unified payments API to get payments from all sources
      const res = await fetch(`/api/payments/unified?status=${filter}&limit=1000`);
      if (res.ok) {
        const data = await res.json();
        // Filter by branch if specified
        let allPayments = data.data?.payments || [];
        if (branch && branch !== 'all') {
          allPayments = allPayments.filter((p: any) => p.officeLocation === branch);
        }
        setPayments(allPayments);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidClick = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setIsVoidModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      FAILED: 'bg-red-100 text-red-700',
      VOIDED: 'bg-gray-200 text-gray-600',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Payment Management</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onRecordPayment}
            className="flex items-center gap-2 px-4 py-2 bg-[#B8860B] text-white rounded-lg hover:bg-[#996F00] transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-transparent"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8860B]"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FAILED">Failed</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{payment.reference}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.clientName}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(Number(payment.amount))}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.payment_type || payment.paymentType}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.method}</td>
                    <td className="px-4 py-3">{getStatusBadge(payment.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-[#B8860B]" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-[#B8860B]" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        {payment.status !== 'VOIDED' && (
                          <button
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Void Payment"
                            onClick={() => handleVoidClick(payment.id)}
                          >
                            <XCircle className="w-4 h-4" />
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

      <VoidPaymentModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        onSuccess={() => {
          fetchPayments();
        }}
        paymentId={selectedPaymentId || ''}
      />
    </div>
  );
}

// Installments Tab Component
function InstallmentsTab({ branch, formatCurrency }: { branch: string; formatCurrency: (amount: number) => string }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, [branch]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/installments?branch=${branch}`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch installment plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      COMPLETED: 'bg-blue-100 text-blue-700',
      DEFAULTED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Installment Plans</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Calendar} title="Active Plans" value={plans.filter(p => p.status === 'ACTIVE').length} color="green" />
        <StatCard icon={CheckCircle} title="Completed" value={plans.filter(p => p.status === 'COMPLETED').length} color="blue" />
        <StatCard icon={AlertTriangle} title="Overdue" value={plans.filter(p => p.status === 'DEFAULTED').length} color="red" />
        <StatCard icon={XCircle} title="Cancelled" value={plans.filter(p => p.status === 'CANCELLED').length} color="purple" />
      </div>

      {/* Plans Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Stand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Paid</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Monthly</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading installment plans...
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No installment plans found
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const progress = plan.totalAmount > 0
                    ? Math.round((Number(plan.totalPaid) / Number(plan.totalAmount)) * 100)
                    : 0;
                  return (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{plan.client?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{plan.standId}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(Number(plan.totalAmount))}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(Number(plan.totalPaid))}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(Number(plan.remainingBalance))}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(Number(plan.monthlyAmount))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B8860B] rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(plan.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Clients Tab Component
function ClientsTab({ branch }: { branch: string }) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClients();
  }, [branch]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/clients?branch=${branch}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Client Directory</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#B8860B] text-white rounded-lg hover:bg-[#996F00]">
          <Users className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No clients found
          </div>
        ) : (
          filteredClients.map((client) => (
            <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#B8860B]/10 rounded-full flex items-center justify-center">
                  <span className="text-[#B8860B] font-semibold">
                    {client.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{client.email}</p>
                  <p className="text-sm text-gray-500">{client.phone}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {client.ownedStands?.length || 0} stands owned
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Generate and download client statement
                      const statementUrl = `/api/account/clients/${client.id}/statement`;
                      window.open(statementUrl, '_blank');
                    }}
                    className="flex items-center gap-1 text-[#B8860B] hover:underline text-sm font-medium"
                    title="Generate Statement"
                  >
                    <FileText className="w-4 h-4" />
                    Statement
                  </button>
                  <button className="text-[#B8860B] hover:underline text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Inventory Tab Component
function InventoryTab({ branch, formatCurrency }: { branch: string; formatCurrency: (amount: number) => string }) {
  const [developments, setDevelopments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, [branch]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/inventory?branch=${branch}`);
      if (res.ok) {
        const data = await res.json();
        setDevelopments(data.developments || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Stand Inventory</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Inventory
        </button>
      </div>

      {/* Development Cards */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading inventory...
        </div>
      ) : developments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No developments found
        </div>
      ) : (
        <div className="space-y-4">
          {developments.map((dev) => (
            <div key={dev.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{dev.name}</h3>
                  <p className="text-sm text-gray-500">{dev.location}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${dev.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                  {dev.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Total Stands</p>
                  <p className="text-lg font-bold text-gray-900">{dev.totalStands}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600">Available</p>
                  <p className="text-lg font-bold text-green-700">{dev.availableStands}</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-600">Reserved</p>
                  <p className="text-lg font-bold text-yellow-700">{dev.reservedStands}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">Sold</p>
                  <p className="text-lg font-bold text-blue-700">{dev.soldStands}</p>
                </div>
                <div className="p-3 bg-[#B8860B]/10 rounded-lg">
                  <p className="text-xs text-[#B8860B]">Revenue</p>
                  <p className="text-lg font-bold text-[#B8860B]">{formatCurrency(dev.totalRevenue || 0)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Commissions Tab Component
function CommissionsTab({ branch, formatCurrency }: { branch: string; formatCurrency: (amount: number) => string }) {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchCommissions();
  }, [branch, selectedMonth]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/commissions?branch=${branch}&month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setCommissions(data.commissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (commissionId: string, newStatus: 'APPROVED' | 'PAID') => {
    if (!confirm(`Are you sure you want to mark this commission as ${newStatus}?`)) {
      return;
    }

    setUpdating(commissionId);
    try {
      const res = await fetch('/api/account/commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionId, status: newStatus }),
      });

      if (res.ok) {
        // Refresh commissions list
        await fetchCommissions();
        alert(`Commission ${newStatus.toLowerCase()} successfully`);
      } else {
        const error = await res.json();
        alert(`Failed to update commission: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update commission:', error);
      alert('Failed to update commission status');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      CALCULATED: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-blue-100 text-blue-700',
      PAID: 'bg-green-100 text-green-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const totalCalculated = commissions.filter(c => c.status === 'CALCULATED').reduce((sum, c) => sum + Number(c.total), 0);
  const totalApproved = commissions.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + Number(c.total), 0);
  const totalPaid = commissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + Number(c.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Commission Tracking</h2>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8860B]"
          />
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          title="Calculated"
          value={formatCurrency(totalCalculated)}
          subtitle="Awaiting approval"
          color="gold"
        />
        <StatCard
          icon={CheckCircle}
          title="Approved"
          value={formatCurrency(totalApproved)}
          subtitle="Ready for payout"
          color="blue"
        />
        <StatCard
          icon={Wallet}
          title="Paid"
          value={formatCurrency(totalPaid)}
          subtitle="This month"
          color="green"
        />
      </div>

      {/* Commissions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Month</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Paid Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading commissions...
                  </td>
                </tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No commissions found for this period
                  </td>
                </tr>
              ) : (
                commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{commission.agentName || commission.agentId}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{commission.month}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(Number(commission.total))}</td>
                    <td className="px-4 py-3">{getStatusBadge(commission.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {commission.paidAt ? new Date(commission.paidAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-[#B8860B]" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {commission.status === 'CALCULATED' && (
                          <button
                            onClick={() => handleUpdateStatus(commission.id, 'APPROVED')}
                            disabled={updating === commission.id}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            {updating === commission.id ? 'Updating...' : 'Approve'}
                          </button>
                        )}
                        {commission.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateStatus(commission.id, 'PAID')}
                            disabled={updating === commission.id}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            {updating === commission.id ? 'Updating...' : 'Mark Paid'}
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
    </div>
  );
}

// Reports Tab Component
function ReportsTab({ branch }: { branch: string }) {
  const [generating, setGenerating] = useState<string | null>(null);

  const reports = [
    {
      id: 'revenue',
      name: 'Revenue Report',
      description: 'Monthly revenue breakdown by development',
      icon: TrendingUp
    },
    {
      id: 'payments',
      name: 'Payments Report',
      description: 'All payments with status and method breakdown',
      icon: CreditCard
    },
    {
      id: 'outstanding',
      name: 'Outstanding Balances',
      description: 'Clients with overdue payments',
      icon: AlertTriangle
    },
    {
      id: 'commissions',
      name: 'Commission Report',
      description: 'Agent commissions summary',
      icon: Wallet
    },
    {
      id: 'installments',
      name: 'Installment Status',
      description: 'All active installment plans',
      icon: Calendar
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Stand availability across developments',
      icon: Package
    },
    {
      id: 'statements',
      name: 'Client Statements',
      description: 'Generate statements for all clients',
      icon: FileText
    },
  ];

  const handleGenerateReport = async (reportId: string, format: 'pdf' | 'csv') => {
    setGenerating(`${reportId}-${format}`);
    try {
      const res = await fetch(`/api/account/reports/${reportId}?branch=${branch}&format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportId}-report-${branch}-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Financial Reports</h2>
        <p className="text-sm text-gray-500">Branch: {branch}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#B8860B]/10 rounded-lg">
                <report.icon className="w-6 h-6 text-[#B8860B]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{report.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
              <button
                onClick={() => handleGenerateReport(report.id, 'pdf')}
                disabled={generating !== null}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#B8860B] text-white rounded-lg hover:bg-[#996F00] disabled:opacity-50 text-sm"
              >
                {generating === `${report.id}-pdf` ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                PDF
              </button>
              <button
                onClick={() => handleGenerateReport(report.id, 'csv')}
                disabled={generating !== null}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {generating === `${report.id}-csv` ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
