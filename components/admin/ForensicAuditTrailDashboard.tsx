'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageContainer, SectionHeader, KPIGrid, ResponsiveTable } from '@/components/layouts';
import { getToolbarClasses } from '@/lib/responsive-framework';
import { 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  User,
  Clock,
  FileText,
  Shield,
  Eye,
  RefreshCw,
  Activity,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

interface AuditLog {
  id: string;
  branch: string;
  userId: string | null;
  action: string;
  module: string;
  recordId: string;
  description: string;
  changes: any;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface FilterOptions {
  modules: string[];
  actions: string[];
  users: Array<{ id: string; name: string; email: string; role: string }>;
}

interface AuditTrailDashboardProps {
  activeBranch?: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
  LOGIN: 'bg-purple-100 text-purple-800 border-purple-200',
  LOGOUT: 'bg-gray-100 text-gray-800 border-gray-200',
  VIEW: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  EXPORT: 'bg-orange-100 text-orange-800 border-orange-200',
  IMPORT: 'bg-teal-100 text-teal-800 border-teal-200',
  APPROVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECT: 'bg-rose-100 text-rose-800 border-rose-200',
  RESERVE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCEL: 'bg-amber-100 text-amber-800 border-amber-200',
  PAYMENT: 'bg-lime-100 text-lime-800 border-lime-200',
  EMAIL_SENT: 'bg-sky-100 text-sky-800 border-sky-200',
  STATUS_CHANGE: 'bg-violet-100 text-violet-800 border-violet-200',
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  AUTH: <Shield className="w-4 h-4" />,
  USERS: <User className="w-4 h-4" />,
  CLIENTS: <User className="w-4 h-4" />,
  STANDS: <FileText className="w-4 h-4" />,
  DEVELOPMENTS: <FileText className="w-4 h-4" />,
  PAYMENTS: <Activity className="w-4 h-4" />,
  CONTRACTS: <FileText className="w-4 h-4" />,
  RESERVATIONS: <Clock className="w-4 h-4" />,
  REPORTS: <FileText className="w-4 h-4" />,
  SETTINGS: <Shield className="w-4 h-4" />,
  EMAIL: <FileText className="w-4 h-4" />,
  RECEIPTS: <FileText className="w-4 h-4" />,
};

// Time Period Presets
const TIME_PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Custom', value: 'custom' },
];

// Helper to calculate date ranges
const getDateRange = (period: string): { start: string; end: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return { 
        start: today.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { 
        start: yesterday.toISOString().split('T')[0], 
        end: yesterday.toISOString().split('T')[0] 
      };
    }
    case '7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { 
        start: weekAgo.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    case '30days': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { 
        start: monthAgo.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { 
        start: firstOfMonth.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    case 'lastMonth': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { 
        start: firstOfLastMonth.toISOString().split('T')[0], 
        end: lastOfLastMonth.toISOString().split('T')[0] 
      };
    }
    case 'thisYear': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { 
        start: firstOfYear.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    default:
      return { start: '', end: '' };
  }
};

export default function ForensicAuditTrailDashboard({ activeBranch = 'Harare' }: AuditTrailDashboardProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ modules: [], actions: [], users: [] });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timePeriod, setTimePeriod] = useState('7days'); // Default to last 7 days
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Selected log for details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Initialize time period on mount
  useEffect(() => {
    const { start, end } = getDateRange('7days');
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Handle time period change
  const handleTimePeriodChange = (period: string) => {
    setTimePeriod(period);
    if (period !== 'custom') {
      const { start, end } = getDateRange(period);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        branch: activeBranch,
      });

      if (search) params.append('search', search);
      if (selectedModule && selectedModule !== 'all') params.append('module', selectedModule);
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (selectedUser && selectedUser !== 'all') params.append('userId', selectedUser);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/audit-trail?${params}`);
      if (!response.ok) {
        let errorMessage = 'Failed to fetch audit logs';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
      setTotal(data.pagination.total);
      setFilterOptions(data.filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, activeBranch, search, selectedModule, selectedAction, selectedUser, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedModule('all');
    setSelectedAction('all');
    setSelectedUser('all');
    setTimePeriod('7days');
    const { start, end } = getDateRange('7days');
    setStartDate(start);
    setEndDate(end);
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        limit: '10000',
        branch: activeBranch,
      });
      if (selectedModule && selectedModule !== 'all') params.append('module', selectedModule);
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/audit-trail?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      const data = await response.json();

      const csv = [
        ['Date/Time', 'User', 'Email', 'Role', 'Action', 'Module', 'Description', 'Record ID', 'Branch'].join(','),
        ...data.logs.map((log: AuditLog) => [
          new Date(log.createdAt).toISOString(),
          log.user?.name || 'System',
          log.user?.email || '-',
          log.user?.role || '-',
          log.action,
          log.module,
          `"${log.description.replace(/"/g, '""')}"`,
          log.recordId,
          log.branch,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${activeBranch}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        limit: '10000',
        branch: activeBranch,
      });
      if (selectedModule && selectedModule !== 'all') params.append('module', selectedModule);
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/audit-trail?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      const data = await response.json();

      // Create PDF
      const doc = new jsPDF('landscape');
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('FINE & COUNTRY', 14, 20);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 14, 26);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FORENSIC AUDIT TRAIL REPORT', 14, 38);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Branch: ${activeBranch}`, 14, 46);
      doc.text(`Period: ${startDate || 'All time'} to ${endDate || 'Present'}`, 14, 52);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 58);
      doc.text(`Total Records: ${data.logs.length}`, 14, 64);

      // Table data
      const tableData = data.logs.map((log: AuditLog) => [
        new Date(log.createdAt).toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
        log.user?.name || 'System',
        log.action,
        log.module,
        log.description.length > 60 ? log.description.substring(0, 60) + '...' : log.description,
        log.recordId.length > 15 ? log.recordId.substring(0, 15) + '...' : log.recordId,
      ]);

      // AutoTable
      autoTable(doc, {
        head: [['Date/Time', 'User', 'Action', 'Module', 'Description', 'Record ID']],
        body: tableData,
        startY: 72,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [10, 22, 41], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 100 },
          5: { cellWidth: 35 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Footer on each page
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
          doc.text(
            'Fine & Country Zimbabwe - Confidential',
            14,
            doc.internal.pageSize.height - 10
          );
        },
      });

      // Download
      doc.save(`audit-trail-${activeBranch}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action] || 'bg-gray-100 text-gray-800 border-gray-200';
    return (
      <Badge variant="outline" className={`${colorClass} font-medium`}>
        {action}
      </Badge>
    );
  };

  const getModuleBadge = (module: string) => {
    return (
      <div className="flex items-center gap-1.5 text-gray-600">
        {MODULE_ICONS[module] || <FileText className="w-4 h-4" />}
        <span className="text-xs font-medium">{module}</span>
      </div>
    );
  };

  return (
    <PageContainer className="space-y-6 py-6">
      {/* Header */}
      <SectionHeader
        title={
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-fcGold flex-shrink-0" />
            <span>Forensic Audit Trail</span>
          </div>
        }
        description="Complete activity log of all user actions in the system"
        actions={
          <>
            <Button
              variant="outline"
              onClick={fetchLogs}
              disabled={loading}
              className="gap-2"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting}
              className="gap-2"
              size="sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={exporting}
              className="gap-2 bg-fcGold text-white hover:bg-fcGold/90"
              size="sm"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <KPIGrid>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold">{total.toLocaleString()}</p>
              </div>
              <Activity className="w-8 h-8 text-fcGold" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold">{filterOptions.users.length}</p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Modules Tracked</p>
                <p className="text-2xl font-bold">{filterOptions.modules.length}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Action Types</p>
                <p className="text-2xl font-bold">{filterOptions.actions.length}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </KPIGrid>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            {/* Time Period Quick Select */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" />
                Quick Time Period
              </Label>
              <div className="flex flex-wrap gap-2">
                {TIME_PERIODS.map((period) => (
                  <Button
                    key={period.value}
                    variant={timePeriod === period.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTimePeriodChange(period.value)}
                    className={timePeriod === period.value ? 'bg-fcGold hover:bg-fcGold/90' : ''}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="module">Module</Label>
                <Select value={selectedModule} onValueChange={setSelectedModule}>
                  <SelectTrigger id="module" className="mt-1">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {filterOptions.modules.map((mod) => (
                      <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="action">Action</Label>
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger id="action" className="mt-1">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {filterOptions.actions.map((act) => (
                      <SelectItem key={act} value={act}>{act}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="user">User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="user" className="mt-1">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {filterOptions.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">From Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setTimePeriod('custom'); }}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="endDate">To Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setTimePeriod('custom'); }}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { setPage(1); fetchLogs(); }} className="bg-fcGold text-white hover:bg-fcGold/90">
                Apply Filters
              </Button>
              <Button variant="outline" onClick={handleResetFilters}>
                Reset
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total.toLocaleString()} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm mt-1">Activity will appear here as users interact with the system</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - Compact layout, no truncation, fits viewport */}
              <div className="hidden xl:block w-full min-w-0">
                <div className="w-full overflow-visible">
                  <table className="w-full divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '12%' }} /> {/* Date/Time */}
                      <col style={{ width: '15%' }} /> {/* User */}
                      <col style={{ width: '10%' }} /> {/* Action */}
                      <col style={{ width: '10%' }} /> {/* Module */}
                      <col style={{ width: '28%' }} /> {/* Description - largest */}
                      <col style={{ width: '15%' }} /> {/* Record ID */}
                      <col style={{ width: '10%' }} /> {/* Details */}
                    </colgroup>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Date/Time</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">User</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Module</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Record ID</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span className="text-[10px] font-mono leading-tight">{formatDate(log.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-fcGold/10 flex items-center justify-center flex-shrink-0">
                                <User className="w-3 h-3 text-fcGold" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-[10px] truncate" title={log.user?.name || 'System'}>
                                  {log.user?.name || 'System'}
                                </div>
                                <div className="text-[9px] text-gray-500 truncate" title={log.user?.email || '-'}>
                                  {log.user?.email || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5">{getActionBadge(log.action)}</td>
                          <td className="px-2 py-2.5">{getModuleBadge(log.module)}</td>
                          <td className="px-2 py-2.5">
                            <div className="min-w-0">
                              <span className="text-gray-700 text-[10px] break-words line-clamp-3" title={log.description}>
                                {log.description}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <code className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-mono break-all block" title={log.recordId}>
                              {log.recordId}
                            </code>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              className="hover:bg-fcGold/10 h-6 w-6 p-0"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="xl:hidden space-y-4">
                {logs.map((log) => (
                  <Card key={log.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-fcGold/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-fcGold" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 truncate">
                              {log.user?.name || 'System'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {log.user?.email || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getActionBadge(log.action)}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="hover:bg-fcGold/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="font-mono">{formatDate(log.createdAt)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getModuleBadge(log.module)}
                      </div>
                      
                      <div className="text-sm text-gray-700 line-clamp-2">
                        {log.description}
                      </div>
                      
                      <div className="pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Record ID</div>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                          {log.recordId}
                        </code>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 text-center sm:text-left">
                    Page {page} of {totalPages} ({total.toLocaleString()} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || loading}
                    >
                      <span className="hidden sm:inline mr-1">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-fcGold" />
                  Audit Log Details
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Date/Time</Label>
                  <p className="font-mono text-sm">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Branch</Label>
                  <p className="font-medium">{selectedLog.branch}</p>
                </div>
                <div>
                  <Label className="text-gray-500">User</Label>
                  <p className="font-medium">{selectedLog.user?.name || 'System'}</p>
                  <p className="text-sm text-gray-500">{selectedLog.user?.email}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Role</Label>
                  <p className="font-medium">{selectedLog.user?.role || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Action</Label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <Label className="text-gray-500">Module</Label>
                  <div className="mt-1">{getModuleBadge(selectedLog.module)}</div>
                </div>
              </div>

              <div>
                <Label className="text-gray-500">Description</Label>
                <p className="mt-1 text-gray-900">{selectedLog.description}</p>
              </div>

              <div>
                <Label className="text-gray-500">Record ID</Label>
                <code className="block mt-1 bg-gray-100 p-2 rounded text-sm font-mono break-all">
                  {selectedLog.recordId}
                </code>
              </div>

              {selectedLog.changes && (
                <div>
                  <Label className="text-gray-500">Changes</Label>
                  <pre className="mt-1 bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-w-full break-all">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button onClick={() => setSelectedLog(null)} className="w-full">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
