
import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, TrendingUp, ShieldCheck,
  Settings, UserPlus, Filter, MoreHorizontal,
  ArrowUpRight, Download, Edit3, Briefcase,
  MapPin, Mail, Phone, Loader2, CheckCircle2
} from 'lucide-react';
import { Profile, Branch, Role } from '../types.ts';
import { NotificationBell } from './NotificationBell';
import { getAgents, updateAgentProfile } from '../lib/db';

interface AgentManagementProps {
  activeBranch: Branch;
}

// Fixed: Use React.FC to ensure standard React props like 'key' are handled correctly by the type checker
const PerformanceBar: React.FC<{ agent: Profile }> = ({ agent }) => {
  // Mock max for scaling (e.g., $300k target)
  const maxCommission = 250000;
  const percentage = Math.min(((agent.totalRealizedCommission || 0) / maxCommission) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-white border border-fcDivider flex items-center justify-center text-[10px] font-bold text-fcGold">
            {agent.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">{agent.name}</span>
            <span className="text-[10px] text-gray-600 font-bold ml-2">({agent.totalSalesCount} sales)</span>
          </div>
        </div>
        <span className="text-sm font-bold text-fcGold">
          ${(agent.totalRealizedCommission || 0).toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full relative overflow-hidden">
        <div
          className="absolute inset-0 bg-fcGold transition-all duration-1000 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-[9px] font-bold text-gray-600 tracking-wider uppercase">
        <span>Commission Realization</span>
        <span>{percentage.toFixed(0)}%</span>
      </div>
    </div>
  );
};

export const AgentManagement: React.FC<AgentManagementProps> = ({ activeBranch }) => {
  const [agents, setAgents] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchAgents = async () => {
    setIsLoading(true);
    const data = await getAgents(activeBranch);
    setAgents(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, [activeBranch]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.phone && a.phone.includes(searchQuery))
    );
  }, [agents, searchQuery]);

  const handleUpdateBranch = async (id: string, branch: Branch) => {
    setIsUpdating(id);
    await updateAgentProfile(id, { assignedBranch: branch });
    await fetchAgents();
    setIsUpdating(null);
  };

  return (
    <div className="max-w-screen-xl mx-auto space-y-10 animate-in fade-in duration-700 pb-32">

      {/* Search Bar - Minimalist Bottom Border */}
      <div className="flex justify-between items-center mb-8">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
          <input
            type="text"
            placeholder="Search agents by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-b border-slate-200 pl-8 pr-4 py-3 text-sm font-medium focus:border-fcGold outline-none transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 text-[10px] font-bold text-gray-600 hover:text-fcGold uppercase tracking-widest transition-colors">
            <Download size={14} />
            <span>Export Registry</span>
          </button>
          <button className="bg-fcGold text-white px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-fcGold/20 hover:brightness-110 transition-all flex items-center space-x-2">
            <UserPlus size={14} />
            <span>Invite Agent</span>
          </button>
          <div className="flex items-center space-x-2">
            <select
              value={selectedAgentId ?? ''}
              onChange={(e) => setSelectedAgentId(e.target.value || null)}
              className="text-[10px] font-bold uppercase tracking-widest border border-slate-200 rounded-md px-2 py-1 text-gray-600 bg-white"
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <NotificationBell
              recipientType={selectedAgentId ? 'Agent' : undefined}
              recipientId={selectedAgentId ?? undefined}
              branch={activeBranch}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Commission Performance Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-fcDivider shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-fcGold/10 rounded-xl text-fcGold">
                  <TrendingUp size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Agent Performance</h3>
              </div>
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{activeBranch} Office</span>
            </div>

            <div className="space-y-10">
              {agents.length > 0 ? (
                // Fixed: Added spread operator to avoid in-place mutation of the agents array during sorting
                [...agents].sort((a, b) => (b.totalRealizedCommission || 0) - (a.totalRealizedCommission || 0)).map(agent => (
                  <PerformanceBar key={agent.id} agent={agent} />
                ))
              ) : (
                <div className="py-20 text-center opacity-30">
                  <Briefcase size={40} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No active sales detected</p>
                </div>
              )}
            </div>

            <button className="w-full mt-10 py-4 text-[10px] font-bold text-gray-600 hover:text-fcGold border-t border-slate-50 transition-colors uppercase tracking-[0.2em]">
              View Historical Yields
            </button>
          </div>

          <div className="bg-fcGold p-8 rounded-2xl shadow-xl shadow-fcGold/10 text-white relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <ShieldCheck size={160} />
            </div>
            <h3 className="text-sm font-bold opacity-80 mb-2">Portfolio Protection</h3>
            <p className="text-xl font-bold leading-tight mb-6 tracking-tight">Administrative oversight for the Zimbabwe network.</p>
            <div className="flex items-center space-x-2 text-[10px] font-bold bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <ShieldCheck size={14} />
              <span className="uppercase tracking-widest">Compliance Active</span>
            </div>
          </div>
        </div>

        {/* Agent List Card */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-fcDivider shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-white rounded-xl text-gray-600">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Agent Registry</h3>
                  <p className="text-xs text-gray-600 font-medium">Manage localized profile parameters and RBAC status.</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                <Filter size={14} />
                <span>All States</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/50 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
                    <th className="px-8 py-5">Profile</th>
                    <th className="px-8 py-5">Branch Status</th>
                    <th className="px-8 py-5">Productivity</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center space-y-4">
                          <Loader2 className="animate-spin text-fcGold" size={24} />
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Synchronizing Registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAgents.length > 0 ? (
                    filteredAgents.map(agent => (
                      <tr key={agent.id} className="group hover:bg-white/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-fcCream border border-fcDivider flex items-center justify-center text-fcGold font-bold text-xs shadow-sm group-hover:bg-white transition-colors">
                              {agent.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900 tracking-tight">{agent.name}</div>
                              <div className="text-[10px] font-medium text-gray-600 lowercase">{agent.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-6">
                            {(['Harare', 'Bulawayo'] as Branch[]).map(branch => (
                              <button
                                key={branch}
                                onClick={() => handleUpdateBranch(agent.id, branch)}
                                disabled={isUpdating === agent.id}
                                className={`text-[10px] font-bold tracking-widest transition-all border-b-2 pb-1 uppercase ${agent.assignedBranch === branch
                                    ? 'text-fcGold border-fcGold'
                                    : 'text-slate-300 border-transparent hover:text-gray-600'
                                  }`}
                              >
                                {branch}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-gray-900">${(agent.totalRealizedCommission || 0).toLocaleString()}</div>
                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Realized</div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="text-[10px] font-bold text-gray-600 hover:text-fcGold uppercase tracking-widest px-4 py-2 border border-slate-100 rounded-lg hover:bg-white transition-all">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-600 text-sm">
                        No agents match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white/50 p-6 flex justify-between items-center border-t border-slate-50">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                Showing {filteredAgents.length} agents across the Zimbabwe network
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-slate-300 hover:text-gray-600 transition-colors">
                  <Settings size={16} />
                </button>
                <button className="p-2 text-slate-300 hover:text-gray-600 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
