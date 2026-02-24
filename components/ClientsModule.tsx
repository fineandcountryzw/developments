'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Download, Eye, X, ChevronRight,
  DollarSign, Clock, CheckCircle2, Building2, 
  Mail, Phone, FileText, TrendingUp, AlertCircle,
  Loader2, Calendar, Receipt, Landmark, User,
  Filter, ArrowUpDown, RefreshCw, Plus, UserPlus
} from 'lucide-react';
import { SkeletonLoader } from './SkeletonLoader';
import { logger } from '@/lib/logger';
import { cachedFetch } from '@/lib/api-cache';
import { useDebounce } from '@/hooks/useDebounce';
import { useRealtime } from '@/hooks/useRealtime';
import { PageContainer, SectionHeader, KPIGrid, ResponsiveTable } from '@/components/layouts';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationalId?: string;
  branch: string;
  isPortalUser?: boolean;
  kycStatus?: string;
  createdAt: string;
  payments?: any[];
  reservations?: any[];
}

interface Payment {
  id: string;
  clientId: string;
  standId?: string;
  amountUsd: number;
  surchargeAmount: number;
  paymentMethod: string;
  paymentType: string;
  officeLocation: string;
  reference: string;
  manualReceiptNo?: string;
  description: string;
  createdAt: string;
  verificationStatus: string;
}

interface Stand {
  id: string;
  number: string;
  status: string;
  priceUsd: number;
  areaSqm: number;
  developmentName: string;
}

interface StatementData {
  client: Client;
  payments: Payment[];
  stands: Stand[];
  summary: {
    totalPaid: number;
    totalVerified: number;
    totalPending: number;
    totalContractValue: number;
    outstandingBalance: number;
    paymentCount: number;
    verifiedCount: number;
    pendingCount: number;
    standCount: number;
  };
}

interface ClientsModuleProps {
  activeBranch?: string;
}

export const ClientsModule: React.FC<ClientsModuleProps> = ({ activeBranch = 'Harare' }) => {
  // Initialize with empty array and ensure it's always an array
  const [clients, setClients] = useState<Client[]>(() => []);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [branchFilter, setBranchFilter] = useState<'All' | 'Harare' | 'Bulawayo'>('All');
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Statement modal state
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Add Client modal state
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    nationalId: '',
    branch: activeBranch || 'Harare'
  });

  // Real-time updates for clients
  useRealtime({
    onClient: async (event) => {
      if (event.action === 'created' || event.action === 'updated') {
        // Refresh clients list
        await fetchClients();
      } else if (event.action === 'deleted') {
        // Remove client from list
        setClients(prev => Array.isArray(prev) ? prev.filter(c => c.id !== event.payload?.id) : []);
      }
    },
    enabled: true
  });

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const json = await cachedFetch<{ data: Client[] }>('/api/admin/clients');
      // Ensure json.data is an array before setting state
      let clientsData: Client[] = [];
      if (json && typeof json === 'object' && 'data' in json) {
        if (Array.isArray(json.data)) {
          clientsData = json.data;
        } else {
          logger.warn('API returned non-array data', { module: 'ClientsModule', data: json.data, type: typeof json.data });
        }
      } else {
        logger.warn('API returned unexpected structure', { module: 'ClientsModule', json });
      }
      setClients(clientsData);
      logger.info('Clients fetched successfully', { module: 'ClientsModule', count: clientsData.length });
    } catch (error) {
      logger.error('Failed to fetch clients', error instanceof Error ? error : undefined, { module: 'ClientsModule' });
      // Ensure clients is always an array even on error
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new client
  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.email) {
      setCreateError('Name and email are required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newClient.email)) {
      setCreateError('Please enter a valid email address');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    // Optimistic update: Add client to UI immediately
    const optimisticClient: Client = {
      id: `temp-${Date.now()}`,
      name: newClient.name.trim(),
      email: newClient.email.trim().toLowerCase(),
      phone: newClient.phone.trim() || '',
      nationalId: newClient.nationalId.trim() || undefined,
      branch: newClient.branch,
      isPortalUser: false,
      createdAt: new Date().toISOString(),
    };
    
    setClients(prev => Array.isArray(prev) ? [optimisticClient, ...prev] : [optimisticClient]);
    
    // Close modal immediately for better UX
    setIsAddClientOpen(false);
    const clientData = {
      name: newClient.name.trim(),
      email: newClient.email.trim().toLowerCase(),
      phone: newClient.phone.trim() || null,
      nationalId: newClient.nationalId.trim() || null,
      branch: newClient.branch
    };
    
    setNewClient({
      name: '',
      email: '',
      phone: '',
      nationalId: '',
      branch: activeBranch || 'Harare'
    });

    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create client');
      }

      // Success - refresh to get server data (replaces optimistic update)
      await fetchClients();
    } catch (error: any) {
      logger.error('Failed to create client', error, { module: 'ClientsModule' });
      
      // Rollback optimistic update on error
      setClients(prev => Array.isArray(prev) ? prev.filter(c => c.id !== optimisticClient.id) : []);
      
      // Reopen modal so user can fix and retry
      setIsAddClientOpen(true);
      setNewClient({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone || '',
        nationalId: clientData.nationalId || '',
        branch: clientData.branch
      });
      
      setCreateError(error.message || 'Failed to create client');
    } finally {
      setIsCreating(false);
    }
  };

  // Filter and sort clients (using debounced search term)
  const filteredClients = useMemo(() => {
    // Defensive check: ensure clients is always an array
    // This is a critical safety check to prevent "filter is not a function" errors
    if (!clients) {
      logger.warn('clients is null/undefined in filteredClients', { module: 'ClientsModule' });
      return [];
    }
    
    if (!Array.isArray(clients)) {
      logger.error('clients is not an array in filteredClients', { 
        module: 'ClientsModule', 
        clientsValue: String(clients), 
        type: typeof clients,
        isArray: Array.isArray(clients)
      });
      // Force reset to empty array to prevent further errors
      setClients([]);
      return [];
    }
    
    let result = clients.filter(c => {
      if (!c || !c.id) return false;
      
      try {
        const name = (c.name || '').toString();
        const email = (c.email || '').toString();
        const phone = (c.phone || '').toString();
        const nationalIdVal = (c.nationalId || '').toString();
        const query = (debouncedSearchTerm || '').toString();
        const branch = (c.branch || '').toString();
        
        const matchesSearch = 
          name.toLowerCase().includes(query.toLowerCase()) ||
          email.toLowerCase().includes(query.toLowerCase()) ||
          phone.includes(query) ||
          (nationalIdVal && nationalIdVal.toLowerCase().includes(query.toLowerCase()));
        
        const matchesBranch = branchFilter === 'All' || branch === branchFilter;
        
        return matchesSearch && matchesBranch;
      } catch (err) {
        logger.warn('Error filtering client', { module: 'ClientsModule', error: err, clientId: c?.id });
        return false;
      }
    });

    // Sort
    try {
      result.sort((a, b) => {
        if (sortField === 'name') {
          const nameA = (a.name || '').toString();
          const nameB = (b.name || '').toString();
          return sortOrder === 'asc' 
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
        } else {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortOrder === 'asc'
            ? dateA - dateB
            : dateB - dateA;
        }
      });
    } catch (err) {
      logger.warn('Error sorting clients', { module: 'ClientsModule', error: err });
    }

    return result;
  }, [clients, debouncedSearchTerm, branchFilter, sortField, sortOrder]);

  // Stats calculations
  const stats = useMemo(() => {
    if (!Array.isArray(clients)) {
      return { totalClients: 0, harareClients: 0, bulawayoClients: 0, portalUsers: 0 };
    }
    
    const totalClients = filteredClients.length;
    const harareClients = clients.filter(c => c && c.branch === 'Harare').length;
    const bulawayoClients = clients.filter(c => c && c.branch === 'Bulawayo').length;
    const portalUsers = clients.filter(c => c && c.isPortalUser).length;
    
    return { totalClients, harareClients, bulawayoClients, portalUsers };
  }, [clients, filteredClients]);

  // View client statement
  const handleViewStatement = async (clientId: string) => {
    setSelectedClientId(clientId);
    setIsStatementOpen(true);
    setIsStatementLoading(true);
    
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/statement`);
      const json = await res.json();
      if (json.data) {
        setStatementData(json.data);
      }
    } catch (error) {
      logger.error('Failed to fetch statement', error instanceof Error ? error : undefined, { module: 'ClientsModule', clientId });
    } finally {
      setIsStatementLoading(false);
    }
  };

  // Download statement PDF
  const handleDownloadStatement = async (clientId: string) => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/statement/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Statement_${statementData?.client.name.replace(/\s+/g, '_') || 'Client'}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      logger.error('Failed to download statement', error instanceof Error ? error : undefined, { module: 'ClientsModule', clientId });
    } finally {
      setIsDownloading(false);
    }
  };

  const closeStatement = () => {
    setIsStatementOpen(false);
    setSelectedClientId(null);
    setStatementData(null);
  };

  const toggleSort = (field: 'name' | 'createdAt') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <PageContainer className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <SectionHeader
        title={
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-fcGold/10 rounded-xl">
              <Users size={24} className="sm:w-7 sm:h-7 text-fcGold" />
            </div>
            <span>Client Center</span>
          </div>
        }
        description="Manage clients and view statements"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsAddClientOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-fcGold text-white rounded-lg sm:rounded-xl hover:bg-fcGold/90 transition-colors shadow-sm text-sm font-medium"
            >
              <UserPlus size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Add Client</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button 
              onClick={fetchClients}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <RefreshCw size={14} className="sm:w-4 sm:h-4 text-gray-600" />
              <span className="hidden sm:inline text-gray-700">Refresh</span>
              <span className="sm:hidden text-gray-700">↻</span>
            </button>
          </div>
        }
      />

      {/* Stats Cards */}
      <KPIGrid>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-fcGold/10 rounded-lg">
              <Users size={20} className="text-fcGold" />
            </div>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalClients}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Clients</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Building2 size={20} className="text-gray-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.harareClients}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Harare Clients</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Building2 size={20} className="text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.bulawayoClients}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bulawayo Clients</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.portalUsers}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Portal Users</div>
        </div>
      </KPIGrid>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
        {/* Branch Filter */}
        <div className="flex bg-white p-1 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm">
          {(['All', 'Harare', 'Bulawayo'] as const).map(branch => (
            <button
              key={branch}
              onClick={() => setBranchFilter(branch)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
                branchFilter === branch 
                  ? 'bg-fcGold text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search size={16} className="sm:w-[18px] sm:h-[18px] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-11 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-fcGold focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-gray-200">
              <Users size={20} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Client Registry</h3>
              <p className="text-xs text-gray-500">Click on a client to view their statement</p>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden xl:block w-full min-w-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-600 uppercase">
                <th 
                  className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Client
                    <ArrowUpDown size={14} className={sortField === 'name' ? 'text-fcGold' : 'text-gray-400'} />
                  </div>
                </th>
                <th className="px-6 py-4 text-left">Contact</th>
                <th className="px-6 py-4 text-left">Branch</th>
                <th className="px-6 py-4 text-left">ID Number</th>
                <th 
                  className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    Joined
                    <ArrowUpDown size={14} className={sortField === 'createdAt' ? 'text-fcGold' : 'text-gray-400'} />
                  </div>
                </th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                // Skeleton loaders for table rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <SkeletonLoader height="h-10" width="w-10" rounded />
                        <div className="space-y-2 flex-1">
                          <SkeletonLoader height="h-4" width="w-32" />
                          <SkeletonLoader height="h-3" width="w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <SkeletonLoader height="h-3" width="w-40" />
                        <SkeletonLoader height="h-3" width="w-32" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <SkeletonLoader height="h-6" width="w-20" rounded />
                    </td>
                    <td className="px-6 py-4">
                      <SkeletonLoader height="h-4" width="w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <SkeletonLoader height="h-4" width="w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <SkeletonLoader height="h-6" width="w-24" rounded />
                    </td>
                    <td className="px-6 py-4">
                      <SkeletonLoader height="h-8" width="w-20" rounded />
                    </td>
                  </tr>
                ))
              ) : filteredClients.length > 0 ? (
                filteredClients.map(client => (
                  <tr 
                    key={client.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewStatement(client.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-fcGold/10 flex items-center justify-center text-sm font-semibold text-fcGold">
                          {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{client.name}</div>
                          <div className="text-xs text-gray-500">ID: {client.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail size={12} className="text-gray-400" />
                          {client.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone size={12} className="text-gray-400" />
                          {client.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        client.branch === 'Harare' 
                          ? 'bg-gray-100 text-gray-700 border border-gray-200' 
                          : 'bg-fcGold/10 text-fcGold border border-fcGold/20'
                      }`}>
                        {client.branch}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {client.nationalId ? (
                        <span className="text-sm font-mono text-gray-700">{client.nationalId}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Calendar size={12} className="text-gray-400" />
                        {new Date(client.createdAt).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.isPortalUser ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 size={12} />
                          Portal User
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                          <User size={12} />
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewStatement(client.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-fcGold hover:bg-fcGold/10 transition-colors"
                      >
                        <Eye size={14} />
                        Statement
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                      <Users size={48} />
                      <p className="text-sm font-medium">No clients found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="xl:hidden space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-card-${i}`} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <SkeletonLoader height="h-12" width="w-12" rounded />
                  <div className="flex-1 space-y-2">
                    <SkeletonLoader height="h-4" width="w-32" />
                    <SkeletonLoader height="h-3" width="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <SkeletonLoader height="h-3" width="w-full" />
                  <SkeletonLoader height="h-3" width="w-3/4" />
                </div>
              </div>
            ))
          ) : filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => handleViewStatement(client.id)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-fcGold hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-fcGold/10 flex items-center justify-center text-sm font-semibold text-fcGold flex-shrink-0">
                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{client.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="truncate">{client.email}</span>
                      <span>•</span>
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.branch === 'Harare' 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-fcGold/10 text-fcGold'
                      }`}>
                        {client.branch}
                      </span>
                      {client.isPortalUser && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          <CheckCircle2 size={10} />
                          Portal
                        </span>
                      )}
                    </div>
                    {client.nationalId && (
                      <div className="text-xs text-gray-600 font-mono mb-2">ID: {client.nationalId}</div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} />
                      Joined {new Date(client.createdAt).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewStatement(client.id);
                  }}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-fcGold hover:bg-fcGold/10 transition-colors border border-fcGold/20"
                >
                  <Eye size={14} />
                  View Statement
                </button>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="flex flex-col items-center gap-4 text-gray-400">
                <Users size={48} />
                <p className="text-sm font-medium">No clients found</p>
                <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isCreating && setIsAddClientOpen(false)} />
          <div className="relative bg-white w-full max-w-full sm:max-w-lg xl:max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-fcGold/10 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/20 rounded-lg">
                  <UserPlus size={22} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add New Client</h3>
                  <p className="text-sm text-gray-500">Enter client details below</p>
                </div>
              </div>
              <button 
                onClick={() => !isCreating && setIsAddClientOpen(false)}
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
                    value={newClient.name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
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
                    value={newClient.email}
                    onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
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
                    value={newClient.phone}
                    onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+263 77 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* National ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  National ID
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={newClient.nationalId}
                    onChange={(e) => setNewClient(prev => ({ ...prev, nationalId: e.target.value }))}
                    placeholder="63-123456A78"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={newClient.branch}
                    onChange={(e) => setNewClient(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fcGold/50 focus:border-fcGold transition-colors appearance-none bg-white"
                    disabled={isCreating}
                  >
                    <option value="Harare">Harare</option>
                    <option value="Bulawayo">Bulawayo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setIsAddClientOpen(false);
                  setCreateError(null);
                  setNewClient({
                    name: '',
                    email: '',
                    phone: '',
                    nationalId: '',
                    branch: activeBranch || 'Harare'
                  });
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClient}
                disabled={isCreating || !newClient.name || !newClient.email}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span className="text-sm font-medium">Create Client</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {isStatementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeStatement} />
          <div className="relative bg-white w-full max-w-full sm:max-w-2xl xl:max-w-4xl max-h-[90vh] rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fcGold/10 rounded-lg">
                  <FileText size={24} className="text-fcGold" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Client Statement</h3>
                  <p className="text-sm text-gray-500">
                    {statementData?.client.name || 'Loading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statementData && (
                  <button 
                    onClick={() => handleDownloadStatement(selectedClientId!)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-fcGold text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    <span className="text-sm font-medium">Download PDF</span>
                  </button>
                )}
                <button 
                  onClick={closeStatement} 
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {isStatementLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={40} className="animate-spin text-fcGold" />
                  <p className="text-sm text-gray-500">Loading statement...</p>
                </div>
              ) : statementData ? (
                <>
                  {/* Client Info Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-fcGold/10 flex items-center justify-center text-fcGold font-bold text-xl">
                          {statementData.client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{statementData.client.name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {statementData.client.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {statementData.client.phone}
                            </span>
                          </div>
                          {statementData.client.nationalId && (
                            <div className="text-xs text-gray-500 mt-1">
                              ID: {statementData.client.nationalId}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        statementData.client.branch === 'Harare' 
                          ? 'bg-gray-200 text-gray-700' 
                          : 'bg-fcGold/20 text-fcGold'
                      }`}>
                        {statementData.client.branch}
                      </span>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Paid</span>
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        ${statementData.summary.totalVerified.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-amber-600" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Outstanding</span>
                      </div>
                      <div className="text-xl font-bold text-amber-600">
                        ${statementData.summary.outstandingBalance.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 size={16} className="text-fcGold" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Contract Value</span>
                      </div>
                      <div className="text-xl font-bold text-fcGold">
                        ${statementData.summary.totalContractValue.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt size={16} className="text-blue-600" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Payments</span>
                      </div>
                      <div className="text-xl font-bold text-blue-600">
                        {statementData.summary.paymentCount}
                      </div>
                    </div>
                  </div>

                  {/* Properties */}
                  {statementData.stands.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h4 className="font-semibold text-gray-900">Property Holdings</h4>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {statementData.stands.map(stand => (
                          <div key={stand.id} className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-fcGold/10 rounded-lg">
                                <Building2 size={18} className="text-fcGold" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">Stand #{stand.number}</div>
                                <div className="text-sm text-gray-500">{stand.developmentName} • {stand.areaSqm} m²</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gray-900">${stand.priceUsd.toLocaleString()}</div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                stand.status === 'SOLD' ? 'bg-green-100 text-green-700' :
                                stand.status === 'RESERVED' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {stand.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment History */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-900">Payment History</h4>
                    </div>
                    {statementData.payments.length > 0 ? (
                      <div className="w-full min-w-0 overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-xs font-semibold text-gray-600 uppercase">
                              <th className="px-6 py-3 text-left">Date</th>
                              <th className="px-6 py-3 text-left">Reference</th>
                              <th className="px-6 py-3 text-left">Description</th>
                              <th className="px-6 py-3 text-left">Method</th>
                              <th className="px-6 py-3 text-left">Status</th>
                              <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {statementData.payments.map(payment => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-900">
                                    {new Date(payment.createdAt).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs font-mono text-gray-600">{payment.reference}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-900">{payment.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    payment.paymentMethod === 'Bank' 
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-green-50 text-green-700 border border-green-200'
                                  }`}>
                                    {payment.paymentMethod}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                                    payment.verificationStatus === 'Verified'
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {payment.verificationStatus === 'Verified' ? (
                                      <CheckCircle2 size={10} />
                                    ) : (
                                      <Clock size={10} />
                                    )}
                                    {payment.verificationStatus}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="text-sm font-bold text-gray-900">
                                    ${payment.amountUsd.toLocaleString()}
                                  </div>
                                  {payment.surchargeAmount > 0 && (
                                    <div className="text-xs text-amber-600">
                                      +${payment.surchargeAmount.toFixed(2)} fee
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Landmark size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">No payments recorded</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <AlertCircle size={40} className="text-red-400" />
                  <p className="text-sm text-gray-500">Failed to load statement</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ClientsModule;
