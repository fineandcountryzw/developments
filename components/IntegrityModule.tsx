
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Search, Clock, Database, ChevronDown, 
  User, History, Zap, Filter, CheckCircle2, AlertTriangle, 
  RefreshCw, Download, Terminal, Globe, Hash, Activity,
  Lock, CreditCard, HardDrive, Cpu, Fingerprint, Eye, 
  ShieldCheck, AlertCircle, Server, Network, Loader2,
  Fingerprint as FingerprintIcon, GitBranch, GitCommit,
  ShieldAlert
} from 'lucide-react';
import { Branch, AuditLog, SystemHealth } from '../types.ts';
import { supabaseMock } from '../services/supabase.ts';
import { getAuditLogs, getSystemHealth, getCommitManifest } from '../lib/db';

const IntegrityStyles = () => (
  <style>{`
    @keyframes pulse-gold {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(133, 117, 78, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(133, 117, 78, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(133, 117, 78, 0); }
    }
    .pulse-indicator-gold {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #85754E;
      animation: pulse-gold 2s infinite;
    }
    .tabular-precision { 
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
  `}</style>
);

const HeartbeatMonitor = ({ label, status, icon: Icon }: { label: string; status: 'online' | 'degraded' | 'offline'; icon: any }) => {
  const statusColors = {
    online: 'text-green-600 bg-green-50 border-green-200',
    degraded: 'text-amber-600 bg-amber-50 border-amber-200',
    offline: 'text-red-600 bg-red-50 border-red-200',
  };

  const statusLabels = {
    online: 'Operational',
    degraded: 'Degraded',
    offline: 'Offline',
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg hover:border-fcGold/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${statusColors[status]} transition-all`}>
          <Icon size={20} />
        </div>
        <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColors[status]}`}>
          {statusLabels[status]}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
        <h3 className="text-lg font-bold text-white">{statusLabels[status]}</h3>
      </div>
    </div>
  );
};

export const IntegrityModule: React.FC<{ activeBranch: Branch }> = ({ activeBranch }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    const [l, h, c] = await Promise.all([
      getAuditLogs(),
      getSystemHealth(),
      getCommitManifest()
    ]);
    setLogs(l as any);
    setHealth(h as any);
    setCommits(c);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => 
      l.actionSummary.toLowerCase().includes(search.toLowerCase()) ||
      l.changedBy.toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <IntegrityStyles />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Forensic Ledger</h1>
          <p className="text-sm text-gray-600 mt-1">
            System Integrity & Audit Trail Monitor • {activeBranch} Node
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-white text-white rounded-xl hover:bg-white transition-all disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
      
      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HeartbeatMonitor label="Paynow Gateway" status="online" icon={CreditCard} />
        <HeartbeatMonitor label="VCS Repository" status="online" icon={GitBranch} />
        <HeartbeatMonitor label="Database Cluster" status={health?.dbResponsive ? 'online' : 'degraded'} icon={Database} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Audit Activity Stream */}
        <div className="col-span-1 lg:col-span-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fcGold/20 rounded-lg text-fcGold">
                  <Terminal size={18} />
                </div>
                <h2 className="text-lg font-bold text-white">Forensic Activity Feed</h2>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="text" 
                  placeholder="Filter logs..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none w-56 transition-all"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {isLoading ? (
                <div className="h-[500px] flex flex-col items-center justify-center space-y-4">
                  <Loader2 size={32} className="animate-spin text-fcGold" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Loading Audit Trail...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="h-[500px] flex flex-col items-center justify-center space-y-4">
                  <AlertCircle size={32} className="text-gray-600" />
                  <p className="text-sm text-gray-600">No audit logs found</p>
                </div>
              ) : filteredLogs.slice(0, 50).map((log) => (
                <div key={log.id} className="p-6 hover:bg-white/50 transition-colors flex items-start space-x-4 group">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs text-white shadow-sm shrink-0 ${
                     log.actionType === 'INSERT' ? 'bg-green-600 border border-green-500' : 
                     log.actionType === 'UPDATE' ? 'bg-fcGold border border-fcGold' : 
                     'bg-red-600 border border-red-500'
                   }`}>
                      {log.actionType[0]}
                   </div>
                   <div className="flex-1 space-y-1 overflow-hidden">
                      <div className="flex justify-between items-baseline">
                        <div className="text-sm font-bold text-white truncate pr-2">{log.actionSummary}</div>
                        <span className="text-[9px] font-semibold text-gray-600 flex items-center shrink-0">
                          <Clock size={8} className="mr-1" />
                          {new Date(log.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">
                        Modified by: {log.changedBy}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="px-2 py-0.5 bg-fcGold/10 text-fcGold rounded text-[9px] font-bold uppercase tracking-wider">
                          {log.tableName.replace('_', ' ')}
                        </span>
                        {log.ipAddress && (
                          <span className="text-[9px] text-gray-600 font-mono">
                            {log.ipAddress}
                          </span>
                        )}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Status Panels */}
        <div className="col-span-1 lg:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg text-white space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fcGold/20 rounded-lg text-fcGold">
                  <GitBranch size={18} />
                </div>
                <h3 className="text-lg font-bold text-white">Version Control</h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Automated CI/CD pipeline tracking every commit and deployment across regional nodes.
              </p>
              
              <div className="space-y-3 pt-4 border-t border-gray-200">
                 {commits.slice(0, 5).map(commit => (
                   <div key={commit.id} className="flex items-start space-x-3 group">
                      <div className="p-1.5 bg-white rounded group-hover:bg-fcGold/20 transition-all shrink-0">
                         <GitCommit size={12} className="text-fcGold" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                         <div className="text-[10px] font-bold text-white truncate">
                            <span className="text-fcGold">{commit.type}:</span> {commit.msg}
                         </div>
                         <div className="flex items-center space-x-2 text-[9px] text-gray-600">
                            <span>{commit.author}</span>
                            <span>•</span>
                            <span>{commit.time}</span>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center space-x-3">
                 <div className="p-2 bg-white rounded-lg text-gray-900">
                   <ShieldAlert size={18} />
                 </div>
                 <h4 className="text-lg font-bold text-gray-900">System Status</h4>
              </div>
              <div className="space-y-4">
                 {[
                   { label: 'Harare Node', val: 'Operational', color: 'text-green-600' },
                   { label: 'Bulawayo Node', val: 'Operational', color: 'text-green-600' },
                   { label: 'Auth Protocol', val: 'JWT-256', color: 'text-gray-600' },
                   { label: 'Deployment', val: 'Production', color: 'text-fcGold' }
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="text-xs font-medium text-gray-600">{item.label}</span>
                      <span className={`text-xs font-bold font-mono ${item.color}`}>{item.val}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
