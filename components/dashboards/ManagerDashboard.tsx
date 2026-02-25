/**
 * Manager Dashboard
 * Team management, KPIs, branch performance, agent analytics
 * Top navigation layout for desktop/laptop
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePaymentRefresh } from '@/hooks/usePaymentRefresh';
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  RefreshCw,
  BarChart3,
  Building2,
  Brain,
  AlertTriangle,
  Lightbulb,
  Shield,
  Activity,
  FileText,
  Filter,
  Download,
  Calendar,
  Search,
  Eye,
  Clock,
  CheckCircle,
  Archive,
  AlertCircle,
  Layers,
  MapIcon,
  X,
} from 'lucide-react';
import { DashboardHeader, DashboardTabs, KPICard, type TabItem } from '@/components/dashboards/shared';
import { logger } from '@/lib/logger';
import { AdminDevelopmentsDashboard } from '@/components/AdminDevelopmentsDashboard';
import StandsInventoryView from '@/components/stands/StandsInventoryView';
import { ManagerTeamTab } from '@/components/dashboards/manager/TeamTab';
import { ManagerBranchMetricsTab } from '@/components/dashboards/manager/BranchMetricsTab';
import { ManagerAiInsightsTab } from '@/components/dashboards/manager/AiInsightsTab';
import { ManagerContractsTab } from '@/components/dashboards/manager/ContractsTab';
import { ManagerSetTargetModal } from '@/components/dashboards/manager/SetTargetModal';
import type { BranchMetrics, TeamMember } from '@/components/dashboards/manager/types';

interface KPIData {
  totalTeamMembers: number;
  activeDeals: number;
  monthlyRevenue: number;
  conversionRate: number;
  leadsThisMonth: number;
  targetAchievement: number;
  teamHealthScore: number;
  avgDealSize: number;
}

interface Contract {
  id: string;
  status: 'DRAFT' | 'SIGNED' | 'ARCHIVED';
  signedAt: string | null;
  signedBy: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  template: {
    id: string;
    name: string;
    description: string | null;
  };
  stand: {
    id: string;
    standNumber: string;
    price: number;
    sizeSqm: number;
    development: {
      id: string;
      name: string;
      location: string;
    };
  } | null;
  paymentSummary: {
    totalPrice: number;
    paidToDate: number;
    remainingBalance: number;
    paymentCount: number;
    paymentProgress: number;
  };
}

interface ContractsData {
  contracts: Contract[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalContracts: number;
    draftContracts: number;
    signedContracts: number;
    archivedContracts: number;
    totalValue: number;
    totalPaid: number;
  };
}

export function ManagerDashboard() {
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'developments' | 'stands' | 'contracts' | 'targets' | 'team' | 'branches' | 'ai-insights'>('overview');

  const [kpis, setKpis] = useState<KPIData>({
    totalTeamMembers: 0,
    activeDeals: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
    leadsThisMonth: 0,
    targetAchievement: 0,
    teamHealthScore: 0,
    avgDealSize: 0,
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [branchMetrics, setBranchMetrics] = useState<BranchMetrics[]>([]);
  const [chartData, setChartData] = useState<{ month: string; deals: number; revenue: number; target: number }[]>([]);

  // Developments Overview State
  const [developmentsData, setDevelopmentsData] = useState<{
    developments: Array<{
      id: string;
      name: string;
      location: string;
      branch: string;
      totalStands: number;
      availableStands: number;
      reservedStands: number;
      soldStands: number;
      basePrice: number;
      status: string;
    }>;
    summary: {
      totalDevelopments: number;
      totalStands: number;
      availableStands: number;
      reservedStands: number;
      soldStands: number;
      totalValue: number;
    };
  }>({
    developments: [],
    summary: {
      totalDevelopments: 0,
      totalStands: 0,
      availableStands: 0,
      reservedStands: 0,
      soldStands: 0,
      totalValue: 0
    }
  });
  const [developmentsLoading, setDevelopmentsLoading] = useState(false);

  // GROQ Financial Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(false);
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<any>(null);

  // Contracts State
  const [contractsData, setContractsData] = useState<ContractsData>({
    contracts: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    summary: { totalContracts: 0, draftContracts: 0, signedContracts: 0, archivedContracts: 0, totalValue: 0, totalPaid: 0 }
  });
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // Contract filters
  const [contractFilters, setContractFilters] = useState({
    status: 'ALL',
    developmentId: 'ALL',
    agentId: 'ALL',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [contractPage, setContractPage] = useState(1);

  // Revenue Analytics State
  const [revenueData, setRevenueData] = useState<{
    summary: {
      thisWeek: { revenue: number; transactions: number; trend: number; trendDirection: 'up' | 'down' };
      thisMonth: { revenue: number; transactions: number; trend: number; trendDirection: 'up' | 'down' };
      previousMonth: { revenue: number; transactions: number };
      yearToDate: { revenue: number; transactions: number };
      avgDealSize: number;
      branch: string;
    };
    dailyRevenue: Array<{ date: string; revenue: number; transactions: number }>;
    monthlyTrends: Array<{ month: string; monthName: string; revenue: number; transactions: number; uniqueClients: number }>;
    revenueByType: Array<{ type: string; revenue: number; transactions: number; percentage: string }>;
  }>({
    summary: {
      thisWeek: { revenue: 0, transactions: 0, trend: 0, trendDirection: 'up' },
      thisMonth: { revenue: 0, transactions: 0, trend: 0, trendDirection: 'up' },
      previousMonth: { revenue: 0, transactions: 0 },
      yearToDate: { revenue: 0, transactions: 0 },
      avgDealSize: 0,
      branch: ''
    },
    dailyRevenue: [],
    monthlyTrends: [],
    revenueByType: []
  });
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Payouts Analytics State
  const [payoutsData, setPayoutsData] = useState<{
    summary: {
      currentMonth: { due: number; agents: number; commissions: number; trend: number; trendDirection: 'up' | 'down'; month: string };
      previousMonth: { total: number; commissions: number; month: string };
      totalPending: { amount: number; commissions: number; agents: number };
      totalPaid: { amount: number; commissions: number };
      netCashPosition: { amount: number; revenue: number; payouts: number; margin: string };
      branch: string;
    };
    agentBreakdown: Array<{
      agent: { name: string; email: string };
      calculated: number;
      approved: number;
      paid: number;
      total: number;
      commissionCount: number;
    }>;
    monthlyTrends: Array<{ month: string; monthName: string; calculated: number; approved: number; paid: number; totalAgents: number; commissionCount: number }>;
    payoutDistribution: { calculated: number; approved: number; paid: number };
  }>({
    summary: {
      currentMonth: { due: 0, agents: 0, commissions: 0, trend: 0, trendDirection: 'up', month: '' },
      previousMonth: { total: 0, commissions: 0, month: '' },
      totalPending: { amount: 0, commissions: 0, agents: 0 },
      totalPaid: { amount: 0, commissions: 0 },
      netCashPosition: { amount: 0, revenue: 0, payouts: 0, margin: '0.0' },
      branch: ''
    },
    agentBreakdown: [],
    monthlyTrends: [],
    payoutDistribution: { calculated: 0, approved: 0, paid: 0 }
  });
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Sales Targets State
  const [targetsData, setTargetsData] = useState<{
    targets: Array<{
      id: string;
      agent: { id: string; name: string; email: string };
      development: { id: string; name: string; location: string } | null;
      targetPeriod: string;
      targetType: string;
      revenueTarget: number | null;
      dealsTarget: number | null;
      actualRevenue: number;
      actualDeals: number;
      paymentCount: number;
      revenueProgress: number | null;
      dealsProgress: number | null;
      forecastRevenue: number;
      forecastDeals: number;
      revenueStatus: string | null;
      dealsStatus: string | null;
      setBy: string;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    summary: {
      totalTargets: number;
      targetsAchieved: number;
      targetsOnTrack: number;
      targetsBehind: number;
      totalRevenueTarget: number;
      totalActualRevenue: number;
      totalDealsTarget: number;
      totalActualDeals: number;
      period: string;
      branch: string;
    };
  }>({
    targets: [],
    summary: {
      totalTargets: 0,
      targetsAchieved: 0,
      targetsOnTrack: 0,
      targetsBehind: 0,
      totalRevenueTarget: 0,
      totalActualRevenue: 0,
      totalDealsTarget: 0,
      totalActualDeals: 0,
      period: '',
      branch: ''
    }
  });
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Target Creation Modal State
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedTargetAgent, setSelectedTargetAgent] = useState<string>('');
  const [selectedTargetDevelopment, setSelectedTargetDevelopment] = useState<string>('');
  const [targetRevenue, setTargetRevenue] = useState<string>('');
  const [targetDeals, setTargetDeals] = useState<string>('');
  const [targetNotes, setTargetNotes] = useState<string>('');
  const [targetSubmitting, setTargetSubmitting] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Team Members for Target Selection
  const [agents, setAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Fetch all manager data - OPTIMIZED with parallel requests
  const fetchManagerData = async () => {
    try {
      setRefreshing(true);
      setDevelopmentsLoading(true);

      // Parallel API calls for better performance
      // FIXED: Use manager-scoped developments endpoint instead of admin
      const [statsResponse, teamResponse, branchResponse, chartResponse, revenueResponse, payoutsResponse, targetsResponse, developmentsResponse] = await Promise.all([
        fetch(`/api/manager/stats?branch=${selectedBranch}&range=${timeRange}`),
        fetch(`/api/manager/team?branch=${selectedBranch === 'all' ? '' : selectedBranch}`),
        fetch(`/api/manager/branches?range=${timeRange}`),
        fetch(`/api/manager/chart-data?branch=${selectedBranch}&months=6`),
        fetch(`/api/manager/revenue?branch=${selectedBranch}`),
        fetch(`/api/manager/payouts?branch=${selectedBranch}`),
        fetch(`/api/manager/targets?branch=${selectedBranch}&period=${targetPeriod}`),
        fetch(`/api/manager/developments?branch=${selectedBranch === 'all' ? '' : selectedBranch}&status=Active`)
      ]);

      // Process stats
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.data) {
          setKpis(statsData.data);
        }
      }

      // Process team members
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        if (teamData.success && teamData.data) {
          const mappedTeam: TeamMember[] = teamData.data.map((member: any) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: 'AGENT',
            branch: member.branch || 'Harare',
            leadsGenerated: member.metrics?.totalClients || 0,
            dealsClosedThisMonth: member.metrics?.activeReservations || 0,
            conversionRate: member.metrics?.totalClients > 0
              ? Math.round((member.metrics.activeReservations / member.metrics.totalClients) * 100 * 10) / 10
              : 0,
            targetAchievement: Math.min(Math.round((member.metrics?.totalCommissions || 0) * 10), 150),
            status: 'active' as const,
            lastActivity: member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Recently',
          }));
          setTeamMembers(mappedTeam);
        }
      }

      // Process branch metrics
      if (branchResponse.ok) {
        const branchData = await branchResponse.json();
        if (branchData.success && branchData.data) {
          setBranchMetrics(branchData.data);
        }
      }

      // Process chart data
      if (chartResponse.ok) {
        const chartResult = await chartResponse.json();
        if (chartResult.success && chartResult.data) {
          setChartData(chartResult.data);
        }
      }

      // Process revenue data
      if (revenueResponse.ok) {
        const revenueResult = await revenueResponse.json();
        if (revenueResult.success && revenueResult.data) {
          setRevenueData(revenueResult.data);
        }
      }

      // Process payouts data
      if (payoutsResponse.ok) {
        const payoutsResult = await payoutsResponse.json();
        if (payoutsResult.success && payoutsResult.data) {
          setPayoutsData(payoutsResult.data);
        }
      }

      // Process targets data
      if (targetsResponse.ok) {
        const targetsResult = await targetsResponse.json();
        if (targetsResult.success && targetsResult.data) {
          setTargetsData(targetsResult.data);
        }
      }

      // Process developments data
      if (developmentsResponse.ok) {
        const devResult = await developmentsResponse.json();
        // API returns { success: true, data: [...] } or { developments: [...] }
        const devs = Array.isArray(devResult.data) ? devResult.data :
          Array.isArray(devResult.developments) ? devResult.developments :
            Array.isArray(devResult) ? devResult : [];

        if (devs.length > 0) {
          // Calculate summary statistics
          const summary = {
            totalDevelopments: devs.length,
            totalStands: devs.reduce((sum: number, d: any) => sum + (Number(d.total_stands) || 0), 0),
            availableStands: devs.reduce((sum: number, d: any) => sum + (Number(d.available_stands) || 0), 0),
            reservedStands: devs.reduce((sum: number, d: any) => {
              // Calculate reserved stands (total - available - sold, or use reserved count if available)
              const total = Number(d.total_stands) || 0;
              const available = Number(d.available_stands) || 0;
              // If we have reserved count, use it; otherwise estimate
              const reserved = Number(d.reserved_stands) || Math.max(0, total - available);
              return sum + reserved;
            }, 0),
            soldStands: devs.reduce((sum: number, d: any) => {
              const total = Number(d.total_stands) || 0;
              const available = Number(d.available_stands) || 0;
              const reserved = Number(d.reserved_stands) || Math.max(0, total - available);
              return sum + Math.max(0, total - available - reserved);
            }, 0),
            totalValue: devs.reduce((sum: number, d: any) => {
              const totalStands = Number(d.total_stands) || 0;
              const basePrice = Number(d.base_price) || 0;
              return sum + (totalStands * basePrice);
            }, 0)
          };

          const mappedDevelopments = devs.map((d: any) => {
            const total = Number(d.total_stands) || 0;
            const available = Number(d.available_stands) || 0;
            const reserved = Number(d.reserved_stands) || Math.max(0, total - available);
            const sold = Math.max(0, total - available - reserved);

            return {
              id: d.id,
              name: d.name,
              location: d.location || 'Location TBD',
              branch: d.branch || 'Harare',
              totalStands: total,
              availableStands: available,
              reservedStands: reserved,
              soldStands: sold,
              basePrice: Number(d.base_price) || 0,
              status: d.status || 'Active'
            };
          });

          setDevelopmentsData({
            developments: mappedDevelopments,
            summary
          });
        } else {
          // Reset to empty state if no developments
          setDevelopmentsData({
            developments: [],
            summary: {
              totalDevelopments: 0,
              totalStands: 0,
              availableStands: 0,
              reservedStands: 0,
              soldStands: 0,
              totalValue: 0
            }
          });
        }
      }

    } catch (error) {
      logger.error('Error fetching manager data', error as Error, { module: 'ManagerDashboard', action: 'FETCH_MANAGER_DATA' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch contracts data with filtering
  const fetchContractsData = async (page: number = contractPage) => {
    try {
      setContractsLoading(true);

      // Build query parameters
      const params = new URLSearchParams({
        branch: selectedBranch,
        page: page.toString(),
        limit: '50'
      });

      if (contractFilters.status !== 'ALL') {
        params.append('status', contractFilters.status);
      }
      if (contractFilters.developmentId !== 'ALL') {
        params.append('developmentId', contractFilters.developmentId);
      }
      if (contractFilters.agentId !== 'ALL') {
        params.append('agentId', contractFilters.agentId);
      }
      if (contractFilters.dateFrom) {
        params.append('dateFrom', contractFilters.dateFrom);
      }
      if (contractFilters.dateTo) {
        params.append('dateTo', contractFilters.dateTo);
      }

      const response = await fetch(`/api/manager/contracts?${params}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setContractsData(data.data);
          setContractPage(page);
        } else {
          logger.error('Failed to fetch contracts', new Error(data.error || 'Unknown error'), { module: 'ManagerDashboard', action: 'FETCH_CONTRACTS' });
        }
      } else {
        logger.error('Failed to fetch contracts: HTTP', new Error(`HTTP ${response.status}`), { module: 'ManagerDashboard', action: 'FETCH_CONTRACTS', status: response.status });
      }
    } catch (error) {
      logger.error('Error fetching contracts', error as Error, { module: 'ManagerDashboard', action: 'FETCH_CONTRACTS' });
    } finally {
      setContractsLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
  }, [selectedBranch, timeRange]);

  // Listen for payment refresh events and auto-refresh dashboard
  usePaymentRefresh(() => fetchManagerData(), [selectedBranch, timeRange]);

  // Check AI Analysis availability on load
  useEffect(() => {
    checkAiAnalysisStatus();
  }, []);

  // Fetch contracts data when contracts tab is active or filters change
  useEffect(() => {
    if (activeTab === 'contracts') {
      fetchContractsData(1); // Reset to page 1 when filters change
    }
  }, [activeTab, selectedBranch, contractFilters]);

  // Debounced search effect for contracts
  useEffect(() => {
    if (activeTab === 'contracts' && contractFilters.search) {
      const timeoutId = setTimeout(() => {
        fetchContractsData(1);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [contractFilters.search]);

  // Fetch targets when period changes or targets tab is active
  useEffect(() => {
    if (activeTab === 'targets') {
      fetchTargetsData();
    }
  }, [activeTab, selectedBranch, targetPeriod]);

  // Fetch targets data
  const fetchTargetsData = async () => {
    try {
      setTargetsLoading(true);

      const response = await fetch(`/api/manager/targets?branch=${selectedBranch}&period=${targetPeriod}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTargetsData(data.data);
        } else {
          logger.error('Failed to fetch targets', new Error(data.error || 'Unknown error'), { module: 'ManagerDashboard', action: 'FETCH_TARGETS' });
        }
      } else {
        logger.error('Failed to fetch targets: HTTP', new Error(`HTTP ${response.status}`), { module: 'ManagerDashboard', action: 'FETCH_TARGETS', status: response.status });
      }
    } catch (error) {
      logger.error('Error fetching targets', error as Error, { module: 'ManagerDashboard', action: 'FETCH_TARGETS' });
    } finally {
      setTargetsLoading(false);
    }
  };

  // Fetch agents for target selection
  const fetchAgents = async () => {
    try {
      setAgentsLoading(true);
      const params = new URLSearchParams({
        role: 'AGENT'
      });

      if (selectedBranch !== 'all') {
        params.append('branch', selectedBranch);
      }

      const response = await fetch(`/api/manager/team?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.users) {
        setAgents(data.users.map((u: any) => ({
          id: u.id,
          name: u.name || 'Unknown',
          email: u.email || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Open target modal
  const openTargetModal = () => {
    setSelectedTargetAgent('');
    setSelectedTargetDevelopment('');
    setTargetRevenue('');
    setTargetDeals('');
    setTargetNotes('');
    setTargetError(null);
    fetchAgents();
    setShowTargetModal(true);
  };

  // Handle set target submission
  const handleSetTarget = async () => {
    if (!selectedTargetAgent) {
      setTargetError('Please select an agent');
      return;
    }

    if (!targetRevenue && !targetDeals) {
      setTargetError('Please enter at least one target (revenue or deals)');
      return;
    }

    try {
      setTargetSubmitting(true);
      setTargetError(null);

      const response = await fetch('/api/manager/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedTargetAgent,
          developmentId: selectedTargetDevelopment || undefined,
          targetPeriod,
          targetType: 'MONTHLY',
          revenueTarget: targetRevenue ? parseFloat(targetRevenue) : undefined,
          dealsTarget: targetDeals ? parseInt(targetDeals, 10) : undefined,
          notes: targetNotes || undefined,
          branch: selectedBranch !== 'all' ? selectedBranch : 'Harare'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setShowTargetModal(false);
        fetchTargetsData(); // Refresh targets list
      } else {
        throw new Error(data.error || 'Failed to create target');
      }
    } catch (error: any) {
      setTargetError(error.message || 'Failed to create target');
    } finally {
      setTargetSubmitting(false);
    }
  };

  const checkAiAnalysisStatus = async () => {
    try {
      const response = await fetch('/api/manager/financial-analysis');
      if (response.ok) {
        const status = await response.json();
        setAiAnalysisEnabled(!!status?.enabled);
        setAiAnalysisStatus(status ?? {});
      } else {
        // Endpoint doesn't exist or is disabled - gracefully disable AI analysis
        setAiAnalysisEnabled(false);
        setAiAnalysisStatus({});
      }
    } catch (error) {
      // Silently handle 404 or other errors - AI analysis is optional
      setAiAnalysisEnabled(false);
      setAiAnalysisStatus({});
    }
  };

  const generateAiAnalysis = async (analysisType: 'monthly' | 'quarterly' | 'risks' = 'monthly') => {
    if (!aiAnalysisEnabled || aiAnalysisLoading) return;

    setAiAnalysisLoading(true);
    try {
      const response = await fetch('/api/manager/financial-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisType,
          branch: selectedBranch === 'all' ? null : selectedBranch
        })
      });

      if (!response.ok) {
        setAiAnalysisEnabled(false);
        setAiAnalysisLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success && result.analysis) {
        setAiAnalysis(result.analysis);
        logger.info('AI Financial Analysis generated', {
          module: 'ManagerDashboard',
          action: 'AI_ANALYSIS',
          riskScore: result.analysis.riskScore,
          insights: result.analysis.insights.length,
          cashflowHealth: result.analysis.cashflowHealth
        });
      } else {
        // Handle fallback analysis
        if (result.fallback) {
          setAiAnalysis(result.fallback);
        }
        logger.warn('AI analysis unavailable', { module: 'ManagerDashboard', action: 'AI_ANALYSIS', error: result.error });
      }
    } catch (error) {
      // Silently handle errors - AI analysis is optional
      setAiAnalysisEnabled(false);
      setAiAnalysis(null);
      // Don't log 404 errors as they're expected when the endpoint doesn't exist
      if (error instanceof Error && !error.message.includes('404') && !error.message.includes('Failed to fetch')) {
        logger.error('AI analysis failed', error, { module: 'ManagerDashboard', action: 'AI_ANALYSIS' });
      }
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // Tab configuration
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'developments', label: 'Developments', icon: Layers },
    { id: 'stands', label: 'Stands', icon: MapIcon },
    { id: 'contracts', label: 'Contracts', icon: FileText },
    { id: 'targets', label: 'Targets', icon: Target },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'branches', label: 'Branches', icon: Building2 },
    ...(aiAnalysisEnabled ? [
      { id: 'ai-insights', label: 'AI Insights', icon: Brain, badge: aiAnalysis ? 1 : undefined }
    ] : [])
  ];

  // Export functions for CSV reports
  const exportRevenue = async (period: string) => {
    try {
      const params = new URLSearchParams({ type: 'revenue', format: 'pdf', branch: selectedBranch, period });
      const res = await fetch(`/api/manager/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `revenue-report-${period}-${Date.now()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { logger.error('Export revenue failed', e as Error, { module: 'ManagerDashboard', action: 'EXPORT_REVENUE' }); }
  };

  const exportPayouts = async () => {
    try {
      const params = new URLSearchParams({ type: 'payouts', format: 'csv', branch: selectedBranch });
      const res = await fetch(`/api/manager/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payouts-report-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { logger.error('Export payouts failed', e as Error, { module: 'ManagerDashboard', action: 'EXPORT_PAYOUTS' }); }
  };

  const exportContracts = async () => {
    try {
      const params = new URLSearchParams({ type: 'contracts', format: 'csv', branch: selectedBranch });
      Object.entries(contractFilters).forEach(([k, v]) => { if (v && v !== 'ALL') params.set(k, String(v)); });
      const res = await fetch(`/api/manager/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts-report-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { logger.error('Export contracts failed', e as Error, { module: 'ManagerDashboard', action: 'EXPORT_CONTRACTS' }); }
  };

  const exportTargets = async () => {
    try {
      const params = new URLSearchParams({ type: 'targets', format: 'csv', branch: selectedBranch, period: targetPeriod });
      const res = await fetch(`/api/manager/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `targets-report-${targetPeriod}-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { logger.error('Export targets failed', e as Error, { module: 'ManagerDashboard', action: 'EXPORT_TARGETS' }); }
  };

  // Memoize chart data to prevent unnecessary re-renders
  const memoizedChartData = useMemo(() => chartData, [chartData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <RefreshCw className="w-10 h-10 animate-spin text-[#B8860B] mx-auto" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Using shared component */}
      <DashboardHeader
        title="Manager Portal"
        subtitle="Team Performance • All amounts USD"
        onRefresh={fetchManagerData}
        refreshing={refreshing}
        actions={
          <div className="flex items-center gap-3">
            {/* Branch Filter */}
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Branch" aria-label="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                <SelectItem value="Harare">Harare</SelectItem>
                <SelectItem value="Bulawayo">Bulawayo</SelectItem>
                <SelectItem value="Mutare">Mutare</SelectItem>
              </SelectContent>
            </Select>
            {/* Time Range Filter */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Period" aria-label="Select time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Navigation Tabs - Using shared component */}
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as any)}
      />

      {/* Main Content */}
      <main className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="space-y-6 pb-12">

          {/* KPI Cards - Using shared component */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <KPICard
                title="Team Members"
                value={kpis.totalTeamMembers}
                subtitle="Active agents"
                icon={Users}
                variant="default"
                color="blue"
                trend="neutral"
                trendValue="100% coverage"
              />

              <KPICard
                title="Active Deals"
                value={kpis.activeDeals}
                subtitle="In pipeline"
                icon={Target}
                variant="default"
                color="green"
                trend="up"
                trendValue="+4 this week"
              />

              <KPICard
                title="Monthly Revenue"
                value={`USD ${(kpis.monthlyRevenue / 1000).toFixed(0)}K`}
                subtitle="Total this month"
                icon={DollarSign}
                variant="default"
                color="emerald"
                trend="up"
                trendValue="+12% from last month"
              />

              <KPICard
                title="Target Achievement"
                value={`${kpis.targetAchievement}%`}
                subtitle="Team performance"
                icon={TrendingUp}
                variant="default"
                color="amber"
              />
            </div>
          )}

          {/* Developments Overview Section - Overview Tab */}
          {activeTab === 'overview' && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-fcGold" />
                    <CardTitle>Developments Overview</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/dashboards/admin?tab=developments'}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </div>
                <CardDescription>Active developments and stand inventory</CardDescription>
              </CardHeader>
              <CardContent>
                {developmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-fcGold" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <p className="text-xs font-medium text-blue-600 mb-1">Total Developments</p>
                        <p className="text-2xl font-bold text-blue-900">{developmentsData.summary.totalDevelopments}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <p className="text-xs font-medium text-green-600 mb-1">Total Stands</p>
                        <p className="text-2xl font-bold text-green-900">{developmentsData.summary.totalStands.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                        <p className="text-xs font-medium text-emerald-600 mb-1">Available</p>
                        <p className="text-2xl font-bold text-emerald-900">{developmentsData.summary.availableStands.toLocaleString()}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <p className="text-xs font-medium text-amber-600 mb-1">Reserved</p>
                        <p className="text-2xl font-bold text-amber-900">{developmentsData.summary.reservedStands.toLocaleString()}</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                        <p className="text-xs font-medium text-purple-600 mb-1">Total Value</p>
                        <p className="text-lg font-bold text-purple-900">
                          ${(developmentsData.summary.totalValue / 1000000).toFixed(1)}M
                        </p>
                      </div>
                    </div>

                    {/* Developments List */}
                    {developmentsData.developments.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Active Developments</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {developmentsData.developments.slice(0, 10).map((dev) => {
                            const utilizationRate = dev.totalStands > 0
                              ? ((dev.totalStands - dev.availableStands) / dev.totalStands * 100).toFixed(1)
                              : '0';
                            return (
                              <div
                                key={dev.id}
                                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-fcGold/50 hover:shadow-md transition-all"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h5 className="font-semibold text-gray-900">{dev.name}</h5>
                                    <span className="px-2 py-0.5 text-xs font-medium bg-fcGold/10 text-fcGold rounded-full">
                                      {dev.branch}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">{dev.location}</p>
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                      {dev.availableStands} Available
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                      {dev.reservedStands} Reserved
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                      {dev.totalStands} Total
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="mb-2">
                                    <div className="flex items-center justify-end gap-2 mb-1">
                                      <span className="text-xs text-gray-500">Utilization</span>
                                      <span className="text-sm font-bold text-gray-900">{utilizationRate}%</span>
                                    </div>
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-fcGold to-amber-500 transition-all"
                                        style={{ width: `${utilizationRate}%` }}
                                      />
                                    </div>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    ${(dev.basePrice / 1000).toFixed(0)}K
                                  </p>
                                  <p className="text-xs text-gray-500">Base Price</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {developmentsData.developments.length > 10 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            Showing 10 of {developmentsData.developments.length} developments
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No active developments found</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Developments Tab - Full Developments Management */}
          {activeTab === 'developments' && (
            <AdminDevelopmentsDashboard
              activeBranch={(selectedBranch === 'all' ? 'Harare' : selectedBranch) as any}
              userRole="Manager"
            />
          )}

          {/* Stands Tab - Full Stands/Inventory Management */}
          {activeTab === 'stands' && (
            <StandsInventoryView
              role="manager"
              title="Stands Inventory"
              subtitle="View and manage stands across your branch developments"
            />
          )}

          {/* Revenue Overview Section - Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Revenue Summary Cards */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Revenue Analytics
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => exportRevenue('month')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Revenue Report
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">This Week</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(revenueData.summary.thisWeek.revenue / 1000).toFixed(0)}K
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {revenueData.summary.thisWeek.trendDirection === 'up' ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                            )}
                            <span className={`text-sm font-medium ${revenueData.summary.thisWeek.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                              }`}>
                              {revenueData.summary.thisWeek.trend >= 0 ? '+' : ''}{revenueData.summary.thisWeek.trend.toFixed(1)}%
                            </span>
                            <span className="text-sm text-gray-500">vs last week</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {revenueData.summary.thisWeek.transactions} transaction{revenueData.summary.thisWeek.transactions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Calendar className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">This Month</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(revenueData.summary.thisMonth.revenue / 1000).toFixed(0)}K
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {revenueData.summary.thisMonth.trendDirection === 'up' ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                            )}
                            <span className={`text-sm font-medium ${revenueData.summary.thisMonth.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                              }`}>
                              {revenueData.summary.thisMonth.trend >= 0 ? '+' : ''}{revenueData.summary.thisMonth.trend.toFixed(1)}%
                            </span>
                            <span className="text-sm text-gray-500">vs last month</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {revenueData.summary.thisMonth.transactions} transaction{revenueData.summary.thisMonth.transactions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Previous Month</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(revenueData.summary.previousMonth.revenue / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-3">
                            {revenueData.summary.previousMonth.transactions} transaction{revenueData.summary.previousMonth.transactions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded-lg">
                          <BarChart3 className="w-6 h-6 text-gray-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Avg Deal Size</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(revenueData.summary.avgDealSize / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-3">This month average</p>
                        </div>
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Target className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Revenue Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Revenue Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Revenue Trend</CardTitle>
                    <CardDescription>Revenue performance this month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueData.dailyRevenue}>
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
                            formatter={(value: any) => [`$${(value / 1000).toFixed(1)}K`, 'Revenue']}
                            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
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
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue by Payment Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Payment Type</CardTitle>
                    <CardDescription>Breakdown by transaction type this month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {revenueData.revenueByType.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No revenue data available</p>
                        </div>
                      ) : (
                        revenueData.revenueByType.map((type, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{type.type}</div>
                              <div className="text-sm text-gray-500">{type.transactions} transactions</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                ${(type.revenue / 1000).toFixed(0)}K
                              </div>
                              <div className="text-sm text-gray-500">{type.percentage}%</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Payouts Overview Section - Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Payouts Summary Cards */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-red-600" />
                    Expected Payouts & Cash Flow
                  </h3>
                  <Button variant="outline" size="sm" onClick={exportPayouts}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Payouts Report
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Commissions Due</p>
                          <p className="text-2xl font-bold text-red-600">
                            ${(payoutsData.summary.currentMonth.due / 1000).toFixed(0)}K
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {payoutsData.summary.currentMonth.trendDirection === 'up' ? (
                              <TrendingUp className="w-4 h-4 text-red-500" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-green-500 rotate-180" />
                            )}
                            <span className={`text-sm font-medium ${payoutsData.summary.currentMonth.trendDirection === 'up' ? 'text-red-600' : 'text-green-600'
                              }`}>
                              {payoutsData.summary.currentMonth.trend >= 0 ? '+' : ''}{payoutsData.summary.currentMonth.trend.toFixed(1)}%
                            </span>
                            <span className="text-sm text-gray-500">vs last month</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {payoutsData.summary.currentMonth.agents} agent{payoutsData.summary.currentMonth.agents !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-red-100 p-2 rounded-lg">
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Pending</p>
                          <p className="text-2xl font-bold text-orange-600">
                            ${(payoutsData.summary.totalPending.amount / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-3">
                            {payoutsData.summary.totalPending.commissions} commission{payoutsData.summary.totalPending.commissions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-orange-100 p-2 rounded-lg">
                          <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Paid</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${(payoutsData.summary.totalPaid.amount / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-3">
                            {payoutsData.summary.totalPaid.commissions} commission{payoutsData.summary.totalPaid.commissions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-green-100 p-2 rounded-lg">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Net Cash Position</p>
                          <p className={`text-2xl font-bold ${payoutsData.summary.netCashPosition.amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {payoutsData.summary.netCashPosition.amount >= 0 ? '+' : ''}${(payoutsData.summary.netCashPosition.amount / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Margin: {payoutsData.summary.netCashPosition.margin}%
                          </p>
                        </div>
                        <div className={`p-2 rounded-lg ${payoutsData.summary.netCashPosition.amount >= 0 ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                          <Target className={`w-6 h-6 ${payoutsData.summary.netCashPosition.amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Previous Month</p>
                          <p className="text-2xl font-bold text-gray-600">
                            ${(payoutsData.summary.previousMonth.total / 1000).toFixed(0)}K
                          </p>
                          <p className="text-xs text-gray-500 mt-3">
                            {payoutsData.summary.previousMonth.commissions} commission{payoutsData.summary.previousMonth.commissions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded-lg">
                          <BarChart3 className="w-6 h-6 text-gray-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Payouts Charts and Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Agent Commission Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Agent Commission Breakdown</CardTitle>
                    <CardDescription>Current month commission status by agent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                      {payoutsData.agentBreakdown.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No commission data available</p>
                        </div>
                      ) : (
                        payoutsData.agentBreakdown.map((agent, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-gray-900">{agent.agent.name}</div>
                                <div className="text-sm text-gray-500">{agent.agent.email}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">
                                  ${(agent.total / 1000).toFixed(1)}K
                                </div>
                                <div className="text-sm text-gray-500">
                                  {agent.commissionCount} commission{agent.commissionCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span>Calc: ${(agent.calculated / 1000).toFixed(1)}K</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span>Approved: ${(agent.approved / 1000).toFixed(1)}K</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>Paid: ${(agent.paid / 1000).toFixed(1)}K</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Payout Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payout Status Distribution</CardTitle>
                    <CardDescription>Commission breakdown by status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-yellow-600" />
                          <div>
                            <div className="font-medium text-yellow-900">Calculated</div>
                            <div className="text-sm text-yellow-700">Pending approval</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-yellow-900">
                            ${(payoutsData.payoutDistribution.calculated / 1000).toFixed(1)}K
                          </div>
                          <div className="text-sm text-yellow-700">
                            {payoutsData.summary.totalPending.amount > 0
                              ? ((payoutsData.payoutDistribution.calculated / payoutsData.summary.totalPending.amount) * 100).toFixed(1)
                              : 0}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-orange-600" />
                          <div>
                            <div className="font-medium text-orange-900">Approved</div>
                            <div className="text-sm text-orange-700">Ready for payment</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-orange-900">
                            ${(payoutsData.payoutDistribution.approved / 1000).toFixed(1)}K
                          </div>
                          <div className="text-sm text-orange-700">
                            {payoutsData.summary.totalPending.amount > 0
                              ? ((payoutsData.payoutDistribution.approved / payoutsData.summary.totalPending.amount) * 100).toFixed(1)
                              : 0}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <div className="font-medium text-green-900">Paid</div>
                            <div className="text-sm text-green-700">Completed payments</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-900">
                            ${(payoutsData.payoutDistribution.paid / 1000).toFixed(1)}K
                          </div>
                          <div className="text-sm text-green-700">Historical</div>
                        </div>
                      </div>

                      <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-blue-900">Cash Flow Impact</div>
                            <div className="text-sm text-blue-700">Revenue - Payouts = Net Position</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-blue-700">
                              ${(payoutsData.summary.netCashPosition.revenue / 1000).toFixed(0)}K - ${(payoutsData.summary.currentMonth.due / 1000).toFixed(0)}K =
                            </div>
                            <div className={`font-semibold ${payoutsData.summary.netCashPosition.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                              {payoutsData.summary.netCashPosition.amount >= 0 ? '+' : ''}${(payoutsData.summary.netCashPosition.amount / 1000).toFixed(0)}K
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Charts - Memoized to prevent unnecessary re-renders */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue & Deal Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue & Deals Trend</CardTitle>
                  <CardDescription>Last 6 months performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={memoizedChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="deals"
                        stroke="#3b82f6"
                        name="Deals Closed"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        name="Revenue (USD)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Branch Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Branch Performance</CardTitle>
                  <CardDescription>Revenue by branch</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="branch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (USD)" />
                      <Bar dataKey="totalDeals" fill="#10b981" name="Deals" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <ManagerContractsTab
              selectedContractId={selectedContractId}
              setSelectedContractId={setSelectedContractId}
              contractsData={contractsData}
              contractsLoading={contractsLoading}
              contractPage={contractPage}
              fetchContractsData={fetchContractsData}
              exportContracts={exportContracts}
              contractFilters={contractFilters}
              setContractFilters={setContractFilters}
            />
          )}

          {/* Sales Targets Tab */}
          {activeTab === 'targets' && (
            <div className="space-y-6">
              {/* Targets Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <KPICard
                  title="Total Targets"
                  value={targetsData.summary.totalTargets}
                  icon={Target}
                  color="blue"
                  subtitle={`Period: ${targetPeriod}`}
                />
                <KPICard
                  title="Achieved"
                  value={targetsData.summary.targetsAchieved}
                  icon={CheckCircle}
                  color="green"
                  subtitle={`${targetsData.summary.totalTargets > 0
                    ? ((targetsData.summary.targetsAchieved / targetsData.summary.totalTargets) * 100).toFixed(1)
                    : 0}% success rate`}
                />
                <KPICard
                  title="On Track"
                  value={targetsData.summary.targetsOnTrack}
                  icon={TrendingUp}
                  color="amber"
                  subtitle="80%+ progress"
                />
                <KPICard
                  title="Behind"
                  value={targetsData.summary.targetsBehind}
                  icon={AlertTriangle}
                  color="red"
                  subtitle="Needs attention"
                />
                <KPICard
                  title="Revenue Progress"
                  value={`${targetsData.summary.totalRevenueTarget > 0
                    ? ((targetsData.summary.totalActualRevenue / targetsData.summary.totalRevenueTarget) * 100).toFixed(1)
                    : 0}%`}
                  icon={DollarSign}
                  color="purple"
                  subtitle={`$${(targetsData.summary.totalActualRevenue / 1000).toFixed(0)}K / $${(targetsData.summary.totalRevenueTarget / 1000).toFixed(0)}K`}
                />
              </div>

              {/* Targets Management */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle>Sales Targets Management</CardTitle>
                      <CardDescription>Monitor and manage team sales targets and progress</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label htmlFor="target-period" className="text-sm font-medium text-gray-700">
                          Period:
                        </label>
                        <input
                          id="target-period"
                          type="month"
                          value={targetPeriod}
                          onChange={(e) => setTargetPeriod(e.target.value)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTargetsData}
                        disabled={targetsLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${targetsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportTargets}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={openTargetModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Set Target
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Targets Table */}
                  <div className="overflow-x-auto">
                    {targetsLoading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-500">Loading targets...</p>
                      </div>
                    ) : targetsData.targets.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 text-lg">No targets set for this period</p>
                        <p className="text-gray-400">Create targets to track team performance</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-3 font-semibold">Agent</th>
                            <th className="text-left p-3 font-semibold hidden md:table-cell">Development</th>
                            <th className="text-left p-3 font-semibold hidden lg:table-cell">Revenue Target</th>
                            <th className="text-left p-3 font-semibold">Revenue Progress</th>
                            <th className="text-left p-3 font-semibold hidden lg:table-cell">Deals Target</th>
                            <th className="text-left p-3 font-semibold hidden md:table-cell">Deals Progress</th>
                            <th className="text-left p-3 font-semibold hidden md:table-cell">Status</th>
                            <th className="text-left p-3 font-semibold hidden lg:table-cell">Forecast</th>
                            <th className="text-left p-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {targetsData.targets.map((target) => (
                            <tr key={target.id} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <div>
                                  <div className="font-medium text-gray-900">{target.agent.name}</div>
                                  <div className="text-sm text-gray-500">{target.agent.email}</div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="text-sm">
                                  {target.development ? (
                                    <>
                                      <div className="font-medium">{target.development.name}</div>
                                      <div className="text-gray-500">{target.development.location}</div>
                                    </>
                                  ) : (
                                    <span className="text-gray-500">All developments</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                {target.revenueTarget ? (
                                  <div>
                                    <div className="font-medium">
                                      ${(target.revenueTarget / 1000).toFixed(0)}K
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Actual: ${(target.actualRevenue / 1000).toFixed(0)}K
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {target.revenueProgress !== null ? (
                                  <div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`h-2 rounded-full ${target.revenueProgress >= 100 ? 'bg-green-500' :
                                            target.revenueProgress >= 80 ? 'bg-yellow-500' :
                                              target.revenueProgress >= 50 ? 'bg-orange-500' : 'bg-red-500'
                                          }`}
                                        style={{ width: `${Math.min(target.revenueProgress, 100)}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-center font-medium">
                                      {target.revenueProgress.toFixed(1)}%
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {target.dealsTarget ? (
                                  <div>
                                    <div className="font-medium">
                                      {target.dealsTarget} deals
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Actual: {target.actualDeals}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {target.dealsProgress !== null ? (
                                  <div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`h-2 rounded-full ${target.dealsProgress >= 100 ? 'bg-green-500' :
                                            target.dealsProgress >= 80 ? 'bg-yellow-500' :
                                              target.dealsProgress >= 50 ? 'bg-orange-500' : 'bg-red-500'
                                          }`}
                                        style={{ width: `${Math.min(target.dealsProgress, 100)}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-center font-medium">
                                      {target.dealsProgress.toFixed(1)}%
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1">
                                  {target.revenueStatus && (
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${target.revenueStatus === 'achieved' ? 'bg-green-100 text-green-800' :
                                        target.revenueStatus === 'on-track' ? 'bg-yellow-100 text-yellow-800' :
                                          target.revenueStatus === 'needs-attention' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                      }`}>
                                      Rev: {target.revenueStatus.replace('-', ' ')}
                                    </span>
                                  )}
                                  {target.dealsStatus && (
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${target.dealsStatus === 'achieved' ? 'bg-green-100 text-green-800' :
                                        target.dealsStatus === 'on-track' ? 'bg-yellow-100 text-yellow-800' :
                                          target.dealsStatus === 'needs-attention' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                      }`}>
                                      Deals: {target.dealsStatus.replace('-', ' ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="text-sm">
                                  {target.revenueTarget && (
                                    <div>
                                      Rev: ${(target.forecastRevenue / 1000).toFixed(0)}K
                                    </div>
                                  )}
                                  {target.dealsTarget && (
                                    <div>
                                      Deals: {target.forecastDeals}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Set Target Modal */}
          {showTargetModal && (
            <ManagerSetTargetModal
              targetError={targetError}
              agents={agents}
              developments={developmentsData.developments}
              selectedTargetAgent={selectedTargetAgent}
              setSelectedTargetAgent={setSelectedTargetAgent}
              selectedTargetDevelopment={selectedTargetDevelopment}
              setSelectedTargetDevelopment={setSelectedTargetDevelopment}
              targetRevenue={targetRevenue}
              setTargetRevenue={setTargetRevenue}
              targetDeals={targetDeals}
              setTargetDeals={setTargetDeals}
              targetNotes={targetNotes}
              setTargetNotes={setTargetNotes}
              targetSubmitting={targetSubmitting}
              onClose={() => setShowTargetModal(false)}
              onSubmit={handleSetTarget}
            />
          )}

          {/* Team Members Tab */}
          {activeTab === 'team' && (
            <ManagerTeamTab teamMembers={teamMembers} selectedBranch={selectedBranch} />
          )}

          {/* Branch Metrics Tab */}
          {activeTab === 'branches' && (
            <ManagerBranchMetricsTab branchMetrics={branchMetrics} />
          )}

          {/* AI Financial Insights Tab */}
          {activeTab === 'ai-insights' && aiAnalysisEnabled && (
            <ManagerAiInsightsTab
              aiAnalysisLoading={aiAnalysisLoading}
              aiAnalysis={aiAnalysis}
              generateAiAnalysis={generateAiAnalysis}
            />
          )}
        </div>
      </main>
    </div>
  );
}
