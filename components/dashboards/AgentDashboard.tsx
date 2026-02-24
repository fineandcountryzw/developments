/**
 * Agent Dashboard - Redesigned
 * Clean, modern UI with sales pipeline tracking and prospect management
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePaymentRefresh } from '@/hooks/usePaymentRefresh';
import { DashboardHeader, DashboardTabs, KPICard, StatusBadge, type TabItem } from '@/components/dashboards/shared';
import { TaskManager } from '@/components/TaskManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
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
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Phone,
  Mail,
  Plus,
  RefreshCw,
  Clock,
  Loader2,
  Building2,
  Eye,
  Calendar,
  BarChart3,
  Wallet,
  Activity,
  UserPlus,
  X,
  AlertCircle,
  User,
  FileText,
  CheckSquare,
} from 'lucide-react';

interface Prospect {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';
  property?: string;
  budget?: number;
  lookingFor?: string;
  lastContact: string;
  nextFollowUp?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface Deal {
  id: string;
  clientName: string;
  property: string;
  amount: number;
  status: 'pipeline' | 'offer' | 'inspection' | 'closing' | 'closed' | 'lost';
  closingDate?: string;
  probability: number;
}

type TabType = 'overview' | 'deals' | 'commissions' | 'performance' | 'tasks';

export function AgentDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'new' | 'contacted' | 'qualified'>('all');

  const [metrics, setMetrics] = useState({
    totalProspects: 0,
    activeDeals: 0,
    monthlyTarget: 0, // Will be set from performance API
    thisMonthRevenue: 0,
    conversionRate: 0,
    thisMonthCommission: 0,
    leadsThisWeek: 0,
    closingThisWeek: 0,
  });

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [commissionData, setCommissionData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Add Prospect Modal State
  const [isAddProspectOpen, setIsAddProspectOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newProspect, setNewProspect] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
    budget: '',
    lookingFor: '',
  });

  // Fetch data from APIs
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      const [dealsResponse, clientsResponse, commissionResponse, performanceResponse] = await Promise.all([
        fetch('/api/agent/deals'),
        fetch('/api/agent/clients'),
        fetch('/api/agent/commissions/analytics'),
        fetch('/api/agent/performance')
      ]);

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        if (dealsData.success && dealsData.data && dealsData.data.length > 0) {
          const fetchedDeals: Deal[] = dealsData.data.map((deal: any) => ({
            id: deal.id,
            clientName: deal.client?.name || 'Unknown Client',
            property: deal.title,
            amount: deal.value || 0,
            status: mapDealStatus(deal.stage?.name),
            closingDate: deal.expectedCloseDate,
            probability: deal.probability || 0,
          }));
          setDeals(fetchedDeals);

          const activeDeals = fetchedDeals.filter(d => d.status !== 'closed' && d.status !== 'lost');
          const revenue = fetchedDeals
            .filter(d => d.status === 'closed')
            .reduce((sum, d) => sum + d.amount, 0);
          const commission = revenue * 0.05; // 5% commission

          setMetrics(prev => ({
            ...prev,
            activeDeals: activeDeals.length,
            thisMonthRevenue: revenue,
            thisMonthCommission: commission,
          }));
        } else {
          // No deals - set empty state
          setDeals([]);
          setMetrics(prev => ({
            ...prev,
            activeDeals: 0,
            thisMonthRevenue: 0,
            thisMonthCommission: 0,
          }));
        }
      } else {
        // API error - set empty state
        setDeals([]);
      }

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if (clientsData.success && clientsData.data && clientsData.data.length > 0) {
          // Map clients to prospects with real data
          const fetchedProspects: Prospect[] = clientsData.data.map((client: any) => {
            // Get most recent reservation for this client to determine status
            const hasReservation = client.reservations && client.reservations.length > 0;
            const status = hasReservation ? 'qualified' : 'new';
            
            // Get last contact date from most recent reservation or client update
            let lastContact = 'Never';
            if (hasReservation && client.reservations[0]?.createdAt) {
              const contactDate = new Date(client.reservations[0].createdAt);
              const daysAgo = Math.floor((new Date().getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysAgo === 0) lastContact = 'Today';
              else if (daysAgo === 1) lastContact = 'Yesterday';
              else lastContact = `${daysAgo} days ago`;
            } else if (client.updatedAt) {
              const updateDate = new Date(client.updatedAt);
              const daysAgo = Math.floor((new Date().getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysAgo === 0) lastContact = 'Today';
              else if (daysAgo === 1) lastContact = 'Yesterday';
              else lastContact = `${daysAgo} days ago`;
            }
            
            return {
              id: client.id,
              name: client.name || 'Unknown',
              email: client.email || '',
              phone: client.phone || '',
              status: status as any,
              priority: 'medium' as any,
              budget: client.budget ? Number(client.budget) : undefined,
              lookingFor: client.lookingFor || undefined,
              lastContact,
            };
          });
          setProspects(fetchedProspects);

          setMetrics(prev => ({
            ...prev,
            totalProspects: clientsData.data.length,
            leadsThisWeek: clientsData.data.filter((c: any) => {
              if (!c.createdAt) return false;
              const created = new Date(c.createdAt);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return created >= weekAgo;
            }).length,
          }));
        } else {
          // No clients - set empty state
          setProspects([]);
          setMetrics(prev => ({
            ...prev,
            totalProspects: 0,
            leadsThisWeek: 0,
          }));
        }
      } else {
        // API error - set empty state
        setProspects([]);
      }

      // Pipeline analytics removed - using deals data directly
      setPipelineData(null);

      // Fetch commission analytics
      if (commissionResponse.ok) {
        const commissionResult = await commissionResponse.json();
        if (commissionResult.success && commissionResult.data) {
          setCommissionData(commissionResult.data);
        } else {
          // Set empty/default commission data
          setCommissionData({
            totalEarned: 0,
            totalPending: 0,
            totalProjected: 0,
            monthlyTrends: [],
            ytdTotal: 0,
            breakdownByDevelopment: [],
            breakdownByStatus: [],
            topDevelopments: [],
          });
        }
      } else {
        // API error - set empty state
        setCommissionData({
          totalEarned: 0,
          totalPending: 0,
          totalProjected: 0,
          monthlyTrends: [],
          ytdTotal: 0,
          breakdownByDevelopment: [],
          breakdownByStatus: [],
          topDevelopments: [],
        });
      }

      // Fetch performance metrics
      if (performanceResponse.ok) {
        const performanceResult = await performanceResponse.json();
        if (performanceResult.success && performanceResult.data) {
          setPerformanceData(performanceResult.data);
          // Update metrics with real performance data
          setMetrics(prev => ({
            ...prev,
            monthlyTarget: performanceResult.data.goals?.monthlyRevenue || 0,
            conversionRate: parseFloat(performanceResult.data.metrics?.conversionRate || '0'),
          }));
        } else {
          // Set empty/default performance data
          const emptyPerformanceData = {
            metrics: {
              thisMonthRevenue: 0,
              thisMonthDeals: 0,
              totalDeals: 0,
              activeDeals: 0,
              closedDeals: 0,
              conversionRate: '0.0%',
              targetAchievement: '0.0%',
              avgDealSize: 0,
            },
            goals: {
              monthlyRevenue: 0,
              monthlyDeals: 10,
              conversionRate: 25,
            },
            progress: {
              revenue: { current: 0, target: 0, percentage: 0 },
              deals: { current: 0, target: 10, percentage: 0 },
              conversion: { current: 0, target: 25, percentage: 0 },
            },
            trends: {
              monthlyTrends: [],
            },
            insights: {
              bestMonth: { month: '', revenue: 0 },
              avgMonthlyRevenue: 0,
            },
          };
          setPerformanceData(emptyPerformanceData);
        }
      } else {
        // API error - set empty state
        const emptyPerformanceData = {
          metrics: {
            thisMonthRevenue: 0,
            thisMonthDeals: 0,
            totalDeals: 0,
            activeDeals: 0,
            closedDeals: 0,
            conversionRate: '0.0%',
            targetAchievement: '0.0%',
            avgDealSize: 0,
          },
          goals: {
            monthlyRevenue: 0,
            monthlyDeals: 10,
            conversionRate: 25,
          },
          progress: {
            revenue: { current: 0, target: 0, percentage: 0 },
            deals: { current: 0, target: 10, percentage: 0 },
            conversion: { current: 0, target: 25, percentage: 0 },
          },
          trends: {
            monthlyTrends: [],
          },
          insights: {
            bestMonth: { month: '', revenue: 0 },
            avgMonthlyRevenue: 0,
          },
        };
        setPerformanceData(emptyPerformanceData);
      }

    } catch (error) {
      // Log error but don't expose to user in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching dashboard data:', error);
      }
      // Set empty states on error
      setDeals([]);
      setProspects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const mapDealStatus = (stageName: string): Deal['status'] => {
    const lowerStage = stageName?.toLowerCase() || '';
    if (lowerStage.includes('lead') || lowerStage.includes('new')) return 'pipeline';
    if (lowerStage.includes('offer') || lowerStage.includes('proposal')) return 'offer';
    if (lowerStage.includes('inspect') || lowerStage.includes('viewing')) return 'inspection';
    if (lowerStage.includes('clos') || lowerStage.includes('final')) return 'closing';
    if (lowerStage.includes('won') || lowerStage.includes('complete')) return 'closed';
    return 'pipeline';
  };

  // Handle creating a new prospect
  const handleCreateProspect = async () => {
    if (!newProspect.name || !newProspect.email) {
      setCreateError('Name and email are required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newProspect.email)) {
      setCreateError('Please enter a valid email address');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/agent/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProspect.name.trim(),
          email: newProspect.email.trim().toLowerCase(),
          phone: newProspect.phone.trim() || null,
          idNumber: newProspect.idNumber.trim() || null,
          budget: newProspect.budget ? parseFloat(newProspect.budget) : null,
          lookingFor: newProspect.lookingFor.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create prospect');
      }

      // Success - close modal and refresh data
      setIsAddProspectOpen(false);
      setNewProspect({
        name: '',
        email: '',
        phone: '',
        idNumber: '',
        budget: '',
        lookingFor: '',
      });
      
      // Refresh prospects list
      await fetchDashboardData();
    } catch (error: any) {
      setCreateError(error.message || 'Failed to create prospect');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen for payment refresh events and auto-refresh dashboard
  usePaymentRefresh(() => fetchDashboardData(), []);

  // Memoize filtered prospects to prevent unnecessary recalculations
  const filteredProspects = useMemo(() => {
    return selectedFilter === 'all' 
      ? prospects 
      : prospects.filter(p => p.status === selectedFilter);
  }, [prospects, selectedFilter]);

  const getPriorityColor = (priority?: string) => {
    if (priority === 'high') return 'text-red-600';
    if (priority === 'medium') return 'text-yellow-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader 
          title="Agent Dashboard"
          subtitle="Sales pipeline & prospect management"
        />
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-fcGold mx-auto" />
            <p className="text-gray-600 font-medium">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        title="Agent Dashboard"
        subtitle="Sales pipeline & prospect management"
        onRefresh={fetchDashboardData}
        refreshing={refreshing}
        actions={
          <button 
            onClick={() => setIsAddProspectOpen(true)}
            className="bg-fcGold hover:bg-fcGold/[0.9] text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Prospect
          </button>
        }
      />

      {/* Tabs */}
      <div className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <DashboardTabs
          tabs={[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'deals', label: 'Deals', icon: TrendingUp },
            { id: 'commissions', label: 'Commissions', icon: Wallet },
            { id: 'performance', label: 'Performance', icon: Activity },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId: string) => setActiveTab(tabId as TabType)}
        />
      </div>
      
      <div className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-in fade-in duration-500">

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Cards - Using shared component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard
            title="Total Prospects"
            value={metrics.totalProspects}
            icon={Users}
            variant="gradient"
            color="blue"
            trend="up"
            trendValue={`+${metrics.leadsThisWeek} this week`}
          />

          <KPICard
            title="Active Deals"
            value={metrics.activeDeals}
            icon={Target}
            variant="gradient"
            color="amber"
            trend="neutral"
            trendValue={`${metrics.closingThisWeek || 2} closing soon`}
          />

          <KPICard
            title="Revenue This Month"
            value={`$${(metrics.thisMonthRevenue / 1000).toFixed(0)}K`}
            subtitle={metrics.monthlyTarget > 0 
              ? `${((metrics.thisMonthRevenue / metrics.monthlyTarget) * 100).toFixed(0)}% of target`
              : 'No target set'
            }
            icon={DollarSign}
            variant="gradient"
            color="emerald"
          />

          <KPICard
            title="Conversion Rate"
            value={`${metrics.conversionRate}%`}
            icon={TrendingUp}
            variant="gradient"
            color="purple"
            trend="up"
            trendValue="+3%"
          />
        </div>

        {/* Prospects Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Active Prospects</h3>
                <p className="text-sm text-gray-500 mt-1">Manage and track your leads</p>
              </div>
              
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-gray-200">
                {['all', 'new', 'contacted', 'qualified'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedFilter === filter
                        ? 'bg-fcGold text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredProspects.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No prospects found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredProspects.map((prospect) => {
                return (
                  <div 
                    key={prospect.id} 
                    className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left: Client Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-fcGold to-amber-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            {prospect.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-semibold text-gray-900 truncate">
                              {prospect.name}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                {prospect.email}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                {prospect.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Looking For - shown below client info */}
                        {prospect.lookingFor && (
                          <div className="mt-2 text-sm">
                            <div className="flex items-start gap-1.5 text-gray-600">
                              <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                              <div>
                                <span className="font-medium text-gray-700">Looking for: </span>
                                <span className="text-gray-900">{prospect.lookingFor}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Center: Property & Budget */}
                      <div className="flex items-center gap-6">
                        {prospect.property && (
                          <div className="text-sm">
                            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                              <Building2 className="w-4 h-4" aria-hidden="true" />
                              <span className="font-medium">Property</span>
                            </div>
                            <div className="font-semibold text-gray-900">{prospect.property}</div>
                          </div>
                        )}
                        {prospect.budget && (
                          <div className="text-sm">
                            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                              <DollarSign className="w-4 h-4" aria-hidden="true" />
                              <span className="font-medium">Budget</span>
                            </div>
                            <div className="font-semibold text-gray-900">
                              ${prospect.budget.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Status & Actions */}
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <div className="text-gray-500 mb-1">Last contact</div>
                          <div className="font-medium text-gray-900">{prospect.lastContact}</div>
                        </div>

                        <StatusBadge status={prospect.status} size="md" />

                        {prospect.nextFollowUp && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            {prospect.nextFollowUp}
                          </div>
                        )}

                        <button 
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          aria-label={`View details for ${prospect.name}`}
                        >
                          <Eye className="w-5 h-5 text-gray-400" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Deals Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Active Deals</h3>
                <p className="text-sm text-gray-500 mt-1">Track deals in your pipeline</p>
              </div>
              <span className="px-4 py-2 bg-fcGold/[0.1] text-fcGold rounded-xl text-sm font-semibold">
                {deals.length} deals
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {deals.length === 0 ? (
              <div className="p-12 text-center">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active deals</p>
                <p className="text-sm text-gray-400 mt-1">Your closed deals will appear here</p>
              </div>
            ) : (
              deals.map((deal) => {
                return (
                  <div 
                    key={deal.id} 
                    className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Deal Info */}
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 mb-1">
                          {deal.clientName}
                        </h4>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Building2 className="w-4 h-4" aria-hidden="true" />
                          {deal.property}
                        </p>
                      </div>

                      {/* Middle: Amount & Probability */}
                      <div className="flex items-center gap-6">
                        <div className="text-sm">
                          <div className="text-gray-500 mb-1">Deal Value</div>
                          <div className="text-lg font-bold text-gray-900">
                            ${(deal.amount / 1000).toFixed(0)}K
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="text-gray-500 mb-1">Probability</div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={deal.probability} aria-valuemin={0} aria-valuemax={100}>
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all" 
                                style={{ width: `${deal.probability}%` }}
                              />
                            </div>
                            <span className="font-semibold text-gray-900">{deal.probability}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Date */}
                      <div className="flex items-center gap-3">
                        {deal.closingDate && (
                          <div className="text-right text-sm">
                            <div className="text-gray-500 mb-1">Closing Date</div>
                            <div className="font-medium text-gray-900">
                              {new Date(deal.closingDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}

                        <StatusBadge status={deal.status} size="md" />

                        <button 
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          aria-label={`View details for deal with ${deal.clientName}`}
                        >
                          <Eye className="w-5 h-5 text-gray-400" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
          </>
        )}

        {/* Deals Tab */}
        {activeTab === 'deals' && (
          <div className="space-y-6">
            {pipelineData ? (
              <>
                {/* Pipeline KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <KPICard
                    title="Total Leads"
                    value={pipelineData.totalLeads || 0}
                    icon={Users}
                    variant="gradient"
                    color="blue"
                  />
                  <KPICard
                    title="Pipeline Value"
                    value={`$${((pipelineData.pipelineValue || 0) / 1000).toFixed(0)}K`}
                    icon={DollarSign}
                    variant="gradient"
                    color="emerald"
                  />
                  <KPICard
                    title="Conversion Rate"
                    value={pipelineData.conversionRate || '0.0%'}
                    icon={TrendingUp}
                    variant="gradient"
                    color="purple"
                  />
                  <KPICard
                    title="Health Score"
                    value={`${pipelineData.healthScore || 0}/100`}
                    icon={Target}
                    variant="gradient"
                    color={(pipelineData.healthScore || 0) >= 70 ? 'emerald' : (pipelineData.healthScore || 0) >= 50 ? 'amber' : 'red'}
                  />
                </div>

            {/* Pipeline Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Funnel</CardTitle>
                <CardDescription>Deal progression through stages</CardDescription>
              </CardHeader>
              <CardContent>
                {pipelineData && pipelineData.conversionFunnel && pipelineData.conversionFunnel.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pipelineData.conversionFunnel}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="stage" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#B8860B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No pipeline data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stage Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline by Stage</CardTitle>
                <CardDescription>Deal value and count by stage</CardDescription>
              </CardHeader>
              <CardContent>
                {pipelineData && pipelineData.stageBreakdown && pipelineData.stageBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {pipelineData.stageBreakdown.map((stage: any) => (
                      <div key={stage.stage} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-900">{stage.stage}</div>
                          <div className="text-sm text-gray-500">{stage.count} deals</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">${(stage.value / 1000).toFixed(0)}K</div>
                          <div className="text-xs text-gray-500">Total value</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No stage breakdown data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No pipeline data available</p>
                  <p className="text-sm text-gray-400 mt-1">Pipeline analytics will appear here once you have deals</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Commissions Tab */}
        {activeTab === 'commissions' && commissionData && (
          <div className="space-y-6">
            {/* Commission KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard
                title="Total Earned"
                value={`$${(commissionData.totalEarned / 1000).toFixed(1)}K`}
                icon={DollarSign}
                variant="gradient"
                color="emerald"
              />
              <KPICard
                title="This Month"
                value={`$${(commissionData.thisMonthTotal / 1000).toFixed(1)}K`}
                subtitle={commissionData.monthlyTrend}
                icon={Calendar}
                variant="gradient"
                color="blue"
                trend={parseFloat(commissionData.monthlyTrend) >= 0 ? "up" : "down"}
                trendValue={commissionData.monthlyTrend}
              />
              <KPICard
                title="Pending"
                value={`$${(commissionData.totalPending / 1000).toFixed(1)}K`}
                icon={Clock}
                variant="gradient"
                color="amber"
              />
              <KPICard
                title="YTD Total"
                value={`$${(commissionData.ytdTotal / 1000).toFixed(1)}K`}
                icon={TrendingUp}
                variant="gradient"
                color="purple"
              />
            </div>

            {/* Commission Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Commission Trends</CardTitle>
                <CardDescription>Monthly commission history</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={commissionData.trends.monthlyHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} name="Total" />
                    <Line type="monotone" dataKey="earned" stroke="#B8860B" strokeWidth={2} name="Earned" />
                    <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Developments */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Developments</CardTitle>
                <CardDescription>Commissions by development</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commissionData.topDevelopments.map((dev: any, idx: number) => (
                    <div key={dev.development} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-fcGold rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{dev.development}</div>
                        </div>
                      </div>
                      <div className="font-bold text-gray-900">${(dev.amount / 1000).toFixed(1)}K</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {performanceData ? (
              <>
                {/* Performance KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <KPICard
                    title="Revenue This Month"
                    value={`$${((performanceData.metrics?.thisMonthRevenue || 0) / 1000).toFixed(0)}K`}
                    subtitle={`${(performanceData.progress?.revenue?.percentage || 0).toFixed(0)}% of target`}
                    icon={DollarSign}
                    variant="gradient"
                    color="emerald"
                  />
                  <KPICard
                    title="Target Achievement"
                    value={performanceData.metrics?.targetAchievement || '0.0%'}
                    icon={Target}
                    variant="gradient"
                    color={parseFloat(performanceData.metrics?.targetAchievement || '0') >= 100 ? 'emerald' : 'amber'}
                  />
                  <KPICard
                    title="Conversion Rate"
                    value={performanceData.metrics?.conversionRate || '0.0%'}
                    icon={TrendingUp}
                    variant="gradient"
                    color="purple"
                  />
                  <KPICard
                    title="Active Deals"
                    value={performanceData.metrics?.activeDeals || 0}
                    subtitle={`${performanceData.metrics?.closedDeals || 0} closed`}
                    icon={Users}
                    variant="gradient"
                    color="blue"
                  />
                </div>

            {/* Goal Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Goal</CardTitle>
                  <CardDescription>Monthly target progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold">{(performanceData.progress?.revenue?.percentage || 0).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-emerald-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(100, performanceData.progress?.revenue?.percentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>${((performanceData.progress?.revenue?.current || 0) / 1000).toFixed(0)}K</span>
                      <span>${((performanceData.progress?.revenue?.target || 0) / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Deals Goal</CardTitle>
                  <CardDescription>Monthly deals target</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold">{(performanceData.progress?.deals?.percentage || 0).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(100, performanceData.progress?.deals?.percentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{performanceData.progress?.deals?.current || 0} deals</span>
                      <span>{performanceData.progress?.deals?.target || 0} deals</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Goal</CardTitle>
                  <CardDescription>Target conversion rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold">{(performanceData.progress?.conversion?.percentage || 0).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-purple-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(100, performanceData.progress?.conversion?.percentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{parseFloat(performanceData.progress?.conversion?.current || '0').toFixed(1)}%</span>
                      <span>{performanceData.progress?.conversion?.target || 0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Monthly revenue and deals</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData && performanceData.trends && performanceData.trends.monthlyTrends && performanceData.trends.monthlyTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={performanceData.trends.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#888" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#888" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} />
                      <Tooltip 
                        formatter={((value: any, name: string): [string, string] => {
                          if (name === 'revenue') return [`$${Number(value).toLocaleString()}`, 'Revenue'];
                          return [String(value), name];
                        }) as any}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Revenue" />
                      <Line yAxisId="right" type="monotone" dataKey="deals" stroke="#3b82f6" strokeWidth={2} name="Deals" />
                      <Line yAxisId="right" type="monotone" dataKey="closed" stroke="#B8860B" strokeWidth={2} name="Closed" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No performance trends data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No performance data available</p>
                  <p className="text-sm text-gray-400 mt-1">Performance metrics will appear here once you have sales activity</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <TaskManager />
        )}

      </div>

      {/* Add Prospect Modal */}
      {isAddProspectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => !isCreating && setIsAddProspectOpen(false)} 
          />
          <div className="relative bg-white w-full max-w-full sm:max-w-lg rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-fcGold/10 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/20 rounded-lg">
                  <UserPlus size={22} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add New Prospect</h3>
                  <p className="text-sm text-gray-500">Enter prospect details below</p>
                </div>
              </div>
              <button 
                onClick={() => !isCreating && setIsAddProspectOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isCreating}
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{createError}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={newProspect.name}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={newProspect.email}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={newProspect.phone}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+263 77 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* National ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  National ID (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={newProspect.idNumber}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, idNumber: e.target.value }))}
                    placeholder="63-123456A78"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={newProspect.budget}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, budget: e.target.value }))}
                    placeholder="50000"
                    min="0"
                    step="1000"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* What They're Looking For */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What They're Looking For
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    value={newProspect.lookingFor}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, lookingFor: e.target.value }))}
                    placeholder="e.g., Residential stand in Harare, 500-700 sqm, near schools..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors resize-none"
                    disabled={isCreating}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setIsAddProspectOpen(false);
                  setCreateError(null);
                  setNewProspect({
                    name: '',
                    email: '',
                    phone: '',
                    idNumber: '',
                    budget: '',
                    lookingFor: '',
                  });
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProspect}
                disabled={isCreating || !newProspect.name || !newProspect.email}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Add Prospect
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
