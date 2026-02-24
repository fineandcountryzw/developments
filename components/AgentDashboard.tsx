import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Layout, Loader2, FileText } from 'lucide-react';
import { getAgentCommissions, getAgentClients } from '../lib/db';
import { CommissionTracker } from './CommissionTracker.tsx';
import { AgentClients } from './AgentClients.tsx';

/**
 * Agent Dashboard - High-Performance Terminal
 * Displays only: Commissions, My Pipeline, My Clients
 * All data strictly filtered by agent_id
 * Supports external activeTab control from App.tsx
 */

interface AgentDashboardProps {
  agentId: string;
  agentName: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ 
  agentId, 
  agentName,
  activeTab: externalActiveTab,
  onTabChange
}) => {
  const [internalActiveModule, setInternalActiveModule] = useState<'commissions' | 'clients' | 'receipts'>('commissions');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCommission: 0,
    activeDeals: 0,
    totalClients: 0,
    totalReceiptsAmount: 0
  });

  // Map external activeTab to internal module
  useEffect(() => {
    if (externalActiveTab === 'dashboard') {
      setInternalActiveModule('commissions');
    } else if (externalActiveTab === 'portfolio') {
      setInternalActiveModule('clients');
    } else if (externalActiveTab === 'receipts') {
      setInternalActiveModule('receipts');
    }
  }, [externalActiveTab]);

  useEffect(() => {
    loadAgentStats();
  }, [agentId]);

  const loadAgentStats = async () => {
    setIsLoading(true);
    try {
      // Fetch only data attributed to this agent
      const [commissionData, clientsData] = await Promise.all([
        getAgentCommissions(agentId),
        getAgentClients(agentId)
      ]);

      const totalCommission = commissionData.reduce((sum: number, c: any) => sum + c.amount, 0);
      
      // Fetch agent's client receipts
      const agentClientsData = clientsData;
      let totalReceiptsAmount = 0;
      
      if (agentClientsData.length > 0) {
        try {
          const clientIds = agentClientsData.map((c: any) => c.id).join(',');
          const receiptRes = await fetch(`/api/admin/receipts?clientId=${clientIds}`);
          if (receiptRes.ok) {
            const receipts = await receiptRes.json();
            totalReceiptsAmount = receipts.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
          }
        } catch (error) {
          console.error('[AGENT_DASHBOARD] Failed to fetch receipts:', error);
        }
      }
      
      setStats({
        totalCommission,
        activeDeals: 0,
        totalClients: clientsData.length,
        totalReceiptsAmount
      });
    } catch (error) {
      console.error('[AGENT_DASHBOARD] Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleChange = (module: 'commissions' | 'clients' | 'receipts') => {
    setInternalActiveModule(module);
    // Notify parent App.tsx of tab change
    if (onTabChange) {
      const tabMap = {
        'commissions': 'dashboard',
        'clients': 'portfolio',
        'receipts': 'receipts'
      };
      onTabChange(tabMap[module]);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-8 animate-in fade-in duration-700 pb-20 font-sans">
      
      {/* Agent Header */}
      <div className="bg-gradient-to-r from-fcGold to-fcGold/80 rounded-2xl p-8 text-white shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Agent Terminal</h1>
              <p className="text-sm font-bold uppercase tracking-widest opacity-90 mt-1">
                {agentName}
              </p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <TrendingUp size={32} />
            </div>
          </div>

          {/* Quick Stats */}
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading your performance...</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Commission</div>
                <div className="text-2xl font-black mt-1">${stats.totalCommission.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Active Deals</div>
                <div className="text-2xl font-black mt-1">{stats.activeDeals}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">My Clients</div>
                <div className="text-2xl font-black mt-1">{stats.totalClients}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Client Receipts</div>
                <div className="text-2xl font-black mt-1">${stats.totalReceiptsAmount.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Module Navigation */}
      <div className="flex space-x-3 bg-white rounded-2xl p-2 shadow-sm border border-fcDivider overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleModuleChange('commissions')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'commissions'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <TrendingUp size={16} className="inline mr-2" />
          Commissions
        </button>
        <button
          onClick={() => handleModuleChange('clients')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'clients'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <Users size={16} className="inline mr-2" />
          My Clients
        </button>
        <button
          onClick={() => handleModuleChange('receipts')}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'receipts'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <FileText size={16} className="inline mr-2" />
          Receipts
        </button>
      </div>

      {/* Active Module */}
      <div className="min-h-[600px]">
        {internalActiveModule === 'commissions' && <CommissionTracker agentId={agentId} />}
        {internalActiveModule === 'clients' && <AgentClients agentId={agentId} agentName={agentName} />}
        {internalActiveModule === 'receipts' && (
          <div className="bg-white rounded-2xl p-8 border border-fcDivider">
            <h3 className="text-2xl font-black text-fcSlate mb-6">Client Payment Receipts</h3>
            <p className="text-gray-600 mb-4">View all receipts generated for your client payments.</p>
            <div className="p-12 bg-fcGold/5 rounded-xl border border-fcGold/20 text-center">
              <FileText size={48} className="mx-auto text-fcGold/50 mb-4" />
              <p className="text-gray-600">Receipt details loading...</p>
              <p className="text-sm text-gray-500 mt-2">Total Client Receipts: ${stats.totalReceiptsAmount.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
